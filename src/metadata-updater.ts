import fs from "fs";
import { getTokenCount } from "./getTokenCount.js";

const baseUrl = "https://api.opensea.io/api/v1/asset";
const apiKey = process.env.OPENSEA_API_KEY;

if (!apiKey) {
  console.error(
    "OPENSEA_API_KEY is not defined in your environment variables."
  );
  process.exit(1);
}

const options = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36",
    "X-Api-Key": apiKey,
    referrer: baseUrl,
  },
};

const JBPROJECTS_ADDRESS = "0xd8b4359143eda5b2d763e127ed27c77addbc47d3";
const MAX_RUNTIME = 20; // Maximum runtime in minutes
const firstTokenId = 1;
const lastTokenId = (await getTokenCount()) as number;

const bucketSize = 1; // Maximum number of requests that can be sent at a time
const leakRate = 1000; // Delay in milliseconds between subsequent requests
const failedRequests: number[] = [];

// Function to simulate delay
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to update OpenSea metadata for all JBProject tokens
async function fetchData(tokenId: number) {
  const url = `https://api.opensea.io/api/v1/asset/${JBPROJECTS_ADDRESS}/${tokenId}/?force_update=true`;

  try {
    const response = await fetch(url, options);

    if (response.ok) {
      const data = await response.json();
      console.log(`Request for token ID ${tokenId} successful.`);
    } else {
      console.error(
        `Error fetching data for token ID ${tokenId}:`,
        response.statusText
      );
      failedRequests.push(tokenId); // If a request fails, add it to the queue
    }
  } catch (error) {
    console.error(`Error fetching data for token ID ${tokenId}:`, error);
    failedRequests.push(tokenId); // If a request fails, add it to the queue
  }
}

// Loop through the token IDs make a GET request to opensea for each
async function fetchAllData() {
  const startTime = Date.now(); // Start time
  let attempts = 0; // To count the number of attempts

  // Set a timeout to clear the failedRequests array after 20 minutes
  const timeout = setTimeout(() => {
    failedRequests.length = 0;
  }, MAX_RUNTIME * 60 * 1000); // minutes in milliseconds

  for (let tokenId = firstTokenId; tokenId <= lastTokenId; tokenId++) {
    await fetchData(tokenId);
    attempts++;

    // If we've hit the bucket size, we wait for the leakRate before continuing
    if (tokenId % bucketSize === 0) {
      await delay(leakRate);
    }
  }

  while (failedRequests.length > 0) {
    const tokenId = failedRequests.pop();

    if (tokenId !== undefined) {
      console.log(`Retrying for token ID ${tokenId}`);
      await fetchData(tokenId);
      attempts++;

      if (tokenId % bucketSize === 0) {
        await delay(leakRate);
      }
    }
  }

  const endTime = Date.now(); // End time
  const elapsedTime = (endTime - startTime) / 1000; // Elapsed time in seconds
  const totalTokensFetched = lastTokenId; // Total tokens fetched

  // Write the log to a file named 'log.txtHere's the continuation of the code:

  fs.appendFileSync(
    "log.txt",
    `Fetch completed at ${new Date().toISOString()}.\nElapsed time: ${elapsedTime} seconds.\nTotal attempts: ${attempts}.\nTotal tokens fetched: ${totalTokensFetched}\n`
  );
  clearTimeout(timeout);
}

// Call the fetchAllData function
fetchAllData();
