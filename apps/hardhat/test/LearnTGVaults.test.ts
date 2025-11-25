  import { expect } from "chai";
  import hre from "hardhat";
  import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

  describe("LearnTGVaults", function () {
    const COURSE_ID_1 = 1;
    const COURSE_ID_2 = 2;
    const GUIDE_NUMBER_1 = 1;
    const GUIDE_NUMBER_2 = 2;
    const AMOUNT_PER_GUIDE = hre.ethers.parseUnits("10", 6); // 10 USDT
    const DEPOSIT_AMOUNT = hre.ethers.parseUnits("100", 6); // 100 USDT
    const VAULT_DEPOSIT_AMOUNT = (DEPOSIT_AMOUNT * 4n) / 5n; // 80%

    async function deployFixture() {
      const [owner, student1, student2, donor, ...addrs] = await hre.ethers.getSigners();

      // Deploy mock USDT token
      const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
      const mockUSDT = await MockUSDT.deploy();
      await mockUSDT.waitForDeployment();
      const usdtAddress = await mockUSDT.getAddress();

      // Deploy LearnTGVaults contract
      const LearnTGVaults = await hre.ethers.getContractFactory("LearnTGVaults");
      const learnTGVaults = await LearnTGVaults.deploy(usdtAddress);
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
        expect(vault.balance).to.equal(0);
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
        expect(vaultAfter.balance).to.equal(vaultBefore.balance + VAULT_DEPOSIT_AMOUNT);

        const feeAmount = DEPOSIT_AMOUNT / 5n;
        const ownerBalanceAfter = await mockUSDT.balanceOf(owner.address);
        expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + feeAmount);
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
        
        await learnTGVaults.emergencyWithdraw(contractBalance);

        const ownerBalanceAfter = await mockUSDT.balanceOf(owner.address);
        expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + contractBalance);
        expect(await learnTGVaults.getContractUSDTBalance()).to.equal(0);
      });

      it("Should prevent non-owner from withdrawing emergency funds", async function() {
        const { learnTGVaults, student1 } = await loadFixture(deployFixture);
        await expect(learnTGVaults.connect(student1).emergencyWithdraw(100))
          .to.be.revertedWith("Only owner");
      });
    });

    describe("Edge Cases", function() {
      it("Should revert submission if vault has insufficient funds", async function() {
        const { learnTGVaults, student1, donor } = await loadFixture(deployFixture);
        const highAmount = hre.ethers.parseUnits("100", 6);
        const lowDeposit = hre.ethers.parseUnits("50", 6);
        await learnTGVaults.createVault(COURSE_ID_2, highAmount);
        await learnTGVaults.connect(donor).deposit(COURSE_ID_2, lowDeposit); 
        
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

