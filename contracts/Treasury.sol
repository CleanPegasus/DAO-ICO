// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Treasury is Ownable {
    
    using SafeERC20 for IERC20;

    address public executor;

    mapping(address => uint256) public withdrawTime;

    constructor(address _executor) {
        executor = _executor;
    }

    function sendToken(address _token, address _recipient, uint256 _amount) external onlyExecutor {
        require(block.timestamp > withdrawTime[_token], "Treasury: Token is locked");
        IERC20(_token).safeTransfer(_recipient, _amount);
    }

    function withdrawAllTokens(address _token, address _recipient) external onlyExecutor {
        require(block.timestamp > withdrawTime[_token], "Treasury: Token is locked");
        uint256 tokenBalance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_recipient, tokenBalance);
    }

    function lockToken(address _token, uint256 _lockTime) external onlyExecutor {
        withdrawTime[_token] = block.timestamp + _lockTime;
    }

    modifier onlyExecutor() {
        require(msg.sender == executor, "Treasury: Only executor can call this function");
        _;
    }

}