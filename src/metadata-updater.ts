import fs from "fs";
import express from "express";
import { getTokenCount } from "./getTokenCount.js";
import cron from "node-cron";
import { Request, Response } from "express";
import { config } from "dotenv";
config();

// Script execution parameters
/// Contract to update
const JBPROJECTS_ADDRESS = "0xd8b4359143eda5b2d763e127ed27c77addbc47d3";
/// Atomatic execution frequency and runtime
const CRON_FREQUENCY = 25; // Frequency in minutes
const MAX_RUNTIME = 20; // Maximum runtime in minutes
/// Rate limiting
const BUCKET_SIZE = 1; // Maximum number of requests that can be sent at a time
const LEAK_RATE = 1000; // Delay in milliseconds between subsequent requests
const RETRY_LEAK_RATE = 2 * LEAK_RATE; // The leak rate for retry requests
// Contract size
const FIRST_TOKEN_ID = 1;
const LAST_TOKEN_ID = (await getTokenCount()) as number;

const BASE_URL = "https://api.opensea.io/api/v1/asset";
const API_KEY = process.env.OPENSEA_API_KEY;

if (!API_KEY) {
  console.error(
    "OPENSEA_API_KEY is not defined in your environment variables."
  );
  process.exit(1);
}

const OPTIONS = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36",
    "X-Api-Key": API_KEY,
    referrer: BASE_URL,
  },
};

// Runtime global state
const failedRequests: number[] = [];
let isRunning = false;

// Function to simulate delay
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to update OpenSea metadata for all JBProject tokens
async function fetchData(tokenId: number) {
  const url = `${BASE_URL}/${JBPROJECTS_ADDRESS}/${tokenId}/?force_update=true`;

  try {
    const response = await fetch(url, OPTIONS);

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
  if (isRunning) {
    return; // If the task is already running, return early.
  }
  isRunning = true;

  const startTime = Date.now(); // Start time
  let attempts = 0; // To count the number of attempts

  // Set a timeout to clear the failedRequests array after MAX_RUNTIME minutes
  const timeout = setTimeout(() => {
    failedRequests.length = 0;
  }, MAX_RUNTIME * 60 * 1000); // minutes in milliseconds

  for (let tokenId = FIRST_TOKEN_ID; tokenId <= LAST_TOKEN_ID; tokenId++) {
    await fetchData(tokenId);
    attempts++;

    // If we've hit the BUCKET_SIZE, we wait for the LEAK_RATE before continuing
    if (tokenId % BUCKET_SIZE === 0) {
      await delay(LEAK_RATE);
    }
  }

  while (failedRequests.length > 0) {
    const tokenId = failedRequests.pop();

    if (tokenId !== undefined) {
      console.log(`Retrying for token ID ${tokenId}`);
      await fetchData(tokenId);
      attempts++;

      if (tokenId % BUCKET_SIZE === 0) {
        await delay(RETRY_LEAK_RATE);
      }
    }
  }
  const endTime = Date.now(); // End time
  const elapsedTime = (endTime - startTime) / 1000; // Elapsed time in seconds
  const totalTokensFetched = LAST_TOKEN_ID; // Total tokens fetched

  // Write the log to a file named 'log.txt'
  fs.appendFileSync(
    "log.txt",
    `Fetch completed at ${new Date().toISOString()}.\nElapsed time: ${elapsedTime} seconds.\nTotal attempts: ${attempts}.\nTotal tokens fetched: ${totalTokensFetched}\n`
  );
  clearTimeout(timeout);
  isRunning = false; // Remember to reset the lock after the task completes.
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
