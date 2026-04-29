// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Staking {
    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
    }

    mapping(address => Stake) public stakes;
    uint256 public totalStaked;
    uint256 public rewardRatePerYear = 1250; // 12.50% APY

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);

    function stake() public payable {
        require(msg.value > 0, "Amount must be greater than 0");
        if (stakes[msg.sender].amount > 0) {
            claimRewards();
        }
        stakes[msg.sender].amount += msg.value;
        stakes[msg.sender].startTime = block.timestamp;
        stakes[msg.sender].lastClaimTime = block.timestamp;
        totalStaked += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function calculateRewards(address _user) public view returns (uint256) {
        Stake memory userStake = stakes[_user];
        if (userStake.amount == 0) return 0;
        uint256 timeElapsed = block.timestamp - userStake.lastClaimTime;
        return (userStake.amount * rewardRatePerYear * timeElapsed) / (365 days * 10000);
    }

    function claimRewards() public {
        uint256 reward = calculateRewards(msg.sender);
        if (reward > 0) {
            stakes[msg.sender].lastClaimTime = block.timestamp;
            payable(msg.sender).transfer(reward);
            emit RewardClaimed(msg.sender, reward);
        }
    }

    function withdraw(uint256 _amount) public {
        require(stakes[msg.sender].amount >= _amount, "Insufficient balance");
        claimRewards();
        stakes[msg.sender].amount -= _amount;
        totalStaked -= _amount;
        payable(msg.sender).transfer(_amount);
        emit Unstaked(msg.sender, _amount);
    }

    receive() external payable {}
}
