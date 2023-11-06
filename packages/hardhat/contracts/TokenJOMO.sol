//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./helpers/errors.sol";
import "./TokenBHP.sol";

contract TokenJOMO is ERC20 {
    uint64 public constant BLOCK_REWARD = 10000000000000;
    address private immutable tokenBHPAddress;
    mapping(address => uint32) private lastBlockUpdate;

    constructor(string memory _name, string memory _symbol, address _tokenBHPAddress)
    ERC20(_name, _symbol)
    {
        tokenBHPAddress = _tokenBHPAddress;
    }

    function updateRewards(address _userAddress) external {
        if (msg.sender != tokenBHPAddress) {
            revert("Only TokenBHP can update rewards");
        }

        if (lastBlockUpdate[_userAddress] > 0) {
            TokenBHP _tokenBHP = TokenBHP(tokenBHPAddress);
            uint256 _userBalance = _tokenBHP.balanceOf(_userAddress);
            uint256 _blocksDiff = block.number - lastBlockUpdate[_userAddress];

            uint256 _govAmount = (_blocksDiff * BLOCK_REWARD * _userBalance) / 10 ** 18;
//            console.log('_userAddress', _userAddress);
//            console.log('_userBalance', _userBalance);
//            console.log('_blocksDiff', _blocksDiff);
//            console.log('_govAmount', _govAmount);
//            console.log('-----------------------');

            _mint(_userAddress, _govAmount);
        }

        lastBlockUpdate[_userAddress] = uint32(block.number);
    }

    function _update(address _from, address _to, uint256 _value)
    internal
    override(ERC20)
    {
        if (_from == address(0)) {
            super._update(_from, _to, _value);
        } else {
            revert("Token is not transferable");
        }
    }

}