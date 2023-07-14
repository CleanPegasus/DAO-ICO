
const hre = require("hardhat");
const { ethers } = require("hardhat");

async function deploy() {

  const fees = ethers.utils.parseEther("0.03") // 3% fees

  const [deployer] = await ethers.getSigners();
  // console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Fake USDC contract
  const FakeUSDC = await ethers.getContractFactory("MockToken");
  const fakeUSDC = await FakeUSDC.deploy('Fake USDC', 'FUSDC');
  await fakeUSDC.deployed();
  // console.log("FakeUSDC deployed to:", fakeUSDC.address);

  // Deploy Timelock contract
  // 1 week timelock = 604800 seconds
  const Timelock = await ethers.getContractFactory("TimeLock");
  const timelock = await Timelock.deploy(1, [deployer.address], [deployer.address], deployer.address);
  await timelock.deployed();
  // console.log("Timelock deployed to:", timelock.address);

  // Deploy governance token
  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy(ethers.utils.parseEther("1000000"));
  await governanceToken.deployed();
  // console.log("GovernanceToken deployed to:", governanceToken.address);

  // Deploy Governance
  const Governance = await ethers.getContractFactory("ICODAO");
  const governance = await Governance.deploy(governanceToken.address, timelock.address);
  await governance.deployed();
  // console.log("Governance deployed to:", governance.address);

  // grant roles to governor
  const proposerRole = await timelock.PROPOSER_ROLE()
  const executorRole = await timelock.EXECUTOR_ROLE()
  await timelock.grantRole(proposerRole, governance.address)
  await timelock.grantRole(executorRole, governance.address)

  // Deploy Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(timelock.address);
  await treasury.deployed();
  // console.log("Treasury deployed to:", treasury.address);

  // Deploy ICO
  const ICO = await ethers.getContractFactory("ICOContract");
  const ico = await ICO.deploy(fakeUSDC.address, treasury.address, timelock.address, fees);
  await ico.deployed();
  // console.log("ICO deployed to:", ico.address);

  

  return {
    fakeUSDC: fakeUSDC,
    timelock: timelock,
    governanceToken: governanceToken,
    governance: governance,
    treasury: treasury,
    ico: ico
  }

}

async function deployMockToken() {
  
    // Deploy MockToken contract
    const MockToken = await ethers.getContractFactory("MockToken");
    const mockToken = await MockToken.deploy('MockToken', 'Mock');
    await mockToken.deployed();
    // console.log("MockToken deployed to:", mockToken.address);
  
    return mockToken
  
}

module.exports = { deploy, deployMockToken };
