// Fetches the 1155 token ids of a given contract via The Graph
import { config } from "dotenv";
config();
import NodeCache from "node-cache";

const graphCache = new NodeCache();

export async function getCached1155TokenIds(contractAddress: string) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const GRAPH_CACHE_DURATION = process.env.GRAPH_CACHE_DURATION!;

  // Validate env vars
  if (!GRAPH_CACHE_DURATION) {
    throw new Error("Missing environment variable: GRAPH_CACHE_DURATION");
  }

  // If cache exists for this contractAddress, return the cached value
  const cachedResult = graphCache.get(contractAddress);
  if (cachedResult) {
    return cachedResult;
  }

  // If cache does not exist or has expired, get new data
  const result = await get1155TokenIds(contractAddress);

  // Store new data in cache for the specified duration
  graphCache.set(
    contractAddress,
    result,
    parseInt(GRAPH_CACHE_DURATION) * 60 * 60 // convert hours to seconds
  );

  return result;
}

export async function get1155TokenIds(contractAddress: string) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const THEGRAPH_API_KEY = process.env.THEGRAPH_API_KEY!;

  // Validate env vars
  if (!THEGRAPH_API_KEY) {
    throw new Error("Missing environment variable: THEGRAPH_API_KEY");
  }

  const endpoint = `https://gateway.thegraph.com/api/${THEGRAPH_API_KEY}/subgraphs/id/GCQVLurkeZrdMf4t5v5NyeWJY8pHhfE9sinjFMjLYd9C`;

  const query = `
  {
    erc1155Tokens(where: { contract: "${contractAddress}" }) {
      id
    }
  }
  `;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query,
    }),
  });

  const data = await response.json();
  const ids = data.data.erc1155Tokens.map((token: { id: string }) =>
    parseInt(token.id.split("/")[1])
  );
  return ids;
}

// For local testing
// get1155TokenIds().then((res) => console.log("1155 token ids:", res));
