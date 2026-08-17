#!/usr/bin/env node
const args = process.argv.slice(2);

if (args.includes("--version")) {
  console.log("reverse v1.0.0");
  process.exit(0);
}

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const trimmed = input.trim();
  console.log(JSON.stringify({ original: trimmed, reversed: trimmed.split("").reverse().join(""), length: trimmed.length }));
});
