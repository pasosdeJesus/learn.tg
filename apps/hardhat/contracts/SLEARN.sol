// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface LearnTGVaultsV3 {
    function recordCourseFunds(uint256 courseId, uint256 usdtAmount, uint256 slearnAmount) external;
}

/**
 * @title SLEARN
 * @dev Utility token for pdJ ecosystem
 * - 2 decimals, 1 USDT = 22 SLEARN (adjustable)
 * - Restricted transfers: allowed if sender OR receiver is authorized
 * - MINTER_ROLE holders are auto-authorized for transfers
 * - Backed by 3-tier reserve: Master (SL0) + Hot learn.tg (L2) + Hot stable-sl (S2)
 */
contract SLEARN is ERC20, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    uint8 private constant DECIMALS = 2;
    uint8 private constant USDT_DECIMALS = 6;

    // ============ TOKENS ============
    IERC20 public immutable usdt;

    // ============ CONVERSION RATE ============
    uint256 public usdtToSlearnRate = 22;  // 1 USDT = 22 SLEARN

    // ============ KEY ADDRESSES ============
    address public pdJTreasury;
    address public ubiWallet;
    address public learnTGVault;           // LearnTGVaultsV3 (receives USDT)
    address public learnTGVaultSLEARN;     // LearnTGVaultsV3 (receives SLEARN, same contract)
    address public referralWallet;
    address public churchesWallet;
    address public reserveMultisig;        // Master reserve (SL0) — Safe multisig
    address public learnTgReserve;         // Hot reserve learn.tg (L2) — backend EOA
    address public stableSlReserve;        // Hot reserve stable-sl (S2) — stable-sl EOA

    // ============ TRANSFER RESTRICTIONS ============
    mapping(address => bool) public authorizedTransfers;

    // ============ MISSIONAL COURSES ============
    mapping(uint256 => bool) public isMissionalCourse;
    uint256[] public missionalCourses;

    // ============ EVENTS ============
    event AuthorizedTransferAdded(address indexed addr);
    event AuthorizedTransferRemoved(address indexed addr);
    event RateUpdated(uint256 oldRate, uint256 newRate);
    event PdJTreasuryUpdated(address indexed newTreasury);
    event UbiWalletUpdated(address indexed newWallet);
    event LearnTGVaultUpdated(address indexed newVault);
    event LearnTGVaultSLEARNUpdated(address indexed newVault);
    event ReferralWalletUpdated(address indexed newWallet);
    event ChurchesWalletUpdated(address indexed newWallet);
    event ReserveMultisigUpdated(address indexed newReserve);
    event LearnTgReserveUpdated(address indexed newReserve);
    event StableSlReserveUpdated(address indexed newReserve);

    event MissionalCourseAdded(uint256 indexed courseId);
    event MissionalCourseRemoved(uint256 indexed courseId);

    event ReceiveProcessed(address indexed payer, uint256 totalUSDT, uint256 slearnAmount, uint256 courseId);
    event CourseVaultFunds(uint256 indexed courseId, uint256 usdtAmount, uint256 slearnAmount);
    event MissionalCourseFunds(uint256 indexed courseId, uint256 usdtAmount, uint256 slearnAmount);
    event UBIRequest(address indexed payer, uint256 usdtAmount);
    event ReferralReward(address indexed referralAddress, uint256 usdtAmount, uint256 slearnAmount);
    event ChurchesFundReceived(address wallet, uint256 usdtAmount, uint256 slearnAmount);
    event MintAndReserve(address indexed to, uint256 usdtAmount, uint256 slearnAmount);
    event SLEARNRedeemed(address indexed user, uint256 slearnAmount, uint256 usdtAmount);

    // ============ MODIFIERS ============
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "SLEARN: not admin");
        _;
    }

    // ============ CONSTRUCTOR ============
    constructor(address _usdt) ERC20("SLEARN", "SLEARN") {
        require(_usdt != address(0), "SLEARN: invalid USDT address");
        usdt = IERC20(_usdt);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============ CONFIGURATION ============
    function decimals() public view virtual override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Convert USDT amount (6 decimals) to SLEARN amount (2 decimals)
     */
    function usdtToSLEARN(uint256 usdtAmount) public view returns (uint256) {
        return (usdtToSlearnRate * usdtAmount * (10 ** DECIMALS)) / (10 ** USDT_DECIMALS);
    }

    /**
     * @dev Convert SLEARN amount (2 decimals) to USDT equivalent (6 decimals)
     */
    function slearnToUSDT(uint256 slearnAmount) public view returns (uint256) {
        return (slearnAmount * (10 ** USDT_DECIMALS)) / (usdtToSlearnRate * (10 ** DECIMALS));
    }

    function setUsdtToSlearnRate(uint256 newRate) external onlyAdmin {
        require(newRate >= 10 && newRate <= 22, "SLEARN: rate must be 10-22");
        emit RateUpdated(usdtToSlearnRate, newRate);
        usdtToSlearnRate = newRate;
    }

    // ============ ADDRESS SETTERS ============
    function setPdJTreasury(address treasury) external onlyAdmin {
        require(treasury != address(0), "SLEARN: invalid address");
        pdJTreasury = treasury;
        emit PdJTreasuryUpdated(treasury);
    }

    function setUbiWallet(address wallet) external onlyAdmin {
        require(wallet != address(0), "SLEARN: invalid address");
        ubiWallet = wallet;
        emit UbiWalletUpdated(wallet);
    }

    function setLearnTGVault(address vault) external onlyAdmin {
        require(vault != address(0), "SLEARN: invalid address");
        learnTGVault = vault;
        emit LearnTGVaultUpdated(vault);
    }

    function setLearnTGVaultSLEARN(address vault) external onlyAdmin {
        require(vault != address(0), "SLEARN: invalid address");
        learnTGVaultSLEARN = vault;
        emit LearnTGVaultSLEARNUpdated(vault);
    }

    function setReferralWallet(address wallet) external onlyAdmin {
        require(wallet != address(0), "SLEARN: invalid address");
        referralWallet = wallet;
        emit ReferralWalletUpdated(wallet);
    }

    function setChurchesWallet(address wallet) external onlyAdmin {
        require(wallet != address(0), "SLEARN: invalid address");
        churchesWallet = wallet;
        emit ChurchesWalletUpdated(wallet);
    }

    function setReserveMultisig(address reserve) external onlyAdmin {
        require(reserve != address(0), "SLEARN: invalid address");
        reserveMultisig = reserve;
        emit ReserveMultisigUpdated(reserve);
    }

    function setLearnTgReserve(address reserve) external onlyAdmin {
        require(reserve != address(0), "SLEARN: invalid address");
        learnTgReserve = reserve;
        emit LearnTgReserveUpdated(reserve);
    }

    function setStableSlReserve(address reserve) external onlyAdmin {
        require(reserve != address(0), "SLEARN: invalid address");
        stableSlReserve = reserve;
        emit StableSlReserveUpdated(reserve);
    }

    // ============ TRANSFER RESTRICTIONS ============
    /**
     * @dev Override grantRole to auto-authorize MINTER_ROLE holders for transfers.
     *      Users can send SLEARN TO authorized addresses (backends).
     */
    function grantRole(bytes32 role, address account) public override onlyAdmin {
        super.grantRole(role, account);
        if (role == MINTER_ROLE) {
            authorizedTransfers[account] = true;
            emit AuthorizedTransferAdded(account);
        }
    }

    function revokeRole(bytes32 role, address account) public override onlyAdmin {
        if (role == MINTER_ROLE) {
            authorizedTransfers[account] = false;
            emit AuthorizedTransferRemoved(account);
        }
        super.revokeRole(role, account);
    }

    function addAuthorizedTransfer(address addr) external onlyAdmin {
        authorizedTransfers[addr] = true;
        emit AuthorizedTransferAdded(addr);
    }

    function removeAuthorizedTransfer(address addr) external onlyAdmin {
        authorizedTransfers[addr] = false;
        emit AuthorizedTransferRemoved(addr);
    }

    /**
     * @dev Transfer allowed if sender OR receiver is authorized.
     *      Users can send SLEARN to backend wallets (authorized via MINTER_ROLE).
     */
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        require(
            authorizedTransfers[msg.sender] || authorizedTransfers[to],
            "SLEARN: neither sender nor receiver authorized"
        );
        return super.transfer(to, amount);
    }

    /**
     * @dev transferFrom allowed if `from` OR msg.sender is authorized.
     */
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        require(
            authorizedTransfers[from] || authorizedTransfers[msg.sender],
            "SLEARN: neither from nor spender authorized"
        );
        return super.transferFrom(from, to, amount);
    }

    // ============ MINT & BURN ============
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(amount > 0, "SLEARN: amount must be positive");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) whenNotPaused {
        require(amount > 0, "SLEARN: amount must be positive");
        _burn(from, amount);
    }

    /**
     * @dev Mint SLEARN and send USDT to hot reserve (L2).
     *      Contract must already have USDT (backend transfers first).
     */
    function mintAndReserve(address to, uint256 usdtAmount) public onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        require(usdtAmount > 0, "SLEARN: amount must be positive");
        require(learnTgReserve != address(0), "SLEARN: hot reserve not set");
        require(usdt.balanceOf(address(this)) >= usdtAmount, "SLEARN: insufficient USDT balance");

        uint256 slearnAmount = usdtToSLEARN(usdtAmount);

        usdt.safeTransfer(learnTgReserve, usdtAmount);
        _mint(to, slearnAmount);

        emit MintAndReserve(to, usdtAmount, slearnAmount);
        return slearnAmount;
    }

    // ============ MISSIONAL COURSES ============
    function addMissionalCourse(uint256 courseId) external onlyRole(MINTER_ROLE) {
        require(!isMissionalCourse[courseId], "SLEARN: already missional");
        isMissionalCourse[courseId] = true;
        missionalCourses.push(courseId);
        emit MissionalCourseAdded(courseId);
    }

    function removeMissionalCourse(uint256 courseId) external onlyRole(MINTER_ROLE) {
        require(isMissionalCourse[courseId], "SLEARN: not missional");
        isMissionalCourse[courseId] = false;
        emit MissionalCourseRemoved(courseId);
    }

    function getMissionalCourses() external view returns (uint256[] memory) {
        // Count active courses
        uint256 count = 0;
        for (uint256 i = 0; i < missionalCourses.length; i++) {
            if (isMissionalCourse[missionalCourses[i]]) count++;
        }
        uint256[] memory active = new uint256[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < missionalCourses.length; i++) {
            if (isMissionalCourse[missionalCourses[i]]) {
                active[j] = missionalCourses[i];
                j++;
            }
        }
        return active;
    }

    // ============ MAIN RECEIVE FUNCTION ============
    /**
     * @dev Receives funds from backend wallet (users sent tokens to backend first).
     *      Burns incoming SLEARN, releases backing USDT from hot reserve,
     *      distributes total USDT pool per percentages.
     *
     * @param payer         Original payer/donor (for reward minting and events)
     * @param usdtAmount    USDT received from backend (6 decimals) — from user's transfer
     * @param slearnAmount  SLEARN received from backend (2 decimals) — from user's transfer, will be burned
     * @param courseId              Main course ID for vault allocation
     * @param percentagePdJ          % to pdJ treasury (USDT)
     * @param percentageReward       % to payer reward (mints SLEARN)
     * @param percentageMissional    % to missional courses
     * @param percentageUBI          % to UBI
     * @param percentageReferral     % to referrals
     * @param percentageChurches     % to churches
     */
    function processPayment(
        address payer,
        uint256 usdtAmount,
        uint256 slearnAmount,
        uint256 courseId,
        uint256 percentagePdJ,
        uint256 percentageReward,
        uint256 percentageMissional,
        uint256 percentageUBI,
        uint256 percentageReferral,
        uint256 percentageChurches
    ) external nonReentrant whenNotPaused onlyRole(MINTER_ROLE) {
        require(payer != address(0), "SLEARN: invalid payer");
        require(usdtAmount > 0 || slearnAmount > 0, "SLEARN: zero payment");

        uint256 totalPct = percentagePdJ + percentageReward + percentageMissional +
            percentageUBI + percentageReferral + percentageChurches;
        require(totalPct <= 99, "SLEARN: percentages exceed 99%");

        // 1. Calculate total USDT and pull tokens from backend.
        //    Accounting invariant: sum of USDT sent externally + USDT sent to reserve
        //    (via mintAndReserve) = totalUSDT. The contract always has enough balance
        //    because we pull everything upfront and percentages sum to 100%.
        uint256 usdtFromSlearn = slearnToUSDT(slearnAmount);
        uint256 totalUSDT = usdtAmount + usdtFromSlearn;

        _pullTokens(usdtAmount, slearnAmount, usdtFromSlearn);

        // 2. Distribute
        _distributePdJ(totalUSDT, percentagePdJ);
        _distributeReward(payer, totalUSDT, percentageReward);
        _distributeMissional(totalUSDT, percentageMissional);
        _distributeUBI(payer, totalUSDT, percentageUBI);
        _distributeReferral(totalUSDT, percentageReferral);
        _distributeChurches(totalUSDT, percentageChurches);
        _distributeVault(totalUSDT, courseId, totalPct);

        emit ReceiveProcessed(payer, totalUSDT, slearnAmount, courseId);
    }

    // ============ INTERNAL DISTRIBUTION HELPERS ============

    function _pullTokens(uint256 usdtAmount, uint256 slearnAmount, uint256 usdtFromSlearn) private {
        if (usdtAmount > 0) {
            usdt.safeTransferFrom(msg.sender, address(this), usdtAmount);
        }
        if (slearnAmount > 0) {
            require(transferFrom(msg.sender, address(this), slearnAmount), "SLEARN: SLEARN transfer failed");
            _burn(address(this), slearnAmount);
            require(learnTgReserve != address(0), "SLEARN: hot reserve not set");
            require(usdtFromSlearn <= usdt.balanceOf(learnTgReserve), "SLEARN: hot reserve insufficient");
            usdt.safeTransferFrom(learnTgReserve, address(this), usdtFromSlearn);
        }
    }

    function _distributePdJ(uint256 total, uint256 pct) private {
        if (pct > 0 && pdJTreasury != address(0)) {
            uint256 amount = (total * pct) / 100;
            usdt.safeTransfer(pdJTreasury, amount);
        }
    }

    function _distributeReward(address payer, uint256 total, uint256 pct) private {
        if (pct > 0) {
            mintAndReserve(payer, (total * pct) / 100);
        }
    }

    function _distributeMissional(uint256 total, uint256 pct) private {
        if (pct == 0 || missionalCourses.length == 0) return;

        // Count active missional courses
        uint256 activeCount = 0;
        for (uint256 i = 0; i < missionalCourses.length; i++) {
            if (isMissionalCourse[missionalCourses[i]]) activeCount++;
        }
        if (activeCount == 0) return;

        uint256 totalForMiss = (total * pct) / 100;
        uint256 halfUSDT = totalForMiss / 2;
        uint256 halfSlearn = totalForMiss - halfUSDT;
        uint256 perUSDT = halfUSDT / activeCount;
        uint256 perSlearn = halfSlearn / activeCount;

        uint256 length = missionalCourses.length;
        for (uint256 i = 0; i < length; i++) {
            uint256 cid = missionalCourses[i];
            if (!isMissionalCourse[cid]) continue;
            uint256 mslearn = 0;
            if (perUSDT > 0 && learnTGVault != address(0)) {
                usdt.safeTransfer(learnTGVault, perUSDT);
            }
            if (perSlearn > 0 && learnTGVaultSLEARN != address(0)) {
                mslearn = mintAndReserve(learnTGVaultSLEARN, perSlearn);
            }
            if (learnTGVault != address(0) && (perUSDT > 0 || mslearn > 0)) {
                LearnTGVaultsV3(learnTGVault).recordCourseFunds(cid, perUSDT, mslearn);
                emit MissionalCourseFunds(cid, perUSDT, mslearn);
            }
        }
    }

    function _distributeUBI(address payer, uint256 total, uint256 pct) private {
        if (pct > 0 && ubiWallet != address(0)) {
            uint256 amount = (total * pct) / 100;
            usdt.safeTransfer(ubiWallet, amount);
            emit UBIRequest(payer, amount);
        }
    }

    function _distributeReferral(uint256 total, uint256 pct) private {
        if (pct == 0 || referralWallet == address(0)) return;
        uint256 totalRef = (total * pct) / 100;
        uint256 halfUSDT = totalRef / 2;
        uint256 halfSlearn = totalRef - halfUSDT;
        uint256 rslearn = 0;

        if (halfUSDT > 0) {
            usdt.safeTransfer(referralWallet, halfUSDT);
        }
        if (halfSlearn > 0) {
            rslearn = mintAndReserve(referralWallet, halfSlearn);
        }
        if (halfUSDT > 0 || rslearn > 0) {
            emit ReferralReward(referralWallet, halfUSDT, rslearn);
        }
    }

    function _distributeChurches(uint256 total, uint256 pct) private {
        if (pct == 0 || churchesWallet == address(0)) return;
        uint256 totalCh = (total * pct) / 100;
        uint256 halfUSDT = totalCh / 2;
        uint256 halfSlearn = totalCh - halfUSDT;
        uint256 cslearn = 0;

        if (halfUSDT > 0) {
            usdt.safeTransfer(churchesWallet, halfUSDT);
        }
        if (halfSlearn > 0) {
            cslearn = mintAndReserve(churchesWallet, halfSlearn);
        }
        emit ChurchesFundReceived(churchesWallet, halfUSDT, cslearn);
    }

    function _distributeVault(uint256 total, uint256 courseId, uint256 totalPct) private {
        uint256 vaultPct = 100 - totalPct;
        if (vaultPct == 0) return;
        uint256 totalVault = (total * vaultPct) / 100;
        uint256 halfUSDT = totalVault / 2;
        uint256 halfSlearn = totalVault - halfUSDT;
        uint256 vslearn = 0;

        if (halfUSDT > 0 && learnTGVault != address(0)) {
            usdt.safeTransfer(learnTGVault, halfUSDT);
        }
        if (halfSlearn > 0 && learnTGVaultSLEARN != address(0)) {
            vslearn = mintAndReserve(learnTGVaultSLEARN, halfSlearn);
        }
        if (learnTGVault != address(0) && (halfUSDT > 0 || vslearn > 0)) {
            LearnTGVaultsV3(learnTGVault).recordCourseFunds(courseId, halfUSDT, vslearn);
            emit CourseVaultFunds(courseId, halfUSDT, vslearn);
        }
    }

    // ============ STABLE-SL REDEMPTION ============
    /**
     * @dev Redeem SLEARN for SLE (Leones). Called by stable-sl backend.
     *      User transfers SLEARN to stable-sl backend, backend calls this.
     *      Burns SLEARN, releases USDT from stable-sl hot reserve (S2) to backend.
     *
     * @param user          User redeeming SLEARN
     * @param slearnAmount  SLEARN amount to burn (2 decimals)
     */
    function redeemForSLE(address user, uint256 slearnAmount)
        external nonReentrant whenNotPaused onlyRole(MINTER_ROLE)
    {
        require(slearnAmount > 0, "SLEARN: amount must be positive");
        require(stableSlReserve != address(0), "SLEARN: S2 reserve not set");

        // Pull SLEARN from backend (user sent to backend first)
        require(transferFrom(msg.sender, address(this), slearnAmount), "SLEARN: SLEARN transfer failed");
        _burn(address(this), slearnAmount);

        // Release USDT from S2 to backend (compensation for SLE paid to user)
        uint256 usdtAmount = slearnToUSDT(slearnAmount);
        require(usdtAmount <= usdt.balanceOf(stableSlReserve), "SLEARN: S2 reserve insufficient");
        usdt.safeTransferFrom(stableSlReserve, msg.sender, usdtAmount);

        emit SLEARNRedeemed(user, slearnAmount, usdtAmount);
    }

    // ============ EMERGENCY ============
    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }
}
