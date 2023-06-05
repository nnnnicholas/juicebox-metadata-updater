//Metadata Updater

import fs from "fs";
import express from "express";
import { getTokenCount } from "./get721TokenCount.js";
import { get1155TokenIds } from "./get1155TokenIdsFromGraph.js";
import cron from "node-cron";
import { Request, Response } from "express";
import { config } from "dotenv";
config();

// Define your environment variables
// Disable non-null assertion temporarily. Non-null assertion is checked at runtime, but TSC doesn't know that.
/* eslint-disable @typescript-eslint/no-non-null-assertion */
const env = {
  JUICEBOX_CARDS_ADDRESS: process.env.JUICEBOX_CARDS_ADDRESS!,
  JBPROJECTS_ADDRESS: process.env.JBPROJECTS_ADDRESS!,
  OPENSEA_API_KEY: process.env.OPENSEA_API_KEY!,
  THEGRAPH_API_KEY: process.env.THEGRAPH_API_KEY!,
  CRON_FREQUENCY: Number(process.env.CRON_FREQUENCY!),
  MAX_RUNTIME: Number(process.env.MAX_RUNTIME!),
  BUCKET_SIZE: Number(process.env.BUCKET_SIZE!),
  LEAK_RATE: Number(process.env.LEAK_RATE!),
  RETRY_LEAK_RATE: Number(process.env.RETRY_LEAK_RATE!),
  FIRST_TOKEN_ID: Number(process.env.FIRST_TOKEN_ID!),
  CONSECUTIVE_FAIL_LIMIT: Number(process.env.CONSECUTIVE_FAIL_LIMIT!),
  CONSECUTIVE_FAIL_RECOVERY_PERIOD: Number(
    process.env.CONSECUTIVE_FAIL_RECOVERY_PERIOD!
  ),
};
/* eslint-enable @typescript-eslint/no-non-null-assertion */

// Function to check if all environment variables are set
function checkEnvVariables(variables: {
  [key: string]: string | number | undefined;
}) {
  for (const key in variables) {
    if (variables[key] === undefined) {
      console.error(
        `Environment variable ${key} is not set. Please check your .env file or environment variables.`
      );
      process.exit(1);
    }
  }
}

// Call the function
checkEnvVariables(env);

const LAST_TOKEN_ID = (await getTokenCount()) as number;
const BASE_URL = "https://api.opensea.io/api/v1/asset";
const OPTIONS = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36",
    "X-Api-Key": env.OPENSEA_API_KEY,
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

  // Set a timeout to clear the failedRequests array and log an error message after env.MAX_RUNTIME minutes
  const timeout = setTimeout(() => {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - startTime) / 1000; // Elapsed time in seconds
    failedRequests.length = 0;
    fs.appendFileSync(
      "logs.txt",
      `Operation timed out after ${
        env.MAX_RUNTIME
      } minutes at ${new Date().toISOString()}.\nElapsed time: ${elapsedTime} seconds.\nTotal attempts: ${attempts}.\nTotal 721 tokens fetched: ${total721TokensFetched}.\nTotal 1155 tokens fetched: ${total1155TokensFetched}.\n\n`
    );
    console.log(
      `Operation timed out after ${
        env.MAX_RUNTIME
      } minutes at ${new Date().toISOString()}. Elapsed time: ${elapsedTime} seconds. Total attempts: ${attempts}. Total 721 tokens fetched: ${total721TokensFetched}. Total 1155 tokens fetched: ${total1155TokensFetched}.`
    );

    isRunning = false; // Remember to reset the lock after the task completes.
  }, env.MAX_RUNTIME * 60 * 1000); // minutes in milliseconds

  try {
    // Fetch 721 tokens
    for (
      let tokenId = env.FIRST_TOKEN_ID;
      tokenId <= LAST_TOKEN_ID;
      tokenId++
    ) {
      await fetchData(tokenId, env.JBPROJECTS_ADDRESS);
      total721TokensFetched++;
      attempts++;

      // If we've hit the env.BUCKET_SIZE, we wait for the env.LEAK_RATE before continuing
      if (tokenId % env.BUCKET_SIZE === 0) {
        await delay(env.LEAK_RATE);
      }
    }

    // Fetch 1155 tokens
    const tokenIds1155 = await get1155TokenIds(env.JUICEBOX_CARDS_ADDRESS);
    for (const tokenId of tokenIds1155) {
      await fetchData(tokenId, env.JUICEBOX_CARDS_ADDRESS);
      total1155TokensFetched++;
      attempts++;
      // If we've hit the env.BUCKET_SIZE, we wait for the env.LEAK_RATE before continuing
      if (tokenId % env.BUCKET_SIZE === 0) {
        await delay(env.LEAK_RATE);
      }
    }

    while (failedRequests.length > 0) {
      const failedRequest = failedRequests.pop();

      if (failedRequest !== undefined) {
        const { tokenId, contractAddress } = failedRequest;
        console.log(`Retrying for token ID ${tokenId}`);
        await fetchData(tokenId, contractAddress);
        attempts++;

        if (tokenId % env.BUCKET_SIZE === 0) {
          await delay(env.RETRY_LEAK_RATE);
        }
      }
    }
    const endTime = Date.now(); // End time
    const elapsedTime = (endTime - startTime) / 1000; // Elapsed time in seconds

    // Write the log to a file named 'log.txt'
    fs.appendFileSync(
      "logs.txt",
      `Operation ${operationStatus} at ${new Date().toISOString()}.\nElapsed time: ${elapsedTime} seconds.\nTotal attempts: ${attempts}.\n
Total 721 tokens fetched: ${total721TokensFetched}.\nTotal 1155 tokens fetched: ${total1155TokensFetched}.\n\n`
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
cron.schedule(`*/${env.CRON_FREQUENCY} * * * *`, async function () {
  if (!isRunning) {
    console.log("Running cron job");
    await fetchAllData();
  }
});

// Call the fetchAllData function
fetchAllData();
