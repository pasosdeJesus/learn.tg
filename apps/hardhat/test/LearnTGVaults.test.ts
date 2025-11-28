import { expect } from "chai";
import hre from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { LearnTGVaults, MockUSDT } from "../typechain-types";

describe("LearnTGVaults", function () {
  const COURSE_ID_1 = 1;
  const COURSE_ID_2 = 2;
  const GUIDE_NUMBER_1 = 1;
  const GUIDE_NUMBER_2 = 2;
  const OWNER_FEE_PERCENTAGE = 20n;
  const AMOUNT_PER_GUIDE = hre.ethers.parseUnits("10", 6); // 10 USDT
  const DEPOSIT_AMOUNT = hre.ethers.parseUnits("100", 6); // 100 USDT
  const TEAM_FEE = (DEPOSIT_AMOUNT * OWNER_FEE_PERCENTAGE) / 100n;
  const VAULT_DEPOSIT_AMOUNT = DEPOSIT_AMOUNT - TEAM_FEE;

  async function deployFixture() {
    const [owner, student1, student2, donor, ...addrs] = await hre.ethers.getSigners();

    // Deploy mock USDT token
    const MockUSDT_Factory = await hre.ethers.getContractFactory("MockUSDT");
    const mockUSDT = (await MockUSDT_Factory.deploy()) as unknown as MockUSDT;
    await mockUSDT.waitForDeployment();
    const usdtAddress = await mockUSDT.getAddress();

    // Deploy LearnTGVaults contract
    const LearnTGVaults_Factory = await hre.ethers.getContractFactory("LearnTGVaults");
    const learnTGVaults = (await LearnTGVaults_Factory.deploy(usdtAddress)) as unknown as LearnTGVaults;
    await learnTGVaults.waitForDeployment();

    // Mint USDT for the donor and approve the LearnTGVaults contract
    await mockUSDT.mint(donor.address, hre.ethers.parseUnits("1000", 6));
    await mockUSDT.connect(donor).approve(await learnTGVaults.getAddress(), hre.ethers.parseUnits("1000", 6));

    // Pre-create and fund a vault for testing
    await learnTGVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
    await learnTGVaults.connect(donor).deposit(COURSE_ID_1, DEPOSIT_AMOUNT);

    return { learnTGVaults, mockUSDT, owner, student1, student2, donor, addrs };
  }

  describe("Deployment", function () {
    it("Should set the right owner, token, and version", async function () {
      const { learnTGVaults, mockUSDT, owner } = await loadFixture(deployFixture);
      expect(await learnTGVaults.owner()).to.equal(owner.address);
      expect(await learnTGVaults.usdtToken()).to.equal(await mockUSDT.getAddress());
      expect(await learnTGVaults.VERSION()).to.equal(2);
    });
  });

  describe("Vault Creation", function () {
    it("Should create a vault successfully", async function () {
      const { learnTGVaults } = await loadFixture(deployFixture);
      const courseId = 99;
      await expect(learnTGVaults.createVault(courseId, AMOUNT_PER_GUIDE))
        .to.emit(learnTGVaults, "VaultCreated")
        .withArgs(courseId, AMOUNT_PER_GUIDE);

      const vault = await learnTGVaults.vaults(courseId);
      expect(vault.courseId).to.equal(courseId);
      expect(vault.balanceUsdt).to.equal(0);
      expect(vault.amountPerGuide).to.equal(AMOUNT_PER_GUIDE);
      expect(vault.exists).to.be.true;
    });

    it("Should revert if vault already exists", async function () {
      const { learnTGVaults } = await loadFixture(deployFixture);
      await expect(learnTGVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE))
        .to.be.revertedWith("Vault already exists for this course");
    });

    it("Should revert if amount per guide is zero", async function () {
      const { learnTGVaults } = await loadFixture(deployFixture);
      await expect(learnTGVaults.createVault(99, 0))
        .to.be.revertedWith("Amount per guide must be greater than 0");
    });

    it("Should revert if course id is zero", async function() {
      const { learnTGVaults } = await loadFixture(deployFixture);
      await expect(learnTGVaults.createVault(0, AMOUNT_PER_GUIDE))
        .to.be.revertedWith("Course id must be greater than 0");
    });

    it("Should revert if called by non-owner", async function () {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      await expect(learnTGVaults.connect(student1).createVault(99, AMOUNT_PER_GUIDE))
        .to.be.revertedWith("Only owner");
    });
  });

  describe("Deposits", function () {
    it("Should deposit USDT successfully, splitting funds", async function () {
      const { learnTGVaults, mockUSDT, owner, donor } = await loadFixture(deployFixture);
      const vaultBefore = await learnTGVaults.vaults(COURSE_ID_1);
      const ownerBalanceBefore = await mockUSDT.balanceOf(owner.address);

      await expect(learnTGVaults.connect(donor).deposit(COURSE_ID_1, DEPOSIT_AMOUNT))
        .to.emit(learnTGVaults, "Deposit")
        .withArgs(COURSE_ID_1, DEPOSIT_AMOUNT);

      const vaultAfter = await learnTGVaults.vaults(COURSE_ID_1);
      expect(vaultAfter.balanceUsdt).to.equal(vaultBefore.balanceUsdt + VAULT_DEPOSIT_AMOUNT);

      const ownerBalanceAfter = await mockUSDT.balanceOf(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + TEAM_FEE);
    });

    it("Should revert if vault doesn't exist", async function () {
      const { learnTGVaults, donor } = await loadFixture(deployFixture);
      await expect(learnTGVaults.connect(donor).deposit(999, DEPOSIT_AMOUNT))
        .to.be.revertedWith("Vault does not exist");
    });

    it("Should revert if deposit amount is zero", async function () {
      const { learnTGVaults, donor } = await loadFixture(deployFixture);
      await expect(learnTGVaults.connect(donor).deposit(COURSE_ID_1, 0))
        .to.be.revertedWith("Deposit amount must be greater than 0");
    });
  });

  describe("Guide Submission and Scholarship", function () {
    it("Should prepare a scholarship for a perfect submission", async function () {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      const profileScore = 100;
      const actualAmount = (AMOUNT_PER_GUIDE * BigInt(profileScore)) / 100n;
      
      await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, profileScore))
        .to.emit(learnTGVaults, "ScholarshipPrepared")
        .withArgs(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, AMOUNT_PER_GUIDE, actualAmount, profileScore);

      expect(await learnTGVaults.pendingScholarship(COURSE_ID_1, GUIDE_NUMBER_1, student1.address)).to.equal(actualAmount);
    });

    it("Should prepare a scholarship with a partial score", async function () {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      const profileScore = 80;
      const expectedAmount = (AMOUNT_PER_GUIDE * BigInt(profileScore)) / 100n;

      await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, profileScore))
        .to.emit(learnTGVaults, "ScholarshipPrepared")
        .withArgs(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, AMOUNT_PER_GUIDE, expectedAmount, profileScore);

      expect(await learnTGVaults.pendingScholarship(COURSE_ID_1, GUIDE_NUMBER_1, student1.address)).to.equal(expectedAmount);
    });

    it("Should revert if profile score is below 50", async function () {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      const profileScore = 49;
      await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, profileScore))
        .to.be.revertedWith("Score 50-100");
    });

    it("Should revert if profile score is above 100", async function () {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      const profileScore = 101;
      await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, profileScore))
        .to.be.revertedWith("Score 50-100");
    });

    it("Should allow student to claim a prepared scholarship", async () => {
      const { learnTGVaults, mockUSDT, student1 } = await loadFixture(deployFixture);
      await learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, 100);
      
      await expect(learnTGVaults.connect(student1).claimScolarship(COURSE_ID_1, GUIDE_NUMBER_1))
        .to.emit(learnTGVaults, "ScholarshipClaimed")
        .withArgs(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, AMOUNT_PER_GUIDE);
      
      expect(await mockUSDT.balanceOf(student1.address)).to.equal(AMOUNT_PER_GUIDE);
      expect(await learnTGVaults.pendingScholarship(COURSE_ID_1, GUIDE_NUMBER_1, student1.address)).to.equal(0);
      expect(await learnTGVaults.guidePaid(COURSE_ID_1, GUIDE_NUMBER_1, student1.address)).to.equal(AMOUNT_PER_GUIDE);
    });

    it("Should not prepare scholarship if answer is not perfect", async function () {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      await learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, false, 100);
      expect(await learnTGVaults.pendingScholarship(COURSE_ID_1, GUIDE_NUMBER_1, student1.address)).to.equal(0);
    });
    
    it("Should revert on claim if no scholarship is pending", async () => {
       const { learnTGVaults, student1 } = await loadFixture(deployFixture);
       await expect(learnTGVaults.connect(student1).claimScolarship(COURSE_ID_1, GUIDE_NUMBER_1))
        .to.be.revertedWith("No pending scholarship");
    });
    
    it("Should emit event and not prepare scholarship if already paid", async () => {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      await learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, 100);
      await learnTGVaults.connect(student1).claimScolarship(COURSE_ID_1, GUIDE_NUMBER_1);
      
      await time.increase(24 * 60 * 60 + 1); // Elapse cooldown

      await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, 100))
        .to.emit(learnTGVaults, "ScholarshipAlreadyPaid")
        .withArgs(COURSE_ID_1, GUIDE_NUMBER_1, student1.address);
    });

    it("Should return early and not prepare scholarship if another is pending", async () => {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      await learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, 100);

      // Elapse cooldown to specifically test the 'hasPending' logic
      await time.increase(24 * 60 * 60 + 1);

      // Calling again should not revert, but should return early due to a pending scholarship and not emit the event.
      await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, 100))
        .to.not.emit(learnTGVaults, "ScholarshipPrepared");
    });

    it("Should revert if on cooldown", async () => {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      await learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, 100);
      await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_2, student1.address, true, 100))
        .to.be.revertedWith("In cooldown");
    });
  });

  describe("Cooldown Logic", function() {
    it("Should apply cooldown after a perfect submission and allow submission after period", async function() {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      await learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, 100);
      expect(await learnTGVaults.studentCanSubmit(COURSE_ID_1, student1.address)).to.be.false;
      
      await time.increase(24 * 60 * 60 + 1); // Elapse cooldown

      expect(await learnTGVaults.studentCanSubmit(COURSE_ID_1, student1.address)).to.be.true;
      await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_2, student1.address, true, 100)).to.not.be.reverted;
    });

    it("Should handle cooldowns independently for different courses", async function() {
      const { learnTGVaults, student1, donor } = await loadFixture(deployFixture);
      await learnTGVaults.createVault(COURSE_ID_2, AMOUNT_PER_GUIDE);
      await learnTGVaults.connect(donor).deposit(COURSE_ID_2, DEPOSIT_AMOUNT);
      
      await learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true, 100);

      // Cooldown for course 1 should not affect course 2
      await expect(learnTGVaults.submitGuideResult(COURSE_ID_2, GUIDE_NUMBER_1, student1.address, true, 100))
        .to.emit(learnTGVaults, "ScholarshipPrepared");
    });
  });

  describe("Administrative Functions", function() {
    it("Should allow owner to withdraw emergency funds", async function() {
      const { learnTGVaults, mockUSDT, owner } = await loadFixture(deployFixture);
      const contractBalance = await learnTGVaults.getContractUSDTBalance();
      const ownerBalanceBefore = await mockUSDT.balanceOf(owner.address);
      
      await learnTGVaults.emergencyWithdrawUsdt(contractBalance);

      const ownerBalanceAfter = await mockUSDT.balanceOf(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + contractBalance);
      expect(await learnTGVaults.getContractUSDTBalance()).to.equal(0);
    });

    it("Should prevent non-owner from withdrawing emergency funds", async function() {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      await expect(learnTGVaults.connect(student1).emergencyWithdrawUsdt(100))
        .to.be.revertedWith("Only owner");
    });
  });

  describe("Migrations and Manual Adjustments", function() {
    it("Should allow owner to set a guide as paid", async function() {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      const paidAmount = hre.ethers.parseUnits("5", 6);

      await learnTGVaults.setGuidePaid(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, paidAmount);

      const storedPaidAmount = await learnTGVaults.guidePaid(COURSE_ID_1, GUIDE_NUMBER_1, student1.address);
      expect(storedPaidAmount).to.equal(paidAmount);
    });

    it("Should prevent non-owner from setting a guide as paid", async function() {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      const paidAmount = hre.ethers.parseUnits("5", 6);

      await expect(learnTGVaults.connect(student1).setGuidePaid(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, paidAmount))
        .to.be.revertedWith("Only owner");
    });

    it("Should revert setGuidePaid if parameters are invalid", async function() {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      const paidAmount = hre.ethers.parseUnits("5", 6);

      // This check is first because the modifier runs before the require statements.
      await expect(learnTGVaults.setGuidePaid(0, GUIDE_NUMBER_1, student1.address, paidAmount))
        .to.be.revertedWith("Vault does not exist");
      
      await expect(learnTGVaults.setGuidePaid(COURSE_ID_1, 0, student1.address, paidAmount))
        .to.be.revertedWith("Invalid params");
      await expect(learnTGVaults.setGuidePaid(COURSE_ID_1, GUIDE_NUMBER_1, hre.ethers.ZeroAddress, paidAmount))
        .to.be.revertedWith("Invalid params");
      await expect(learnTGVaults.setGuidePaid(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, 0))
        .to.be.revertedWith("Invalid params");
    });

    it("Should allow owner to set a vault balanceUsdt", async function() {
      const { learnTGVaults } = await loadFixture(deployFixture);
      const newBalance = hre.ethers.parseUnits("500", 6);

      await learnTGVaults.setVaultBalance(COURSE_ID_1, newBalance);

      const vault = await learnTGVaults.vaults(COURSE_ID_1);
      expect(vault.balanceUsdt).to.equal(newBalance);
    });

    it("Should prevent non-owner from setting a vault balanceUsdt", async function() {
      const { learnTGVaults, student1 } = await loadFixture(deployFixture);
      const newBalance = hre.ethers.parseUnits("500", 6);

      await expect(learnTGVaults.connect(student1).setVaultBalance(COURSE_ID_1, newBalance))
        .to.be.revertedWith("Only owner");
    });

    it("Should revert setVaultBalance if vault does not exist", async function() {
      const { learnTGVaults } = await loadFixture(deployFixture);
      const newBalance = hre.ethers.parseUnits("500", 6);

      await expect(learnTGVaults.setVaultBalance(999, newBalance))
        .to.be.revertedWith("Vault does not exist");
    });
  });

  describe("Edge Cases", function() {
    it("Should revert submission if vault balanceUsdt is just below scholarship amount", async function() {
      const { learnTGVaults, student1, donor } = await loadFixture(deployFixture);
      const amountPerGuide = hre.ethers.parseUnits("50", 6); // Scholarship is 50 USDT
      await learnTGVaults.createVault(COURSE_ID_2, amountPerGuide);

      // Deposit 62 USDT. Vault gets 80% => 49.6 USDT.
      const depositAmount = hre.ethers.parseUnits("62", 6);
      await learnTGVaults.connect(donor).deposit(COURSE_ID_2, depositAmount);

      // Student submits with perfect score, requiring 50 USDT. This should fail.
      await expect(learnTGVaults.submitGuideResult(COURSE_ID_2, GUIDE_NUMBER_1, student1.address, true, 100))
        .to.be.revertedWith("Insufficient funds");
    });

    it("Should revert if student address is zero on submission", async function() {
      const { learnTGVaults } = await loadFixture(deployFixture);
      await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, hre.ethers.ZeroAddress, true, 100))
        .to.be.revertedWith("Invalid params");
    });
  });
});

