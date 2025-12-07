#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';

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
  const fileList = changedFiles.map((file) => `- ${file}`).join('\n');
  return [
    'The following git diff captures a pull request targeting the Vegan Pantry Chef project.',
    'Update only the user-facing Markdown docs under docs/docs to reflect end-user changes.',
    'Keep explanations concise and limited to what the recipe-seeking user sees in the app.',
    'If no documentation update is needed, respond with {"files":[],"notes":"No changes"}.',
    '',
    `Base commit: ${baseSha}`,
    `Head commit: ${headSha}`,
    '',
    'Changed files:',
    fileList || '(none)',
    '',
    'Unified diff (may be truncated):',
    diffSnippet,
    '',
    'Respond with strict JSON using this schema:',
    '{"files":[{"path":"docs/docs/<file>.md","content":"<entire file contents>"}],"notes":"<short summary>"}',
    'Do not include code fences or commentary outside JSON. Use only ASCII characters.',
  ].join('\n');
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model response did not contain JSON.');
  }
  const jsonText = text.slice(start, end + 1);
  return parseStrictJson(jsonText);
}

function parseStrictJson(rawText) {
  const sanitized = escapeControlCharactersInJson(rawText);
  try {
    return JSON.parse(sanitized);
  } catch (error) {
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

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY environment variable.');
  }

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
          content:
            'You are an expert product copywriter for Vegan Pantry Chef. Update only end-user documentation. Respond with minimal, direct language.',
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

function writeDocFile(file) {
  if (!file?.path || !file?.content) {
    throw new Error('Missing file path or content in model output.');
  }
  if (!file.path.startsWith('docs/docs/')) {
    throw new Error(`Refusing to write to non-docs path: ${file.path}`);
  }
  const normalizedContent = ensureAscii(file.content).replace(/\r\n/g, '\n');
  const finalContent = normalizedContent.endsWith('\n') ? normalizedContent : `${normalizedContent}\n`;
  const absolutePath = join(process.cwd(), file.path);
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
