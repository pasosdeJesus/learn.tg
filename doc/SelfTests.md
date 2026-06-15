# Self Verification — Test Report

### Environment

| Date | Device | Browser | Wallet | Opera | Comments | 
|-----------|-------|---|---|---|
| 2026-05-11 | Android 16 | Brave 1.89.145 | Brave Native | Yes | Opens self |
| 2026-05-12 | Desktop | Chromium 141.0.7390.54 | One Key | Yes | Must use phone to scan |
| 2026-05-12 | Android 16 | Built-in Wallet | OneKey | 
| Wallet | Brave native wallet |
| Network | Celo Mainnet |

### Production Configuration

| Parameter | Value |
|-----------|-------|
| `endpoint` | `https://learntg.pdJ.app/api/self-verify` |
| `endpointType` | `https` |
| `scope` | `learn.tg` |

### Test Results

| Date | Device | Result | Notes |
|-----------|-------|--------|-------|
| 2026-05-11 | Android + Brave | ✅ Passed | NFC scan worked, verified name shown |
| 2026-05-12 | Desktop + OneKey | ✅ Passed | QR scan on phone required |
| 2026-05-12 | Android + OneKey | ✅ Passed | In-wallet browser worked |
