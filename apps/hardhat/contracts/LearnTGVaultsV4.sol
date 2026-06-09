// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// V4 of LearnTGVaults — partial scholarship payments: USDT and SLEARN paid
// independently over multiple submissions. Non-perfect submissions do not
// trigger cooldown. Course-level cooldown prevents one person from draining
// all rewards in a single session.

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    modifier nonReentrant() {
        require(_status != _ENTERED, "Reentrancy detected");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

contract LearnTGVaultsV4 is ReentrancyGuard {
    uint256 public constant VERSION = 4;
    address public immutable owner;

    IERC20 public immutable usdtToken;
    IERC20 public immutable slearnToken;

    struct Vault {
        uint256 courseId;
        uint256 balanceUsdt;
        uint256 balanceSlearn;
        uint256 amountPerGuideUsdt;
        uint256 amountPerGuideSlearn;
        bool exists;
    }

    mapping(uint256 => Vault) public vaults;

    // courseId => guideId => student => usdt amount paid
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public guidePaidUSDT;

    // courseId => guideId => student => slearn amount paid
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public guidePaidSLEARN;

    // courseId => student => last submission timestamp
    mapping(uint256 => mapping(address => uint256)) public studentCooldowns;

    // Address authorized to call recordCourseFunds (set to SLEARN contract)
    mapping(address => bool) public slearnContractRole;

    // Events
    event VaultCreated(uint256 indexed courseId, uint256 amountPerGuideUsdt, uint256 amountPerGuideSlearn);
    event CourseFundsRecorded(uint256 indexed courseId, uint256 usdtAmount, uint256 slearnAmount);
    event ScholarshipPaid(
        uint256 indexed courseId,
        uint256 indexed guideId,
        address indexed student,
        uint256 usdtAmount,
        uint256 slearnAmount,
        uint8 profileScore
    );
    event ScholarshipAlreadyPaid(uint256 indexed courseId, uint256 indexed guideId, address indexed student);
    event ScholarshipInsufficientFunds(
        uint256 indexed courseId,
        uint256 indexed guideId,
        address indexed student,
        uint256 usdtNeeded,
        uint256 usdtAvailable,
        uint256 slearnNeeded,
        uint256 slearnAvailable
    );
    event EmergencyWithdrawal(address indexed token, uint256 amount);
    event GuidePaidSet(uint256 courseId, uint256 guideId, address student, uint256 usdtAmount, uint256 slearnAmount);
    event VaultBalanceSet(uint256 courseId, uint256 balanceUsdt, uint256 balanceSlearn);
    event AmountPerGuideSet(uint256 courseId, uint256 amountUsdt, uint256 amountSlearn);
    event SlearmContractRoleSet(address indexed addr, bool authorized);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlySlearnContract() {
        require(slearnContractRole[msg.sender], "Only SLEARN contract");
        _;
    }

    modifier vaultExists(uint256 courseId) {
        require(vaults[courseId].exists, "Vault does not exist");
        _;
    }

    constructor(address _usdtToken, address _slearnToken) {
        require(_usdtToken != address(0), "Zero USDT token");
        require(_slearnToken != address(0), "Zero SLEARN token");
        owner = msg.sender;
        usdtToken = IERC20(_usdtToken);
        slearnToken = IERC20(_slearnToken);
    }

    // ============ ADMIN ============

    function setSlearnContractRole(address addr, bool authorized) external onlyOwner {
        slearnContractRole[addr] = authorized;
        emit SlearmContractRoleSet(addr, authorized);
    }

    function createVault(
        uint256 courseId,
        uint256 amountPerGuideUsdt,
        uint256 amountPerGuideSlearn
    ) external onlyOwner {
        require(courseId > 0, "Course id must be greater than 0");
        require(!vaults[courseId].exists, "Vault already exists");
        vaults[courseId] = Vault({
            courseId: courseId,
            balanceUsdt: 0,
            balanceSlearn: 0,
            amountPerGuideUsdt: amountPerGuideUsdt,
            amountPerGuideSlearn: amountPerGuideSlearn,
            exists: true
        });
        emit VaultCreated(courseId, amountPerGuideUsdt, amountPerGuideSlearn);
    }

    // ============ SLEARN CONTRACT INTERFACE ============

    function recordCourseFunds(uint256 courseId, uint256 usdtAmount, uint256 slearnAmount)
        external vaultExists(courseId) onlySlearnContract
    {
        vaults[courseId].balanceUsdt += usdtAmount;
        vaults[courseId].balanceSlearn += slearnAmount;
        emit CourseFundsRecorded(courseId, usdtAmount, slearnAmount);
    }

    // ============ SCHOLARSHIP PAYMENT ============

    // V4: partial payments — USDT and SLEARN paid independently.
    // Students can receive one token now and the other later when funds arrive.
    // Non-perfect submissions do NOT trigger cooldown (only cooldown if paid).
    function payScholarship(
        uint256 courseId,
        uint256 guideId,
        address student,
        bool isPerfect,
        uint8 profileScore
    ) external onlyOwner vaultExists(courseId) {
        require(courseId > 0 && guideId > 0 && student != address(0), "Invalid params");
        require(profileScore >= 50 && profileScore <= 100, "Score 50-100");
        require(studentCanSubmit(courseId, student), "In cooldown");

        bool alreadyPaidUSDT = guidePaidUSDT[courseId][guideId][student] > 0;
        bool alreadyPaidSLEARN = guidePaidSLEARN[courseId][guideId][student] > 0;

        // V4: only block if BOTH already paid
        if (alreadyPaidUSDT && alreadyPaidSLEARN) {
            emit ScholarshipAlreadyPaid(courseId, guideId, student);
            return;
        }

        // V4: non-perfect → just return, no cooldown punishment
        if (!isPerfect) {
            return;
        }

        Vault storage vault = vaults[courseId];
        require(vault.balanceUsdt <= usdtToken.balanceOf(address(this)), "USDT accounting exceeds real balance");
        require(vault.balanceSlearn <= slearnToken.balanceOf(address(this)), "SLEARN accounting exceeds real balance");

        uint256 fullUSDT = vault.amountPerGuideUsdt;
        uint256 fullSlearn = vault.amountPerGuideSlearn;
        uint256 actualUSDT = (fullUSDT * profileScore) / 100;
        uint256 actualSlearn = (fullSlearn * profileScore) / 100;

        uint256 paidUSDT = 0;
        uint256 paidSlearn = 0;

        // Pay USDT if not already paid and vault has funds
        if (!alreadyPaidUSDT && actualUSDT > 0 && vault.balanceUsdt > 0) {
            paidUSDT = vault.balanceUsdt >= actualUSDT ? actualUSDT : vault.balanceUsdt;
            vault.balanceUsdt -= paidUSDT;
            guidePaidUSDT[courseId][guideId][student] = paidUSDT;
            require(usdtToken.transfer(student, paidUSDT), "USDT transfer failed");
        }

        // Pay SLEARN if not already paid and vault has funds
        if (!alreadyPaidSLEARN && actualSlearn > 0 && vault.balanceSlearn > 0) {
            paidSlearn = vault.balanceSlearn >= actualSlearn ? actualSlearn : vault.balanceSlearn;
            vault.balanceSlearn -= paidSlearn;
            guidePaidSLEARN[courseId][guideId][student] = paidSlearn;
            require(slearnToken.transfer(student, paidSlearn), "SLEARN transfer failed");
        }

        // V4: cooldown only if something was actually paid
        if (paidUSDT > 0 || paidSlearn > 0) {
            studentCooldowns[courseId][student] = block.timestamp;
            emit ScholarshipPaid(courseId, guideId, student, paidUSDT, paidSlearn, profileScore);
        } else {
            emit ScholarshipInsufficientFunds(
                courseId, guideId, student,
                actualUSDT, vault.balanceUsdt,
                actualSlearn, vault.balanceSlearn
            );
        }
    }

    function studentCanSubmit(uint256 courseId, address student) public view returns (bool) {
        uint256 last = studentCooldowns[courseId][student];
        return last == 0 || block.timestamp >= last + 1 days;
    }

    // ============ MIGRATION HELPERS ============

    function setGuidePaid(
        uint256 courseId,
        uint256 guideId,
        address student,
        uint256 usdtAmount,
        uint256 slearnAmount
    ) external onlyOwner vaultExists(courseId) {
        require(courseId > 0 && guideId > 0 && student != address(0), "Invalid params");
        guidePaidUSDT[courseId][guideId][student] = usdtAmount;
        guidePaidSLEARN[courseId][guideId][student] = slearnAmount;
        emit GuidePaidSet(courseId, guideId, student, usdtAmount, slearnAmount);
    }

    function setVaultBalance(uint256 courseId, uint256 balanceUsdt, uint256 balanceSlearn)
        external onlyOwner vaultExists(courseId)
    {
        require(balanceUsdt <= usdtToken.balanceOf(address(this)), "USDT exceeds real balance");
        require(balanceSlearn <= slearnToken.balanceOf(address(this)), "SLEARN exceeds real balance");
        vaults[courseId].balanceUsdt = balanceUsdt;
        vaults[courseId].balanceSlearn = balanceSlearn;
        emit VaultBalanceSet(courseId, balanceUsdt, balanceSlearn);
    }

    function setAmountPerGuide(uint256 courseId, uint256 amountUsdt, uint256 amountSlearn)
        external onlyOwner vaultExists(courseId)
    {
        vaults[courseId].amountPerGuideUsdt = amountUsdt;
        vaults[courseId].amountPerGuideSlearn = amountSlearn;
        emit AmountPerGuideSet(courseId, amountUsdt, amountSlearn);
    }

    // ============ EMERGENCY ============

    function emergencyWithdrawUSDT(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount > 0");
        emit EmergencyWithdrawal(address(usdtToken), amount);
        require(usdtToken.transfer(owner, amount), "USDT transfer failed");
    }

    function emergencyWithdrawSLEARN(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount > 0");
        emit EmergencyWithdrawal(address(slearnToken), amount);
        require(slearnToken.transfer(owner, amount), "SLEARN transfer failed");
    }

    // ============ VIEWS ============

    function getContractUSDTBalance() external view returns (uint256) {
        return usdtToken.balanceOf(address(this));
    }

    function getContractSLEARNBalance() external view returns (uint256) {
        return slearnToken.balanceOf(address(this));
    }

    function getStudentGuideStatus(
        uint256 courseId,
        uint256 guideId,
        address student
    ) external view returns (
        uint256 paidUSDT,
        uint256 paidSlearn,
        bool canSubmit
    ) {
        paidUSDT = guidePaidUSDT[courseId][guideId][student];
        paidSlearn = guidePaidSLEARN[courseId][guideId][student];
        canSubmit = studentCanSubmit(courseId, student);
    }
}
