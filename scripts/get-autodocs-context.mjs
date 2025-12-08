#!/usr/bin/env node
import {appendFileSync, readFileSync} from "node:fs";
import {join} from "node:path";

function parseLines(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSON entry in autodocs log: ${line}`);
      }
    });
}

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }
  const line = `${name}=${value}\n`;
  appendFileSync(process.env.GITHUB_OUTPUT, line, "utf8");
}

function validateEntry(entry, autodocsBranch) {
  const required = [
    ["autodocsBranch", entry.autodocsBranch],
    ["codeBranch", entry.codeBranch],
    ["codePr", entry.codePr],
    ["baseSha", entry.baseSha],
    ["headSha", entry.headSha],
  ];
  for (const [key, value] of required) {
    if (!value) {
      throw new Error(`Autodocs log entry for ${autodocsBranch} is missing required field: ${key}`);
    }
  }
}

async function main() {
  const [, , autodocsBranch] = process.argv;
  if (!autodocsBranch) {
    console.error("Usage: node scripts/get-autodocs-context.mjs <autodocsBranch>");
    process.exit(1);
  }

  const logPath = join(process.cwd(), "docs", "autodocs-log.ndjson");
  let content;
  try {
    content = readFileSync(logPath, "utf8");
  } catch (error) {
    throw new Error(`Failed to read autodocs log at ${logPath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const entries = parseLines(content);
  const entry = [...entries].reverse().find((item) => item.autodocsBranch === autodocsBranch);

  if (!entry) {
    throw new Error(`No autodocs log entry found for branch ${autodocsBranch}`);
  }

  validateEntry(entry, autodocsBranch);

  writeOutput("autodocs_branch", entry.autodocsBranch);
  writeOutput("code_branch", entry.codeBranch);
  writeOutput("code_pr", String(entry.codePr));
  writeOutput("base", entry.baseSha);
  writeOutput("head", entry.headSha);
  if (Array.isArray(entry.commits)) {
    writeOutput("commits", entry.commits.join(","));
  }

  console.log(`Resolved autodocs context for ${autodocsBranch}: PR #${entry.codePr}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
