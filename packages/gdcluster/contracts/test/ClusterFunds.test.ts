import { expect } from 'chai'
import hre from 'hardhat'
const { ethers } = hre

describe('ClusterFunds', () => {
  let contract: any
  let mockUSDT: any
  let slearn: any
  let owner: any
  let pdjTreasury: any
  let donor: any
  let clusterA: any
  let clusterB: any
  let clusterC: any

  const COUNTRY_SL = 'SL'

  before(async () => {
    const signers = await ethers.getSigners()
    owner = signers[0]
    pdjTreasury = signers[1]
    donor = signers[2]
    clusterA = signers[3]
    clusterB = signers[4]
    clusterC = signers[5]

    // USDT (MockUSDT, 6 decimals)
    const USDTFactory = await ethers.getContractFactory('MockUSDT')
    mockUSDT = await USDTFactory.deploy(owner.address)
    await mockUSDT.waitForDeployment()

    // SLEARN (real contract, 2 decimals) — implements mintAndReserve used by
    // ClusterFunds._distributeFees for donor cashback.
    const SLEARNFactory = await ethers.getContractFactory('SLEARN')
    slearn = await SLEARNFactory.deploy(await mockUSDT.getAddress())
    await slearn.waitForDeployment()

    // mintAndReserve requires a hot reserve (learnTgReserve).
    await slearn.setLearnTgReserve(owner.address)

    // ClusterFunds
    const factory = await ethers.getContractFactory('ClusterFunds')
    contract = await factory.deploy(
      await mockUSDT.getAddress(),
      await slearn.getAddress(),
      pdjTreasury.address,
      owner.address,
    )
    await contract.waitForDeployment()

    // Grant MINTER_ROLE: ClusterFunds (mintAndReserve) and owner (mint for donor).
    // grantRole also auto-authorizes the holder for SLEARN transfers.
    const MINTER_ROLE = await slearn.MINTER_ROLE()
    await slearn.grantRole(MINTER_ROLE, await contract.getAddress())
    await slearn.grantRole(MINTER_ROLE, owner.address)

    const usdtAmt = ethers.parseUnits('10000', 6)
    const slearnAmt = ethers.parseUnits('10000', 2)
    await mockUSDT.mint(donor.address, usdtAmt)
    await slearn.mint(donor.address, slearnAmt)

    await mockUSDT.connect(donor).approve(await contract.getAddress(), ethers.MaxUint256)
    await slearn.connect(donor).approve(await contract.getAddress(), ethers.MaxUint256)
  })

  it('deploys with correct defaults (10% pdJ, 10% cashback)', async () => {
    expect((await contract.usdtToken()).toLowerCase()).to.equal((await mockUSDT.getAddress()).toLowerCase())
    expect((await contract.slearnToken()).toLowerCase()).to.equal((await slearn.getAddress()).toLowerCase())
    expect(await contract.donorCashbackPct()).to.equal(10)
    const cfg = await contract.getFeeConfig()
    expect(cfg.wallets.length).to.equal(1)
    expect(cfg.percentages[0]).to.equal(10)
  })

  it('setFeeConfig can change defaults', async () => {
    await contract.setFeeConfig([], []) // clear all fees
    let cfg = await contract.getFeeConfig()
    expect(cfg.wallets.length).to.equal(0)
    await contract.setFeeConfig([pdjTreasury.address], [10]) // restore
    cfg = await contract.getFeeConfig()
    expect(cfg.wallets.length).to.equal(1)
  })

  it('setDonorCashbackPct works', async () => {
    await expect(contract.setDonorCashbackPct(60)).to.be.revertedWith('Max 50%')
    await contract.setDonorCashbackPct(10)
    expect(await contract.donorCashbackPct()).to.equal(10)
  })

  it('processDonation distributes fees + cashback correctly', async () => {
    const usdtAmount = ethers.parseUnits('100', 6)
    const slearnAmount = ethers.parseUnits('200', 2)
    const txHash = ethers.id('don-1')

    await mockUSDT.connect(donor).transfer(await contract.getAddress(), usdtAmount)
    await slearn.connect(donor).transfer(await contract.getAddress(), slearnAmount)

    const pdjUsdtBefore = await mockUSDT.balanceOf(pdjTreasury.address)
    const pdjSlearnBefore = await slearn.balanceOf(pdjTreasury.address)
    const donorSlearnBefore = await slearn.balanceOf(donor.address)

    await contract.processDonation(txHash, clusterA.address, donor.address, usdtAmount, slearnAmount)

    // 10% pdJ
    const pdjUsdt = await mockUSDT.balanceOf(pdjTreasury.address) - pdjUsdtBefore
    const pdjSlearn = await slearn.balanceOf(pdjTreasury.address) - pdjSlearnBefore
    expect(pdjUsdt).to.equal(usdtAmount * 10n / 100n)
    expect(pdjSlearn).to.equal(slearnAmount * 10n / 100n)

    // Donor SLEARN cashback = 10% of SLEARN returned directly + SLEARN minted
    // from the 10% USDT cashback via mintAndReserve.
    const cashbackUsdt = usdtAmount * 10n / 100n
    const mintedSlearn = await slearn.usdtToSLEARN(cashbackUsdt)
    const donorSlearn = await slearn.balanceOf(donor.address) - donorSlearnBefore
    expect(donorSlearn).to.equal(slearnAmount * 10n / 100n + mintedSlearn)

    // 80% cluster
    const bal = await contract.getClusterBalance(clusterA.address)
    expect(bal[0]).to.equal(usdtAmount * 80n / 100n)
    expect(bal[1]).to.equal(slearnAmount * 80n / 100n)
  })

  it('processCountryDonation works', async () => {
    const usdtAmount = ethers.parseUnits('50', 6)
    const txHash = ethers.id('country-1')
    await mockUSDT.connect(donor).transfer(await contract.getAddress(), usdtAmount)
    await contract.processCountryDonation(txHash, COUNTRY_SL, donor.address, usdtAmount, 0n)
    const countryBal = await contract.getCountryBalance(COUNTRY_SL)
    expect(countryBal[0]).to.equal(usdtAmount * 80n / 100n)
  })

  it('replay protection works', async () => {
    const txHash = ethers.id('don-2')
    await mockUSDT.connect(donor).transfer(await contract.getAddress(), 100n)
    await contract.processDonation(txHash, clusterA.address, donor.address, 100n, 0n)
    await expect(
      contract.processDonation(txHash, clusterA.address, donor.address, 100n, 0n)
    ).to.be.revertedWith('Already processed')
  })

  it('setClusterVerification works', async () => {
    await expect(contract.setClusterVerification(clusterA.address, true))
      .to.emit(contract, 'ClusterVerified')
    await expect(contract.setClusterVerification(clusterB.address, true))
      .to.be.revertedWith('Cluster not found')
  })
})
