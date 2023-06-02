// Fetches the 721 token count of a given contract via RPC
import { config } from "dotenv";
config();

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const RPC = process.env.ALCHEMY_RPC_URL;
const CONTRACTADDRESS = "0xD8B4359143eda5B2d763E127Ed27c77addBc47d3";
const ABI = [
  {
    inputs: [],
    name: "count",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const; // const assertion
const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC ? RPC : ""), // use Alchemy RPC if available
});

const result = client.readContract({
  abi: ABI,
  address: CONTRACTADDRESS,
  functionName: "count",
});

export default async function getTokenCount() {
  const count = await result;
  // console.log(`Total supply of JBProjects: ${count}`);
  return count;
}

// For local testing
// getTokenCount().then((res) => console.log("Total supply of JBProjects:", res));
