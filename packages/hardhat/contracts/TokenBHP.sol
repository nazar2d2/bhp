//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./helpers/modifiers.sol";

contract TokenBHP is ERC20, ERC20Burnable, Ownable, Modifiers {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_SUPPLY = 1618 * 10 ** 6 * 10 ** 18;
    uint256 private constant oneDistributionPart = MAX_SUPPLY / 5;
    uint256 private constant marketingEcosystemUnlocked = oneDistributionPart / 5;

    uint256 public constant timeWithoutFee = 30 days * 6;
    mapping(address => bool) public excludedFromFee;

    address private stakingContractAddress;
    address private multiSignContractAddress;
    address private preSalePaymentToken;
    uint256 private feeEnabledAfter;

    // Ecosystem rewards & Marketing vesting
    uint64 public vestingStart;
    uint64 public vestingEnd;
    uint256 public ecosystemVestingMinted;
    uint256 public marketingVestingMinted;

    // PreSale
    uint256 public presaleMinted;

    constructor(
        address _initialOwner, string memory _name, string memory _symbol,
        address _multiSignAddress, address _preSaleAddress
    )
    ERC20(_name, _symbol)
    Ownable(_initialOwner)
    {
        feeEnabledAfter = block.timestamp + timeWithoutFee;
        multiSignContractAddress = _multiSignAddress;
        preSalePaymentToken = _preSaleAddress;

        // Ecosystem & Marketing - 2 years vesting
        vestingStart = uint64(block.timestamp);
        vestingEnd = uint64(block.timestamp) + 720 days;

        // Mint 20% of total supply for LP
        _mint(msg.sender, oneDistributionPart);

        // Mint 20% from Marketing (4% from total) + 20% from Ecosystem (4% from total), rest amount by vesting
        _mint(multiSignContractAddress, marketingEcosystemUnlocked * 2);

        excludedFromFee[address(0)] = true;
    }

    // ------------------ Public/External ------------------

    function _update(address _from, address _to, uint256 _value)
    internal
    override(ERC20)
    {
        if (excludedFromFee[_from] || excludedFromFee[_to] || block.timestamp < feeEnabledAfter) {
            super._update(_from, _to, _value);
            return;
        }

        uint256 _taxBurn = _value * 309 / 100000; // 0.309 %
        super._update(_from, stakingContractAddress, _taxBurn);
        super._burn(_from, _taxBurn);
        super._update(_from, _to, _value - _taxBurn * 2);
    }

    function ecosystemMint()
    external
    throwIfAddressIsInvalid(multiSignContractAddress)
    {
        uint256 _availableForMint = getEcosystemUnlocked();
        uint256 _minUnlockAmount = oneDistributionPart / 5;

        if (_availableForMint >= _minUnlockAmount) {
            _mint(multiSignContractAddress, _minUnlockAmount);
            ecosystemVestingMinted += _minUnlockAmount;
        }
    }

    function getEcosystemUnlocked()
    public view
    returns (uint256)
    {
        return getEcosystemMarketingUnlocked() - ecosystemVestingMinted;
    }

    function marketingMint()
    external
    throwIfAddressIsInvalid(multiSignContractAddress)
    {
        uint256 _availableForMint = getMarketingUnlocked();
        uint256 _minUnlockAmount = oneDistributionPart / 5;

        if (_availableForMint >= _minUnlockAmount) {
            _mint(multiSignContractAddress, _minUnlockAmount);
            marketingVestingMinted += _minUnlockAmount;
        }
    }

    function getMarketingUnlocked()
    public view
    returns (uint256)
    {
        return getEcosystemMarketingUnlocked() - marketingVestingMinted;
    }

    function getEcosystemMarketingUnlocked()
    public view
    returns (uint256)
    {
        require(uint64(block.timestamp) >= vestingStart, "E01: Vesting not started");
        require(vestingEnd > vestingStart, "E02: Wrong vesting period");

        uint256 _unlockedAmount;
        if (block.timestamp >= vestingEnd) {
            _unlockedAmount = oneDistributionPart - marketingEcosystemUnlocked;
        } else {
            uint64 _duration = vestingEnd - vestingStart;
            _unlockedAmount = ((oneDistributionPart - marketingEcosystemUnlocked) * (block.timestamp - vestingStart)) / _duration;
        }

        return _unlockedAmount;
    }

    // amount - count of tokens to buy (not wei)
    function preSaleMint(uint32 _amount)
    external
    throwIfEqualToZero(_amount)
    {
        uint256 _amountWei = uint256(_amount) * 10 ** 18;
        require(presaleMinted + _amountWei < oneDistributionPart, "E03: Presale limit reached");

        uint256 _totalPrice = getPreSalePrice(_amount);
        IERC20(preSalePaymentToken).safeTransferFrom(msg.sender, multiSignContractAddress, _totalPrice);

        presaleMinted += _amountWei;
        _mint(msg.sender, _amountWei);
    }

    // amount - count of tokens to buy (not wei)
    function getPreSalePrice(uint32 _amount)
    public view
    returns (uint256)
    {
        uint256 _denominator = 1000;
        uint256 _priceOne = 10 ** 6 / 1000;
        uint256 _amountWei = uint256(_amount) * 10 ** 18;
        uint256 _soldPct = (presaleMinted + _amountWei) * 100 * _denominator / oneDistributionPart;

        if (_soldPct < 20 * _denominator) {
            return 1 * _priceOne * _amount;
        } else if (_soldPct < 40 * _denominator) {
            return 3 * _priceOne * _amount;
        } else if (_soldPct < 60 * _denominator) {
            return 8 * _priceOne * _amount;
        } else if (_soldPct < 80 * _denominator) {
            return 13 * _priceOne * _amount;
        }
        return 21 * _priceOne * _amount;
    }

    receive()
    external payable
    {}

    fallback()
    external payable
    {}

    // ------------------ Only Owner ------------------

    function exclude(address _addr, bool _status)
    external
    onlyOwner
    {
        excludedFromFee[_addr] = _status;
    }

    function setStakingContractAddress(address _stakingAddress)
    external
    throwIfAddressIsInvalid(_stakingAddress)
    onlyOwner
    {
        require(stakingContractAddress == address(0), "E04: Staking contract already set");

        // Staking contract, exclude from fee
        stakingContractAddress = _stakingAddress;
        excludedFromFee[stakingContractAddress] = true;

        // Mint 20% for staking
        _mint(stakingContractAddress, oneDistributionPart);
    }
}


