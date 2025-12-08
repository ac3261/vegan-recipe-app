#!/usr/bin/env node
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";

const MAX_DIFF_LENGTH = 10000;
const PROMPTS_DIR = join(process.cwd(), "docs", "prompts");
const GUIDELINES_PATH = join(PROMPTS_DIR, "docs-guidelines.md");

let cachedGuidelines;

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

function listChangedFiles(baseSha, headSha) {
  const output = run("git", ["diff", "--name-only", `${baseSha}`, `${headSha}`]);
  if (!output) {
    return [];
  }
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function filterRelevantFiles(files) {
  return files.filter((file) => !file.startsWith("docs/"));
}

function getDiff(baseSha, headSha, files) {
  if (files.length === 0) {
    return "";
  }
  const result = spawnSync("git", ["diff", `${baseSha}`, `${headSha}`, "--", ...files], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || "Failed to read diff";
    throw new Error(message.trim());
  }
  return result.stdout;
}

function loadGuidelines() {
  if (!cachedGuidelines) {
    try {
      cachedGuidelines = readFileSync(GUIDELINES_PATH, "utf8").replace(/\r\n/g, "\n").trim();
    } catch (error) {
      throw new Error(`Failed to read prompt file at ${GUIDELINES_PATH}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return cachedGuidelines;
}

function buildPrompt({baseSha, headSha, codeBranch, relevantFiles, diffSnippet}) {
  const fileList = relevantFiles.map((file) => `- ${file}`).join("\n") || "(none)";
  const guidelines = loadGuidelines();
  return [
    "You review pull requests for the Vegan Pantry Chef web application.",
    "Decide if the proposed code changes introduce, modify, or remove user-facing behaviour that should trigger a documentation update.",
    "Only answer \"true\" when end-user documentation in docs/docs should be refreshed.",
    "Code comments, spelling fixes, developer-only changes, or internal refactors typically do not require documentation.",
    "Use the documentation guidelines as additional context when deciding.",
    "Respond strictly in JSON using the schema {\"needsDocumentation\": boolean, \"reason\": string}.",
    "The reason should be short (<= 160 characters).",
    "",
    "Documentation guidelines:",
    guidelines,
    "",
    `Code branch: ${codeBranch}`,
    `Base commit: ${baseSha}`,
    `Head commit: ${headSha}`,
    "",
    "Changed files:",
    fileList,
    "",
    "Diff snippet (may be truncated):",
    diffSnippet || "(empty diff)",
    "",
    "Remember: respond with JSON only and never invent file contents.",
  ].join("\n");
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain JSON.");
  }
  const jsonText = text.slice(start, end + 1);
  return JSON.parse(jsonText);
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: "You provide precise JSON answers only.",
        },
        {role: "user", content: prompt},
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq API returned an empty response.");
  }
  return extractJson(content);
}

async function main() {
  const [, , baseSha, headSha, codeBranch = ""] = process.argv;
  if (!baseSha || !headSha) {
    console.error("Usage: node scripts/determine-docs-needed.mjs <baseSha> <headSha> [codeBranch]");
    process.exit(1);
  }

  const changedFiles = listChangedFiles(baseSha, headSha);
  const relevantFiles = filterRelevantFiles(changedFiles);

  if (relevantFiles.length === 0) {
    console.log("false");
    return;
  }

  const diff = getDiff(baseSha, headSha, relevantFiles);
  const diffSnippet = diff.length > MAX_DIFF_LENGTH ? `${diff.slice(0, MAX_DIFF_LENGTH)}\n...\n[Diff truncated]` : diff;

  const prompt = buildPrompt({baseSha, headSha, codeBranch, relevantFiles, diffSnippet});

  let result;
  try {
    result = await callGroq(prompt);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const needsDocs = Boolean(result?.needsDocumentation);
  const reason = typeof result?.reason === "string" ? result.reason.trim() : "";

  if (reason) {
    console.error(reason);
  }

  console.log(needsDocs ? "true" : "false");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
