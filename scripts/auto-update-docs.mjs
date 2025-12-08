#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {writeFileSync, mkdirSync, existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';

const DOCS_PROMPTS_DIR = join(process.cwd(), 'docs', 'prompts');
const GUIDELINES_PATH = join(DOCS_PROMPTS_DIR, 'docs-guidelines.md');

let cachedGuidelines;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || `Command failed: ${command} ${args.join(' ')}`;
    throw new Error(message.trim());
  }
  return result.stdout.trim();
}

function listChangedFiles(baseSha, headSha) {
  const output = run('git', ['diff', '--name-only', `${baseSha}`, `${headSha}`]);
  if (!output) {
    return [];
  }
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function filterRelevantFiles(files) {
  return files.filter((file) => !file.startsWith('docs/'));
}

function getDiff(baseSha, headSha, files) {
  if (files.length === 0) {
    return '';
  }
  const result = spawnSync('git', ['diff', `${baseSha}`, `${headSha}`, '--', ...files], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || 'Failed to read diff';
    throw new Error(message.trim());
  }
  return result.stdout;
}

function buildPrompt({baseSha, headSha, changedFiles, diffSnippet}) {
  const fileList = changedFiles.map((file) => `- ${file}`).join('\n') || '(none)';
  const guidelines = loadGuidelines();
  return [
    'The following git diff captures a pull request targeting the Vegan Pantry Chef project.',
    'Update only the user-facing Markdown docs under docs/docs to reflect end-user changes.',
    'If no documentation update is needed, respond with {"files":[],"notes":"No changes"}.',
    '',
    'Documentation guidelines:',
    guidelines,
    '',
    `Base commit: ${baseSha}`,
    `Head commit: ${headSha}`,
    '',
    'Changed files:',
    fileList,
    '',
    'Unified diff (may be truncated):',
    diffSnippet,
    '',
    'Respond with strict JSON using this schema:',
    '{"files":[{"path":"docs/docs/<file>.md","content":"<entire file contents>"}],"notes":"<short summary>"}',
    'Update only files inside docs/docs/.',
    'Replace entire Markdown files in your response; do not send patches.',
    'When no changes are needed, respond with {"files":[],"notes":"No changes"}.',
    'Do not include code fences or commentary outside JSON. Use only ASCII characters.',
  ].join('\n');
}

function extractJson(text) {
  const start = text.indexOf('{');
  if (start === -1) {
    throw new Error('Model response did not contain JSON.');
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const jsonText = text.slice(start, index + 1);
        return parseStrictJson(jsonText);
      }
    }
  }

  throw new Error('Model response JSON appears incomplete.');
}

function parseStrictJson(rawText) {
  const sanitized = escapeControlCharactersInJson(rawText);
  try {
    return JSON.parse(sanitized);
  } catch (error) {
    const repaired = fixInvalidEscapeSequences(sanitized);
    if (repaired !== sanitized) {
      try {
        return JSON.parse(repaired);
      } catch (innerError) {
        throw new Error(
          `Failed to parse model JSON response after repair: ${
            innerError instanceof Error ? innerError.message : String(innerError)
          }`
        );
      }
    }
    throw new Error(`Failed to parse model JSON response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function escapeControlCharactersInJson(text) {
  let result = '';
  let inString = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (char === '\\') {
        // Preserve escape sequence and skip the next character.
        result += char;
        index += 1;
        if (index < text.length) {
          result += text[index];
        }
        continue;
      }

      if (char === '"') {
        inString = false;
        result += char;
        continue;
      }

      const code = char.charCodeAt(0);
      if (code <= 0x1f) {
        if (char === '\n') {
          result += '\\n';
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else {
          result += `\\u${code.toString(16).padStart(4, '0')}`;
        }
      } else {
        result += char;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    }

    result += char;
  }

  return result;
}

function fixInvalidEscapeSequences(text) {
  let result = '';
  let inString = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"' && text[index - 1] !== '\\') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString && char === '\\') {
      const next = text[index + 1];
      if (!next) {
        result += '\\\\';
        continue;
      }

      if (next === 'u') {
        const hex = text.slice(index + 2, index + 6);
        const validUnicodeEscape = /^[0-9a-fA-F]{4}$/.test(hex);
        if (!validUnicodeEscape) {
          result += '\\\\';
          continue;
        }
      } else if (!['"', '\\', '/', 'b', 'f', 'n', 'r', 't'].includes(next)) {
        result += '\\\\';
        continue;
      }
    }

    result += char;
  }

  return result;
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY environment variable.');
  }

  const systemPrompt = loadGuidelines();

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {role: 'user', content: prompt},
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
    throw new Error('Groq API returned an empty response.');
  }
  return extractJson(content);
}

function loadGuidelines() {
  if (!cachedGuidelines) {
    cachedGuidelines = readPromptFile(GUIDELINES_PATH);
  }
  return cachedGuidelines;
}

function readPromptFile(path) {
  try {
    return readFileSync(path, 'utf8').replace(/\r\n/g, '\n').trim();
  } catch (error) {
    throw new Error(`Failed to read prompt file at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function ensureAscii(text) {
  let sanitized = '';
  for (const char of text) {
    if (char.charCodeAt(0) <= 127) {
      sanitized += char;
    } else {
      sanitized += '?';
    }
  }
  return sanitized;
}

function removeBrokenMarkdownLinks(markdown, absoluteDocPath) {
  return markdown.replace(/\[([^\]]+)\]\(([^)]+\.md)\)/gi, (match, label, href) => {
    const trimmedHref = href.trim();

    if (/^https?:\//i.test(trimmedHref) || trimmedHref.startsWith('#')) {
      return match;
    }

    const targetPath = resolve(dirname(absoluteDocPath), trimmedHref);
    if (existsSync(targetPath)) {
      return match;
    }

    return label;
  });
}

function writeDocFile(file) {
  if (!file?.path || !file?.content) {
    throw new Error('Missing file path or content in model output.');
  }
  if (!file.path.startsWith('docs/docs/')) {
    throw new Error(`Refusing to write to non-docs path: ${file.path}`);
  }
  const absolutePath = join(process.cwd(), file.path);
  const asciiContent = ensureAscii(file.content).replace(/\r\n/g, '\n');
  const safeContent = removeBrokenMarkdownLinks(asciiContent, absolutePath);
  const finalContent = safeContent.endsWith('\n') ? safeContent : `${safeContent}\n`;
  mkdirSync(dirname(absolutePath), {recursive: true});
  writeFileSync(absolutePath, finalContent, 'utf8');
  console.log(`Updated ${file.path}`);
}

async function main() {
  const [, , baseSha, headSha] = process.argv;
  if (!baseSha || !headSha) {
    console.error('Usage: node scripts/auto-update-docs.mjs <baseSha> <headSha>');
    process.exit(1);
  }

  const changedFiles = listChangedFiles(baseSha, headSha);
  const relevantFiles = filterRelevantFiles(changedFiles);

  if (relevantFiles.length === 0) {
    console.log('No non-docs changes detected; skipping documentation update.');
    return;
  }

  const diff = getDiff(baseSha, headSha, relevantFiles);
  if (!diff) {
    console.log('Diff empty; skipping documentation update.');
    return;
  }

  const maxLength = 12000;
  const diffSnippet = diff.length > maxLength ? `${diff.slice(0, maxLength)}\n...\n[Diff truncated]` : diff;

  const prompt = buildPrompt({baseSha, headSha, changedFiles: relevantFiles, diffSnippet});

  let result;
  try {
    result = await callGroq(prompt);
  } catch (error) {
    console.error(`Failed to generate documentation: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(result.files) || result.files.length === 0) {
    console.log('Model indicated no documentation changes are required.');
    if (result?.notes) {
      console.log(`Notes: ${result.notes}`);
    }
    return;
  }

  for (const file of result.files) {
    writeDocFile(file);
  }

  if (result?.notes) {
    console.log(`Notes: ${result.notes}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
