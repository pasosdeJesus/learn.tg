import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

describe("ScholarshipVaults", function () {
  let scholarshipVaults;
  let mockUSDT;
  let owner;
  let student1;
  let student2;
  let donor;
  let addrs;

  const COURSE_ID_1 = 1;
  const COURSE_ID_2 = 2;
  const GUIDE_NUMBER_1 = 1;
  const GUIDE_NUMBER_2 = 2;
  const AMOUNT_PER_GUIDE = hre.ethers.parseUnits("2", 6); // 2 USDT
  const DEPOSIT_AMOUNT = hre.ethers.parseUnits("100", 6); // 100 USDT

  beforeEach(async function () {
    [owner, student1, student2, donor, ...addrs] = await hre.ethers.getSigners();

    // Deploy mock USDT token
    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Deploy ScholarshipVaults contract
    const ScholarshipVaults = await hre.ethers.getContractFactory("ScholarshipVaults");
    scholarshipVaults = await ScholarshipVaults.deploy(await mockUSDT.getAddress());
    await scholarshipVaults.waitForDeployment();

    // Mint USDT tokens to donor and approve contract
    await mockUSDT.mint(donor.address, hre.ethers.parseUnits("1000", 6));
    await mockUSDT.connect(donor).approve(await scholarshipVaults.getAddress(), hre.ethers.parseUnits("1000", 6));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await scholarshipVaults.owner()).to.equal(owner.address);
    });

    it("Should set the correct USDT token address", async function () {
      expect(await scholarshipVaults.usdtToken()).to.equal(await mockUSDT.getAddress());
    });
  });

  describe("Vault Creation", function () {
    it("Should create a vault successfully", async function () {
      await expect(scholarshipVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE))
        .to.emit(scholarshipVaults, "VaultCreated")
        .withArgs(COURSE_ID_1, AMOUNT_PER_GUIDE);

      const vault = await scholarshipVaults.getVault(COURSE_ID_1);
      expect(vault.courseIdReturn).to.equal(COURSE_ID_1);
      expect(vault.balance).to.equal(0);
      expect(vault.amountPerGuide).to.equal(AMOUNT_PER_GUIDE);
      expect(vault.exists).to.be.true;
    });

    it("Should revert if vault already exists", async function () {
      await scholarshipVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
      await expect(scholarshipVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE))
        .to.be.revertedWith("Vault already exists for this course");
    });

    it("Should revert if amount per guide is zero", async function () {
      await expect(scholarshipVaults.createVault(COURSE_ID_1, 0))
        .to.be.revertedWith("Amount per guide must be greater than 0");
    });

    it("Should revert if called by non-owner", async function () {
      await expect(scholarshipVaults.connect(student1).createVault(COURSE_ID_1, AMOUNT_PER_GUIDE))
        .to.be.revertedWith("Only owner can call this function");
    });
  });

  describe("Deposits", function () {
    beforeEach(async function () {
      await scholarshipVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
    });

    it("Should deposit USDT successfully", async function () {
      await expect(scholarshipVaults.connect(donor).deposit(COURSE_ID_1, DEPOSIT_AMOUNT))
        .to.emit(scholarshipVaults, "Deposit")
        .withArgs(COURSE_ID_1, DEPOSIT_AMOUNT);

      const vault = await scholarshipVaults.getVault(COURSE_ID_1);
      expect(vault.balance).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should revert if vault doesn't exist", async function () {
      await expect(scholarshipVaults.connect(donor).deposit(999, DEPOSIT_AMOUNT))
        .to.be.revertedWith("Vault does not exist");
    });

    it("Should revert if deposit amount is zero", async function () {
      await expect(scholarshipVaults.connect(donor).deposit(COURSE_ID_1, 0))
        .to.be.revertedWith("Deposit amount must be greater than 0");
    });

    it("Should revert if USDT transfer fails", async function () {
      // Try to deposit without approval
      await expect(scholarshipVaults.connect(student1).deposit(COURSE_ID_1, DEPOSIT_AMOUNT))
        .to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Guide Submission and Scholarship Release", function () {
    beforeEach(async function () {
      await scholarshipVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
      await scholarshipVaults.connect(donor).deposit(COURSE_ID_1, DEPOSIT_AMOUNT);
    });

    it("Should release scholarship for perfect submission by new student", async function () {
      await expect(scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true))
        .to.emit(scholarshipVaults, "ScholarshipReleased")
        .withArgs(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, AMOUNT_PER_GUIDE);

      // Check vault balance decreased
      const vault = await scholarshipVaults.getVault(COURSE_ID_1);
      expect(vault.balance).to.equal(DEPOSIT_AMOUNT - AMOUNT_PER_GUIDE);

      // Check student received USDT
      expect(await mockUSDT.balanceOf(student1.address)).to.equal(AMOUNT_PER_GUIDE);

      // Check guide is marked as paid
      expect(await scholarshipVaults.guidePaid(COURSE_ID_1, GUIDE_NUMBER_1, student1.address)).to.be.true;

      // Check cooldown is set
      expect(await scholarshipVaults.getStudentCooldown(COURSE_ID_1, student1.address)).to.be.gt(0);
    });

    it("Should not release scholarship if answer is not perfect", async function () {
      await scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, false);

      // Check no scholarship was released
      expect(await mockUSDT.balanceOf(student1.address)).to.equal(0);
      expect(await scholarshipVaults.guidePaid(COURSE_ID_1, GUIDE_NUMBER_1, student1.address)).to.be.false;

      // Check cooldown is still set for wrong answer
      expect(await scholarshipVaults.getStudentCooldown(COURSE_ID_1, student1.address)).to.be.gt(0);
    });

    it("Should not release scholarship if guide already paid", async function () {
      // First submission - should succeed
      await scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true);
      
      // Fast forward 24 hours + 1 second to bypass cooldown for the next attempt
      await time.increase(24 * 60 * 60 + 1);

      // Second submission for same guide - should revert because it's already paid
      await expect(scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true))
        .to.be.revertedWith("Student already received an scolarship for this guide");

      // Student should only receive one payment
      expect(await mockUSDT.balanceOf(student1.address)).to.equal(AMOUNT_PER_GUIDE);
    });

    it("Should not release scholarship for other guide if 24 hours haven't passed", async function () {
      // First submission
      await scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true);
      
      // Try second submission immediately - should revert due to cooldown
      await expect(scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_2, student1.address, true))
        .to.be.revertedWith("Student is in cooldown period, cannot submit");

      // Student should only receive one payment
      expect(await mockUSDT.balanceOf(student1.address)).to.equal(AMOUNT_PER_GUIDE);
    });

    it("Should release scholarship after 24 hours cooldown", async function () {
      // First submission
      await scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true);
      
      // Fast forward 24 hours + 1 second
      await time.increase(24 * 60 * 60 + 1);
      
      // Second submission after cooldown - should succeed
      await expect(scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_2, student1.address, true))
        .to.emit(scholarshipVaults, "ScholarshipReleased")
        .withArgs(COURSE_ID_1, GUIDE_NUMBER_2, student1.address, AMOUNT_PER_GUIDE);

      // Student should receive two payments
      expect(await mockUSDT.balanceOf(student1.address)).to.equal(AMOUNT_PER_GUIDE * 2n);
    });

    it("Should not release scholarship if insufficient vault balance", async function () {
      // Drain the vault balance to less than amount per guide
      const vault = await scholarshipVaults.getVault(COURSE_ID_1);
      const amountToWithdraw = vault.balance - (AMOUNT_PER_GUIDE / 2n);
      await scholarshipVaults.emergencyWithdraw(amountToWithdraw);

      // Try to submit perfect guide - should not pay due to insufficient balance
      // We expect this to fail with "Insufficient balance" from the MockUSDT contract
      await expect(scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true))
        .to.be.revertedWith("Insufficient balance");

      expect(await mockUSDT.balanceOf(student1.address)).to.equal(0);
    });

    it("Should revert if called by non-owner", async function () {
      await expect(scholarshipVaults.connect(student1).submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true))
        .to.be.revertedWith("Only owner can call this function");
    });

    it("Should revert if student address is zero", async function () {
      await expect(scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, hre.ethers.ZeroAddress, true))
        .to.be.revertedWith("Invalid student address");
    });
  });

  describe("Cooldown and Eligibility Checks", function () {
    beforeEach(async function () {
      await scholarshipVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
      await scholarshipVaults.connect(donor).deposit(COURSE_ID_1, DEPOSIT_AMOUNT);
    });

    it("Should return true for new student eligibility", async function () {
      expect(await scholarshipVaults.studentCanSubmit(COURSE_ID_1, student1.address)).to.be.true;
    });

    it("Should return false during cooldown period", async function () {
      await scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true);
      expect(await scholarshipVaults.studentCanSubmit(COURSE_ID_1, student1.address)).to.be.false;
    });

    it("Should return true after cooldown period", async function () {
      await scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true);
      
      // Fast forward 24 hours + 1 second
      await time.increase(24 * 60 * 60 + 1);
      
      expect(await scholarshipVaults.studentCanSubmit(COURSE_ID_1, student1.address)).to.be.true;
    });
  });

  describe("Administrative Functions", function () {
    beforeEach(async function () {
      await scholarshipVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
      await scholarshipVaults.connect(donor).deposit(COURSE_ID_1, DEPOSIT_AMOUNT);
    });

    it("Should allow owner to emergency withdraw", async function () {
      const withdrawAmount = hre.ethers.parseUnits("50", 6);
      await scholarshipVaults.emergencyWithdraw(withdrawAmount);
      
      expect(await mockUSDT.balanceOf(owner.address)).to.equal(withdrawAmount);
    });

    it("Should revert emergency withdraw if called by non-owner", async function () {
      const withdrawAmount = hre.ethers.parseUnits("50", 6);
      await expect(scholarshipVaults.connect(student1).emergencyWithdraw(withdrawAmount))
        .to.be.revertedWith("Only owner can call this function");
    });

    it("Should update USDT token address", async function () {
      const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
      const newToken = await MockUSDT.deploy();
      await newToken.waitForDeployment();

      await scholarshipVaults.updateUSDTAddress(await newToken.getAddress());
      expect(await scholarshipVaults.usdtToken()).to.equal(await newToken.getAddress());
    });

    it("Should revert USDT address update if called by non-owner", async function () {
      await expect(scholarshipVaults.connect(student1).updateUSDTAddress(await mockUSDT.getAddress()))
        .to.be.revertedWith("Only owner can call this function");
    });

    it("Should return correct contract USDT balance", async function () {
      expect(await scholarshipVaults.getContractUSDTBalance()).to.equal(DEPOSIT_AMOUNT);
    });
  });

  describe("Multiple Courses and Students", function () {
    beforeEach(async function () {
      await scholarshipVaults.createVault(COURSE_ID_1, AMOUNT_PER_GUIDE);
      await scholarshipVaults.createVault(COURSE_ID_2, AMOUNT_PER_GUIDE * 2n);
      await scholarshipVaults.connect(donor).deposit(COURSE_ID_1, DEPOSIT_AMOUNT);
      await scholarshipVaults.connect(donor).deposit(COURSE_ID_2, DEPOSIT_AMOUNT);
    });

    it("Should handle scholarships for different courses independently", async function () {
      // Student1 gets scholarship from course 1
      await scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true);
      
      // Student1 should be eligible for course 2 immediately (different course)
      expect(await scholarshipVaults.studentCanSubmit(COURSE_ID_2, student1.address)).to.be.true;
      
      // Student1 gets scholarship from course 2
      await scholarshipVaults.submitGuideResult(COURSE_ID_2, GUIDE_NUMBER_1, student1.address, true);
      
      expect(await mockUSDT.balanceOf(student1.address)).to.equal(AMOUNT_PER_GUIDE + (AMOUNT_PER_GUIDE * 2n));
    });

    it("Should handle multiple students independently", async function () {
      // Both students submit perfect guides
      await scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_1, student1.address, true);
      await scholarshipVaults.submitGuideResult(COURSE_ID_1, GUIDE_NUMBER_2, student2.address, true);
      
      expect(await mockUSDT.balanceOf(student1.address)).to.equal(AMOUNT_PER_GUIDE);
      expect(await mockUSDT.balanceOf(student2.address)).to.equal(AMOUNT_PER_GUIDE);
    });
  });
});