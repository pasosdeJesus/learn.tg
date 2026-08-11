import { expect } from "chai";
import hre from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { LearnTGVaultsV5 } from "../typechain-types/contracts/LearnTGVaultsV5.sol/LearnTGVaultsV5";
import { MockUSDT } from "../typechain-types/contracts/MockUSDT";

describe("LearnTGVaultsV5", function () {
  const COURSE_ID = 1;
  const GUIDE_ID = 1;
  const PROFILE_SCORE = 100;
  const AMOUNT_PER_GUIDE_USDT = hre.ethers.parseUnits("1", 6);    // 1 USDT
  const AMOUNT_PER_GUIDE_SLEARN = hre.ethers.parseUnits("5", 2);  // 5 SLEARN
  const DEPOSIT_USDT = hre.ethers.parseUnits("10", 6);
  const DEPOSIT_SLEARN = hre.ethers.parseUnits("50", 2);

  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

  async function deployFixture() {
    const [owner, student, referrer, learnTg] = await hre.ethers.getSigners();

    const MockUSDT_Factory = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = (await MockUSDT_Factory.deploy(owner.address)) as unknown as MockUSDT;
    await usdt.waitForDeployment();

    // MockUSDT doubles as SLEARN mock (both are ERC20 mocks)
    const slearn = (await MockUSDT_Factory.deploy(owner.address)) as unknown as MockUSDT;
    await slearn.waitForDeployment();

    const VaultFactory = await hre.ethers.getContractFactory("contracts/LearnTGVaultsV5.sol:LearnTGVaultsV5");
    const vault = (await VaultFactory.deploy(
      await usdt.getAddress(),
      await slearn.getAddress()
    )) as unknown as LearnTGVaultsV5;
    await vault.waitForDeployment();

    // Fund vault with tokens
    await usdt.mint(await vault.getAddress(), DEPOSIT_USDT);
    await slearn.mint(await vault.getAddress(), DEPOSIT_SLEARN);

    return { vault, usdt, slearn, owner, student, referrer, learnTg };
  }

  async function vaultWithSetupFixture() {
    const f = await loadFixture(deployFixture);
    await f.vault.createVault(COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN);
    await f.vault.setVaultBalance(COURSE_ID, DEPOSIT_USDT, DEPOSIT_SLEARN);
    return f;
  }

  describe("Deployment", function () {
    it("Should set VERSION=5, owner, and tokens", async function () {
      const { vault, usdt, slearn, owner } = await loadFixture(deployFixture);
      expect(await vault.VERSION()).to.equal(5n);
      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.usdtToken()).to.equal(await usdt.getAddress());
      expect(await vault.slearnToken()).to.equal(await slearn.getAddress());
    });
  });

  describe("Vault Creation", function () {
    it("Should allow owner to create a vault", async function () {
      const { vault } = await loadFixture(deployFixture);
      await expect(vault.createVault(COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN))
        .to.emit(vault, "VaultCreated")
        .withArgs(COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN);
      const v = await vault.vaults(COURSE_ID);
      expect(v.exists).to.be.true;
    });

    it("Should revert if non-owner creates vault", async function () {
      const { vault, student } = await loadFixture(deployFixture);
      await expect(vault.connect(student).createVault(COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN))
        .to.be.revertedWith("Only owner");
    });

    it("Should revert if vault already exists", async function () {
      const { vault } = await loadFixture(vaultWithSetupFixture);
      await expect(vault.createVault(COURSE_ID, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN))
        .to.be.revertedWith("Vault already exists");
    });

    it("Should revert if courseId is 0", async function () {
      const { vault } = await loadFixture(deployFixture);
      await expect(vault.createVault(0, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN))
        .to.be.revertedWith("Course id must be greater than 0");
    });
  });

  describe("payScholarship — basic", function () {
    it("Should pay 100% scholarship with 100 profileScore (no splits)", async function () {
      const { vault, usdt, slearn, student } = await loadFixture(vaultWithSetupFixture);

      const studentUSDTBefore = await usdt.balanceOf(student.address);
      const studentSlearnBefore = await slearn.balanceOf(student.address);

      await expect(vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      )).to.emit(vault, "ScholarshipPaidV5");

      const expectedUSDT = AMOUNT_PER_GUIDE_USDT;  // 100% of 1 USDT
      const expectedSlearn = AMOUNT_PER_GUIDE_SLEARN; // 100% of 5 SLEARN

      expect(await usdt.balanceOf(student.address)).to.equal(studentUSDTBefore + expectedUSDT);
      expect(await slearn.balanceOf(student.address)).to.equal(studentSlearnBefore + expectedSlearn);

      // guidePaid records
      expect(await vault.guidePaidUSDT(COURSE_ID, GUIDE_ID, student.address)).to.equal(expectedUSDT);
      expect(await vault.guidePaidSLEARN(COURSE_ID, GUIDE_ID, student.address)).to.equal(expectedSlearn);
    });

    it("Should pay proportionally with lower profileScore", async function () {
      const { vault, usdt, student } = await loadFixture(vaultWithSetupFixture);
      const score = 60n;

      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, Number(score),
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      );

      const expectedUSDT = (AMOUNT_PER_GUIDE_USDT * score) / 100n;
      expect(await vault.guidePaidUSDT(COURSE_ID, GUIDE_ID, student.address)).to.equal(expectedUSDT);
      expect(await usdt.balanceOf(student.address)).to.equal(expectedUSDT);
    });

    it("Should not pay for non-perfect submissions", async function () {
      const { vault, usdt, student } = await loadFixture(vaultWithSetupFixture);

      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, false, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      );

      expect(await vault.guidePaidUSDT(COURSE_ID, GUIDE_ID, student.address)).to.equal(0n);
      expect(await vault.studentCanSubmit(COURSE_ID, student.address)).to.be.true; // no cooldown
    });

    it("Should not double-pay", async function () {
      const { vault, student } = await loadFixture(vaultWithSetupFixture);

      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      );

      // Second call should emit AlreadyPaid, not pay again
      await expect(vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      )).to.emit(vault, "ScholarshipAlreadyPaid");

      expect(await vault.guidePaidUSDT(COURSE_ID, GUIDE_ID, student.address)).to.equal(AMOUNT_PER_GUIDE_USDT);
    });
  });

  describe("payScholarship — splits", function () {
    it("Should split 80/10/10 between student, referrer, and learnTg", async function () {
      const { vault, usdt, slearn, student, referrer, learnTg } = await loadFixture(vaultWithSetupFixture);

      const totalUSDT = AMOUNT_PER_GUIDE_USDT; // 1 USDT
      const totalSlearn = AMOUNT_PER_GUIDE_SLEARN; // 5 SLEARN

      const referrerUSDT = (totalUSDT * 10n) / 100n;
      const referrerSlearn = (totalSlearn * 10n) / 100n;
      const learnTgUSDT = (totalUSDT * 10n) / 100n;
      const learnTgSlearn = (totalSlearn * 10n) / 100n;
      const studentUSDT = totalUSDT - referrerUSDT - learnTgUSDT;
      const studentSlearn = totalSlearn - referrerSlearn - learnTgSlearn;

      const studentUSDTBefore = await usdt.balanceOf(student.address);
      const referrerUSDTBefore = await usdt.balanceOf(referrer.address);
      const learnTgUSDTBefore = await usdt.balanceOf(learnTg.address);

      await expect(vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        referrer.address, referrerUSDT, referrerSlearn,
        learnTg.address, learnTgUSDT, learnTgSlearn
      )).to.emit(vault, "ScholarshipPaidV5")
        .withArgs(
          COURSE_ID, GUIDE_ID, student.address,
          studentUSDT, studentSlearn,
          referrer.address, referrerUSDT, referrerSlearn,
          learnTg.address, learnTgUSDT, learnTgSlearn,
          PROFILE_SCORE
        );

      expect(await usdt.balanceOf(student.address)).to.equal(studentUSDTBefore + studentUSDT);
      expect(await usdt.balanceOf(referrer.address)).to.equal(referrerUSDTBefore + referrerUSDT);
      expect(await usdt.balanceOf(learnTg.address)).to.equal(learnTgUSDTBefore + learnTgUSDT);

      // guidePaid tracks total amount (not just student portion)
      expect(await vault.guidePaidUSDT(COURSE_ID, GUIDE_ID, student.address)).to.equal(totalUSDT);
    });

    it("Should pay only referrer split (no learnTg)", async function () {
      const { vault, usdt, student, referrer } = await loadFixture(vaultWithSetupFixture);

      const totalUSDT = AMOUNT_PER_GUIDE_USDT;
      const referrerUSDT = (totalUSDT * 10n) / 100n;
      const referrerSlearn = 0n;

      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        referrer.address, referrerUSDT, referrerSlearn,
        ZERO_ADDR, 0, 0
      );

      const status = await vault.getStudentGuideStatus(COURSE_ID, GUIDE_ID, student.address);
      expect(status[0]).to.equal(totalUSDT); // guidePaidUSDT = full amount
      expect(await usdt.balanceOf(referrer.address)).to.equal(referrerUSDT);
    });

    it("Should pay only learnTg split (no referrer)", async function () {
      const { vault, usdt, student, learnTg } = await loadFixture(vaultWithSetupFixture);

      const learnTgUSDT = (AMOUNT_PER_GUIDE_USDT * 10n) / 100n;

      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0,
        learnTg.address, learnTgUSDT, 0
      );

      expect(await usdt.balanceOf(learnTg.address)).to.equal(learnTgUSDT);
    });

    it("Should reject deductions exceeding scholarship", async function () {
      const { vault, student, referrer } = await loadFixture(vaultWithSetupFixture);

      await expect(vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        referrer.address, AMOUNT_PER_GUIDE_USDT + 1n, 0,
        ZERO_ADDR, 0, 0
      )).to.be.revertedWith("USDT deductions exceed scholarship");
    });

    it("Should reject self-referral", async function () {
      const { vault, student } = await loadFixture(vaultWithSetupFixture);

      await expect(vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        student.address, 100000n, 0,
        ZERO_ADDR, 0, 0
      )).to.be.revertedWith("Cannot refer yourself");
    });
  });

  describe("payScholarship — per-token all-or-nothing", function () {
    it("Should skip USDT if vault balance insufficient", async function () {
      const { vault, usdt, slearn, student } = await loadFixture(vaultWithSetupFixture);

      const requiredUSDT = AMOUNT_PER_GUIDE_USDT; // 1 USDT
      // Set USDT balance below required
      await vault.setVaultBalance(COURSE_ID, requiredUSDT - 1n, DEPOSIT_SLEARN);

      await expect(vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      )).to.emit(vault, "ScholarshipInsufficientFunds");

      // SLEARN was paid (sufficient)
      expect(await vault.guidePaidSLEARN(COURSE_ID, GUIDE_ID, student.address)).to.equal(AMOUNT_PER_GUIDE_SLEARN);
      // USDT was NOT paid (insufficient)
      expect(await vault.guidePaidUSDT(COURSE_ID, GUIDE_ID, student.address)).to.equal(0n);
      // Cooldown set because SLEARN was paid
      expect(await vault.studentCanSubmit(COURSE_ID, student.address)).to.be.false;
    });

    it("Should pay USDT later when funds arrive (partial between tokens)", async function () {
      const { vault, usdt, student } = await loadFixture(vaultWithSetupFixture);

      const requiredUSDT = AMOUNT_PER_GUIDE_USDT;
      // Start with insufficient USDT
      await vault.setVaultBalance(COURSE_ID, requiredUSDT - 1n, DEPOSIT_SLEARN);

      // First attempt: SLEARN paid, USDT skipped
      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      );
      expect(await vault.guidePaidSLEARN(COURSE_ID, GUIDE_ID, student.address)).to.equal(AMOUNT_PER_GUIDE_SLEARN);
      expect(await vault.guidePaidUSDT(COURSE_ID, GUIDE_ID, student.address)).to.equal(0n);

      // Advance time past cooldown
      await time.increase(86401); // 24h + 1s

      // Add more USDT
      await vault.setVaultBalance(COURSE_ID, DEPOSIT_USDT, DEPOSIT_SLEARN - AMOUNT_PER_GUIDE_SLEARN);

      const balanceBefore = await usdt.balanceOf(student.address);

      // Second attempt: USDT paid now
      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      );

      expect(await vault.guidePaidUSDT(COURSE_ID, GUIDE_ID, student.address)).to.equal(AMOUNT_PER_GUIDE_USDT);
      expect(await usdt.balanceOf(student.address)).to.equal(balanceBefore + AMOUNT_PER_GUIDE_USDT);
    });
  });

  describe("Cooldown", function () {
    it("Should enforce 24h cooldown after payment", async function () {
      const { vault, student } = await loadFixture(vaultWithSetupFixture);

      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      );

      expect(await vault.studentCanSubmit(COURSE_ID, student.address)).to.be.false;

      await time.increase(86401);
      expect(await vault.studentCanSubmit(COURSE_ID, student.address)).to.be.true;
    });

    it("Should not set cooldown if nothing was paid", async function () {
      const { vault, student } = await loadFixture(vaultWithSetupFixture);

      // Set balance to 0 so nothing can be paid
      await vault.setVaultBalance(COURSE_ID, 0, 0);

      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      );

      // No cooldown because nothing was paid
      expect(await vault.studentCanSubmit(COURSE_ID, student.address)).to.be.true;
    });
  });

  describe("Migration helpers", function () {
    it("setGuidePaid should work for owner", async function () {
      const { vault, student } = await loadFixture(vaultWithSetupFixture);

      await vault.setGuidePaid(COURSE_ID, GUIDE_ID, student.address, AMOUNT_PER_GUIDE_USDT, AMOUNT_PER_GUIDE_SLEARN);
      expect(await vault.guidePaidUSDT(COURSE_ID, GUIDE_ID, student.address)).to.equal(AMOUNT_PER_GUIDE_USDT);
      expect(await vault.guidePaidSLEARN(COURSE_ID, GUIDE_ID, student.address)).to.equal(AMOUNT_PER_GUIDE_SLEARN);
    });

    it("setGuidePaid should revert for non-owner", async function () {
      const { vault, student } = await loadFixture(vaultWithSetupFixture);
      await expect(vault.connect(student).setGuidePaid(COURSE_ID, GUIDE_ID, student.address, 1, 1))
        .to.be.revertedWith("Only owner");
    });

    it("setVaultBalance should update balances", async function () {
      const { vault } = await loadFixture(vaultWithSetupFixture);
      const newUSDT = hre.ethers.parseUnits("5", 6);
      const newSLEARN = hre.ethers.parseUnits("25", 2);

      await vault.setVaultBalance(COURSE_ID, newUSDT, newSLEARN);
      const v = await vault.vaults(COURSE_ID);
      expect(v.balanceUsdt).to.equal(newUSDT);
      expect(v.balanceSlearn).to.equal(newSLEARN);
    });
  });

  describe("Emergency", function () {
    it("Should allow owner to emergency withdraw", async function () {
      const { vault, usdt, owner } = await loadFixture(vaultWithSetupFixture);
      const amount = hre.ethers.parseUnits("5", 6);
      const ownerBefore = await usdt.balanceOf(owner.address);

      await vault.emergencyWithdrawUSDT(amount);
      expect(await usdt.balanceOf(owner.address)).to.equal(ownerBefore + amount);
    });

    it("Should revert emergency withdraw for non-owner", async function () {
      const { vault, student } = await loadFixture(vaultWithSetupFixture);
      await expect(vault.connect(student).emergencyWithdrawUSDT(1000000))
        .to.be.revertedWith("Only owner");
    });
  });

  describe("getStudentGuideStatus", function () {
    it("Should return paid amounts and canSubmit", async function () {
      const { vault, student } = await loadFixture(vaultWithSetupFixture);

      let status = await vault.getStudentGuideStatus(COURSE_ID, GUIDE_ID, student.address);
      expect(status[0]).to.equal(0n);  // paidUSDT
      expect(status[1]).to.equal(0n);  // paidSlearn
      expect(status[2]).to.be.true;    // canSubmit

      await vault.payScholarship(
        COURSE_ID, GUIDE_ID, student.address, true, PROFILE_SCORE,
        ZERO_ADDR, 0, 0, ZERO_ADDR, 0, 0
      );

      status = await vault.getStudentGuideStatus(COURSE_ID, GUIDE_ID, student.address);
      expect(status[0]).to.equal(AMOUNT_PER_GUIDE_USDT);
      expect(status[1]).to.equal(AMOUNT_PER_GUIDE_SLEARN);
      expect(status[2]).to.be.false;   // in cooldown
    });
  });
});
