// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ClusterFunds
 * @author learn.tg
 * @notice Manages USDT and SLEARN donations for clusters and countries.
 * Funds accumulate until released by pdJ admin after GD contact verification.
 *
 * Phase 1: Donations, fund accumulation, admin release.
 * Phase 2 (post-pilot): AAVE yield for idle USDT.
 */
contract ClusterFunds is Ownable, ReentrancyGuard {
    // ──── State ────

    IERC20 public usdtToken;
    IERC20 public slearnToken;
    address public pdjTreasury;
    uint8 public pdjPercentage = 15; // fixed at 15%, configurable 0-30 in steps of 5

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

    // ──── Events ────

    event ClusterDonation(address indexed donor, address indexed clusterWallet, uint256 usdtAmount, uint256 slearnAmount);
    event CountryDonation(address indexed donor, string countryCode, uint256 usdtAmount, uint256 slearnAmount);
    event CountryFundsRedistributed(string countryCode, uint256 usdtPerCluster, uint256 slearnPerCluster, uint256 clusterCount_);
    event ClusterFundsReleased(address indexed clusterWallet, uint256 usdtAmount, uint256 slearnAmount);
    event CountryFundsReleased(string countryCode, address indexed recipient, uint256 usdtAmount, uint256 slearnAmount);
    event ClusterVerified(address indexed clusterWallet, bool verified);
    event PdjTreasuryUpdated(address indexed newTreasury);
    event PdjPercentageUpdated(uint8 newPercentage);

    // ──── Constructor ────

    constructor(address _usdt, address _slearn, address _pdjTreasury, address initialOwner)
        Ownable(initialOwner)
    {
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
        require(_pct <= 30, "Max 30%");
        require(_pct % 5 == 0, "Steps of 5");
        pdjPercentage = _pct;
        emit PdjPercentageUpdated(_pct);
    }

    function setClusterVerification(address _clusterWallet, bool _verified) external onlyOwner {
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
        processedTx[txHash] = true;

        if (!clusterFunds[clusterWallet].exists) {
            clusterFunds[clusterWallet].exists = true;
        }

        (uint256 clusterUsdt, uint256 clusterSlearn, uint256 pdjUsdt, uint256 pdjSlearn) =
            _splitAmounts(usdtAmount, slearnAmount);

        if (pdjUsdt > 0) usdtToken.transfer(pdjTreasury, pdjUsdt);
        if (pdjSlearn > 0) slearnToken.transfer(pdjTreasury, pdjSlearn);

        clusterFunds[clusterWallet].usdtBalance += clusterUsdt;
        clusterFunds[clusterWallet].slearnBalance += clusterSlearn;

        emit ClusterDonation(donor, clusterWallet, clusterUsdt, clusterSlearn);
    }

    /**
     * @notice Process a verified donation to a country fund.
     */
    function processCountryDonation(
        bytes32 txHash,
        string calldata countryCode,
        address donor,
        uint256 usdtAmount,
        uint256 slearnAmount
    ) external onlyOwner nonReentrant {
        require(!processedTx[txHash], "Already processed");
        processedTx[txHash] = true;

        (uint256 clusterUsdt, uint256 clusterSlearn, uint256 pdjUsdt, uint256 pdjSlearn) =
            _splitAmounts(usdtAmount, slearnAmount);

        if (pdjUsdt > 0) usdtToken.transfer(pdjTreasury, pdjUsdt);
        if (pdjSlearn > 0) slearnToken.transfer(pdjTreasury, pdjSlearn);

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
     * @param countryCode The country whose funds to redistribute.
     * @param clusters Array of cluster wallet addresses in that country.
     * Called by backend when a new cluster forms.
     */
    function redistributeCountryFunds(string calldata countryCode, address[] calldata clusters) external onlyOwner {
        uint256 count = clusters.length;
        require(count > 0, "No clusters in country");

        CountryFund storage fund = countryFunds[countryCode];
        uint256 usdtTotal = fund.usdtBalance;
        uint256 slearnTotal = fund.slearnBalance;
        require(usdtTotal > 0 || slearnTotal > 0, "No funds to distribute");

        fund.usdtBalance = 0;
        fund.slearnBalance = 0;

        uint256 usdtPerCluster = usdtTotal / count;
        uint256 slearnPerCluster = slearnTotal / count;

        for (uint256 i = 0; i < count; i++) {
            address cw = clusters[i];
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
     */
    function releaseClusterFunds(address clusterWallet) external onlyOwner nonReentrant {
        ClusterFund storage fund = clusterFunds[clusterWallet];
        require(fund.exists, "Cluster not found");
        require(fund.verified, "Cluster not verified");

        uint256 usdtAmt = fund.usdtBalance;
        uint256 slearnAmt = fund.slearnBalance;
        require(usdtAmt > 0 || slearnAmt > 0, "No funds to release");

        fund.usdtBalance = 0;
        fund.slearnBalance = 0;

        if (usdtAmt > 0) usdtToken.transfer(clusterWallet, usdtAmt);
        if (slearnAmt > 0) slearnToken.transfer(clusterWallet, slearnAmt);

        emit ClusterFundsReleased(clusterWallet, usdtAmt, slearnAmt);
    }

    /**
     * @notice Release country funds to a specific recipient.
     */
    function releaseCountryFunds(string calldata countryCode, address recipient) external onlyOwner nonReentrant {
        CountryFund storage fund = countryFunds[countryCode];
        require(fund.exists, "Country not found");

        uint256 usdtAmt = fund.usdtBalance;
        uint256 slearnAmt = fund.slearnBalance;
        require(usdtAmt > 0 || slearnAmt > 0, "No funds to release");

        fund.usdtBalance = 0;
        fund.slearnBalance = 0;

        if (usdtAmt > 0) usdtToken.transfer(recipient, usdtAmt);
        if (slearnAmt > 0) slearnToken.transfer(recipient, slearnAmt);

        emit CountryFundsReleased(countryCode, recipient, usdtAmt, slearnAmt);
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
        uint256 usdtBalance, uint256 slearnBalance, bool exists, bool verified
    ) {
        ClusterFund storage f = clusterFunds[clusterWallet];
        return (f.usdtBalance, f.slearnBalance, f.exists, f.verified);
    }

    function getCountryFunds(string calldata countryCode) external view returns (
        uint256 usdtBalance, uint256 slearnBalance, bool exists
    ) {
        CountryFund storage f = countryFunds[countryCode];
        return (f.usdtBalance, f.slearnBalance, f.exists);
    }

    // ──── Emergency ────

    function emergencyWithdrawUSDT(uint256 amount) external onlyOwner {
        usdtToken.transfer(owner(), amount);
    }

    function emergencyWithdrawSLEARN(uint256 amount) external onlyOwner {
        slearnToken.transfer(owner(), amount);
    }

    // ──── Internal ────

    function _splitAmounts(uint256 usdtAmt, uint256 slearnAmt)
        internal view returns (uint256 clusterUsdt, uint256 clusterSlearn, uint256 pdjUsdt, uint256 pdjSlearn)
    {
        uint256 clusterPct = 100 - pdjPercentage;
        clusterUsdt = (usdtAmt * clusterPct) / 100;
        clusterSlearn = (slearnAmt * clusterPct) / 100;
        pdjUsdt = usdtAmt - clusterUsdt;
        pdjSlearn = slearnAmt - clusterSlearn;
    }
}
