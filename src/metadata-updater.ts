"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
(0, dotenv_1.config)();
const transport = (0, viem_1.http)(process.env.ALCHEMY_RPC_URL);
const client = (0, viem_1.createPublicClient)({
    chain: chains_1.mainnet,
    transport: (0, viem_1.http)(),
});
const blockNumber = await client.getBlockNumber();
exports.default = `Block number: ${blockNumber}`;
