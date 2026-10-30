// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// V6 of LearnTGVaults — flexible scholarship split with referrer and learn.tg
// destination, plus self-enforcing accounting. The contract keeps one token
// balance and per-course numbers, so it also keeps their sum
// (totalRecordedUsdt/Slearn) and refuses any change that would leave the books
// above the money: setVaultBalance, recordCourseFunds, payScholarship,
// retireCourse and the emergency withdrawals all check the invariant. A forced
// emergency withdrawal marks the accounting as broken and blocks payments until
// the owner reconciles it. See doc/LearnTGVaultsV6.md.
// https://github.com/pasosdeJesus/learn.tg/issues/221

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

contract LearnTGVaultsV6 is ReentrancyGuard {
    uint256 public constant VERSION = 6;
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
        // Once retired a course cannot take funds, pay or be repriced: the only
        // operations left are retireCourse (to sweep whatever it still holds)
        // and the emergency withdrawals.
        bool retired;
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

    // Sum of every vaults[].balanceUsdt / balanceSlearn. It must never exceed the
    // tokens the contract holds; every mutation of vaults[] updates it and checks.
    uint256 public totalRecordedUsdt;
    uint256 public totalRecordedSlearn;

    // Set by a forced emergency withdrawal, cleared when the books reconcile again.
    bool public accountingBroken;

    // Events
    event VaultCreated(uint256 indexed courseId, uint256 amountPerGuideUsdt, uint256 amountPerGuideSlearn);
    event CourseFundsRecorded(uint256 indexed courseId, uint256 usdtAmount, uint256 slearnAmount);
    event ScholarshipPaidV5(
        uint256 indexed courseId,
        uint256 indexed guideId,
        address indexed student,
        uint256 studentUsdt,
        uint256 studentSlearn,
        address referrer,
        uint256 referrerUsdt,
        uint256 referrerSlearn,
        address learnTgWallet,
        uint256 learnTgUsdt,
        uint256 learnTgSlearn,
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
    event SlearnContractRoleSet(address indexed addr, bool authorized);
    // sent*: tokens actually transferred to the owner; unsent*: recorded amounts
    // that had no tokens behind them (a phantom) or were left in the pool because
    // the caller asked not to sweep.
    event CourseRetired(
        uint256 indexed courseId,
        uint256 sentUsdt,
        uint256 sentSlearn,
        uint256 unsentUsdt,
        uint256 unsentSlearn
    );
    event AccountingBroken(address indexed token, uint256 amount);
    event AccountingReconciled(uint256 totalRecordedUsdt, uint256 totalRecordedSlearn);
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

    // Reverts when the books claim more than the contract holds, and clears the
    // flag left by a forced emergency withdrawal once they are consistent again.
    function _assertSolvent() internal {
        require(
            totalRecordedUsdt <= usdtToken.balanceOf(address(this)),
            "Accounting: USDT exceeds real balance"
        );
        require(
            totalRecordedSlearn <= slearnToken.balanceOf(address(this)),
            "Accounting: SLEARN exceeds real balance"
        );
        if (accountingBroken) {
            accountingBroken = false;
            emit AccountingReconciled(totalRecordedUsdt, totalRecordedSlearn);
        }
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
        emit SlearnContractRoleSet(addr, authorized);
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
            exists: true,
            retired: false
        });
        emit VaultCreated(courseId, amountPerGuideUsdt, amountPerGuideSlearn);
    }

    // ============ SLEARN CONTRACT INTERFACE ============

    // recordCourseFunds is called by the SLEARN contract AFTER it has already
    // transferred USDT (via transferFrom) and minted SLEARN to this vault.
    // The SLEARN contract is a trusted, same-project contract — it handles
    // the actual token movement; this function only updates the accounting.
    function recordCourseFunds(uint256 courseId, uint256 usdtAmount, uint256 slearnAmount)
        external vaultExists(courseId) onlySlearnContract
    {
        require(!vaults[courseId].retired, "Course is retired");
        vaults[courseId].balanceUsdt += usdtAmount;
        vaults[courseId].balanceSlearn += slearnAmount;
        totalRecordedUsdt += usdtAmount;
        totalRecordedSlearn += slearnAmount;
        emit CourseFundsRecorded(courseId, usdtAmount, slearnAmount);
        _assertSolvent();
    }

    // ============ SCHOLARSHIP PAYMENT ============

    // V5: flexible split with referrer + learnTgWallet.
    // Per-token all-or-nothing: vault must have enough for the full scholarship
    // amount of a token, or that token is skipped entirely. Partial payment
    // between tokens is preserved (USDT today, SLEARN tomorrow).
    // Non-perfect submissions do NOT trigger cooldown.
    function payScholarship(
        uint256 courseId,
        uint256 guideId,
        address student,
        bool isPerfect,
        uint8 profileScore,
        address referrer,
        uint256 referrerUSDT,
        uint256 referrerSlearn,
        address learnTgWallet,
        uint256 learnTgUSDT,
        uint256 learnTgSlearn
    ) external onlyOwner vaultExists(courseId) nonReentrant {
        require(courseId > 0 && guideId > 0 && student != address(0), "Invalid params");
        require(profileScore >= 50 && profileScore <= 100, "Score 50-100");
        require(!vaults[courseId].retired, "Course is retired");
        require(!accountingBroken, "Accounting broken: reconcile first");
        require(studentCanSubmit(courseId, student), "In cooldown");

        bool alreadyPaidUSDT = guidePaidUSDT[courseId][guideId][student] > 0;
        bool alreadyPaidSLEARN = guidePaidSLEARN[courseId][guideId][student] > 0;

        // If both already paid, nothing to do
        if (alreadyPaidUSDT && alreadyPaidSLEARN) {
            emit ScholarshipAlreadyPaid(courseId, guideId, student);
            return;
        }

        // Non-perfect submission: just return, no cooldown punishment
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

        // Validate deductions
        uint256 totalDeductionsUSDT = referrerUSDT + learnTgUSDT;
        uint256 totalDeductionsSlearn = referrerSlearn + learnTgSlearn;
        require(totalDeductionsUSDT <= actualUSDT, "USDT deductions exceed scholarship");
        require(totalDeductionsSlearn <= actualSlearn, "SLEARN deductions exceed scholarship");

        // Self-referral prevention
        if (referrer != address(0)) {
            require(referrer != student, "Cannot refer yourself");
        }

        // Student receives the remainder
        uint256 studentUSDT = actualUSDT - totalDeductionsUSDT;
        uint256 studentSlearn = actualSlearn - totalDeductionsSlearn;

        uint256 paidUSDT = 0;
        uint256 paidSlearn = 0;

        // Pay USDT if not already paid AND vault has enough for the full amount
        if (!alreadyPaidUSDT && actualUSDT > 0 && vault.balanceUsdt >= actualUSDT) {
            if (studentUSDT > 0) {
                require(usdtToken.transfer(student, studentUSDT), "USDT student transfer failed");
            }
            if (referrer != address(0) && referrerUSDT > 0) {
                require(usdtToken.transfer(referrer, referrerUSDT), "USDT referrer transfer failed");
            }
            if (learnTgWallet != address(0) && learnTgUSDT > 0) {
                require(usdtToken.transfer(learnTgWallet, learnTgUSDT), "USDT learnTg transfer failed");
            }

            // Update state AFTER all transfers succeeded
            vault.balanceUsdt -= actualUSDT;
            totalRecordedUsdt -= actualUSDT;
            guidePaidUSDT[courseId][guideId][student] = actualUSDT;
            paidUSDT = actualUSDT;
        }

        // Pay SLEARN if not already paid AND vault has enough for the full amount
        if (!alreadyPaidSLEARN && actualSlearn > 0 && vault.balanceSlearn >= actualSlearn) {
            if (studentSlearn > 0) {
                require(slearnToken.transfer(student, studentSlearn), "SLEARN student transfer failed");
            }
            if (referrer != address(0) && referrerSlearn > 0) {
                require(slearnToken.transfer(referrer, referrerSlearn), "SLEARN referrer transfer failed");
            }
            if (learnTgWallet != address(0) && learnTgSlearn > 0) {
                require(slearnToken.transfer(learnTgWallet, learnTgSlearn), "SLEARN learnTg transfer failed");
            }

            // Update state AFTER all transfers succeeded
            vault.balanceSlearn -= actualSlearn;
            totalRecordedSlearn -= actualSlearn;
            guidePaidSLEARN[courseId][guideId][student] = actualSlearn;
            paidSlearn = actualSlearn;
        }

        _assertSolvent();

        // Cooldown only if something was actually paid
        if (paidUSDT > 0 || paidSlearn > 0) {
            studentCooldowns[courseId][student] = block.timestamp;
            emit ScholarshipPaidV5(
                courseId, guideId, student,
                studentUSDT, studentSlearn,
                referrer, referrerUSDT, referrerSlearn,
                learnTgWallet, learnTgUSDT, learnTgSlearn,
                profileScore
            );
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

    // Migration helper: sets one course's balance and keeps the global totals in
    // step. It cannot declare more than the contract holds, and the check is on
    // the SUM of every course, not on this amount alone.
    function setVaultBalance(uint256 courseId, uint256 balanceUsdt, uint256 balanceSlearn)
        external onlyOwner vaultExists(courseId)
    {
        require(!vaults[courseId].retired, "Course is retired: use retireCourse");
        Vault storage vault = vaults[courseId];
        totalRecordedUsdt = totalRecordedUsdt - vault.balanceUsdt + balanceUsdt;
        totalRecordedSlearn = totalRecordedSlearn - vault.balanceSlearn + balanceSlearn;
        vault.balanceUsdt = balanceUsdt;
        vault.balanceSlearn = balanceSlearn;
        emit VaultBalanceSet(courseId, balanceUsdt, balanceSlearn);
        _assertSolvent();
    }

    // Retires a course and cleans its books in the same call, so the accounting
    // cannot keep a claim for a course that no longer exists (the 8 USDT of the
    // retired course 106 travelled from V2 to V5 that way). The vault is kept so
    // historical checks still resolve, but it is empty and pays nothing.
    //
    // There is ONE token balance for every course, so "the course's money" is its
    // recorded balance and it can only be paid out of the unallocated float once
    // the other courses are covered: sent = min(recorded, float). Whatever the
    // course records above that has no tokens behind it and is only written off.
    // With sendToOwner = false the backed part stays in the pool as float.
    function retireCourse(uint256 courseId, bool sendToOwner)
        external onlyOwner vaultExists(courseId) nonReentrant
    {
        Vault storage vault = vaults[courseId];
        uint256 recordedUsdt = vault.balanceUsdt;
        uint256 recordedSlearn = vault.balanceSlearn;

        uint256 remainingUsdt = totalRecordedUsdt - recordedUsdt;
        uint256 remainingSlearn = totalRecordedSlearn - recordedSlearn;
        uint256 heldUsdt = usdtToken.balanceOf(address(this));
        uint256 heldSlearn = slearnToken.balanceOf(address(this));
        uint256 floatUsdt = heldUsdt > remainingUsdt ? heldUsdt - remainingUsdt : 0;
        uint256 floatSlearn = heldSlearn > remainingSlearn ? heldSlearn - remainingSlearn : 0;

        uint256 backedUsdt = recordedUsdt < floatUsdt ? recordedUsdt : floatUsdt;
        uint256 backedSlearn = recordedSlearn < floatSlearn ? recordedSlearn : floatSlearn;

        uint256 sentUsdt = sendToOwner ? backedUsdt : 0;
        uint256 sentSlearn = sendToOwner ? backedSlearn : 0;

        totalRecordedUsdt = remainingUsdt;
        totalRecordedSlearn = remainingSlearn;
        vault.balanceUsdt = 0;
        vault.balanceSlearn = 0;
        vault.amountPerGuideUsdt = 0;
        vault.amountPerGuideSlearn = 0;
        vault.retired = true;

        if (sentUsdt > 0) {
            require(usdtToken.transfer(owner, sentUsdt), "USDT transfer failed");
        }
        if (sentSlearn > 0) {
            require(slearnToken.transfer(owner, sentSlearn), "SLEARN transfer failed");
        }

        emit CourseRetired(
            courseId,
            sentUsdt,
            sentSlearn,
            recordedUsdt - sentUsdt,
            recordedSlearn - sentSlearn
        );
        _assertSolvent();
    }

    function setAmountPerGuide(uint256 courseId, uint256 amountUsdt, uint256 amountSlearn)
        external onlyOwner vaultExists(courseId)
    {
        require(!vaults[courseId].retired, "Course is retired");
        vaults[courseId].amountPerGuideUsdt = amountUsdt;
        vaults[courseId].amountPerGuideSlearn = amountSlearn;
        emit AmountPerGuideSet(courseId, amountUsdt, amountSlearn);
    }

    // ============ EMERGENCY ============

    // Only the unallocated float can leave without touching the books. To migrate
    // a vault, zero the courses first (setVaultBalance / retireCourse), withdraw,
    // and declare the balances again in the new contract.
    function emergencyWithdrawUSDT(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount > 0");
        uint256 float = usdtToken.balanceOf(address(this)) - totalRecordedUsdt;
        require(amount <= float, "Withdrawal would break accounting");
        emit EmergencyWithdrawal(address(usdtToken), amount);
        require(usdtToken.transfer(owner, amount), "USDT transfer failed");
    }

    function emergencyWithdrawSLEARN(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount > 0");
        uint256 float = slearnToken.balanceOf(address(this)) - totalRecordedSlearn;
        require(amount <= float, "Withdrawal would break accounting");
        emit EmergencyWithdrawal(address(slearnToken), amount);
        require(slearnToken.transfer(owner, amount), "SLEARN transfer failed");
    }

    // Last resort: takes tokens that the books claim. It leaves the contract in a
    // state where payments revert until the owner reconciles (retireCourse or
    // setVaultBalance), so a drift can never go unnoticed again.
    function forceEmergencyWithdrawUSDT(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount > 0");
        require(amount <= usdtToken.balanceOf(address(this)), "Amount exceeds balance");
        accountingBroken = true;
        emit AccountingBroken(address(usdtToken), amount);
        require(usdtToken.transfer(owner, amount), "USDT transfer failed");
    }

    function forceEmergencyWithdrawSLEARN(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount > 0");
        require(amount <= slearnToken.balanceOf(address(this)), "Amount exceeds balance");
        accountingBroken = true;
        emit AccountingBroken(address(slearnToken), amount);
        require(slearnToken.transfer(owner, amount), "SLEARN transfer failed");
    }

    // ============ VIEWS ============

    // One call for the off-chain check (apps/web/bin/check-vault-balances.mjs).
    function accountingState() external view returns (
        uint256 heldUsdt,
        uint256 heldSlearn,
        uint256 recordedUsdt,
        uint256 recordedSlearn,
        bool broken
    ) {
        heldUsdt = usdtToken.balanceOf(address(this));
        heldSlearn = slearnToken.balanceOf(address(this));
        recordedUsdt = totalRecordedUsdt;
        recordedSlearn = totalRecordedSlearn;
        broken = accountingBroken;
    }

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
