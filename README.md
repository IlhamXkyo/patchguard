# PatchGuard

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![Status: Production](https://img.shields.io/badge/status-active-blue.svg)](#)

> **Zero-dependency static security and hallucination linter for Git diffs, staged commits, and AI-generated code patches.**

---

## The Problem It Solves

As AI coding agents and LLM copilot extensions generate thousands of lines of code daily, pull requests are increasingly polluted by:
1. **Accidental Token Leaks**: Hardcoded GitHub tokens, API keys, or private key blocks pasted into test scripts or config diffs.
2. **AI Mock Syndrome**: Half-baked stubs (`// TODO: implement real logic here`, dummy return fixtures) slipping into production merges.
3. **Hallucinated Packages**: Fabricated dependency imports that do not exist or pose typosquatting supply-chain risks.

Existing linters scan whole codebases and require heavy AST parser setups. **PatchGuard** operates directly on **Git diffs** (`git diff`, `git diff --cached`, or stdin pipes), providing instant sub-millisecond pre-commit and CI verification with **zero external dependencies**.

---

## 30-Second Quickstart

Run directly via `npx` or install globally:

```bash
# Scan currently staged git changes before committing
npx patchguard --staged

# Scan working directory unstaged modifications
npx patchguard --unstaged

# Scan incoming commits in CI / PR review
npx patchguard --commit HEAD~1

# Pipe any git diff or patch file directly
git diff origin/main | npx patchguard --stdin
```

---

## Core Capabilities

- **Zero Runtime Dependencies**: Written entirely in pure, standard Node.js without bloat.
- **Accurate Unified Diff Parsing**: Scans only newly added lines (`+`), eliminating false positives on unchanged legacy code.
- **Secret & Token Defense**: Catches GitHub tokens (`ghp_`, `gho_`, fine-grained PATs), AWS credentials (`AKIA...`), and generic auth secrets.
- **AI Hallucination & Mock Detection**: Flags unimplemented stubs, placeholder comments, and fabricated NPM packages.
- **Machine-Readable Diagnostics**: Use `--json` flag to integrate directly with automated review agents or GitHub Actions.

---

## Exit Codes

- `0`: Inspection passed (no blocking security errors or mock stubs found).
- `1`: Blocking violation detected (terminates `git commit` or CI pipeline).

---

## License

[MIT](LICENSE) © [IlhamXkyo](https://github.com/IlhamXkyo)
