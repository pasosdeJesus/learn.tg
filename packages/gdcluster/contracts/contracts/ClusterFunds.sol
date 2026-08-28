// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface ISLEARNMint {
    function mintAndReserve(address to, uint256 usdtAmount) external returns (uint256);
}

/**
 * @title ClusterFunds
 * @author learn.tg
 * @notice Manages USDT and SLEARN donations for clusters and countries.
 * Funds accumulate until released by pdJ admin after GD contact verification.
 *
 * Phase 1: Donations, fund accumulation, admin release.
 * Phase 2 (post-pilot): AAVE yield for idle USDT.
 *
 * Fee system: configurable fee wallets + percentages + donor cashback.
 * Remainder after fees + cashback goes to the cluster or country fund.
 * Donor cashback: USDT portion → mintAndReserve (backs SLEARN), SLEARN portion → direct return.
 * Example: wallets=[pdjTreasury], pcts=[10], cashback=10 → 10% pdJ, 10% donor, 80% cluster.
 *
 * Security: Uses OpenZeppelin's SafeERC20, ReentrancyGuard, Ownable, and Pausable.
 */
contract ClusterFunds is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ──── State ────

    IERC20 public immutable usdtToken;
    IERC20 public immutable slearnToken;

    // Configurable fee recipients + cashback
    address[] public feeWallets;
    uint8[] public feePercentages;
    uint8 public donorCashbackPct; // e.g. 10 = 10% SLEARN cashback to donor

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
    }

    mapping(address => ClusterFund) public clusterFunds;      // clusterWallet → fund
    mapping(string => CountryFund) public countryFunds;       // countryCode → fund
    mapping(bytes32 => bool) public processedTx;              // replay protection

    // Emergency withdrawal timelock
    uint256 public emergencyWithdrawTimelock = 7 days;
    mapping(bytes32 => uint256) public emergencyWithdrawRequests;

    // ──── Events ────

    event ClusterDonation(address indexed donor, address indexed clusterWallet, uint256 usdtAmount, uint256 slearnAmount);
    event CountryDonation(address indexed donor, string countryCode, uint256 usdtAmount, uint256 slearnAmount);
    event CountryFundsRedistributed(string countryCode, uint256 usdtPerCluster, uint256 slearnPerCluster, uint256 clusterCount_);
    event ClusterFundsReleased(address indexed clusterWallet, uint256 usdtAmount, uint256 slearnAmount);
    event CountryFundsReleased(string countryCode, address indexed recipient, uint256 usdtAmount, uint256 slearnAmount);
    event ClusterRemoved(address indexed clusterWallet, string countryCode, uint256 usdtAmount, uint256 slearnAmount);
    event ClusterVerified(address indexed clusterWallet, bool verified);
    event FeeConfigUpdated(address[] wallets, uint8[] percentages);
    event DonorCashbackPctUpdated(uint8 newPct);
    event FeeDistributed(address indexed recipient, uint256 usdtAmount, uint256 slearnAmount);
    event DonorCashback(address indexed donor, uint256 usdtBacking, uint256 slearnReturned);
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

        // Default: 10% pdJ treasury, 10% donor cashback, 80% cluster/country
        feeWallets.push(_pdjTreasury);
        feePercentages.push(10);
        donorCashbackPct = 10;
    }

    // ──── Admin ────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Configure fee recipients and percentages.
     * @param wallets Array of recipient addresses (no zero addresses).
     * @param percentages Array of percentages (each 0-100, sum must be <= 100).
     *        Remainder after fees goes to cluster/country fund.
     *        Pass empty arrays to disable all fees (100% to cluster/country).
     *        Donor cashback is handled by the backend separately.
     */
    function setFeeConfig(address[] calldata wallets, uint8[] calldata percentages) external onlyOwner {
        require(wallets.length == percentages.length, "Length mismatch");
        uint16 total;
        for (uint256 i = 0; i < percentages.length; i++) {
            require(wallets[i] != address(0), "Zero address");
            total += percentages[i];
        }
        require(total <= 100, "Total exceeds 100%");

        delete feeWallets;
        delete feePercentages;
        for (uint256 i = 0; i < wallets.length; i++) {
            feeWallets.push(wallets[i]);
            feePercentages.push(percentages[i]);
        }

        emit FeeConfigUpdated(wallets, percentages);
    }

    function getFeeConfig() external view returns (address[] memory wallets, uint8[] memory percentages) {
        return (feeWallets, feePercentages);
    }

    /**
     * @notice Set donor cashback percentage.
     * @param pct Cashback percentage (0-50). USDT: mintAndReserve, SLEARN: direct return.
     */
    function setDonorCashbackPct(uint8 pct) external onlyOwner {
        require(pct <= 50, "Max 50%");
        donorCashbackPct = pct;
        emit DonorCashbackPctUpdated(pct);
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
    ) external onlyOwner whenNotPaused nonReentrant {
        require(!processedTx[txHash], "Already processed");
        require(clusterWallet != address(0), "Invalid cluster wallet");
        require(donor != address(0), "Invalid donor");
        require(usdtAmount > 0 || slearnAmount > 0, "Amounts cannot both be zero");

        processedTx[txHash] = true;

        if (!clusterFunds[clusterWallet].exists) {
            clusterFunds[clusterWallet].exists = true;
        }

        (uint256 clusterUsdt, uint256 clusterSlearn) = _distributeFees(usdtAmount, slearnAmount, donor);

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
    ) external onlyOwner whenNotPaused nonReentrant {
        require(!processedTx[txHash], "Already processed");
        require(bytes(countryCode).length == 2, "Invalid country code");
        require(donor != address(0), "Invalid donor");
        require(usdtAmount > 0 || slearnAmount > 0, "Amounts cannot both be zero");

        processedTx[txHash] = true;

        (uint256 countryUsdt, uint256 countrySlearn) = _distributeFees(usdtAmount, slearnAmount, donor);

        if (!countryFunds[countryCode].exists) {
            countryFunds[countryCode].exists = true;
        }
        countryFunds[countryCode].usdtBalance += countryUsdt;
        countryFunds[countryCode].slearnBalance += countrySlearn;

        emit CountryDonation(donor, countryCode, countryUsdt, countrySlearn);
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
    ) external onlyOwner whenNotPaused nonReentrant {
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

        // Validate and deduplicate
        for (uint256 i = 0; i < count; i++) {
            require(clusters[i] != address(0), "Invalid cluster address");
            require(clusterFunds[clusters[i]].exists, "Cluster not registered");
            require(clusterFunds[clusters[i]].verified, "Cluster not verified");
            for (uint256 j = 0; j < i; j++) {
                require(clusters[i] != clusters[j], "Duplicate cluster");
            }
        }

        for (uint256 i = 0; i < count; i++) {
            address cw = clusters[i];
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

    function releaseClusterFunds(address clusterWallet) external onlyOwner whenNotPaused nonReentrant {
        require(clusterWallet != address(0), "Invalid cluster wallet");
        ClusterFund storage fund = clusterFunds[clusterWallet];
        require(fund.exists, "Cluster not found");
        require(fund.verified, "Cluster not verified");

        uint256 usdtAmt = fund.usdtBalance;
        uint256 slearnAmt = fund.slearnBalance;
        require(usdtAmt > 0 || slearnAmt > 0, "No funds to release");
        require(usdtAmt >= 1e6 || slearnAmt >= 1, "Amount too small");

        fund.usdtBalance = 0;
        fund.slearnBalance = 0;

        if (usdtAmt > 0) usdtToken.safeTransfer(clusterWallet, usdtAmt);
        if (slearnAmt > 0) slearnToken.safeTransfer(clusterWallet, slearnAmt);

        emit ClusterFundsReleased(clusterWallet, usdtAmt, slearnAmt);
    }

    function releaseCountryFunds(
        string calldata countryCode,
        address recipient
    ) external onlyOwner whenNotPaused nonReentrant {
        require(bytes(countryCode).length == 2, "Invalid country code");
        require(recipient != address(0), "Invalid recipient");
        CountryFund storage fund = countryFunds[countryCode];
        require(fund.exists, "Country not found");

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

    function removeCluster(address clusterWallet, string calldata countryCode) external onlyOwner whenNotPaused nonReentrant {
        require(clusterWallet != address(0), "Invalid cluster wallet");
        require(bytes(countryCode).length == 2, "Invalid country code");
        ClusterFund storage fund = clusterFunds[clusterWallet];
        require(fund.exists, "Cluster not found");

        uint256 usdtAmt = fund.usdtBalance;
        uint256 slearnAmt = fund.slearnBalance;

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

    function requestEmergencyWithdrawal(address token, uint256 amount) external onlyOwner whenNotPaused nonReentrant {
        require(amount > 0, "Amount > 0");
        require(token == address(usdtToken) || token == address(slearnToken), "Invalid token");

        uint256 balance = token == address(usdtToken)
            ? usdtToken.balanceOf(address(this))
            : slearnToken.balanceOf(address(this));
        require(amount <= balance, "Insufficient balance");

        bytes32 requestId = keccak256(abi.encodePacked(
            token,
            amount,
            block.timestamp,
            msg.sender,
            blockhash(block.number - 1)
        ));
        emergencyWithdrawRequests[requestId] = block.timestamp + emergencyWithdrawTimelock;

        emit EmergencyWithdrawRequested(requestId, token, amount, block.timestamp + emergencyWithdrawTimelock);
    }

    function executeEmergencyWithdrawal(bytes32 requestId, address token, uint256 amount) external onlyOwner whenNotPaused nonReentrant {
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
        bool exists
    ) {
        CountryFund storage f = countryFunds[countryCode];
        return (f.usdtBalance, f.slearnBalance, f.exists);
    }

    // ──── Internal ────

    /**
     * @dev Distribute fees + cashback. Remainder goes to cluster/country.
     */
    function _distributeFees(uint256 usdtAmt, uint256 slearnAmt, address donor)
        internal returns (uint256 clusterUsdt, uint256 clusterSlearn)
    {
        clusterUsdt = usdtAmt;
        clusterSlearn = slearnAmt;

        // 1. Static fee wallets (e.g. pdjTreasury)
        uint256 len = feeWallets.length;
        for (uint256 i = 0; i < len; i++) {
            uint256 feeUsdt = (usdtAmt * feePercentages[i]) / 100;
            uint256 feeSlearn = (slearnAmt * feePercentages[i]) / 100;

            if (feeUsdt > 0) {
                usdtToken.safeTransfer(feeWallets[i], feeUsdt);
                clusterUsdt -= feeUsdt;
                emit FeeDistributed(feeWallets[i], feeUsdt, 0);
            }
            if (feeSlearn > 0) {
                slearnToken.safeTransfer(feeWallets[i], feeSlearn);
                clusterSlearn -= feeSlearn;
                emit FeeDistributed(feeWallets[i], 0, feeSlearn);
            }
        }

        // 2. Donor cashback
        if (donorCashbackPct > 0 && donor != address(0)) {
            uint256 cashbackUsdt = (usdtAmt * donorCashbackPct) / 100;
            uint256 cashbackSlearn = (slearnAmt * donorCashbackPct) / 100;
            uint256 cashbackMinted = 0;

            if (cashbackUsdt > 0) {
                // Transfer USDT to SLEARN contract, then mintAndReserve → backs SLEARN
                address slearnAddr = address(slearnToken);
                usdtToken.safeTransfer(slearnAddr, cashbackUsdt);
                cashbackMinted = ISLEARNMint(slearnAddr).mintAndReserve(donor, cashbackUsdt);
                clusterUsdt -= cashbackUsdt;
            }
            if (cashbackSlearn > 0) {
                slearnToken.safeTransfer(donor, cashbackSlearn);
                clusterSlearn -= cashbackSlearn;
            }

            if (cashbackUsdt > 0 || cashbackSlearn > 0) {
                emit DonorCashback(donor, cashbackUsdt, cashbackSlearn);
            }
        }
    }
}
