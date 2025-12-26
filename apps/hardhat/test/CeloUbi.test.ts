import { ethers, network } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { CeloUbi } from "../typechain-types";

describe("CeloUbi", function () {
    const MAX_REWARD = ethers.parseEther("1");
    const COOLDOWN_PERIOD = 24 * 60 * 60; // 24 hours in seconds

    async function deployCeloUbiFixture() {
        const [owner, backend, recipient, otherAccount] = await ethers.getSigners();
        const CeloUbiFactory = await ethers.getContractFactory("CeloUbi");
        const celoUbi = await CeloUbiFactory.deploy(owner.address, backend.address) as unknown as CeloUbi;
        return { celoUbi, owner, backend, recipient, otherAccount };
    }

    async function deployAndFundCeloUbiFixture() {
        const { celoUbi, owner, backend, recipient, otherAccount } = await loadFixture(deployCeloUbiFixture);
        await celoUbi.connect(owner).deposit({ value: ethers.parseEther("100") });
        return { celoUbi, owner, backend, recipient, otherAccount };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { celoUbi, owner } = await loadFixture(deployCeloUbiFixture);
            expect(await celoUbi.owner()).to.equal(owner.address);
        });

        it("Should set the right backend address", async function () {
            const { celoUbi, backend } = await loadFixture(deployCeloUbiFixture);
            expect(await celoUbi.backendAddress()).to.equal(backend.address);
        });

        it("Should set the correct MAX_REWARD", async function () {
            const { celoUbi } = await loadFixture(deployCeloUbiFixture);
            expect(await celoUbi.MAX_REWARD()).to.equal(MAX_REWARD);
        });
    });

    describe("Administration", function () {
        it("Should allow the owner to deposit funds", async function () {
            const { celoUbi, owner } = await loadFixture(deployCeloUbiFixture);
            const depositAmount = ethers.parseEther("10");
            await expect(celoUbi.connect(owner).deposit({ value: depositAmount }))
                .to.changeEtherBalance(celoUbi, depositAmount);
        });

        it("Should allow the owner to set a new backend address", async function () {
            const { celoUbi, owner, otherAccount } = await loadFixture(deployCeloUbiFixture);
            await celoUbi.connect(owner).setBackendAddress(otherAccount.address);
            expect(await celoUbi.backendAddress()).to.equal(otherAccount.address);
        });

        it("Should prevent non-owners from setting the backend address", async function () {
            const { celoUbi, otherAccount } = await loadFixture(deployCeloUbiFixture);
            await expect(celoUbi.connect(otherAccount).setBackendAddress(otherAccount.address))
                .to.be.revertedWithCustomError(celoUbi, "OwnableUnauthorizedAccount");
        });
    });

    describe("Claiming", function () {
        const profileScore = 75; // 75%
        const expectedReward = (MAX_REWARD * BigInt(profileScore)) / BigInt(100);

        it("Should allow backend to claim for a recipient", async function () {
            const { celoUbi, backend, recipient } = await loadFixture(deployAndFundCeloUbiFixture);
            await expect(celoUbi.connect(backend).claim(recipient.address, profileScore))
                .to.emit(celoUbi, "Claimed").withArgs(recipient.address, expectedReward);
        });

        it("Should transfer the correct reward amount", async function () {
            const { celoUbi, backend, recipient } = await loadFixture(deployAndFundCeloUbiFixture);
            await expect(celoUbi.connect(backend).claim(recipient.address, profileScore))
                .to.changeEtherBalance(recipient, expectedReward);
        });

        it("Should fail if profile score is below 50", async function () {
            const { celoUbi, backend, recipient } = await loadFixture(deployAndFundCeloUbiFixture);
            await expect(celoUbi.connect(backend).claim(recipient.address, 49))
                .to.be.revertedWith("CeloUbi: Profile score must be between 50 and 100");
        });

        it("Should fail if profile score is above 100", async function () {
            const { celoUbi, backend, recipient } = await loadFixture(deployAndFundCeloUbiFixture);
            await expect(celoUbi.connect(backend).claim(recipient.address, 101))
                .to.be.revertedWith("CeloUbi: Profile score must be between 50 and 100");
        });

        it("Should enforce cooldown period", async function () {
            const { celoUbi, backend, recipient } = await loadFixture(deployAndFundCeloUbiFixture);
            await celoUbi.connect(backend).claim(recipient.address, profileScore);
            await expect(celoUbi.connect(backend).claim(recipient.address, profileScore))
                .to.be.revertedWith("CeloUbi: Cooldown period not over");

            await network.provider.send("evm_increaseTime", [COOLDOWN_PERIOD]);
            await network.provider.send("evm_mine");

            await expect(celoUbi.connect(backend).claim(recipient.address, profileScore))
                .to.not.be.reverted;
        });

        it("Should prevent non-backend from claiming", async function () {
            const { celoUbi, otherAccount, recipient } = await loadFixture(deployAndFundCeloUbiFixture);
            await expect(celoUbi.connect(otherAccount).claim(recipient.address, profileScore))
                .to.be.revertedWith("CeloUbi: Caller is not the authorized backend");
        });

        it("Should fail if contract has insufficient balance", async function () {
            const { celoUbi, owner, backend, recipient } = await loadFixture(deployAndFundCeloUbiFixture);
            // Drain the contract
            await celoUbi.connect(owner).emergencyWithdraw();
            await expect(celoUbi.connect(backend).claim(recipient.address, profileScore))
                .to.be.revertedWith("CeloUbi: Insufficient contract balance");
        });
    });

    describe("Emergency Withdraw", function () {
        it("Should allow the owner to withdraw all funds", async function () {
            const { celoUbi, owner } = await loadFixture(deployCeloUbiFixture);
            const depositAmount = ethers.parseEther("5");
            await celoUbi.connect(owner).deposit({ value: depositAmount });

            await expect(celoUbi.connect(owner).emergencyWithdraw())
                .to.changeEtherBalances([celoUbi, owner], [-depositAmount, depositAmount]);
        });

        it("Should prevent non-owners from withdrawing", async function () {
            const { celoUbi, otherAccount } = await loadFixture(deployCeloUbiFixture);
            await expect(celoUbi.connect(otherAccount).emergencyWithdraw())
                .to.be.revertedWithCustomError(celoUbi, "OwnableUnauthorizedAccount");
        });
    });
});
