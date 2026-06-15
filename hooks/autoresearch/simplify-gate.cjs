'use strict';

// UserPromptSubmit hook: warns or blocks shipping verbs when too many LOC changed.
// Fails open on any error — never blocks legitimate work due to hook malfunction.

const { execSync } = require('child_process');
const { isEnabled, safeParseStdin, log, block, inject } = require('./lib/ar-hook-utils.cjs');

const HOOK_NAME = 'simplify-gate';

const SHIPPING_VERBS = ['ship', 'merge', 'deploy', 'pr', 'publish', 'release'];

const NEGATION_PHRASES = [
  "don't ship", "never deploy", "not ready to merge",
  "don't merge", "don't deploy", "don't publish",
  "don't release", "no ship", "no merge", "no deploy"
];

const WARN_THRESHOLD = 400;
const BLOCK_THRESHOLD = 800;

function hasShippingVerb(prompt) {
  const lower = prompt.toLowerCase();

  for (const phrase of NEGATION_PHRASES) {
    if (lower.includes(phrase)) return false;
  }

  for (const verb of SHIPPING_VERBS) {
    const regex = new RegExp('\\b' + verb + '\\b', 'i');
    if (regex.test(prompt)) return true;
  }

  return false;
}

function parseDiffStat(output) {
  const lines = output.trim().split('\n');
  const summary = lines[lines.length - 1];
  // e.g. " 3 files changed, 120 insertions(+), 45 deletions(-)"
  let insertions = 0;
  let deletions = 0;

  const insMatch = summary.match(/(\d+)\s+insertion/);
  const delMatch = summary.match(/(\d+)\s+deletion/);

  if (insMatch) insertions = parseInt(insMatch[1], 10);
  if (delMatch) deletions = parseInt(delMatch[1], 10);

  return insertions + deletions;
}

try {
  if (!isEnabled(HOOK_NAME)) process.exit(0);

  const stdin = safeParseStdin();
  if (!stdin) process.exit(0);

  const prompt = (stdin.prompt && typeof stdin.prompt === 'string') ? stdin.prompt : '';
  if (!prompt) process.exit(0);

  // Fast bail: no shipping verb detected
  if (!hasShippingVerb(prompt)) process.exit(0);

  let loc = 0;
  try {
    const diffOutput = execSync('git diff --stat', { encoding: 'utf8', timeout: 5000 });
    if (!diffOutput || !diffOutput.trim()) process.exit(0);
    loc = parseDiffStat(diffOutput);
  } catch {
    // git diff failed (not a git repo, no changes, etc.) — fail open
    process.exit(0);
  }

  if (loc < WARN_THRESHOLD) {
    process.exit(0);
  }

  log(HOOK_NAME, { loc, action: loc > BLOCK_THRESHOLD ? 'block' : 'warn' });

  if (loc > BLOCK_THRESHOLD) {
    block(
      `BLOCKED: ${loc} lines changed exceeds ${BLOCK_THRESHOLD} LOC shipping threshold. ` +
      `Simplify before shipping. Use AR_DISABLE_SIMPLIFY_GATE=1 to override.`
    );
  }

  // 400–800 range: warn but allow
  inject(
    `WARNING: ${loc} lines changed. Consider simplifying before shipping.`
  );
} catch {
  process.exit(0);
}
