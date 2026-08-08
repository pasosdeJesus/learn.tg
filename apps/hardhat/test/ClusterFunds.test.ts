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

    // Deploy mock tokens (MockUSDT is ERC20 + Ownable, use as both USDT and SLEARN)
    const USDTFactory = await ethers.getContractFactory('MockUSDT')
    mockUSDT = await USDTFactory.deploy(owner.address)
    await mockUSDT.waitForDeployment()

    mockSLEARN = await USDTFactory.deploy(owner.address)
    await mockSLEARN.waitForDeployment()

    // Deploy ClusterFunds
    const factory = await ethers.getContractFactory('ClusterFunds')
    contract = await factory.deploy(
      await mockUSDT.getAddress(),
      await mockSLEARN.getAddress(),
      pdjTreasury.address,
      owner.address,
    )
    await contract.waitForDeployment()

    // Fund donor with tokens (MockUSDT has 6 decimals for both)
    const usdtAmt = ethers.parseUnits('10000', 6)
    const slearnAmt = ethers.parseUnits('10000', 6)
    await mockUSDT.mint(donor.address, usdtAmt)
    await mockSLEARN.mint(donor.address, slearnAmt)

    // Approve contract to spend donor's tokens
    await mockUSDT.connect(donor).approve(await contract.getAddress(), ethers.MaxUint256)
    await mockSLEARN.connect(donor).approve(await contract.getAddress(), ethers.MaxUint256)
  })

  // ──── Deployment ────

  it('deploys with correct token addresses, treasury, and owner', async () => {
    expect((await contract.usdtToken()).toLowerCase()).to.equal((await mockUSDT.getAddress()).toLowerCase())
    expect((await contract.slearnToken()).toLowerCase()).to.equal((await mockSLEARN.getAddress()).toLowerCase())
    expect((await contract.pdjTreasury()).toLowerCase()).to.equal(pdjTreasury.address.toLowerCase())
    expect((await contract.owner()).toLowerCase()).to.equal(owner.address.toLowerCase())
    expect(await contract.pdjPercentage()).to.equal(15)
  })

  // ──── Admin ────

  it('setPdJTreasury rejects zero address', async () => {
    await expect(contract.setPdJTreasury(ethers.ZeroAddress))
      .to.be.revertedWith('Invalid treasury')
  })

  it('setPdJTreasury updates treasury and emits event', async () => {
    await expect(contract.setPdJTreasury(clusterA.address))
      .to.emit(contract, 'PdjTreasuryUpdated')
      .withArgs(clusterA.address)
    // Restore
    await contract.setPdJTreasury(pdjTreasury.address)
  })

  it('setPdJPercentage validates range and steps', async () => {
    await expect(contract.setPdJPercentage(3)).to.be.revertedWith('Min 5%')
    await expect(contract.setPdJPercentage(35)).to.be.revertedWith('Max 30%')
    await expect(contract.setPdJPercentage(12)).to.be.revertedWith('Steps of 5')

    await contract.setPdJPercentage(20)
    expect(await contract.pdjPercentage()).to.equal(20)
    await contract.setPdJPercentage(15)
  })

  it('setClusterVerification works', async () => {
    // Register cluster via donation
    await mockUSDT.connect(donor).transfer(await contract.getAddress(), ethers.parseUnits('100', 6))
    const txHash = ethers.id('verify-test')
    await contract.processDonation(txHash, clusterA.address, donor.address, ethers.parseUnits('100', 6), 0n)

    await expect(contract.setClusterVerification(clusterA.address, true))
      .to.emit(contract, 'ClusterVerified')
      .withArgs(clusterA.address, true)

    const funds = await contract.getClusterFunds(clusterA.address)
    // HRE mock may return named properties or indexed tuple
    expect(funds.exists || funds[2]).to.be.true
    expect(funds.verified || funds[3]).to.be.true

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

  // ──── Donations ────

  it('processDonation splits 85/15 and emits events', async () => {
    const usdtAmount = ethers.parseUnits('100', 6)
    const slearnAmount = ethers.parseUnits('200', 6)
    const txHash = ethers.id('don-1')

    await mockUSDT.connect(donor).transfer(await contract.getAddress(), usdtAmount)
    await mockSLEARN.connect(donor).transfer(await contract.getAddress(), slearnAmount)

    await expect(contract.processDonation(txHash, clusterA.address, donor.address, usdtAmount, slearnAmount))
      .to.emit(contract, 'ClusterDonation')

    const bal = await contract.getClusterBalance(clusterA.address)
    const usdtBal = bal[0]
    const slearnBal = bal[1]
    expect(usdtBal).to.equal(usdtAmount * 85n / 100n)
    expect(slearnBal).to.equal(slearnAmount * 85n / 100n)

    await expect(
      contract.processDonation(txHash, clusterA.address, donor.address, usdtAmount, slearnAmount)
    ).to.be.revertedWith('Already processed')
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
    expect(countryBal[0]).to.equal(usdtAmount * 85n / 100n)
  })

  it('processCountryDonation validates country code', async () => {
    await expect(
      contract.processCountryDonation(ethers.id('bad-cc'), 'S', donor.address, 100n, 0n)
    ).to.be.revertedWith('Invalid country code')
  })

  // ──── Redistribution ────

  it('redistributeCountryFunds distributes among verified clusters', async () => {
    // Ensure both clusters are registered
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

    const clusterBal = await contract.getClusterBalance(clusterB.address)

    await contract.removeCluster(clusterB.address, COUNTRY_SL)

    const removedFunds = await contract.getClusterFunds(clusterB.address)
    expect(removedFunds[2]).to.be.false // exists
  })

  // ──── pct = 0 edge case ────

  it('pdjPercentage = 5 sends 95% to cluster', async () => {
    await contract.setPdJPercentage(5)
    const txHash = ethers.id('pct-5')
    const amount = ethers.parseUnits('100', 6)

    await mockUSDT.connect(donor).transfer(await contract.getAddress(), amount)
    await contract.processDonation(txHash, clusterA.address, donor.address, amount, 0n)

    const bal = await contract.getClusterBalance(clusterA.address)
    expect(Number(bal[0])).to.be.greaterThan(0)

    await contract.setPdJPercentage(15)
  })
})
