//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

contract Modifiers {

    // Functions decrease contract size

    function _throwIfEqualToZero(uint _id) private pure {
        require(_id != 0, "EM01: Wrong input uint");
    }

    function _throwIfAddressIsInvalid(address _target) private pure {
        require(_target != address(0), "EM02: Wrong input address");
    }

    function _throwIfIsEmptyString(string calldata _id) private pure {
        require(bytes(_id).length > 0, "EM03: Wrong input string");
    }

    function _onlyCallByAddress(address _address) private view {
        require(msg.sender == _address, "EM04: No access to call");
    }

    // Modifiers

    /// @notice throw if the uint is equal to zero
    /// @param _id the ID to validate
    modifier throwIfEqualToZero(uint _id) {
        _throwIfEqualToZero(_id);
        _;
    }

    /// @notice throw if an address is invalid
    /// @param _target the address to check
    modifier throwIfAddressIsInvalid(address _target) {
        _throwIfAddressIsInvalid(_target);
        _;
    }

    /// @notice throw if the id is invalid
    /// @param _id the ID to validate
    modifier throwIfIsEmptyString(string calldata _id) {
        _throwIfIsEmptyString(_id);
        _;
    }

    /// @notice throw if caller is invalid
    /// @param _address only allow this address to call
    modifier onlyCallByAddress(address _address) {
        _onlyCallByAddress(_address);
        _;
    }

}