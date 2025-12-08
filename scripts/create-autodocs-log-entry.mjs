#!/usr/bin/env node
import {appendFileSync, existsSync, mkdirSync} from "node:fs";
import {join, dirname} from "node:path";
import {spawnSync} from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || `Command failed: ${command} ${args.join(" ")}`;
    throw new Error(message.trim());
  }
  return result.stdout.trim();
}

function ensureDirectoryForFile(path) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, {recursive: true});
  }
}

function buildEntry({autodocsBranch, codeBranch, prNumber, baseSha, headSha, commits}) {
  return {
    timestamp: new Date().toISOString(),
    autodocsBranch,
    codeBranch,
    codePr: Number(prNumber),
    baseSha,
    headSha,
    commits,
  };
}

function listCommits(baseSha, headSha) {
  if (!baseSha || !headSha || baseSha === headSha) {
    return [];
  }
  const output = run("git", ["rev-list", "--reverse", `${baseSha}..${headSha}`]);
  if (!output) {
    return [];
  }
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

async function main() {
  const [, , autodocsBranch, codeBranch, prNumber, baseSha, headSha] = process.argv;
  if (!autodocsBranch || !codeBranch || !prNumber || !baseSha || !headSha) {
    console.error("Usage: node scripts/create-autodocs-log-entry.mjs <autodocsBranch> <codeBranch> <prNumber> <baseSha> <headSha>");
    process.exit(1);
  }

  const commits = listCommits(baseSha, headSha);
  const logPath = join(process.cwd(), "docs", "autodocs-log.ndjson");
  ensureDirectoryForFile(logPath);

  const entry = buildEntry({autodocsBranch, codeBranch, prNumber, baseSha, headSha, commits});
  appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  console.log(`Recorded autodocs entry for PR #${prNumber} with ${commits.length} commits.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
