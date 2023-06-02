import { config } from "dotenv";
config();

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const rpc = process.env.ALCHEMY_RPC_URL;

const client = createPublicClient({
  chain: mainnet,
  transport: http(rpc ? rpc : ""),
});

export async function getTokenIds(contractAddress: string) {
  const blockNumber = await client.getBlockNumber();
  return `Block number: ${blockNumber}`;
}

// getBlockNumber().then((res) => console.log(res));
