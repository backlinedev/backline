#!/usr/bin/env node
const fs = require("fs");

const args = process.argv.slice(2);

if (args.includes("--version")) {
  console.log("analyze v1.0.0");
  process.exit(0);
}

const inputIndex = args.indexOf("--input");
const inputPath = inputIndex !== -1 ? args[inputIndex + 1] : null;

if (!inputPath) {
  console.error("usage: analyze.js --input <file>");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
const prices = data.items.map((i) => i.price);
const average = Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2));
const max = Math.max(...prices);

console.log(JSON.stringify({ average_price: average, max_price: max }, null, 2));
