#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { analyzePatch, formatConsoleReport } = require('../src/index');

function showHelp() {
  console.log(`
\x1b[1mPatchGuard CLI\x1b[0m — Zero-dependency security & AI hallucination linter for Git patches.

\x1b[1mUSAGE:\x1b[0m
  npx patchguard [options]
  patchguard [options]

\x1b[1mOPTIONS:\x1b[0m
  --staged, -s        Inspect staged git changes (git diff --cached) [default]
  --unstaged, -u      Inspect unstaged working directory changes (git diff)
  --commit, -c <rev>  Inspect a specific commit or range (e.g. HEAD~1, origin/main..HEAD)
  --file, -f <path>   Inspect a unified .diff / .patch file from disk
  --stdin             Read unified diff directly from standard input pipe
  --json              Output full diagnostic results as JSON
  --version, -v       Show PatchGuard version
  --help, -h          Show this help message

\x1b[1mEXAMPLES:\x1b[0m
  $ patchguard --staged
  $ git diff origin/main | patchguard --stdin
  $ patchguard --commit HEAD~1 --json
  `);
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

  const isJson = args.includes('--json');
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
      diffContent = execSync(`git diff ${rev}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } else if (args.includes('-u') || args.includes('--unstaged')) {
      diffContent = execSync('git diff', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } else {
      // Default: --staged
      diffContent = execSync('git diff --cached', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      if (!diffContent.trim()) {
        // If staged is empty, fallback to working unstaged diff
        diffContent = execSync('git diff', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('not a git repository')) {
      console.error('Error: Not inside a Git repository. Pass a patch file via --file or diff stream via --stdin.');
    } else {
      console.error('Error fetching git diff:', err.message);
    }
    process.exit(1);
  }

  const result = analyzePatch(diffContent);

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
