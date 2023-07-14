const { hardhat, ethers } = require("hardhat");
const { expect } = require("chai");
const { deploy, deployMockToken } = require("../scripts/deploy");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");


/**
 * Tests
 * 1. Deploy all contracts
 * 2. Make a proposal to register a token
 * 3. Vote on proposal
 * 4. Execute proposal
 * 5. Buy Tokens
 * 6. Withdraw Tokens
 * 7. updates (fees, stablecoin, treasury, etc.)
 * 8. treasury tests
 */

describe("Tests", () => {

  async function propose(governance, targets, values, calldatas, description) {
    const tx = await governance.propose(targets, values, calldatas, description);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => e.event === 'ProposalCreated');
    const proposalId = event?.args?.proposalId;
    return proposalId;
  }

  async function vote(governance, proposalId, voters, support) {
    for (const voter of voters) {
      await governance.connect(voter).castVote(proposalId, support);
    }
  }

  async function execute(governance, targets, values, calldatas, description) {
    const hash = ethers.utils.id(description);
    await governance.queue(targets, values, calldatas, hash);
    await mineBlocks(10);
    await governance.execute(targets, values, calldatas, hash);
  }

  async function proposeAndExecute(governance, voters, targets, values, calldatas, description) {

    const proposalId = await propose(governance, targets, values, calldatas, description);
    await mineBlocks(1);
    await vote(governance, proposalId, voters, 1);
    await mineBlocks(2);
    await execute(governance, targets, values, calldatas, description);
  }

  async function mineBlocks(blocks) {
    for (let i = 0; i < blocks; i++) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  async function transferAndDelegateFixture(governanceToken, voters, amount) {
    await governanceToken.transfer(voters[1].address, amount);
    await governanceToken.transfer(voters[2].address, amount);
    await governanceToken.transfer(voters[3].address, amount);

    await governanceToken.connect(voters[0]).delegate(voters[0].address);
    await governanceToken.connect(voters[1]).delegate(voters[1].address);
    await governanceToken.connect(voters[2]).delegate(voters[2].address);
    await governanceToken.connect(voters[3]).delegate(voters[3].address);
  }

  describe("Governance", () => {

    before(async function () {

      const { fakeUSDC, timelock, governanceToken, governance, treasury, ico } = await deploy();

      const [deployer, voter1, voter2, voter3] = await ethers.getSigners();

      const mockToken = await deployMockToken();

      await transferAndDelegateFixture(governanceToken, [deployer, voter1, voter2, voter3], ethers.utils.parseEther("1000"));

      // Contracts
      this.fakeUSDC = fakeUSDC;
      this.timelock = timelock;
      this.governanceToken = governanceToken;
      this.governance = governance;
      this.treasury = treasury;
      this.ico = ico;
      this.mockToken = mockToken;

      // Signers
      this.deployer = deployer;
      this.voter1 = voter1;
      this.voter2 = voter2;
      this.voter3 = voter3;

    });


    it('Should make a proposal to register a token', async function () {

      const targets = [this.ico.address, this.treasury.address];
      const values = [0, 0];
      const calldatas = [this.ico.interface.encodeFunctionData("registerToken",
        [this.mockToken.address, ethers.utils.parseEther("2"), this.deployer.address]),
        this.treasury.interface.encodeFunctionData("lockToken",
        [this.mockToken.address, 60 * 60 * 24 * 365])]; // 1 year
      const description = "Register Mock Token";

      const proposalId = await propose(this.governance, targets, values, calldatas, description);
      await mineBlocks(1);

      // States: Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed
      expect(await this.governance.state(proposalId)).to.equal(1);
      expect(await this.ico.tokenPrice(this.mockToken.address)).to.equal(0);

      this.proposalId = proposalId;
      this.targets = targets;
      this.values = values;
      this.calldatas = calldatas;
      this.description = description;

    });

    it('Should vote on proposal', async function () {
      await vote(this.governance, this.proposalId, [this.deployer, this.voter1, this.voter2, this.voter3], 1);
      const { againstVotes, forVotes, abstainVotes } = await this.governance.proposalVotes(this.proposalId);
      console.log('For Votes: ', forVotes.toString());
      console.log('Against Votes: ', againstVotes.toString());
      console.log('Abstain Votes: ', abstainVotes.toString());
    });

    it('Should execute proposal', async function () {
      await execute(this.governance, this.targets, this.values, this.calldatas, this.description);

      expect(await this.governance.state(this.proposalId)).to.equal(7); // Executed
      expect(await this.ico.tokenPrice(this.mockToken.address)).to.equal(ethers.utils.parseEther("2"));
      expect(await this.ico.stablecoinRecipient(this.mockToken.address)).to.equal(this.deployer.address);

      // TODO: Check that the token is locked
      // expect(await this.treasury.withdrawTime(this.mockToken.address)).to.equal();
    });

  });

  describe("ICO", () => {
    before(async function () {
      const { fakeUSDC, timelock, governanceToken, governance, treasury, ico } = await deploy();

      const [deployer, voter1, voter2, voter3] = await ethers.getSigners();

      const mockToken = await deployMockToken();

      // Transfer FUSDC to voters
      await fakeUSDC.transfer(voter1.address, ethers.utils.parseEther("1000"));
      await fakeUSDC.transfer(voter2.address, ethers.utils.parseEther("1000"));
      await fakeUSDC.transfer(voter3.address, ethers.utils.parseEther("1000"));

      // Transfer tokens and delegate
      await transferAndDelegateFixture(governanceToken, [deployer, voter1, voter2, voter3], ethers.utils.parseEther("1000"));

      const targets = [ico.address, treasury.address];
      const values = [0, 0];
      const calldatas = [ico.interface.encodeFunctionData("registerToken",
        [mockToken.address, ethers.utils.parseEther("2"), deployer.address]),
        treasury.interface.encodeFunctionData("lockToken",
        [mockToken.address, 60 * 60 * 24 * 365])]; // 1 year
      const description = "Register Mock Token";

      await proposeAndExecute(governance, [deployer, voter1, voter2, voter3], targets, values, calldatas, description);

      await mockToken.transfer(ico.address, ethers.utils.parseEther("1000"));

      // Contracts
      this.fakeUSDC = fakeUSDC;
      this.timelock = timelock;
      this.governanceToken = governanceToken;
      this.governance = governance;
      this.treasury = treasury;
      this.ico = ico;
      this.mockToken = mockToken;

      // Signers
      this.deployer = deployer;
      this.voter1 = voter1;
      this.voter2 = voter2;
      this.voter3 = voter3;
    });

    it('Should buy tokens', async function () {

      await this.fakeUSDC.connect(this.voter1).approve(this.ico.address, ethers.utils.parseEther("1000"));
      await this.ico.connect(this.voter1).buyToken(this.mockToken.address, ethers.utils.parseEther("1"));

      expect(await this.mockToken.balanceOf(this.voter1.address)).to.equal(ethers.utils.parseEther("1"));
      // TODO: More checks
    });

    it('should be able to withdraw tokens', async function () {

      const deployerBalance = await this.mockToken.balanceOf(this.deployer.address);
      const icoBalance = await this.mockToken.balanceOf(this.ico.address);

      const targets = [this.ico.address];
      const values = [0];
      const calldatas = [this.ico.interface.encodeFunctionData("withdrawToken", [this.mockToken.address, this.deployer.address])];
      const description = "Withdraw Mock Token";

      await proposeAndExecute(this.governance, [this.deployer, this.voter1, this.voter2, this.voter3], targets, values, calldatas, description);

      expect(await this.mockToken.balanceOf(this.deployer.address)).to.equal(deployerBalance.add(icoBalance));
      expect(await this.mockToken.balanceOf(this.ico.address)).to.equal(0);
    });

    it('should be able to update variables in the ICO', async function () {

      const { fakeUSDC, treasury, } = await deploy();

      const targets = [this.ico.address, this.ico.address, this.ico.address];
      const values = [0, 0, 0];
      const calldatas = [this.ico.interface.encodeFunctionData("updateStablecoin", [fakeUSDC.address]),
        this.ico.interface.encodeFunctionData("updateTreasuryAddress", [treasury.address]),
        this.ico.interface.encodeFunctionData("updateFees", [ethers.utils.parseEther("0.05")])];
      const description = "Update ICO";

      await proposeAndExecute(this.governance, [this.deployer, this.voter1, this.voter2, this.voter3], targets, values, calldatas, description);

      console.log('Stablecoin: ', await this.ico.stablecoin());
      expect(await this.ico.stablecoin()).to.equal(fakeUSDC.address);
      expect(await this.ico.treasuryAddress()).to.equal(treasury.address);
      expect(await this.ico.fees()).to.equal(ethers.utils.parseEther("0.05"));
      
    });
  });

  describe("Treasury", () => {
    before(async function () {
      const { fakeUSDC, timelock, governanceToken, governance, treasury, ico } = await deploy();

      const [deployer, voter1, voter2, voter3] = await ethers.getSigners();

      const mockToken = await deployMockToken();

      // Transfer and delegate tokens
      await transferAndDelegateFixture(governanceToken, [deployer, voter1, voter2, voter3], ethers.utils.parseEther("1000"));

      // Transfer FUSDC to treasury
      await fakeUSDC.transfer(treasury.address, ethers.utils.parseEther("1000"));

      // Contracts
      this.fakeUSDC = fakeUSDC;
      this.treasury = treasury;
      this.mockToken = mockToken;
      this.governance = governance;

      // Signers
      this.deployer = deployer;
      this.voter1 = voter1;
      this.voter2 = voter2;
      this.voter3 = voter3;

    });

    it('should be able to withdraw tokens', async function () {

      const deployerBalance = await this.fakeUSDC.balanceOf(this.deployer.address);
      const treasuryBalance = await this.fakeUSDC.balanceOf(this.treasury.address);

      const targets = [this.treasury.address];
      const values = [0];
      const calldatas = [this.treasury.interface.encodeFunctionData("withdrawAllTokens", [this.fakeUSDC.address, this.deployer.address])];
      const description = "Withdraw All FUSDC Tokens";

      await proposeAndExecute(this.governance, [this.deployer, this.voter1, this.voter2, this.voter3], targets, values, calldatas, description);

      expect(await this.fakeUSDC.balanceOf(this.deployer.address)).to.equal(deployerBalance.add(treasuryBalance));
      expect(await this.fakeUSDC.balanceOf(this.treasury.address)).to.equal(0);
    });

    it('should be able to lock tokens', async function () {
        
        const targets = [this.treasury.address];
        const values = [0];
        const calldatas = [this.treasury.interface.encodeFunctionData("lockToken", [this.mockToken.address, 60 * 60 * 24 * 365])]; // 1 year
        const description = "Lock Mock Token";

        await proposeAndExecute(this.governance, [this.deployer, this.voter1, this.voter2, this.voter3], targets, values, calldatas, description);
        const timestamp = (await ethers.provider.getBlock('latest')).timestamp;
        console.log(timestamp);
        await this.mockToken.transfer(this.treasury.address, ethers.utils.parseEther("1000"));

        expect(await this.mockToken.balanceOf(this.treasury.address)).to.equal(ethers.utils.parseEther("1000"));
        expect(await this.treasury.withdrawTime(this.mockToken.address)).to.equal(timestamp + 60 * 60 * 24 * 365);

        const targets2 = [this.treasury.address];
        const values2 = [0];
        const calldatas2 = [this.treasury.interface.encodeFunctionData("withdrawAllTokens", [this.mockToken.address, this.deployer.address])];
        const description2 = "Withdraw Mock Token";

        await expect(proposeAndExecute(this.governance, [this.deployer, this.voter1, this.voter2, this.voter3], targets2, values2, calldatas2, description2)).to.be.revertedWith("TimelockController: underlying transaction reverted");

    });

    it('should be able to withdraw locked tokens after lock period', async function () {
        
        const deployerBalance = await this.mockToken.balanceOf(this.deployer.address);
        const treasuryBalance = await this.mockToken.balanceOf(this.treasury.address);

        await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 365 + 1]);
  
        const targets = [this.treasury.address];
        const values = [0];
        const calldatas = [this.treasury.interface.encodeFunctionData("withdrawAllTokens", [this.mockToken.address, this.deployer.address])];
        const description = "Withdraw All Mock Token";
  
        await proposeAndExecute(this.governance, [this.deployer, this.voter1, this.voter2, this.voter3], targets, values, calldatas, description);
  
        expect(await this.mockToken.balanceOf(this.deployer.address)).to.equal(deployerBalance.add(treasuryBalance));
        expect(await this.mockToken.balanceOf(this.treasury.address)).to.equal(0);
    });

    it('should be able to send tokens to the treasury', async function () {

      await this.fakeUSDC.transfer(this.treasury.address, ethers.utils.parseEther("1000"));

      console.log(await this.treasury.withdrawTime(this.fakeUSDC.address));

      const targets = [this.treasury.address];
      const values = [0];
      const calldatas = [this.treasury.interface.encodeFunctionData("sendToken", [this.fakeUSDC.address, this.deployer.address, ethers.utils.parseEther("10")])];
      const description = "Send 10 FUSDC to Deployer";
  
      const deployerBalance = await this.fakeUSDC.balanceOf(this.deployer.address);
      
      await proposeAndExecute(this.governance, [this.deployer, this.voter1, this.voter2, this.voter3], targets, values, calldatas, description);
      
      expect(await this.fakeUSDC.balanceOf(this.deployer.address)).to.equal(deployerBalance.add(ethers.utils.parseEther("10")));
      
    });

  });

});