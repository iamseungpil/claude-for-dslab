'use strict';

// PreToolUse hook: blocks file access to directories matching .ckignore patterns.
// Fails open on any error — never blocks legitimate work due to hook malfunction.

const fs = require('fs');
const path = require('path');
const { isEnabled, safeParseStdin, log, block, allow } = require('./lib/ar-hook-utils.cjs');
const ignore = require('./lib/ignore.cjs');

const HOOK_NAME = 'scout-block';

const BASELINE_PATTERNS = [
  'node_modules/',
  '__pycache__/',
  '.git/',
  'dist/',
  'build/',
  'out/',
  'coverage/',
  '.next/',
  '.nuxt/',
  'venv/',
  '.venv/',
  'env/',
  '.terraform/',
  '.aws/',
  '.ssh/',
  '*.log'
];

// Commands whose tokens should never be matched as file paths.
const BUILD_TOOL_PREFIXES = [
  'npm', 'yarn', 'pnpm', 'bun',
  'pip', 'cargo', 'go', 'rustc',
  'make', 'cmake', 'mvn', 'gradle',
  'docker', 'kubectl', 'terraform', 'helm',
  'python', 'node'
];

function findProjectRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function loadCkIgnore(projectRoot) {
  const ig = ignore();
  ig.add(BASELINE_PATTERNS);
  try {
    const ckPath = path.join(projectRoot, '.ckignore');
    const content = fs.readFileSync(ckPath, 'utf8');
    ig.add(content);
  } catch { /* no .ckignore — baseline only */ }
  return ig;
}

function relativeToRoot(filePath, projectRoot) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const rel = path.relative(projectRoot, abs);
  // If the path escapes the project root, use the absolute path for matching.
  return rel.startsWith('..') ? abs : rel;
}

// Extract path-like tokens from a bash command string.
// Splits on spaces, pipes, semicolons, and common shell operators.
function extractPathTokens(command) {
  const tokens = command.split(/[\s|;&<>]+/);
  return tokens.filter(t => {
    if (!t || t.startsWith('-')) return false;
    // A token looks like a path if it contains '/' or starts with '.' or contains a file extension
    return t.includes('/') || t.startsWith('.') || /\.[a-z]{1,6}$/.test(t);
  });
}

function checkPath(filePath, ig, projectRoot) {
  if (!filePath || typeof filePath !== 'string') return null;
  const rel = relativeToRoot(filePath, projectRoot);
  if (ig.ignores(rel)) return rel;
  return null;
}

try {
  if (!isEnabled(HOOK_NAME)) {
    process.exit(0);
  }

  const stdin = safeParseStdin();
  if (!stdin) {
    process.exit(0);
  }

  const { tool_name, tool_input } = stdin;
  if (!tool_input) {
    process.exit(0);
  }

  const projectRoot = findProjectRoot(process.cwd());
  const ig = loadCkIgnore(projectRoot);

  // Bash: smart token extraction with build-tool allowlist
  if (tool_name === 'Bash') {
    const command = tool_input.command || '';
    const firstToken = command.trim().split(/\s+/)[0];
    if (BUILD_TOOL_PREFIXES.includes(firstToken)) {
      process.exit(0);
    }

    const pathTokens = extractPathTokens(command);
    for (const token of pathTokens) {
      const matched = checkPath(token, ig, projectRoot);
      if (matched) {
        log(HOOK_NAME, { action: 'block', tool: tool_name, path: token, matched });
        block(
          `BLOCKED: Access to '${matched}' denied by .ckignore\n\n` +
          `To allow, add to .ckignore: !${matched}`
        );
      }
    }
    process.exit(0);
  }

  // Structured tools: Read, Edit, Write, Glob, Grep
  const STRUCTURED_TOOLS = new Set(['Read', 'Edit', 'Write', 'Glob', 'Grep']);
  if (STRUCTURED_TOOLS.has(tool_name)) {
    const filePath = tool_input.file_path || tool_input.path || '';
    const matched = checkPath(filePath, ig, projectRoot);
    if (matched) {
      log(HOOK_NAME, { action: 'block', tool: tool_name, path: filePath, matched });
      block(
        `BLOCKED: Access to '${matched}' denied by .ckignore\n\n` +
        `To allow, add to .ckignore: !${matched}`
      );
    }
  }

  process.exit(0);
} catch {
  // Fail-open: never block on hook errors
  process.exit(0);
}
