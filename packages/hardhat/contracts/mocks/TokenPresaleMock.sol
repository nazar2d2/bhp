// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenPresaleMock is ERC20, ERC20Burnable, Ownable {
    constructor(address _initialOwner, address _recipient)
    ERC20("Token mockup", "tUSDT")
    Ownable(_initialOwner)
    {
        _mint(msg.sender, 10000000 * 10 ** decimals());
        _mint(_recipient, 10000000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount)
    public
    onlyOwner
    {
        _mint(to, amount);
    }

    function decimals()
    public view virtual override
    returns (uint8)
    {
        return 6;
    }
}