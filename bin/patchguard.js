#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { analyzePatch, formatConsoleReport, RULES } = require('../src/index');

function showHelp() {
  console.log(`
\x1b[1mPatchGuard CLI\x1b[0m — Zero-dependency security & AI hallucination linter for Git patches.

\x1b[1mUSAGE:\x1b[0m
  npx patchguard [options]
  patchguard [options]

\x1b[1mOPTIONS:\x1b[0m
  --staged, -s         Inspect staged git changes (git diff --cached) [default]
  --unstaged, -u       Inspect unstaged working directory changes (git diff)
  --commit, -c <rev>   Inspect a specific commit or range (e.g. HEAD~1, origin/main..HEAD)
  --file, -f <path>    Inspect a unified .diff / .patch file from disk
  --stdin              Read unified diff directly from standard input pipe
  --ignore <rules>     Comma-separated rule IDs to skip (e.g. SEC-003,HAL-003)
  --ignore-tests       Skip scanning additions inside test/spec files
  --strict             Treat warnings as blocking errors (fail with code 1)
  --rules              List all available security and hallucination detection rules
  --json               Output full diagnostic results as JSON
  --version, -v        Show PatchGuard version
  --help, -h           Show this help message

\x1b[1mEXAMPLES:\x1b[0m
  $ patchguard --staged
  $ patchguard --unstaged --strict
  $ git diff origin/main | patchguard --stdin --ignore HAL-003
  $ patchguard --commit HEAD~1 --json
  $ patchguard --rules
`);
}

function showRules() {
  console.log('\x1b[1m=== PATCHGUARD DETECTION RULES CATALOG ===\x1b[0m\n');
  for (const rule of RULES) {
    let color = '\x1b[33m'; // Yellow
    if (rule.severity === 'error') color = '\x1b[31m'; // Red
    if (rule.severity === 'info') color = '\x1b[36m'; // Cyan

    console.log(`${color}[${rule.id}]\x1b[0m \x1b[1m${rule.name}\x1b[0m (${rule.category})`);
    console.log(`  Severity: ${rule.severity.toUpperCase()}`);
    console.log(`  Info:     ${rule.message}`);
    console.log('');
  }
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
  });
}

function runGit(gitArgs) {
  try {
    return execFileSync('git', gitArgs, {
      encoding: 'utf8',
      maxBuffer: 15 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err) {
    const errorMsg = (err.stderr || err.message || '').toString();
    if (errorMsg.includes('not a git repository')) {
      throw new Error('Not inside a Git repository. Pass a patch file via --file or diff stream via --stdin.');
    }
    throw new Error(errorMsg.trim() || 'Failed to execute git command.');
  }
}

async function run() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  if (args.includes('-v') || args.includes('--version')) {
    const pkg = require('../package.json');
    console.log(`patchguard v${pkg.version}`);
    process.exit(0);
  }

  if (args.includes('--rules')) {
    showRules();
    process.exit(0);
  }

  const isJson = args.includes('--json');
  const isStrict = args.includes('--strict');
  const ignoreTests = args.includes('--ignore-tests');

  let ignoreRules = [];
  const ignoreIdx = args.indexOf('--ignore') !== -1 ? args.indexOf('--ignore') : args.indexOf('--ignore-rules');
  if (ignoreIdx !== -1 && args[ignoreIdx + 1]) {
    ignoreRules = args[ignoreIdx + 1].split(',').map(s => s.trim());
  }

  let diffContent = '';

  try {
    if (args.includes('--stdin')) {
      diffContent = await readStdin();
    } else if (args.includes('-f') || args.includes('--file')) {
      const idx = args.indexOf('-f') !== -1 ? args.indexOf('-f') : args.indexOf('--file');
      const filePath = args[idx + 1];
      if (!filePath) {
        console.error('Error: Missing file path argument after -f / --file');
        process.exit(1);
      }
      diffContent = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8');
    } else if (args.includes('-c') || args.includes('--commit')) {
      const idx = args.indexOf('-c') !== -1 ? args.indexOf('-c') : args.indexOf('--commit');
      const rev = args[idx + 1] || 'HEAD~1..HEAD';
      diffContent = runGit(['diff', rev]);
    } else if (args.includes('-u') || args.includes('--unstaged')) {
      diffContent = runGit(['diff']);
    } else {
      // Default: --staged
      diffContent = runGit(['diff', '--cached']);
      if (!diffContent.trim()) {
        // Fallback to working unstaged diff if staged is empty
        diffContent = runGit(['diff']);
      }
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const result = analyzePatch(diffContent, {
    ignoreRules,
    strict: isStrict,
    ignoreTests
  });

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatConsoleReport(result));
  }

  if (!result.summary.passed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run();
