// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract ScholarshipVaults {
    address public immutable owner;
    IERC20 public usdtToken;

    struct Vault {
        uint256 courseId;
        uint256 balance;
        uint256 amountPerGuide;
        bool exists;
    }

    mapping(uint256 => Vault) public vaults;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) 
      public guidePaid; // courseId => guideNumber => student => hasBeenPaid
    mapping(uint256 => mapping(address => uint256)) 
      public studentCooldowns; // courseId => student => lastSubmissionTimestamp

    event VaultCreated(uint256 courseId, uint256 amountPerGuide);
    event Deposit(uint256 courseId, uint256 amount);
    event ScholarshipReleased(
      uint256 courseId, uint256 guideNumber, address student, uint256 amount
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier vaultExists(uint256 courseId) {
        require(vaults[courseId].exists, "Vault does not exist");
        _;
    }

    constructor(address _usdtTokenAddress) {
        owner = msg.sender;
        usdtToken = IERC20(_usdtTokenAddress);
    }

    // Create a vault for a course (amount in USDT with 6 decimals)
    function createVault(uint256 courseId, uint256 amountPerGuide) external onlyOwner {
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
    function deposit(uint256 courseId, uint256 amount) external vaultExists(courseId) {
        require(courseId > 0, "Course id must be greater than 0");
        require(amount > 0, "Deposit amount must be greater than 0");
        // Prevent reentracy atacks https://docs.soliditylang.org/en/latest/security-considerations.html#re-entrancy
        uint256 forLearntg = amount/5;
        uint256 forVault = amount - forLearntg;
        vaults[courseId].balance += forVault;  
        emit Deposit(courseId, amount);
        require(
            usdtToken.transferFrom(msg.sender, owner, forLearntg),
            "USDT transfer for learntg failed"
        );

        require(
            usdtToken.transferFrom(msg.sender, address(this), forVault),
            "USDT transfer for vault failed, please write to support"
        );
    }

    // Check if a student can submit and receive scholarship for a course (24 hours have 
    // passed since his/her last submission)
    function studentCanSubmit(uint256 courseId, address student)
      public view vaultExists(courseId) returns (bool) {
        uint256 lastSubmission = studentCooldowns[courseId][student];
        // If student never submitted (lastSubmission == 0), they are eligible
        return lastSubmission == 0 || 
          block.timestamp >= lastSubmission + 1 days;
    }


    // Submit guide result for a student
    function submitGuideResult(
        uint256 courseId, 
        uint256 guideNumber, 
        address student, 
        bool isPerfect
    ) external onlyOwner vaultExists(courseId) {
        require(courseId > 0, "Course id must be greater than 0");
        require(guideNumber > 0, "Guide number must be greater than 0");
        require(student != address(0), "Invalid student address");
        require(studentCanSubmit(courseId, student), "Student is in cooldown period, cannot submit");
        require(!guidePaid[courseId][guideNumber][student], "Student already received an scolarship for this guide");
        require(vaults[courseId].balance >= vaults[courseId].amountPerGuide, "There are not enough funds to pay the scolarship");
        
        // Prevent reentracy atacks https://docs.soliditylang.org/en/latest/security-considerations.html#re-entrancy

        // Cooldown of 24 hours before the student tries to submit again in this course
        studentCooldowns[courseId][student] = block.timestamp;

        if (isPerfect) {
            // Release scholarship
            uint256 amount = vaults[courseId].amountPerGuide;
            vaults[courseId].balance -= amount;
            guidePaid[courseId][guideNumber][student] = true;
            emit ScholarshipReleased(courseId, guideNumber, student, amount);
            require(
              usdtToken.transfer(student, amount), "USDT transfer failed"
            );
        }
    }

    // Get vault information
    function getVault(uint256 courseId) external view returns (
        uint256 courseIdReturn,
        uint256 balance,
        uint256 amountPerGuide,
        bool exists
    ) {
        require(courseId > 0, "Course id must be greater than 0");
        Vault memory vault = vaults[courseId];
        return (
            vault.courseId,
            vault.balance,
            vault.amountPerGuide,
            vault.exists
        );
    }

    // Get student's last submission timestamp for a course
    function getStudentCooldown(uint256 courseId, address student) 
      external view returns (uint256) {
        return studentCooldowns[courseId][student];
    }

    // Get contract's USDT balance
    function getContractUSDTBalance() external view returns (uint256) {
        return usdtToken.balanceOf(address(this));
    }

    // Emergency withdraw function (only owner)
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(
            usdtToken.transfer(owner, amount),
            "USDT transfer failed"
        );
    }

    // Update USDT token address (only owner, in case of token upgrades)
    function updateUSDTAddress(address _newUSDTAddress) external onlyOwner {
        require(_newUSDTAddress != address(0), "Invalid USDT address");
        usdtToken = IERC20(_newUSDTAddress);
    }
}

