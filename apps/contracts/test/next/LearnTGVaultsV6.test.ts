import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { LearnTGVaultsV6 } from "../../typechain-types/contracts/next/LearnTGVaultsV6.sol/LearnTGVaultsV6";
import { MockUSDT } from "../../typechain-types/contracts/_usdt_mock.sol/MockUSDT";

// R-#221: the contract keeps one token balance and per-course numbers, so it also
// keeps their sum and refuses any change that would leave the books above the
// money. These tests pin that invariant.
describe("LearnTGVaultsV6 accounting", function () {
  const COURSE_ID = 1;
  const OTHER_COURSE_ID = 2;
  const GUIDE_ID = 1;
  const PROFILE_SCORE = 100;
  const AMOUNT_PER_GUIDE_USDT = hre.ethers.parseUnits("1", 6);
  const AMOUNT_PER_GUIDE_SLEARN = hre.ethers.parseUnits("5", 2);
  const HELD_USDT = hre.ethers.parseUnits("10", 6);
  const HELD_SLEARN = hre.ethers.parseUnits("50", 2);
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

  async function deployFixture() {
    const [owner, student, slearnContract] = await hre.ethers.getSigners();

    const MockFactory = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = (await MockFactory.deploy(owner.address)) as unknown as MockUSDT;
    await usdt.waitForDeployment();
    const slearn = (await MockFactory.deploy(owner.address)) as unknown as MockUSDT;
    await slearn.waitForDeployment();

    const VaultFactory = await hre.ethers.getContractFactory(
      "contracts/next/LearnTGVaultsV6.sol:LearnTGVaultsV6"
    );
    const vault = (await VaultFactory.deploy(
      await usdt.getAddress(),
      await slearn.getAddress()
    )) as unknown as LearnTGVaultsV6;
    await vault.waitForDeployment();

    await usdt.mint(await vault.getAddress(), HELD_USDT);
    await slearn.mint(await vault.getAddress(), HELD_SLEARN);

    return { vault, usdt, slearn, owner, student, slearnContract };
  }

  async function oneCourseFixture() {
    const f = await loadFixture(deployFixture);
    await f.vault.createVault(COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN);
    await f.vault.setVaultBalance(COURSE_ID, HELD_USDT, HELD_SLEARN);
    return f;
  }

  describe("deployment", function () {
    it("starts with VERSION 6, zero totals and sound accounting", async function () {
      const { vault } = await loadFixture(deployFixture);
      expect(await vault.VERSION()).to.equal(6n);
      expect(await vault.totalRecordedUsdt()).to.equal(0n);
      expect(await vault.totalRecordedSlearn()).to.equal(0n);
      expect(await vault.accountingBroken()).to.equal(false);
    });
  });

  describe("setVaultBalance", function () {
    it("rejects a per-course balance that is fine alone but breaks the sum", async function () {
      const { vault } = await loadFixture(deployFixture);
      await vault.createVault(COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN);
      await vault.createVault(OTHER_COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN);

      // 6 of the 10 held USDT are fine for one course...
      await vault.setVaultBalance(COURSE_ID, hre.ethers.parseUnits("6", 6), 0);
      // ...but 6 more are not: the two courses would claim 12 of 10.
      await expect(
        vault.setVaultBalance(OTHER_COURSE_ID, hre.ethers.parseUnits("6", 6), 0)
      ).to.be.revertedWith("Accounting: USDT exceeds real balance");
    });

    it("keeps the totals in step when a balance is replaced", async function () {
      const { vault } = await loadFixture(deployFixture);
      await vault.createVault(COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN);

      await vault.setVaultBalance(COURSE_ID, HELD_USDT, HELD_SLEARN);
      await vault.setVaultBalance(COURSE_ID, hre.ethers.parseUnits("4", 6), hre.ethers.parseUnits("20", 2));

      expect(await vault.totalRecordedUsdt()).to.equal(hre.ethers.parseUnits("4", 6));
      expect(await vault.totalRecordedSlearn()).to.equal(hre.ethers.parseUnits("20", 2));
      const state = await vault.accountingState();
      expect(state.recordedUsdt).to.equal(hre.ethers.parseUnits("4", 6));
      expect(state.heldUsdt).to.equal(HELD_USDT);
      expect(state.broken).to.equal(false);
    });
  });

  describe("retireCourse", function () {
    it("zeroes the books, marks the course retired and refuses to pay it", async function () {
      const { vault, usdt, student } = await loadFixture(oneCourseFixture);

      await expect(vault.retireCourse(COURSE_ID, false)).to.emit(vault, "CourseRetired");
      const retired = await vault.vaults(COURSE_ID);
      expect(retired.balanceUsdt).to.equal(0n);
      expect(retired.balanceSlearn).to.equal(0n);
      expect(retired.amountPerGuideUsdt).to.equal(0n);
      expect(retired.amountPerGuideSlearn).to.equal(0n);
      expect(retired.exists).to.equal(true);
      expect(retired.retired).to.equal(true);
      expect(await vault.totalRecordedUsdt()).to.equal(0n);
      expect(await vault.totalRecordedSlearn()).to.equal(0n);

      const before = await usdt.balanceOf(student.address);
      await expect(
        vault.payScholarship(
          COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
          ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
        )
      ).to.be.revertedWith("Course is retired");
      expect(await usdt.balanceOf(student.address)).to.equal(before);
    });

    it("does not let a retired course take funds or be repriced", async function () {
      const { vault, slearnContract } = await loadFixture(oneCourseFixture);
      await vault.setSlearnContractRole(slearnContract.address, true);
      await vault.retireCourse(COURSE_ID, false);

      await expect(
        vault.connect(slearnContract).recordCourseFunds(COURSE_ID, 1n, 0n)
      ).to.be.revertedWith("Course is retired");
      await expect(
        vault.setAmountPerGuide(COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN)
      ).to.be.revertedWith("Course is retired");
      await expect(
        vault.setVaultBalance(COURSE_ID, 0n, 0n)
      ).to.be.revertedWith("Course is retired: use retireCourse");
    });

    it("sends the backed balance to the owner when asked", async function () {
      const { vault, usdt, slearn, owner } = await loadFixture(oneCourseFixture);

      const ownerUsdtBefore = await usdt.balanceOf(owner.address);
      const ownerSlearnBefore = await slearn.balanceOf(owner.address);

      await expect(vault.retireCourse(COURSE_ID, true))
        .to.emit(vault, "CourseRetired")
        .withArgs(COURSE_ID, HELD_USDT, HELD_SLEARN, 0n, 0n);

      expect(await usdt.balanceOf(owner.address)).to.equal(ownerUsdtBefore + HELD_USDT);
      expect(await slearn.balanceOf(owner.address)).to.equal(ownerSlearnBefore + HELD_SLEARN);
      expect(await vault.getContractUSDTBalance()).to.equal(0n);
      expect(await vault.totalRecordedUsdt()).to.equal(0n);
    });

    it("sends only what is backed and writes off the rest", async function () {
      const { vault, usdt, owner } = await loadFixture(oneCourseFixture);

      // Take 5 of the 10 USDT behind the books: the course's claim is now half phantom.
      await vault.forceEmergencyWithdrawUSDT(hre.ethers.parseUnits("5", 6));
      expect(await vault.accountingBroken()).to.equal(true);

      const ownerUsdtBefore = await usdt.balanceOf(owner.address);
      await expect(vault.retireCourse(COURSE_ID, true))
        .to.emit(vault, "CourseRetired")
        .withArgs(COURSE_ID, hre.ethers.parseUnits("5", 6), HELD_SLEARN, hre.ethers.parseUnits("5", 6), 0n);

      expect(await usdt.balanceOf(owner.address)).to.equal(ownerUsdtBefore + hre.ethers.parseUnits("5", 6));
      expect(await vault.totalRecordedUsdt()).to.equal(0n);
      expect(await vault.accountingBroken()).to.equal(false);
    });

    it("leaves the money as float when it is not swept", async function () {
      const { vault } = await loadFixture(oneCourseFixture);

      await vault.retireCourse(COURSE_ID, false);
      expect(await vault.getContractUSDTBalance()).to.equal(HELD_USDT);
      await vault.emergencyWithdrawUSDT(HELD_USDT);
      expect(await vault.getContractUSDTBalance()).to.equal(0n);
    });
  });

  describe("emergency withdrawals", function () {
    it("only allows taking the unallocated float", async function () {
      const { vault } = await loadFixture(oneCourseFixture);

      // 10 held, 10 recorded: nothing is free.
      await expect(vault.emergencyWithdrawUSDT(1n)).to.be.revertedWith(
        "Withdrawal would break accounting"
      );

      // Free 2 USDT by lowering the course balance, then take exactly those 2.
      await vault.setVaultBalance(COURSE_ID, hre.ethers.parseUnits("8", 6), HELD_SLEARN);
      await expect(vault.emergencyWithdrawUSDT(hre.ethers.parseUnits("3", 6))).to.be.revertedWith(
        "Withdrawal would break accounting"
      );
      await vault.emergencyWithdrawUSDT(hre.ethers.parseUnits("2", 6));
      expect(await vault.getContractUSDTBalance()).to.equal(hre.ethers.parseUnits("8", 6));
    });

    it("marks the accounting broken when forced and blocks payments until reconciled", async function () {
      const { vault, usdt, student } = await loadFixture(oneCourseFixture);

      await expect(vault.forceEmergencyWithdrawUSDT(hre.ethers.parseUnits("5", 6)))
        .to.emit(vault, "AccountingBroken");
      expect(await vault.accountingBroken()).to.equal(true);

      await expect(
        vault.payScholarship(
          COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
          ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
        )
      ).to.be.revertedWith("Accounting broken: reconcile first");

      // Reconcile the books with what the contract holds again.
      await vault.setVaultBalance(COURSE_ID, hre.ethers.parseUnits("5", 6), HELD_SLEARN);
      expect(await vault.accountingBroken()).to.equal(false);

      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      );
      expect(await vault.totalRecordedUsdt()).to.equal(hre.ethers.parseUnits("4", 6));
    });
  });

  describe("recordCourseFunds", function () {
    it("rejects an increment the contract cannot back with tokens", async function () {
      const { vault, slearnContract } = await loadFixture(deployFixture);
      await vault.createVault(COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN);
      await vault.setSlearnContractRole(slearnContract.address, true);

      // The contract holds 10 USDT; a record of 11 has no money behind it.
      await expect(
        vault.connect(slearnContract).recordCourseFunds(COURSE_ID, HELD_USDT + 1n, 0n)
      ).to.be.revertedWith("Accounting: USDT exceeds real balance");
    });
  });

  describe("payScholarship", function () {
    it("deducts the totals by exactly what it pays", async function () {
      const { vault, student } = await loadFixture(oneCourseFixture);

      const before = await vault.accountingState();
      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      );
      const after = await vault.accountingState();

      expect(before.recordedUsdt - after.recordedUsdt).to.equal(AMOUNT_PER_GUIDE_USDT);
      expect(before.recordedSlearn - after.recordedSlearn).to.equal(AMOUNT_PER_GUIDE_SLEARN);
      expect(after.recordedUsdt <= after.heldUsdt).to.equal(true);
      expect(after.recordedSlearn <= after.heldSlearn).to.equal(true);
    });
  });
});
