// Fetches the 1155 token ids of a given contract via The Graph
import { config } from "dotenv";
config();

export async function get1155TokenIds() {
  const apiKey = process.env.THEGRAPH_API_KEY;
  const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/GCQVLurkeZrdMf4t5v5NyeWJY8pHhfE9sinjFMjLYd9C`;

  const query = `
  {
    erc1155Tokens(where: { contract: "0xe601eae33a0109147a6f3cd5f81997233d42fedd" }) {
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
