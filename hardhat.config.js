require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.14",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
};
