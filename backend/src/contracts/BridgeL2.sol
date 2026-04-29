// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChainForge Bridge L2 (Target Chain)
 * @dev Mints/Burns representing tokens on the target chain.
 */
contract BridgeL2 {
    address public admin;
    uint256 public totalBridged;

    event Mint(address indexed user, uint256 amount, uint256 timestamp);
    event Burn(address indexed user, uint256 amount, uint256 timestamp);

    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Admin/Relayer mints tokens for the user (after confirmation from L1)
     */
    function mint(address payable _user, uint256 _amount) external {
        // In a real native bridge, the L2 contract would have 'minting' rights 
        // from the chain's protocol or it handles an ERC20 wrapper.
        totalBridged += _amount;
        payable(_user).transfer(_amount); // Sending native tokens as a simplified example
        emit Mint(_user, _amount, block.timestamp);
    }

    /**
     * @dev User burns tokens to bridge back to L1
     */
    function burn() external payable {
        require(msg.value > 0, "Burn amount must be > 0");
        totalBridged -= msg.value;
        emit Burn(msg.sender, msg.value, block.timestamp);
    }

    receive() external payable {}
}
