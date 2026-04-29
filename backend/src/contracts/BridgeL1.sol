// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChainForge Bridge L1 (Source Chain)
 * @dev Locks funds on the source chain to be minted on the target chain.
 */
contract BridgeL1 {
    address public admin;
    uint256 public totalLocked;

    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed user, uint256 amount, uint256 timestamp);

    constructor() {
        admin = msg.sender;
    }

    modifier仅限管理员() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    /**
     * @dev User deposits funds to bridge to another chain
     */
    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be > 0");
        totalLocked += msg.value;
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @dev Admin/Relayer releases funds back to user (Withdrawal from target chain)
     */
    function release(address payable _user, uint256 _amount) external {
        // In a real bridge, this would be called by a multi-sig or a trusted relayer
        require(address(this).balance >= _amount, "Insufficient contract balance");
        totalLocked -= _amount;
        _user.transfer(_amount);
        emit Withdrawal(_user, _amount, block.timestamp);
    }

    receive() external payable {}
}
