import { config } from "dotenv";
config();

const apiKey = process.env.THEGRAPH_API_KEY;
const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/GCQVLurkeZrdMf4t5v5NyeWJY8pHhfE9sinjFMjLYd9C`;

const query = `
{
  erc1155Tokens(where: { contract: "0xe601eae33a0109147a6f3cd5f81997233d42fedd" }) {
    id
  }
}
`;

fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    query,
  }),
})
  .then((r) => r.json())
  .then((data) => {
    const ids = data.data.erc1155Tokens.map((token: { id: string }) =>
      parseInt(token.id.split("/")[1])
    );
    console.log(ids);
  });
