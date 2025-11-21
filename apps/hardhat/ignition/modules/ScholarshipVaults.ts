import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import dotenv from "dotenv"
dotenv.config()

// Address of the USDT token on Celo (you may need to adjust this for the specific network)
// This is an example - you'll need to verify the correct address for your deployment network
const USDT_ADDRESS = process.env.USDT_ADDRESS

const ScholarshipVaultsModule = buildModule("ScholarshipVaultsModule", (m) => {
  // If you want to use a mock USDT for testing, you can deploy it:
  // const mockUSDT = m.contract("MockUSDT", []);
  
  // For now, we'll use an existing USDT token address
  const usdtAddress = m.getParameter("usdtAddress", USDT_ADDRESS);
  
  // Deploy the ScholarshipVaults contract
  const scholarshipVaults = m.contract("ScholarshipVaults", [usdtAddress]);

  return { scholarshipVaults };
});

export default ScholarshipVaultsModule;
