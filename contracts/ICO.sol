// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts/security/Pausable.sol";

import "hardhat/console.sol";

contract ICOContract {

    using SafeERC20 for IERC20;

    address public treasuryAddress;
    IERC20 public stablecoin;
    uint256 public fees;
    address public executor;

    mapping(address => uint256) public tokenPrice;
    mapping(address => address) public stablecoinRecipient;

    //TODO: Events

    constructor(address _stablecoin, address _treasuryAddress, address _timelock, uint256 _fees) {
        stablecoin = IERC20(_stablecoin);
        treasuryAddress = _treasuryAddress;
        executor = _timelock;
        fees = _fees;
    }

    function buyToken(address _token, uint256 _amount) external buyChecks(_token, _amount) {

        uint256 price = (_amount * tokenPrice[_token]) / 1 ether;

        console.log("price: %s", price);

        uint256 feeAmount = (price * fees) / 2 ether;
        console.log("feeAmount: %s", feeAmount);

        // stablecoin transfer
        stablecoin.safeTransferFrom(msg.sender, stablecoinRecipient[_token], price);
        stablecoin.safeTransferFrom(msg.sender, treasuryAddress, (price * fees) / 2 ether); // sending stablecoin fee to treasury address
        console.log("Reached here");
        // ERC20 transfer
        IERC20(_token).transfer(msg.sender, _amount);
        IERC20(_token).transfer(treasuryAddress, (_amount * fees) / 2 ether);

    }

    function registerToken(address _token, uint256 _price, address _stablecoinRecipient) external onlyExecutor {
        tokenPrice[_token] = _price;
        stablecoinRecipient[_token] = _stablecoinRecipient;
    }

    function withdrawToken(address _token, address _to) external onlyExecutor {
        uint256 tokenBalance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_to, tokenBalance);
    }

    function updateTreasuryAddress(address _treasuryAddress) external onlyExecutor {
        treasuryAddress = _treasuryAddress;
    }

    function updateFees(uint256 _fees) external onlyExecutor {
        fees = _fees;
    }

    function updateStablecoin(address _stablecoin) external onlyExecutor {
        stablecoin = IERC20(_stablecoin);
    }

    modifier buyChecks(address _token, uint256 _amount) {
        uint256 tokenBalance = IERC20(_token).balanceOf(address(this));
        require(0 < _amount && _amount < tokenBalance, "Not enough balance in the contract");
        require(tokenPrice[_token] > 0, "The token is not registered");
        require(_token != address(0) && _token != address(stablecoin), "Invalid Token address");
        _;
    }

    modifier onlyExecutor() {
        require(msg.sender == executor, "Only executor can call this function");
        _;
    }


}

