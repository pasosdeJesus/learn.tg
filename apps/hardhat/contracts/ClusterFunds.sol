// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ClusterFunds
 * @author learn.tg
 * @notice Manages USDT and SLEARN donations for clusters and countries.
 * Funds accumulate until released by pdJ admin after GD contact verification.
 *
 * Phase 1: Donations, fund accumulation, admin release.
 * Phase 2 (post-pilot): AAVE yield for idle USDT.
 *
 * Security: Uses OpenZeppelin's SafeERC20, ReentrancyGuard, and Ownable.
 * Emergency withdrawals are restricted to contract balances with timelock.
 */
contract ClusterFunds is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──── State ────

    IERC20 public immutable usdtToken;
    IERC20 public immutable slearnToken;
    address public pdjTreasury;
    uint8 public pdjPercentage = 15; // fixed at 15%, configurable 5-30 in steps of 5

    struct ClusterFund {
        uint256 usdtBalance;
        uint256 slearnBalance;
        bool exists;
        bool verified;
    }

    struct CountryFund {
        uint256 usdtBalance;
        uint256 slearnBalance;
        bool exists;
        bool verified;
    }

    mapping(address => ClusterFund) public clusterFunds;      // clusterWallet → fund
    mapping(string => CountryFund) public countryFunds;       // countryCode → fund
    mapping(bytes32 => bool) public processedTx;              // replay protection

    // Emergency withdrawal timelock
    uint256 public emergencyWithdrawTimelock = 7 days;        // 7-day delay
    mapping(bytes32 => uint256) public emergencyWithdrawRequests; // requestId → timestamp

    // ──── Events ────

    event ClusterDonation(address indexed donor, address indexed clusterWallet, uint256 usdtAmount, uint256 slearnAmount);
    event CountryDonation(address indexed donor, string countryCode, uint256 usdtAmount, uint256 slearnAmount);
    event CountryFundsRedistributed(string countryCode, uint256 usdtPerCluster, uint256 slearnPerCluster, uint256 clusterCount_);
    event ClusterFundsReleased(address indexed clusterWallet, uint256 usdtAmount, uint256 slearnAmount);
    event CountryFundsReleased(string countryCode, address indexed recipient, uint256 usdtAmount, uint256 slearnAmount);
    event ClusterRemoved(address indexed clusterWallet, string countryCode, uint256 usdtAmount, uint256 slearnAmount);
    event ClusterVerified(address indexed clusterWallet, bool verified);
    event PdjTreasuryUpdated(address indexed newTreasury);
    event PdjPercentageUpdated(uint8 newPercentage);
    event PdjFeeDeducted(uint256 usdtAmount, uint256 slearnAmount);
    event EmergencyWithdrawRequested(bytes32 indexed requestId, address indexed token, uint256 amount, uint256 releaseTime);
    event EmergencyWithdrawExecuted(bytes32 indexed requestId, address indexed token, uint256 amount);

    // ──── Constructor ────

    constructor(
        address _usdt,
        address _slearn,
        address _pdjTreasury,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_usdt != address(0), "Invalid USDT");
        require(_slearn != address(0), "Invalid SLEARN");
        require(_pdjTreasury != address(0), "Invalid treasury");
        usdtToken = IERC20(_usdt);
        slearnToken = IERC20(_slearn);
        pdjTreasury = _pdjTreasury;
    }

    // ──── Admin ────

    function setPdJTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        pdjTreasury = _treasury;
        emit PdjTreasuryUpdated(_treasury);
    }

    function setPdJPercentage(uint8 _pct) external onlyOwner {
        require(_pct >= 5, "Min 5%");
        require(_pct <= 30, "Max 30%");
        require(_pct % 5 == 0, "Steps of 5");
        pdjPercentage = _pct;
        emit PdjPercentageUpdated(_pct);
    }

    function setClusterVerification(address _clusterWallet, bool _verified) external onlyOwner {
        require(_clusterWallet != address(0), "Zero address");
        require(clusterFunds[_clusterWallet].exists, "Cluster not found");
        clusterFunds[_clusterWallet].verified = _verified;
        emit ClusterVerified(_clusterWallet, _verified);
    }

    // ──── Donations ────

    /**
     * @notice Process a verified donation to a specific cluster.
     * @param txHash The transaction hash of the incoming transfer (replay protection).
     * @param clusterWallet The cluster's wallet address receiving the cluster share.
     * @param donor The original donor address (for event accuracy).
     * @param usdtAmount Exact USDT amount of this donation.
     * @param slearnAmount Exact SLEARN amount of this donation.
     */
    function processDonation(
        bytes32 txHash,
        address clusterWallet,
        address donor,
        uint256 usdtAmount,
        uint256 slearnAmount
    ) external onlyOwner nonReentrant {
        require(!processedTx[txHash], "Already processed");
        require(clusterWallet != address(0), "Invalid cluster wallet");
        require(donor != address(0), "Invalid donor");
        require(usdtAmount > 0 || slearnAmount > 0, "Amounts cannot both be zero");

        processedTx[txHash] = true;

        if (!clusterFunds[clusterWallet].exists) {
            clusterFunds[clusterWallet].exists = true;
        }

        (uint256 clusterUsdt, uint256 clusterSlearn, uint256 pdjUsdt, uint256 pdjSlearn) =
            _splitAmounts(usdtAmount, slearnAmount);

        if (pdjUsdt > 0) {
            usdtToken.safeTransfer(pdjTreasury, pdjUsdt);
            emit PdjFeeDeducted(pdjUsdt, 0);
        }
        if (pdjSlearn > 0) {
            slearnToken.safeTransfer(pdjTreasury, pdjSlearn);
            emit PdjFeeDeducted(0, pdjSlearn);
        }

        clusterFunds[clusterWallet].usdtBalance += clusterUsdt;
        clusterFunds[clusterWallet].slearnBalance += clusterSlearn;

        emit ClusterDonation(donor, clusterWallet, clusterUsdt, clusterSlearn);
    }

    /**
     * @notice Process a verified donation to a country fund.
     * @param txHash The transaction hash of the incoming transfer (replay protection).
     * @param countryCode ISO 3166-1 alpha-2 country code (e.g., "SL", "CO").
     * @param donor The original donor address (for event accuracy).
     * @param usdtAmount Exact USDT amount of this donation.
     * @param slearnAmount Exact SLEARN amount of this donation.
     */
    function processCountryDonation(
        bytes32 txHash,
        string calldata countryCode,
        address donor,
        uint256 usdtAmount,
        uint256 slearnAmount
    ) external onlyOwner nonReentrant {
        require(!processedTx[txHash], "Already processed");
        require(bytes(countryCode).length == 2, "Invalid country code");
        require(donor != address(0), "Invalid donor");
        require(usdtAmount > 0 || slearnAmount > 0, "Amounts cannot both be zero");

        processedTx[txHash] = true;

        (uint256 clusterUsdt, uint256 clusterSlearn, uint256 pdjUsdt, uint256 pdjSlearn) =
            _splitAmounts(usdtAmount, slearnAmount);

        if (pdjUsdt > 0) {
            usdtToken.safeTransfer(pdjTreasury, pdjUsdt);
            emit PdjFeeDeducted(pdjUsdt, 0);
        }
        if (pdjSlearn > 0) {
            slearnToken.safeTransfer(pdjTreasury, pdjSlearn);
            emit PdjFeeDeducted(0, pdjSlearn);
        }

        if (!countryFunds[countryCode].exists) {
            countryFunds[countryCode].exists = true;
        }
        countryFunds[countryCode].usdtBalance += clusterUsdt;
        countryFunds[countryCode].slearnBalance += clusterSlearn;

        emit CountryDonation(donor, countryCode, clusterUsdt, clusterSlearn);
    }

    // ──── Redistribution ────

    /**
     * @notice Distribute country fund equally among clusters in that country.
     * @param countryCode ISO 3166-1 alpha-2 country code (e.g., "SL", "CO").
     * @param clusters Array of cluster wallet addresses in that country.
     * Called by backend when a new cluster forms.
     * Limits: max 100 clusters per transaction to avoid gas limits.
     */
    function redistributeCountryFunds(
        string calldata countryCode,
        address[] calldata clusters
    ) external onlyOwner nonReentrant {
        require(bytes(countryCode).length == 2, "Invalid country code");
        uint256 count = clusters.length;
        require(count > 0, "No clusters in country");
        require(count <= 100, "Max 100 clusters per call");

        CountryFund storage fund = countryFunds[countryCode];
        uint256 usdtTotal = fund.usdtBalance;
        uint256 slearnTotal = fund.slearnBalance;
        require(usdtTotal > 0 || slearnTotal > 0, "No funds to distribute");

        fund.usdtBalance = 0;
        fund.slearnBalance = 0;

        uint256 usdtPerCluster = usdtTotal / count;
        uint256 slearnPerCluster = slearnTotal / count;

        // Deduplicate clusters and track seen addresses
        mapping(address => bool) storage seen;
        for (uint256 i = 0; i < count; i++) {
            address cw = clusters[i];
            require(cw != address(0), "Invalid cluster address");
            require(!seen[cw], "Duplicate cluster");
            require(clusterFunds[cw].exists, "Cluster not registered");
            require(clusterFunds[cw].verified, "Cluster not verified");
            seen[cw] = true;

            if (!clusterFunds[cw].exists) {
                clusterFunds[cw].exists = true;
            }
            clusterFunds[cw].usdtBalance += usdtPerCluster;
            clusterFunds[cw].slearnBalance += slearnPerCluster;
        }

        // Any remainder stays in country fund
        uint256 usdtRemainder = usdtTotal - (usdtPerCluster * count);
        uint256 slearnRemainder = slearnTotal - (slearnPerCluster * count);
        if (usdtRemainder > 0 || slearnRemainder > 0) {
            fund.usdtBalance = usdtRemainder;
            fund.slearnBalance = slearnRemainder;
        }

        emit CountryFundsRedistributed(countryCode, usdtPerCluster, slearnPerCluster, count);
    }

    // ──── Release ────

    /**
     * @notice Release accumulated funds to a verified cluster's wallet.
     * @param clusterWallet The cluster's wallet address.
     */
    function releaseClusterFunds(address clusterWallet) external onlyOwner nonReentrant {
        require(clusterWallet != address(0), "Invalid cluster wallet");
        ClusterFund storage fund = clusterFunds[clusterWallet];
        require(fund.exists, "Cluster not found");
        require(fund.verified, "Cluster not verified");

        uint256 usdtAmt = fund.usdtBalance;
        uint256 slearnAmt = fund.slearnBalance;
        require(usdtAmt > 0 || slearnAmt > 0, "No funds to release");
        require(usdtAmt >= 1e6 || slearnAmt >= 1, "Amount too small"); // 1 USDT min, 1 SLEARN min

        fund.usdtBalance = 0;
        fund.slearnBalance = 0;

        if (usdtAmt > 0) usdtToken.safeTransfer(clusterWallet, usdtAmt);
        if (slearnAmt > 0) slearnToken.safeTransfer(clusterWallet, slearnAmt);

        emit ClusterFundsReleased(clusterWallet, usdtAmt, slearnAmt);
    }

    /**
     * @notice Release country funds to a specific recipient.
     * @param countryCode ISO 3166-1 alpha-2 country code (e.g., "SL", "CO").
     * @param recipient Address receiving the funds.
     */
    function releaseCountryFunds(
        string calldata countryCode,
        address recipient
    ) external onlyOwner nonReentrant {
        require(bytes(countryCode).length == 2, "Invalid country code");
        require(recipient != address(0), "Invalid recipient");
        CountryFund storage fund = countryFunds[countryCode];
        require(fund.exists, "Country not found");
        require(fund.verified, "Country not verified");

        uint256 usdtAmt = fund.usdtBalance;
        uint256 slearnAmt = fund.slearnBalance;
        require(usdtAmt > 0 || slearnAmt > 0, "No funds to release");
        require(usdtAmt >= 1e6 || slearnAmt >= 1, "Amount too small");

        fund.usdtBalance = 0;
        fund.slearnBalance = 0;

        if (usdtAmt > 0) usdtToken.safeTransfer(recipient, usdtAmt);
        if (slearnAmt > 0) slearnToken.safeTransfer(recipient, slearnAmt);

        emit CountryFundsReleased(countryCode, recipient, usdtAmt, slearnAmt);
    }

    // ──── Cluster Removal (Dissolution) ────

    /**
     * @notice Remove a dissolved cluster and transfer its funds to the country fund.
     * @param clusterWallet The cluster's wallet address to remove.
     * @param countryCode ISO 3166-1 alpha-2 country code (e.g., "SL", "CO").
     * Called by backend when a cluster is dissolved (last pastor leaves).
     */
    function removeCluster(address clusterWallet, string calldata countryCode) external onlyOwner nonReentrant {
        require(clusterWallet != address(0), "Invalid cluster wallet");
        require(bytes(countryCode).length == 2, "Invalid country code");
        ClusterFund storage fund = clusterFunds[clusterWallet];
        require(fund.exists, "Cluster not found");

        uint256 usdtAmt = fund.usdtBalance;
        uint256 slearnAmt = fund.slearnBalance;

        // Transfer funds to country fund
        if (usdtAmt > 0 || slearnAmt > 0) {
            if (!countryFunds[countryCode].exists) {
                countryFunds[countryCode].exists = true;
            }
            countryFunds[countryCode].usdtBalance += usdtAmt;
            countryFunds[countryCode].slearnBalance += slearnAmt;

            fund.usdtBalance = 0;
            fund.slearnBalance = 0;
        }

        fund.exists = false;
        fund.verified = false;

        emit ClusterRemoved(clusterWallet, countryCode, usdtAmt, slearnAmt);
    }

    // ──── Emergency Withdrawals (with Timelock) ────

    /**
     * @notice Request an emergency withdrawal. Funds become available after 7 days.
     * @param token Address of the token to withdraw (USDT or SLEARN).
     * @param amount Amount to withdraw.
     */
    function requestEmergencyWithdrawal(address token, uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount > 0");
        require(token == address(usdtToken) || token == address(slearnToken), "Invalid token");

        uint256 balance = token == address(usdtToken)
            ? usdtToken.balanceOf(address(this))
            : slearnToken.balanceOf(address(this));
        require(amount <= balance, "Insufficient balance");

        bytes32 requestId = keccak256(abi.encodePacked(token, amount, block.timestamp, msg.sender));
        emergencyWithdrawRequests[requestId] = block.timestamp + emergencyWithdrawTimelock;

        emit EmergencyWithdrawRequested(requestId, token, amount, block.timestamp + emergencyWithdrawTimelock);
    }

    /**
     * @notice Execute a previously requested emergency withdrawal after timelock expires.
     * @param requestId The request ID returned from requestEmergencyWithdrawal.
     * @param token Address of the token to withdraw.
     * @param amount Amount to withdraw.
     */
    function executeEmergencyWithdrawal(bytes32 requestId, address token, uint256 amount) external onlyOwner nonReentrant {
        require(emergencyWithdrawRequests[requestId] > 0, "Request not found");
        require(block.timestamp >= emergencyWithdrawRequests[requestId], "Timelock not expired");
        require(amount > 0, "Amount > 0");
        require(token == address(usdtToken) || token == address(slearnToken), "Invalid token");

        uint256 balance = token == address(usdtToken)
            ? usdtToken.balanceOf(address(this))
            : slearnToken.balanceOf(address(this));
        require(amount <= balance, "Insufficient balance");

        delete emergencyWithdrawRequests[requestId];

        if (token == address(usdtToken)) {
            usdtToken.safeTransfer(owner(), amount);
        } else {
            slearnToken.safeTransfer(owner(), amount);
        }

        emit EmergencyWithdrawExecuted(requestId, token, amount);
    }

    /**
     * @notice Cancel an emergency withdrawal request.
     * @param requestId The request ID to cancel.
     */
    function cancelEmergencyWithdrawal(bytes32 requestId) external onlyOwner {
        require(emergencyWithdrawRequests[requestId] > 0, "Request not found");
        delete emergencyWithdrawRequests[requestId];
    }

    // ──── Views ────

    function getClusterBalance(address clusterWallet) external view returns (uint256 usdt, uint256 slearn) {
        ClusterFund storage f = clusterFunds[clusterWallet];
        return (f.usdtBalance, f.slearnBalance);
    }

    function getCountryBalance(string calldata countryCode) external view returns (uint256 usdt, uint256 slearn) {
        CountryFund storage f = countryFunds[countryCode];
        return (f.usdtBalance, f.slearnBalance);
    }

    function getClusterFunds(address clusterWallet) external view returns (
        uint256 usdtBalance,
        uint256 slearnBalance,
        bool exists,
        bool verified
    ) {
        ClusterFund storage f = clusterFunds[clusterWallet];
        return (f.usdtBalance, f.slearnBalance, f.exists, f.verified);
    }

    function getCountryFunds(string calldata countryCode) external view returns (
        uint256 usdtBalance,
        uint256 slearnBalance,
        bool exists,
        bool verified
    ) {
        CountryFund storage f = countryFunds[countryCode];
        return (f.usdtBalance, f.slearnBalance, f.exists, f.verified);
    }

    // ──── Internal ────

    /**
     * @dev Split amounts between cluster/country and pdJ treasury.
     * Rounding favors the cluster (cluster receives the rounded-up amount).
     */
    function _splitAmounts(uint256 usdtAmt, uint256 slearnAmt)
        internal view returns (
            uint256 clusterUsdt,
            uint256 clusterSlearn,
            uint256 pdjUsdt,
            uint256 pdjSlearn
        )
    {
        uint256 clusterPct = 100 - pdjPercentage;
        // Round up for cluster (favors cluster over pdJ)
        clusterUsdt = (usdtAmt * clusterPct + 99) / 100;
        clusterSlearn = (slearnAmt * clusterPct + 99) / 100;
        // PDJ receives the remainder
        pdjUsdt = usdtAmt - clusterUsdt;
        pdjSlearn = slearnAmt - clusterSlearn;
    }
}
