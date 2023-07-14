const { hardhat, ethers } = require("hardhat");

async function skipTime(time) {
    await ethers.provider.send("evm_increaseTime", [time]);
    await ethers.provider.send("evm_mine");
}

async function sendTokens(token, from, to, amount) {
    for (let i = 0; i < to.length; i++) {
        await token.connect(from).transfer(to[i], amount);
    }
}

async function delegateVotesSelf(token, from) {
    for (let i = 0; i < from.length; i++) {
        await token.connect(from).delegate(from[i].address);
    }
}

module.exports = {
    skipTime,
    sendTokens,
    delegateVotesSelf
}