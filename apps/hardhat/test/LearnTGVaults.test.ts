
import { expect } from "chai";
import hre from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { LearnTGVaults } from "../typechain-types/contracts/LearnTGVaults.sol/LearnTGVaults";
import { MockUSDT } from "../typechain-types/contracts/MockUSDT";

describe("LearnTGVaults", function () {
  // --- Constants ---
  const COURSE_ID_1 = 1;
  const COURSE_ID_2 = 2;
  const GUIDE_ID_1 = 1;
  const GUIDE_ID_2 = 2;
  const OWNER_FEE_PERCENTAGE = 20n; // 20%
  const AMOUNT_PER_GUIDE = hre.ethers.parseUnits("10", 6); // 10 USDT
  const DEPOSIT_AMOUNT = hre.ethers.parseUnits("100", 6); // 100 USDT
  const TEAM_FEE = (DEPOSIT_AMOUNT * OWNER_FEE_PERCENTAGE) / 100n;
  const VAULT_DEPOSIT_AMOUNT = DEPOSIT_AMOUNT - TEAM_FEE;

  // --- Fixtures ---
  async function deployLearnTGVaultsFixture() {
    const [owner, student1, student2, donor, ...addrs] = await hre.ethers.getSigners();

    // Deploy mock tokens
    const MockUSDT_Factory = await hre.ethers.getContractFactory("MockUSDT");
    const mockUSDT = (await MockUSDT_Factory.deploy()) as unknown as MockUSDT;
    const mockCCop = (await MockUSDT_Factory.deploy()) as unknown as MockUSDT;
    const mockGooddollar = (await MockUSDT_Factory.deploy()) as unknown as MockUSDT;
    await mockUSDT.waitForDeployment();
    await mockCCop.waitForDeployment();
    await mockGooddollar.waitForDeployment();
    const usdtAddress = await mockUSDT.getAddress();
    const cCopAddress = await mockCCop.getAddress();
    const gooddollarAddress = await mockGooddollar.getAddress();

    // Deploy LearnTGVaults contract
    const LearnTGVaults_Factory = await hre.ethers.getContractFactory("LearnTGVaults");
    const learnTGVaults = (await LearnTGVaults_Factory.deploy(
      usdtAddress, 
      cCopAddress, 
      gooddollarAddress
    )) as unknown as LearnTGVaults;
    await learnTGVaults.waitForDeployment();

    // Mint and approve tokens for the donor
    await mockUSDT.mint(donor.address, hre.ethers.parseUnits("1000", 6));
    await mockUSDT.connect(donor).approve(await learnTGVaults.getAddress(), hre.ethers.parseUnits("1000", 6));
    await mockCCop.mint(donor.address, hre.ethers.parseUnits("1000", 18));
    await mockCCop.connect(donor).approve(await learnTGVaults.getAddress(), hre.ethers.parseUnits("1000", 18));
    await mockGooddollar.mint(donor.address, hre.ethers.parseUnits("1000", 18));
    await mockGooddollar.connect(donor).approve(await learnTGVaults.getAddress(), hre.ethers.parseUnits("1000", 18));

    return { learnTGVaults, mockUSDT, mockCCop, mockGooddollar, owner, student1, student2, donor, addrs };
  }

  async function deployAndFundVaultFixture() {
    const { learnTGVaults, mockUSDT, owner, student1, donor } = await loadFixture(deployLearnTGVaultsFixture);
    
    await learnTGVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
    await learnTGVaults.connect(donor).deposit(COURSE_ID_1, DEPOSIT_AMOUNT);

    return { learnTGVaults, mockUSDT, owner, student1, donor };
  }

  async function scholarshipPaidFixture() {
    const { learnTGVaults, mockUSDT, owner, student1, donor } = await loadFixture(deployAndFundVaultFixture);
    const profileScore = 100;
    await learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_1, student1.address, true, profileScore);

    return { learnTGVaults, mockUSDT, owner, student1, donor };
  }

  // --- Test Suites ---
  describe("Deployment", function () {
    it("Should set the right owner, token, and version", async function () {
      const { learnTGVaults, mockUSDT, mockCCop, mockGooddollar, owner } = await loadFixture(deployLearnTGVaultsFixture);
      expect(await learnTGVaults.owner()).to.equal(owner.address);
      expect(await learnTGVaults.usdtToken()).to.equal(await mockUSDT.getAddress());
      expect(await learnTGVaults.cCopToken()).to.equal(await mockCCop.getAddress());
      expect(await learnTGVaults.gooddollarToken()).to.equal(await mockGooddollar.getAddress());
      expect(await learnTGVaults.VERSION()).to.equal(2);
    });
  });

  describe("Vault Creation", function () {
    it("Should allow owner to create a vault", async function () {
        const { learnTGVaults } = await loadFixture(deployLearnTGVaultsFixture);
        await expect(learnTGVaults.createVault(COURSE_ID_2, AMOUNT_PER_GUIDE))
            .to.emit(learnTGVaults, "VaultCreated")
            .withArgs(COURSE_ID_2, AMOUNT_PER_GUIDE);
        const vault = await learnTGVaults.vaults(COURSE_ID_2);
        expect(vault.exists).to.be.true;
        expect(vault.amountPerGuide).to.equal(AMOUNT_PER_GUIDE);
    });

    it("Should revert if a non-owner tries to create a vault", async function () {
        const { learnTGVaults, student1 } = await loadFixture(deployLearnTGVaultsFixture);
        await expect(learnTGVaults.connect(student1).createVault(COURSE_ID_2, AMOUNT_PER_GUIDE))
            .to.be.revertedWith("Only owner");
    });

    it("Should revert if creating a vault that already exists", async function () {
        const { learnTGVaults } = await loadFixture(deployAndFundVaultFixture);
        await expect(learnTGVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE))
            .to.be.revertedWith("Vault already exists for this course");
    });

    it("Should revert if amount per guide is zero", async function () {
        const { learnTGVaults } = await loadFixture(deployLearnTGVaultsFixture);
        await expect(learnTGVaults.createVault(COURSE_ID_2, 0))
            .to.be.revertedWith("Amount per guide must be greater than 0");
    });

    it("Should revert if course ID is zero", async function () {
      const { learnTGVaults } = await loadFixture(deployLearnTGVaultsFixture);
      await expect(learnTGVaults.createVault(0, AMOUNT_PER_GUIDE))
          .to.be.revertedWith("Course id must be greater than 0");
    });
  });

  describe("Deposits (USDT)", function () {
    it("Should accept deposits and correctly distribute fees", async function () {
      const { learnTGVaults, mockUSDT, owner, donor } = await loadFixture(deployLearnTGVaultsFixture);
      await learnTGVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);

      const ownerBalanceBefore = await mockUSDT.balanceOf(owner.address);

      await expect(learnTGVaults.connect(donor).deposit(COURSE_ID_1, DEPOSIT_AMOUNT))
        .to.emit(learnTGVaults, "Deposit")
        .withArgs(COURSE_ID_1, DEPOSIT_AMOUNT);

      const vault = await learnTGVaults.vaults(COURSE_ID_1);
      expect(vault.balanceUsdt).to.equal(VAULT_DEPOSIT_AMOUNT);

      const ownerBalanceAfter = await mockUSDT.balanceOf(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + TEAM_FEE);
    });

    it("Should revert if depositing to a non-existent vault", async function () {
      const { learnTGVaults, donor } = await loadFixture(deployLearnTGVaultsFixture);
      await expect(learnTGVaults.connect(donor).deposit(999, DEPOSIT_AMOUNT))
        .to.be.revertedWith("Vault does not exist");
    });

    it("Should revert if deposit amount is zero", async function () {
      const { learnTGVaults, donor } = await loadFixture(deployAndFundVaultFixture);
      await expect(learnTGVaults.connect(donor).deposit(COURSE_ID_1, 0))
        .to.be.revertedWith("Deposit amount must be greater than 0");
    });
  });

  describe("Other Token Deposits", function() {
    it("Should accept cCop deposits", async function() {
      const { learnTGVaults, mockCCop, owner, donor } = await loadFixture(deployLearnTGVaultsFixture);
      await learnTGVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
      const depositAmount = hre.ethers.parseUnits("200", 18);
      const teamFee = (depositAmount * OWNER_FEE_PERCENTAGE) / 100n;
      const vaultDeposit = depositAmount - teamFee;

      await expect(learnTGVaults.connect(donor).depositCcop(COURSE_ID_1, depositAmount))
        .to.emit(learnTGVaults, "Deposit");
      
      const vault = await learnTGVaults.vaults(COURSE_ID_1);
      expect(vault.balanceCcop).to.equal(vaultDeposit);
    });

    it("Should accept Gooddollar deposits", async function() {
      const { learnTGVaults, mockGooddollar, owner, donor } = await loadFixture(deployLearnTGVaultsFixture);
      await learnTGVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
      const depositAmount = hre.ethers.parseUnits("500", 18);
      const teamFee = (depositAmount * OWNER_FEE_PERCENTAGE) / 100n;
      const vaultDeposit = depositAmount - teamFee;

      await expect(learnTGVaults.connect(donor).depositGooddollar(COURSE_ID_1, depositAmount))
        .to.emit(learnTGVaults, "Deposit");
      
      const vault = await learnTGVaults.vaults(COURSE_ID_1);
      expect(vault.balanceGooddollar).to.equal(vaultDeposit);
    });
  });

  describe("submitGuideResult", function () {
    context("When successful", function() {
      it("Should pay a scholarship for a correct answer with 100 profile score", async function () {
        const { learnTGVaults, mockUSDT, student1 } = await loadFixture(deployAndFundVaultFixture);
        const profileScore = 100;
        const expectedAmount = (AMOUNT_PER_GUIDE * BigInt(profileScore)) / 100n;
        const studentBalanceBefore = await mockUSDT.balanceOf(student1.address);

        await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_1, student1.address, true, profileScore))
          .to.emit(learnTGVaults, "ScholarshipPaid")
          .withArgs(COURSE_ID_1, GUIDE_ID_1, student1.address, AMOUNT_PER_GUIDE, expectedAmount, profileScore);
        
        expect(await mockUSDT.balanceOf(student1.address)).to.equal(studentBalanceBefore + expectedAmount);
        expect(await learnTGVaults.guidePaid(COURSE_ID_1, GUIDE_ID_1, student1.address)).to.equal(expectedAmount);
        expect(await learnTGVaults.studentCanSubmit(COURSE_ID_1, student1.address)).to.be.false;
      });

      it("Should pay a scholarship with a scaled amount for a partial profile score", async function () {
        const { learnTGVaults, mockUSDT, student1 } = await loadFixture(deployAndFundVaultFixture);
        const profileScore = 80; // 80% score
        const expectedAmount = (AMOUNT_PER_GUIDE * BigInt(profileScore)) / 100n;
        const studentBalanceBefore = await mockUSDT.balanceOf(student1.address);

        await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_1, student1.address, true, profileScore))
          .to.emit(learnTGVaults, "ScholarshipPaid")
          .withArgs(COURSE_ID_1, GUIDE_ID_1, student1.address, AMOUNT_PER_GUIDE, expectedAmount, profileScore);

        expect(await mockUSDT.balanceOf(student1.address)).to.equal(studentBalanceBefore + expectedAmount);
      });
    });

    context("When submission is invalid", function() {
      it("Should revert if profile score is below 50", async function () {
        const { learnTGVaults, student1 } = await loadFixture(deployAndFundVaultFixture);
        await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_1, student1.address, true, 49))
          .to.be.revertedWith("Score 50-100");
      });

      it("Should revert if profile score is above 100", async function () {
        const { learnTGVaults, student1 } = await loadFixture(deployAndFundVaultFixture);
        await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_1, student1.address, true, 101))
          .to.be.revertedWith("Score 50-100");
      });

      it("Should revert if student is in cooldown period", async function () {
        const { learnTGVaults, student1 } = await loadFixture(scholarshipPaidFixture);
        await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_2, student1.address, true, 100))
          .to.be.revertedWith("In cooldown");
      });

      it("Should revert if vault has insufficient funds", async function () {
        const { learnTGVaults, student1, donor } = await loadFixture(deployLearnTGVaultsFixture);
        const smallDeposit = AMOUNT_PER_GUIDE - 1n;
        await learnTGVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
        await learnTGVaults.connect(donor).deposit(COURSE_ID_1, smallDeposit);
        
        await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_1, student1.address, true, 100))
          .to.be.revertedWith("Insufficient funds");
      });

      it("Should emit ScholarshipAlreadyPaid if the guide has been paid", async function () {
        const { learnTGVaults, student1 } = await loadFixture(scholarshipPaidFixture);
        await time.increase(24 * 60 * 60); // Pass cooldown

        await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_1, student1.address, true, 100))
          .to.emit(learnTGVaults, "ScholarshipAlreadyPaid")
          .withArgs(COURSE_ID_1, GUIDE_ID_1, student1.address);
      });

      it("Should not pay a scholarship for an incorrect answer", async function () {
        const { learnTGVaults, student1 } = await loadFixture(deployAndFundVaultFixture);
        
        await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_1, student1.address, false, 100))
          .to.not.emit(learnTGVaults, "ScholarshipPaid");

        expect(await learnTGVaults.guidePaid(COURSE_ID_1, GUIDE_ID_1, student1.address)).to.equal(0);
      });

      it("Should revert with invalid parameters", async function() {
        const { learnTGVaults, student1 } = await loadFixture(deployAndFundVaultFixture);
        const zeroAddress = hre.ethers.ZeroAddress;

        await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, 0, student1.address, true, 100))
          .to.be.revertedWith("Invalid params");

        await expect(learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_1, zeroAddress, true, 100))
          .to.be.revertedWith("Invalid params");
      });
    });
  });

  describe("Cooldown", function() {
      it("Should allow submission after cooldown period", async () => {
        const { learnTGVaults, student1 } = await loadFixture(scholarshipPaidFixture);
        expect(await learnTGVaults.studentCanSubmit(COURSE_ID_1, student1.address)).to.be.false;

        await time.increase(24 * 60 * 60); // 1 day

        expect(await learnTGVaults.studentCanSubmit(COURSE_ID_1, student1.address)).to.be.true;
      });
  });

  describe("Administrative Functions", function() {
    it("Should prevent non-owner from emergency withdrawal (USDT)", async function() {
      const { learnTGVaults, student1 } = await loadFixture(deployAndFundVaultFixture);
      await expect(learnTGVaults.connect(student1).emergencyWithdrawUsdt(100))
        .to.be.revertedWith("Only owner");
    });

    it("Should allow owner to manually set a guide as paid", async function() {
      const { learnTGVaults, student1 } = await loadFixture(deployAndFundVaultFixture);
      const paidAmount = hre.ethers.parseUnits("7", 6);

      await learnTGVaults.setGuidePaid(COURSE_ID_1, GUIDE_ID_1, student1.address, paidAmount);

      expect(await learnTGVaults.guidePaid(COURSE_ID_1, GUIDE_ID_1, student1.address)).to.equal(paidAmount);
    });

    it("Should prevent non-owner from setting guide as paid", async function() {
      const { learnTGVaults, student1 } = await loadFixture(deployAndFundVaultFixture);
      const paidAmount = hre.ethers.parseUnits("7", 6);

      await expect(learnTGVaults.connect(student1).setGuidePaid(COURSE_ID_1, GUIDE_ID_1, student1.address, paidAmount))
        .to.be.revertedWith("Only owner");
    });

    it("Should revert if setting guide paid with zero amount", async function() {
      const { learnTGVaults, student1 } = await loadFixture(deployAndFundVaultFixture);
      await expect(learnTGVaults.setGuidePaid(COURSE_ID_1, GUIDE_ID_1, student1.address, 0))
        .to.be.revertedWith("Invalid params");
    });

    describe("setVaultBalance", function() {
      it("Should allow owner to set vault balance", async function() {
        const { learnTGVaults } = await loadFixture(deployAndFundVaultFixture);
        const newBalance = hre.ethers.parseUnits("500", 6);

        await expect(learnTGVaults.setVaultBalance(COURSE_ID_1, newBalance))
          .to.emit(learnTGVaults, "VaultBalanceSet")
          .withArgs(COURSE_ID_1, newBalance);

        const vault = await learnTGVaults.vaults(COURSE_ID_1);
        expect(vault.balanceUsdt).to.equal(newBalance);
      });

      it("Should revert if non-owner tries to set vault balance", async function() {
        const { learnTGVaults, student1 } = await loadFixture(deployAndFundVaultFixture);
        const newBalance = hre.ethers.parseUnits("500", 6);

        await expect(learnTGVaults.connect(student1).setVaultBalance(COURSE_ID_1, newBalance))
          .to.be.revertedWith("Only owner");
      });

      it("Should revert if trying to set balance for a non-existent vault", async function() {
        const { learnTGVaults } = await loadFixture(deployLearnTGVaultsFixture);
        const newBalance = hre.ethers.parseUnits("500", 6);

        await expect(learnTGVaults.setVaultBalance(999, newBalance))
          .to.be.revertedWith("Vault does not exist");
      });

      it("Should revert if trying to set a zero balance", async function() {
        const { learnTGVaults } = await loadFixture(deployAndFundVaultFixture);
        await expect(learnTGVaults.setVaultBalance(COURSE_ID_1, 0))
          .to.be.revertedWith("Balance should be positive");
      });
    });
  });

  describe("Emergency Withdrawals", function() {
    it("Should allow owner to withdraw USDT", async function() {
      const { learnTGVaults, mockUSDT, owner } = await loadFixture(deployAndFundVaultFixture);
      const balance = await learnTGVaults.getContractUSDTBalance();
      await expect(learnTGVaults.emergencyWithdrawUsdt(balance))
        .to.emit(learnTGVaults, "EmergencyWithdrawal");
    });

    it("Should allow owner to withdraw cCop", async function() {
      const { learnTGVaults, mockCCop, owner, donor } = await loadFixture(deployLearnTGVaultsFixture);
      await learnTGVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
      await learnTGVaults.connect(donor).depositCcop(COURSE_ID_1, hre.ethers.parseUnits("100", 18));
      const balance = await learnTGVaults.getContractCcopBalance();
      await expect(learnTGVaults.emergencyWithdrawCcop(balance))
        .to.emit(learnTGVaults, "EmergencyWithdrawal");
    });

    it("Should allow owner to withdraw Gooddollar", async function() {
      const { learnTGVaults, mockGooddollar, owner, donor } = await loadFixture(deployLearnTGVaultsFixture);
      await learnTGVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
      await learnTGVaults.connect(donor).depositGooddollar(COURSE_ID_1, hre.ethers.parseUnits("100", 18));
      const balance = await learnTGVaults.getContractGooddollarBalance();
      await expect(learnTGVaults.emergencyWithdrawGooddollar(balance))
        .to.emit(learnTGVaults, "EmergencyWithdrawal");
    });

    it("Should revert if withdrawing zero", async function() {
      const { learnTGVaults } = await loadFixture(deployAndFundVaultFixture);
      await expect(learnTGVaults.emergencyWithdrawUsdt(0)).to.be.revertedWith("Amount > 0");
      await expect(learnTGVaults.emergencyWithdrawCcop(0)).to.be.revertedWith("Amount > 0");
      await expect(learnTGVaults.emergencyWithdrawGooddollar(0)).to.be.revertedWith("Amount > 0");
    });
  });

  describe("Getters", function() {
    it("Should return correct student guide status", async function() {
      const { learnTGVaults, student1 } = await loadFixture(scholarshipPaidFixture);
      const [paidAmount, canSubmit] = await learnTGVaults.getStudentGuideStatus(COURSE_ID_1, GUIDE_ID_1, student1.address);
      const expectedAmount = (AMOUNT_PER_GUIDE * 100n) / 100n;
      expect(paidAmount).to.equal(expectedAmount);
      expect(canSubmit).to.be.false;
    });
  });
});
