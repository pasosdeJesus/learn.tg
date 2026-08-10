import { expect } from 'chai'
import hre from 'hardhat'
const { ethers } = hre

describe('ClusterFunds', () => {
  let contract: any
  let mockUSDT: any
  let mockSLEARN: any
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

    const USDTFactory = await ethers.getContractFactory('MockUSDT')
    mockUSDT = await USDTFactory.deploy(owner.address)
    await mockUSDT.waitForDeployment()

    mockSLEARN = await USDTFactory.deploy(owner.address)
    await mockSLEARN.waitForDeployment()

    const factory = await ethers.getContractFactory('ClusterFunds')
    contract = await factory.deploy(
      await mockUSDT.getAddress(),
      await mockSLEARN.getAddress(),
      pdjTreasury.address,
      owner.address,
    )
    await contract.waitForDeployment()

    const usdtAmt = ethers.parseUnits('10000', 6)
    const slearnAmt = ethers.parseUnits('10000', 6)
    await mockUSDT.mint(donor.address, usdtAmt)
    await mockSLEARN.mint(donor.address, slearnAmt)

    await mockUSDT.connect(donor).approve(await contract.getAddress(), ethers.MaxUint256)
    await mockSLEARN.connect(donor).approve(await contract.getAddress(), ethers.MaxUint256)

    // MockSLEARN has mint() via Ownable — simulate mintAndReserve behavior
    // For testing, we approve SLEARN to spend contract's USDT and mock the mint
    // (MockSLEARN doesn't have mintAndReserve; we test cashback transfers directly)
  })

  it('deploys with correct defaults (10% pdJ, 10% cashback)', async () => {
    expect((await contract.usdtToken()).toLowerCase()).to.equal((await mockUSDT.getAddress()).toLowerCase())
    expect((await contract.slearnToken()).toLowerCase()).to.equal((await mockSLEARN.getAddress()).toLowerCase())
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
    const slearnAmount = ethers.parseUnits('200', 6)
    const txHash = ethers.id('don-1')

    await mockUSDT.connect(donor).transfer(await contract.getAddress(), usdtAmount)
    await mockSLEARN.connect(donor).transfer(await contract.getAddress(), slearnAmount)

    const pdjUsdtBefore = await mockUSDT.balanceOf(pdjTreasury.address)
    const pdjSlearnBefore = await mockSLEARN.balanceOf(pdjTreasury.address)
    const donorSlearnBefore = await mockSLEARN.balanceOf(donor.address)

    await contract.processDonation(txHash, clusterA.address, donor.address, usdtAmount, slearnAmount)

    // 10% pdJ
    const pdjUsdt = await mockUSDT.balanceOf(pdjTreasury.address) - pdjUsdtBefore
    const pdjSlearn = await mockSLEARN.balanceOf(pdjTreasury.address) - pdjSlearnBefore
    expect(pdjUsdt).to.equal(usdtAmount * 10n / 100n)
    expect(pdjSlearn).to.equal(slearnAmount * 10n / 100n)

    // 10% SLEARN cashback to donor
    const donorSlearn = await mockSLEARN.balanceOf(donor.address) - donorSlearnBefore
    expect(donorSlearn).to.equal(slearnAmount * 10n / 100n)

    // 80% cluster
    const bal = await contract.getClusterBalance(clusterA.address)
    expect(bal[0]).to.equal(usdtAmount * 80n / 100n)
    expect(bal[1]).to.equal(slearnAmount * 80n / 100n)

    // NOTE: USDT cashback via mintAndReserve is tested separately
    // (MockSLEARN doesn't implement mintAndReserve)
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
