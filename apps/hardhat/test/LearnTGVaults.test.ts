
import { expect } from "chai";
import hre from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { LearnTGVaults, MockUSDT } from "../typechain-types";

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

    // Mint USDT for the donor and approve the LearnTGVaults contract
    await mockUSDT.mint(donor.address, hre.ethers.parseUnits("1000", 6));
    await mockUSDT.connect(donor).approve(await learnTGVaults.getAddress(), hre.ethers.parseUnits("1000", 6));

    return { learnTGVaults, mockUSDT, usdtAddress, owner, student1, student2, donor, addrs };
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
      const { learnTGVaults, usdtAddress, owner } = await loadFixture(deployLearnTGVaultsFixture);
      expect(await learnTGVaults.owner()).to.equal(owner.address);
      expect(await learnTGVaults.usdtToken()).to.equal(usdtAddress);
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
  });

  describe("Deposits", function () {
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
        const tx = await learnTGVaults.submitGuideResult(COURSE_ID_1, GUIDE_ID_1, student1.address, false, 100);
        const receipt = await tx.wait();

        const event = receipt?.events?.find(e => e.event === 'ScholarshipPaid');
        expect(event).to.be.undefined;
        expect(await learnTGVaults.guidePaid(COURSE_ID_1, GUIDE_ID_1, student1.address)).to.equal(0);
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
    it("Should allow owner to perform an emergency withdrawal", async function() {
      const { learnTGVaults, mockUSDT, owner } = await loadFixture(deployAndFundVaultFixture);
      const contractBalance = await learnTGVaults.getContractUSDTBalance();
      const ownerBalanceBefore = await mockUSDT.balanceOf(owner.address);
      
      await learnTGVaults.emergencyWithdrawUsdt(contractBalance);

      const ownerBalanceAfter = await mockUSDT.balanceOf(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + contractBalance);
      expect(await learnTGVaults.getContractUSDTBalance()).to.equal(0);
    });

    it("Should prevent non-owner from emergency withdrawal", async function() {
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
  });
});

