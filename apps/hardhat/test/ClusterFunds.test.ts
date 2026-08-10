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
  const COUNTRY_CO = 'CO'

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
      owner.address,
    )
    await contract.waitForDeployment()

    const usdtAmt = ethers.parseUnits('10000', 6)
    const slearnAmt = ethers.parseUnits('10000', 6)
    await mockUSDT.mint(donor.address, usdtAmt)
    await mockSLEARN.mint(donor.address, slearnAmt)

    await mockUSDT.connect(donor).approve(await contract.getAddress(), ethers.MaxUint256)
    await mockSLEARN.connect(donor).approve(await contract.getAddress(), ethers.MaxUint256)
  })

  // ──── Deployment ────

  it('deploys with correct token addresses and owner', async () => {
    expect((await contract.usdtToken()).toLowerCase()).to.equal((await mockUSDT.getAddress()).toLowerCase())
    expect((await contract.slearnToken()).toLowerCase()).to.equal((await mockSLEARN.getAddress()).toLowerCase())
    expect((await contract.owner()).toLowerCase()).to.equal(owner.address.toLowerCase())
    const cfg = await contract.getFeeConfig()
    expect(cfg.wallets.length).to.equal(0)
  })

  // ──── Fee Config ────

  it('setFeeConfig validates inputs', async () => {
    await expect(contract.setFeeConfig([pdjTreasury.address], [10, 5]))
      .to.be.revertedWith('Length mismatch')
    await expect(contract.setFeeConfig([ethers.ZeroAddress], [10]))
      .to.be.revertedWith('Zero address')
    await expect(contract.setFeeConfig([pdjTreasury.address], [110]))
      .to.be.revertedWith('Total exceeds 100%')
  })

  it('setFeeConfig emits FeeConfigUpdated', async () => {
    await expect(contract.setFeeConfig([pdjTreasury.address], [10]))
      .to.emit(contract, 'FeeConfigUpdated')

    const cfg = await contract.getFeeConfig()
    expect(cfg.wallets.length).to.equal(1)
    expect(cfg.wallets[0].toLowerCase()).to.equal(pdjTreasury.address.toLowerCase())
    expect(cfg.percentages[0]).to.equal(10)
  })

  it('setFeeConfig clears fees with empty arrays', async () => {
    await contract.setFeeConfig([pdjTreasury.address], [15])
    await contract.setFeeConfig([], [])
    const cfg = await contract.getFeeConfig()
    expect(cfg.wallets.length).to.equal(0)
    await contract.setFeeConfig([pdjTreasury.address], [10])
  })

  // ──── Cluster Verification ────

  it('setClusterVerification works', async () => {
    await mockUSDT.connect(donor).transfer(await contract.getAddress(), ethers.parseUnits('100', 6))
    const txHash = ethers.id('verify-test')
    await contract.processDonation(txHash, clusterA.address, donor.address, ethers.parseUnits('100', 6), 0n)

    await expect(contract.setClusterVerification(clusterA.address, true))
      .to.emit(contract, 'ClusterVerified')
      .withArgs(clusterA.address, true)

    await expect(contract.setClusterVerification(clusterB.address, true))
      .to.be.revertedWith('Cluster not found')
  })

  // ──── Pausable ────

  it('pause and unpause work', async () => {
    await contract.pause()
    expect(await contract.paused()).to.be.true

    await mockUSDT.connect(donor).transfer(await contract.getAddress(), ethers.parseUnits('50', 6))
    await expect(
      contract.processDonation(ethers.id('paused'), clusterA.address, donor.address, ethers.parseUnits('50', 6), 0n)
    ).to.be.reverted

    await contract.unpause()
    expect(await contract.paused()).to.be.false
  })

  // ──── Donations (with 10% pdJ fee config) ────

  it('processDonation sends 10% to pdJ, 90% to cluster', async () => {
    const usdtAmount = ethers.parseUnits('100', 6)
    const slearnAmount = ethers.parseUnits('200', 6)
    const txHash = ethers.id('don-1')

    await mockUSDT.connect(donor).transfer(await contract.getAddress(), usdtAmount)
    await mockSLEARN.connect(donor).transfer(await contract.getAddress(), slearnAmount)

    const pdjUsdtBefore = await mockUSDT.balanceOf(pdjTreasury.address)
    const pdjSlearnBefore = await mockSLEARN.balanceOf(pdjTreasury.address)

    await expect(contract.processDonation(txHash, clusterA.address, donor.address, usdtAmount, slearnAmount))
      .to.emit(contract, 'FeeDistributed')
      .to.emit(contract, 'ClusterDonation')

    const pdjUsdt = await mockUSDT.balanceOf(pdjTreasury.address) - pdjUsdtBefore
    const pdjSlearn = await mockSLEARN.balanceOf(pdjTreasury.address) - pdjSlearnBefore
    expect(pdjUsdt).to.equal(usdtAmount * 10n / 100n)
    expect(pdjSlearn).to.equal(slearnAmount * 10n / 100n)

    const bal = await contract.getClusterBalance(clusterA.address)
    expect(bal[0]).to.equal(usdtAmount * 90n / 100n)
    expect(bal[1]).to.equal(slearnAmount * 90n / 100n)

    await expect(
      contract.processDonation(txHash, clusterA.address, donor.address, usdtAmount, slearnAmount)
    ).to.be.revertedWith('Already processed')
  })

  it('processDonation with empty fees sends 100% to cluster', async () => {
    await contract.setFeeConfig([], [])
    const usdtAmount = ethers.parseUnits('100', 6)
    const txHash = ethers.id('don-no-fee')

    await mockUSDT.connect(donor).transfer(await contract.getAddress(), usdtAmount)
    await contract.processDonation(txHash, clusterA.address, donor.address, usdtAmount, 0n)

    const bal = await contract.getClusterBalance(clusterA.address)
    expect(bal[0]).to.equal(usdtAmount)

    await contract.setFeeConfig([pdjTreasury.address], [10])
  })

  it('processDonation rejects zero addresses and zero amounts', async () => {
    const txHash = ethers.id('don-zeroaddr')
    await expect(
      contract.processDonation(txHash, ethers.ZeroAddress, donor.address, 100n, 0n)
    ).to.be.revertedWith('Invalid cluster wallet')
    await expect(
      contract.processDonation(txHash, clusterA.address, ethers.ZeroAddress, 100n, 0n)
    ).to.be.revertedWith('Invalid donor')
    await expect(
      contract.processDonation(ethers.id('don-zero'), clusterA.address, donor.address, 0n, 0n)
    ).to.be.revertedWith('Amounts cannot both be zero')
  })

  it('processCountryDonation works', async () => {
    const usdtAmount = ethers.parseUnits('50', 6)
    const txHash = ethers.id('country-1')

    await mockUSDT.connect(donor).transfer(await contract.getAddress(), usdtAmount)

    await contract.processCountryDonation(txHash, COUNTRY_SL, donor.address, usdtAmount, 0n)

    const countryBal = await contract.getCountryBalance(COUNTRY_SL)
    expect(countryBal[0]).to.equal(usdtAmount * 90n / 100n)
  })

  it('processCountryDonation validates country code', async () => {
    await expect(
      contract.processCountryDonation(ethers.id('bad-cc'), 'S', donor.address, 100n, 0n)
    ).to.be.revertedWith('Invalid country code')
  })

  // ──── Redistribution ────

  it('redistributeCountryFunds distributes among verified clusters', async () => {
    const txC = ethers.id('reg-B')
    await mockUSDT.connect(donor).transfer(await contract.getAddress(), ethers.parseUnits('10', 6))
    await contract.processDonation(txC, clusterB.address, donor.address, ethers.parseUnits('10', 6), 0n)
    await contract.setClusterVerification(clusterB.address, true)

    const countryTx = ethers.id('country-redist')
    await mockUSDT.connect(donor).transfer(await contract.getAddress(), ethers.parseUnits('100', 6))
    await contract.processCountryDonation(countryTx, COUNTRY_SL, donor.address, ethers.parseUnits('100', 6), 0n)

    await contract.redistributeCountryFunds(COUNTRY_SL, [clusterA.address, clusterB.address])

    const afterA = await contract.getClusterBalance(clusterA.address)
    const afterB = await contract.getClusterBalance(clusterB.address)
    expect(Number(afterA[0])).to.be.greaterThan(0)
    expect(Number(afterB[0])).to.be.greaterThan(0)
  })

  it('redistributeCountryFunds rejects unverified or duplicates', async () => {
    await expect(
      contract.redistributeCountryFunds(COUNTRY_SL, [clusterC.address])
    ).to.be.revertedWith('Cluster not registered')

    await expect(
      contract.redistributeCountryFunds(COUNTRY_SL, [clusterA.address, clusterA.address])
    ).to.be.revertedWith('Duplicate cluster')
  })

  // ──── Release ────

  it('releaseClusterFunds transfers to cluster wallet', async () => {
    const txHash = ethers.id('release-test')
    await mockUSDT.connect(donor).transfer(await contract.getAddress(), ethers.parseUnits('100', 6))
    await contract.processDonation(txHash, clusterA.address, donor.address, ethers.parseUnits('100', 6), 0n)

    const balBefore = await contract.getClusterBalance(clusterA.address)

    await contract.releaseClusterFunds(clusterA.address)

    const balAfter = await contract.getClusterBalance(clusterA.address)
    expect(balAfter[0]).to.equal(0n)
    expect(await mockUSDT.balanceOf(clusterA.address)).to.equal(balBefore[0])
  })

  it('releaseClusterFunds requires verification', async () => {
    await expect(contract.releaseClusterFunds(clusterC.address))
      .to.be.revertedWith('Cluster not found')
  })

  // ──── Cluster Removal ────

  it('removeCluster transfers funds to country', async () => {
    const txHash = ethers.id('remove-test')
    await mockUSDT.connect(donor).transfer(await contract.getAddress(), ethers.parseUnits('50', 6))
    await contract.processDonation(txHash, clusterB.address, donor.address, ethers.parseUnits('50', 6), 0n)

    await contract.removeCluster(clusterB.address, COUNTRY_SL)

    const removedFunds = await contract.getClusterFunds(clusterB.address)
    expect(removedFunds[2]).to.be.false
  })
})
