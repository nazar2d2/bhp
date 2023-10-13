//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is ReentrancyGuard, Ownable {
    IERC20 public token;

    bool public isPaused = false;
    uint256 public rewardsPerSecond = 4.1538 ether;
    uint256 public constant stakingAmountToStart = 21 * 10 ** 6 * 10 ** 18; // 21M tokens
    uint256 public stakingStartTime = 0;
    uint256 public stakingEndTime = 0;
    uint256 public totalStaked = 0;

//	function getApy(){
//
//	}

    mapping(address => Stake) public userStakes;

    struct Stake {
        uint256 deposited;
        uint256 startStaking;
        uint256 timeOfLastUpdate;
        uint256 unclaimedRewards;
    }

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event ClaimRewards(address indexed user, uint256 amount);

    // Constructor function
    constructor(address _initialOwner, address _tokenAddress)
    Ownable(_initialOwner)
    {
        token = IERC20(_tokenAddress);
    }

    modifier whenNotPaused() {
        require(!isPaused, "E01: Contract is paused.");
        _;
    }

    modifier whenPaused() {
        require(isPaused, "E02: Contract is not paused.");
        _;
    }

    function pause()
    external
    onlyOwner
    whenNotPaused
    {
        isPaused = true;
    }

    function unpause()
    external
    onlyOwner
    whenPaused
    {
        isPaused = false;
    }

    function endStaking()
    external
    onlyOwner
    {
        stakingEndTime = block.timestamp;
    }

    // Deposit tokens to the contract, start/update staking
    function deposit(uint256 _amount)
    external
    nonReentrant
    {
        require(_amount > 0, "E03: Invalid amount");
        require(token.transferFrom(msg.sender, address(this), _amount), "E04: Transfer failed");

        if (stakingStartTime == 0 && totalStaked + _amount >= stakingAmountToStart) {
            stakingStartTime = block.timestamp;
        }

        Stake storage userStake = userStakes[msg.sender];

        if (userStake.deposited == 0) {
            // new staking deposit
            userStake.deposited = _amount;
            userStake.startStaking = block.timestamp;
            userStake.timeOfLastUpdate = block.timestamp;
            userStake.unclaimedRewards = 0;
        } else {
            // increase staking deposit
            uint256 rewards = calculateRewards(msg.sender);
            userStake.unclaimedRewards += rewards;
            userStake.deposited += _amount;
            userStake.timeOfLastUpdate = block.timestamp;
        }

        totalStaked += _amount;
        emit Deposit(msg.sender, _amount);
    }

    // Mints rewards for msg.sender
    function claimRewards()
    external
    nonReentrant
    {
        Stake storage userStake = userStakes[msg.sender];

        uint256 rewards = calculateRewards(msg.sender) + userStake.unclaimedRewards;
        require(rewards > 0, "E05: You have no rewards");

        if (token.balanceOf(address(this)) - totalStaked < rewards) {
            revert("E09: Not enough tokens in the contract for rewards");
        }

        userStake.unclaimedRewards = 0;
        userStake.timeOfLastUpdate = block.timestamp;

        _transfer_tokens(msg.sender, rewards);
        emit ClaimRewards(msg.sender, rewards);
    }

    // Withdraw specified amount of staked tokens
    function withdraw(uint256 _amount)
    external
    nonReentrant
    {
        Stake storage userStake = userStakes[msg.sender];
        require(userStake.deposited >= _amount, "E06: Can't withdraw more than you have");

        uint256 _rewards = calculateRewards(msg.sender);
        userStake.deposited -= _amount;
        userStake.timeOfLastUpdate = block.timestamp;
        userStake.unclaimedRewards = _rewards;
        totalStaked -= _amount;

        _transfer_tokens(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount);
    }

    // Withdraw all stake and rewards and mints them to the msg.sender
    function withdrawAll()
    external
    nonReentrant
    {
        Stake storage userStake = userStakes[msg.sender];
        require(userStake.deposited > 0, "E07: You have no deposit");

        uint256 _rewards = calculateRewards(msg.sender) + userStake.unclaimedRewards;
        uint256 _deposit = userStake.deposited;

        if (token.balanceOf(address(this)) - totalStaked < _rewards) {
            revert("E09: Not enough tokens in the contract for rewards");
        }

        userStake.deposited = 0;
        userStake.timeOfLastUpdate = 0;
        uint256 _amount = _rewards + _deposit;
        totalStaked -= _deposit;

        _transfer_tokens(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount);
    }

    // Function useful for fron-end that returns user stake and rewards by address
    function getDepositInfo(address _user)
    public
    view
    returns (uint256, uint256)
    {
        Stake storage userStake = userStakes[_user];

        uint256 _stake = userStake.deposited;
        uint256 _rewards = calculateRewards(_user) + userStake.unclaimedRewards;
        return (_stake, _rewards);
    }

    // Calculate the rewards since the last update on Deposit info
    function calculateRewards(address _user)
    internal
    view
    returns (uint256)
    {
        if (stakingStartTime == 0 || totalStaked == 0 || block.timestamp < stakingStartTime) {
            return 0;
        }

        Stake storage userStake = userStakes[_user];

        uint256 _startRewardsTimestamp;
        if (stakingStartTime > userStake.timeOfLastUpdate) {
            _startRewardsTimestamp = stakingStartTime;
        } else {
            _startRewardsTimestamp = userStake.timeOfLastUpdate;
        }

        uint256 _stakingDuration = block.timestamp - userStake.startStaking;
        uint256 _multiplier = getDurationMultiplier(_stakingDuration);
        uint256 _userWeight = (userStake.deposited * _multiplier) / 1 ether;

        uint256 _lastRewardsTimestamp;
        if (stakingEndTime == 0) {
            _lastRewardsTimestamp = block.timestamp;
        } else {
            _lastRewardsTimestamp = stakingEndTime;
        }

        return _userWeight * (_lastRewardsTimestamp - _startRewardsTimestamp) * rewardsPerSecond / totalStaked;
    }

    // -------------------- Private ----------------------

    function getDurationMultiplier(uint256 _duration)
    private pure
    returns (uint256) {
        if (_duration < 30 days) {
            return 0.9 ether;  // -10% penalty
        } else if (_duration < 90 days) {
            return 1 ether; // 100% for 30 days
        } else if (_duration < 180 days) {
            return 1.5 ether; // 150% for 90 days
        } else if (_duration < 360 days) {
            return 2 ether; // 200% for 180 days
        } else {
            return 2.5 ether; // 250% for 1 year
        }
    }

    function _transfer_tokens(address _to, uint256 _amount)
    private
    {
        require(token.transfer(_to, _amount), "E08: Transfer failed");
    }

}