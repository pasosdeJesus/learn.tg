// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CeloUbi
 * @author learn.tg
 * @notice This contract manages the distribution of a Universal Basic Income (UBI)
 * in CELO. It is designed to be called by a trusted backend service that
 * verifies user eligibility (e.g., profileScore) before initiating a claim.
 * This ensures that on-chain rules are met and prevents Sybil attacks.
 */
contract CeloUbi is Ownable {
    // The fixed amount of CELO to be rewarded per claim (1 CELO).
    uint256 public constant REWARD_AMOUNT = 1 ether;

    // The cooldown period required between claims for a single user (24 hours).
    uint256 public constant COOLDOWN_PERIOD = 24 hours;

    // The trusted backend address authorized to call the claim function.
    address public backendAddress;

    // Mapping to store the timestamp of the last claim for each recipient.
    mapping(address => uint256) public lastClaimed;

    // Emitted when a user successfully claims their UBI.
    event Claimed(address indexed recipient, uint256 amount);
    // Emitted when the owner deposits funds into the contract.
    event Deposited(address indexed sender, uint256 amount);
    // Emitted when the owner performs an emergency withdrawal.
    event EmergencyWithdrawal(address indexed owner, uint256 amount);
    // Emitted when the backend address is updated.
    event BackendAddressUpdated(address indexed newBackendAddress);

    /**
     * @dev Modifier to restrict function calls to the trusted backend address.
     */
    modifier onlyBackend() {
        require(msg.sender == backendAddress, "CeloUbi: Caller is not the authorized backend");
        _;
    }

    /**
     * @notice Sets the initial owner and the trusted backend address.
     * @param initialOwner The address of the contract owner/administrator.
     * @param _backendAddress The initial address for the trusted backend service.
     */
    constructor(address initialOwner, address _backendAddress) Ownable(initialOwner) {
        require(_backendAddress != address(0), "CeloUbi: Backend address cannot be the zero address");
        backendAddress = _backendAddress;
        emit BackendAddressUpdated(_backendAddress);
    }

    /**
     * @notice Allows the owner to update the trusted backend address.
     * @param _newBackendAddress The new address for the backend service.
     */
    function setBackendAddress(address _newBackendAddress) public onlyOwner {
        require(_newBackendAddress != address(0), "CeloUbi: Backend address cannot be the zero address");
        backendAddress = _newBackendAddress;
        emit BackendAddressUpdated(_newBackendAddress);
    }

    /**
     * @notice Allows the owner to deposit CELO into the contract.
     * This function is payable.
     */
    function deposit() public payable onlyOwner {
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Called by the backend to process a user's UBI claim.
     * @param recipient The user's address that will receive the UBI.
     * @dev This function enforces the cooldown period and sufficient balance checks.
     */
    function claim(address recipient) public onlyBackend {
        require(block.timestamp >= lastClaimed[recipient] + COOLDOWN_PERIOD, "CeloUbi: Cooldown period not over");
        require(address(this).balance >= REWARD_AMOUNT, "CeloUbi: Insufficient contract balance");

        lastClaimed[recipient] = block.timestamp;

        (bool success, ) = recipient.call{value: REWARD_AMOUNT}("");
        require(success, "CeloUbi: CELO transfer failed");

        emit Claimed(recipient, REWARD_AMOUNT);
    }

    /**
     * @notice Allows the owner to withdraw all funds from the contract in an emergency.
     * This can be used for contract upgrades or unforeseen circumstances.
     */
    function emergencyWithdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        emit EmergencyWithdrawal(owner(), balance);
        (bool success, ) = owner().call{value: balance}("");
        require(success, "CeloUbi: Emergency withdrawal failed");
    }

    /**
     * @notice Returns the current CELO balance of the contract.
     * @return The balance in wei.
     */
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}