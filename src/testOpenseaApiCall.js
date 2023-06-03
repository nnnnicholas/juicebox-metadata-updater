// works

import { config } from "dotenv";
config();

const baseUrl = "https://api.opensea.io/api/v1/asset";

const url =
  "https://api.opensea.io/api/v1/asset/0xd8b4359143eda5b2d763e127ed27c77addbc47d3/1/?force_update=true";
const options = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36",
    "X-Api-Key": process.env.OPENSEA_API_KEY,
    referrer: baseUrl,
  },
};
(async function () {
  const response = await fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log(data);
    })
    .catch((error) => {
      console.log("There was an error!", error);
    });
})();
