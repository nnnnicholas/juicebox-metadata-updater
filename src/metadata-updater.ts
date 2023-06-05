//Metadata Updater

import fs from "fs";
import express from "express";
import { getTokenCount } from "./get721TokenCount.js";
import { get1155TokenIds } from "./get1155TokenIdsFromGraph.js";
import cron from "node-cron";
import { Request, Response } from "express";
import { config } from "dotenv";
config();

// Script execution parameters
/// Contract to update
const JBPROJECTS_ADDRESS = "0xd8b4359143eda5b2d763e127ed27c77addbc47d3";
const JUICEBOX_CARDS_ADDRESS = "0xe601eae33a0109147a6f3cd5f81997233d42fedd";
/// Atomatic execution frequency and runtime
const CRON_FREQUENCY = process.env.CRON_FREQUENCY; // Frequency in minutes
const MAX_RUNTIME = process.env.MAX_RUNTIME; // Maximum runtime in minutes
/// Rate limiting
const BUCKET_SIZE = process.env.BUCKET_SIZE; // Maximum number of requests that can be sent at a time
const LEAK_RATE = process.env.LEAK_RATE; // Delay in milliseconds between subsequent requests
const RETRY_LEAK_RATE = process.env.RETRY_LEAK_RATE; // The leak rate for retry requests
// Contract size
const FIRST_TOKEN_ID = process.env.FIRST_TOKEN_ID;
const LAST_TOKEN_ID = (await getTokenCount()) as number;

const BASE_URL = "https://api.opensea.io/api/v1/asset";
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;

if (
  !CRON_FREQUENCY ||
  !MAX_RUNTIME ||
  !BUCKET_SIZE ||
  !LEAK_RATE ||
  !RETRY_LEAK_RATE ||
  !FIRST_TOKEN_ID ||
  !OPENSEA_API_KEY
) {
  console.error(
    "One or more required environment variables are not set. Please check your .env file or environment variables."
  );
  process.exit(1);
}

const OPTIONS = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36",
    "X-Api-Key": OPENSEA_API_KEY,
    referrer: BASE_URL,
  },
};

// Runtime global state
type FailedRequest = { tokenId: number; contractAddress: string };
const failedRequests: FailedRequest[] = [];
let isRunning = false;

// Function to simulate delay
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to update OpenSea metadata for all JBProject tokens
async function fetchData(tokenId: number, contractAddress: string) {
  const url = `${BASE_URL}/${contractAddress}/${tokenId}/?force_update=true`;

  try {
    const response = await fetch(url, OPTIONS);

    if (response.ok) {
      const data = await response.json();
      console.log(
        `Request for ${
          Object.keys({ contractAddress })[0]
        } token ID ${tokenId} successful.`
      );
    } else {
      console.error(
        `Error fetching data for token ID ${tokenId}:`,
        response.statusText
      );
      failedRequests.push({ tokenId, contractAddress }); // If a request fails, add it to the queue
    }
  } catch (error) {
    console.error(`Error fetching data for token ID ${tokenId}:`, error);
    failedRequests.push({ tokenId, contractAddress }); // If a request fails, add it to the queue
  }
}

// Loop through the token IDs make a GET request to opensea for each
async function fetchAllData() {
  if (isRunning) {
    return; // If the task is already running, return early.
  }
  isRunning = true;

  const startTime = Date.now(); // Start time
  let attempts = 0; // To count the number of attempts
  let total721TokensFetched = 0; // Total 721 tokens fetched
  let total1155TokensFetched = 0; // Total 1155 tokens fetched
  let operationStatus = "completed successfully";

  // Set a timeout to clear the failedRequests array and log an error message after MAX_RUNTIME minutes
  const timeout = setTimeout(() => {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - startTime) / 1000; // Elapsed time in seconds
    failedRequests.length = 0;
    fs.appendFileSync(
      "logs.txt",
      `Operation timed out after ${MAX_RUNTIME} minutes at ${new Date().toISOString()}.\nElapsed time: ${elapsedTime} seconds.\nTotal attempts: ${attempts}.\nTotal 721 tokens fetched: ${total721TokensFetched}.\nTotal 1155 tokens fetched: ${total1155TokensFetched}.\n\n`
    );
    console.log(
      `Operation timed out after ${MAX_RUNTIME} minutes at ${new Date().toISOString()}. Elapsed time: ${elapsedTime} seconds. Total attempts: ${attempts}. Total 721 tokens fetched: ${total721TokensFetched}. Total 1155 tokens fetched: ${total1155TokensFetched}.`
    );

    isRunning = false; // Remember to reset the lock after the task completes.
  }, MAX_RUNTIME * 60 * 1000); // minutes in milliseconds

  try {
    // Fetch 721 tokens
    for (let tokenId = FIRST_TOKEN_ID; tokenId <= LAST_TOKEN_ID; tokenId++) {
      await fetchData(tokenId, JBPROJECTS_ADDRESS);
      total721TokensFetched++;
      attempts++;

      // If we've hit the BUCKET_SIZE, we wait for the LEAK_RATE before continuing
      if (tokenId % BUCKET_SIZE === 0) {
        await delay(LEAK_RATE);
      }
    }

    // Fetch 1155 tokens
    const tokenIds1155 = await get1155TokenIds(JUICEBOX_CARDS_ADDRESS);
    for (const tokenId of tokenIds1155) {
      await fetchData(tokenId, JUICEBOX_CARDS_ADDRESS);
      total1155TokensFetched++;
      attempts++;
      // If we've hit the BUCKET_SIZE, we wait for the LEAK_RATE before continuing
      if (tokenId % BUCKET_SIZE === 0) {
        await delay(LEAK_RATE);
      }
    }

    while (failedRequests.length > 0) {
      const failedRequest = failedRequests.pop();

      if (failedRequest !== undefined) {
        const { tokenId, contractAddress } = failedRequest;
        console.log(`Retrying for token ID ${tokenId}`);
        await fetchData(tokenId, contractAddress);
        attempts++;

        if (tokenId % BUCKET_SIZE === 0) {
          await delay(RETRY_LEAK_RATE);
        }
      }
    }
    const endTime = Date.now(); // End time
    const elapsedTime = (endTime - startTime) / 1000; // Elapsed time in seconds

    // Write the log to a file named 'log.txt'
    fs.appendFileSync(
      "logs.txt",
      `Operation ${operationStatus} at ${new Date().toISOString()}.\nElapsed time: ${elapsedTime} seconds.\nTotal attempts: ${attempts}.\nTotal 721 tokens fetched: ${total721TokensFetched}.\nTotal 1155 tokens fetched: ${total1155TokensFetched}.\n\n`
    );
    console.log(
      `Operation ${operationStatus} at ${new Date().toISOString()}. Elapsed time: ${elapsedTime} seconds. Total attempts: ${attempts}. Total 721 tokens fetched: ${total721TokensFetched}. Total 1155 tokens fetched: ${total1155TokensFetched}.`
    );
    clearTimeout(timeout);
    isRunning = false; // Reset the lock after the task completes.
  } catch (error) {
    console.error(`Error during fetchAllData: ${error}`);
    operationStatus = `failed with error: ${error}`;
  } finally {
    const endTime = Date.now(); // End time
    const elapsedTime = (endTime - startTime) / 1000; // Elapsed time in seconds

    // Write the log to a file named 'logs.txt'
    fs.appendFileSync(
      "logs.txt",
      `Operation ${operationStatus} at ${new Date().toISOString()}.\nElapsed time: ${elapsedTime} seconds.\nTotal attempts: ${attempts}.\nTotal 721 tokens fetched: ${total721TokensFetched}.\nTotal 1155 tokens fetched: ${total1155TokensFetched}.\n`
    );

    clearTimeout(timeout);
    isRunning = false; // Remember to reset the lock after the task completes.
  }
}

// Define an Express app.
const app = express();

// Define a route that will trigger your fetchAllData function.
app.get("/refresh", async (req: Request, res: Response) => {
  if (!isRunning) {
    await fetchAllData();
    res.send("Refreshing data.");
  } else {
    res.send("Data refresh already in progress.");
  }
});

// Define the port to listen on.
const port = process.env.PORT || 3000;

// Start listening for requests.
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});

// Set a cron job to call the function every N minutes
cron.schedule(`*/${CRON_FREQUENCY} * * * *`, async function () {
  if (!isRunning) {
    console.log("Running cron job");
    await fetchAllData();
  }
});

// Call the fetchAllData function
fetchAllData();
