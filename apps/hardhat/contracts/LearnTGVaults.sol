// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount)
      external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// ReentrancyGuard optimizado (más barato que OpenZeppelin)
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

contract LearnTGVaults is ReentrancyGuard {
  uint256 public constant VERSION = 2;
  address public immutable owner;
  IERC20 public immutable usdtToken;
  uint256 private constant PERCENTAGE_FOR_TEAM = 20;

  struct Vault {
    uint256 courseId;
    uint256 balance;
    uint256 amountPerGuide;
    bool exists;
  }

  mapping(uint256 => Vault) public vaults;

  // Estado final (nada de funciones temporales)
  mapping(uint256 => mapping(uint256 => mapping(address => uint256)))
    public guidePaid;            // courseId => guide => wallet => amount paid
  mapping(uint256 => mapping(uint256 => mapping(address => uint256)))
    public pendingScholarship;
  mapping(uint256 => mapping(address => uint256))
    public studentCooldowns;

  // Eventos
  event VaultCreated(uint256 indexed courseId, uint256 amountPerGuide);
  event Deposit(uint256 indexed courseId, uint256 amount);
  event ScholarshipPrepared(
    uint256 indexed courseId,
    uint256 indexed guideNumber,
    address indexed student,
    uint256 fullAmount,
    uint256 actualAmount,
    uint8 profileScore
  );
  event ScholarshipClaimed(
    uint256 indexed courseId,
    uint256 indexed guideNumber,
    address indexed student,
    uint256 amount
  );
  event ScholarshipAlreadyPaid(
    uint256 indexed courseId,
    uint256 indexed guideNumber,
    address indexed student
  );

  modifier onlyOwner() {
    require(msg.sender == owner, "Only owner");
    _;
  }

  modifier vaultExists(uint256 courseId) {
    require(vaults[courseId].exists, "Vault does not exist");
    _;
  }

  constructor(address _usdtToken) {
    owner = msg.sender;
    usdtToken = IERC20(_usdtToken);
  }

  // Create a vault for a course (amount in USDT with 6 decimals)
  function createVault(uint256 courseId, uint256 amountPerGuide)
  external onlyOwner {
    require(courseId > 0, "Course id must be greater than 0");
    require(amountPerGuide > 0, "Amount per guide must be greater than 0");
    require(
      !vaults[courseId].exists, "Vault already exists for this course"
    );
    vaults[courseId] = Vault({
      courseId: courseId,
      balance: 0,
      amountPerGuide: amountPerGuide,
      exists: true
    });

    emit VaultCreated(courseId, amountPerGuide);
  }



  // Deposit 80% of indicated USDT into a vault and 20% to learn.tg
  // (caller must approve this contract first)
  function deposit(uint256 courseId, uint256 amount)
  external vaultExists(courseId) nonReentrant {
    require(courseId > 0, "Course id must be greater than 0");
    require(amount > 0, "Deposit amount must be greater than 0");

    uint256 forTeam = (amount / 100) * PERCENTAGE_FOR_TEAM;
    uint256 forVault = amount - forTeam;

    vaults[courseId].balance += forVault;
    emit Deposit(courseId, amount);

    require(
      usdtToken.transferFrom(msg.sender, owner, forTeam),
      "Team transfer failed"
    );
    require(
      usdtToken.transferFrom(msg.sender, address(this), forVault),
      "Vault transfer failed"
    );
  }

  // Usada para migrar de versión anterior a esta
  function setGuidePaid(
    uint256 courseId,
    uint256 guideNumber,
    address student,
    uint256 amount
  ) external onlyOwner vaultExists(courseId) {
    require(
      courseId > 0 && guideNumber > 0 && student != address(0) &&
      amount > 0, "Invalid params"
    );
    guidePaid[courseId][guideNumber][student] = amount;
  }

  // Usada para migrar de versión anterior a esta
  function setVaultBalance(
    uint256 courseId,
    uint256 balance
  ) external onlyOwner vaultExists(courseId) {
    require(
      balance > 0, "Balance should be positive"
    );
    vaults[courseId].balance = balance;
  }


  // Backend llama esto cuando el estudiante envía solución
  function submitGuideResult(
    uint256 courseId,
    uint256 guideNumber,
    address student,
    bool isPerfect,
    uint8 profileScore
  ) external onlyOwner vaultExists(courseId) {
    require(
      courseId > 0 && guideNumber > 0 && student != address(0),
      "Invalid params");
      require(profileScore >= 50 && profileScore <= 100, "Score 50-100");
      require(studentCanSubmit(courseId, student), "In cooldown");

      uint256 paid = guidePaid[courseId][guideNumber][student];
      bool alreadyPaid = paid > 0;
      bool hasPending = pendingScholarship[courseId][guideNumber][student] > 0;

      if (alreadyPaid || hasPending) {
        if (alreadyPaid) {
          emit ScholarshipAlreadyPaid(courseId, guideNumber, student);
        }
        return;
      }

      studentCooldowns[courseId][student] = block.timestamp;

      if (!isPerfect) {
        return;
      }

      uint256 fullAmount = vaults[courseId].amountPerGuide;
      uint256 actualAmount = (fullAmount * profileScore) / 100;

      require(vaults[courseId].balance >= actualAmount, "Insufficient funds");

      pendingScholarship[courseId][guideNumber][student] = actualAmount;
      vaults[courseId].balance -= actualAmount;

      emit ScholarshipPrepared(courseId, guideNumber, student, fullAmount, actualAmount, profileScore);
  }


  // Estudiante reclama su beca
  function claimScolarship(uint256 courseId, uint256 guideNumber)
  external vaultExists(courseId) nonReentrant {
    uint256 amount = pendingScholarship[courseId][guideNumber][msg.sender];
    require(amount > 0, "No pending scholarship");

    pendingScholarship[courseId][guideNumber][msg.sender] = 0;
    guidePaid[courseId][guideNumber][msg.sender] = amount;

    emit ScholarshipClaimed(courseId, guideNumber, msg.sender, amount);
    require(usdtToken.transfer(msg.sender, amount), "Transfer failed");
  }

  function studentCanSubmit(uint256 courseId, address student)
  public view returns (bool) {
    uint256 last = studentCooldowns[courseId][student];
    return last == 0 || block.timestamp >= last + 1 days;
  }

  // Emergency withdraw (solo owner)
  function emergencyWithdraw(uint256 amount)
  external onlyOwner nonReentrant {
    require(amount > 0, "Amount > 0");
    require(usdtToken.transfer(owner, amount), "Transfer failed");
  }

  // Getters útiles
  function getContractUSDTBalance() external view returns (uint256) {
    return usdtToken.balanceOf(address(this));
  }

  function getStudentGuideStatus(
    uint256 courseId,
    uint256 guideNumber,
    address student
  ) external view returns (
  uint256 paidAmount,
  uint256 pendingAmount,
  bool canSubmit
  ) {
    paidAmount = guidePaid[courseId][guideNumber][student];
    pendingAmount = pendingScholarship[courseId][guideNumber][student];
    canSubmit = studentCanSubmit(courseId, student);
  }

}
