# PatchGuard

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![Status: Production](https://img.shields.io/badge/status-active-blue.svg)](#)

> **Zero-dependency static security and hallucination linter for Git diffs, staged commits, and AI-generated code patches.**

---

## The Problem It Solves

As AI coding agents and LLM copilot extensions generate thousands of lines of code daily, pull requests are increasingly polluted by:
1. **Accidental Token Leaks**: Hardcoded API keys (OpenAI, Anthropic Claude, Google AI Studio, GitHub, AWS, Stripe) pasted into code or config diffs.
2. **AI Mock Syndrome**: Half-baked stubs (`// TODO: implement real logic here`, `throw new Error("Not implemented")`, `raise NotImplementedError`) slipping into production merges.
3. **Hallucinated Packages**: Fabricated dependency imports across JavaScript and Python that do not exist or pose typosquatting supply-chain risks.

Existing linters scan whole codebases and require heavy AST parser setups. **PatchGuard** operates directly on **Git diffs** (`git diff`, `git diff --cached`, or stdin pipes), providing instant sub-millisecond pre-commit and CI verification with **zero external dependencies**.

---

## 30-Second Quickstart

Run directly via `npx` or install globally:

```bash
# Scan currently staged git changes before committing
npx patchguard --staged

# Scan working directory unstaged modifications in strict mode
npx patchguard --unstaged --strict

# Scan incoming commits in CI / PR review
npx patchguard --commit HEAD~1

# Pipe any git diff or patch file directly
git diff origin/main | npx patchguard --stdin

# Ignore non-blocking rules (e.g. console logging)
npx patchguard --staged --ignore HAL-003

# View full catalog of detection rules
npx patchguard --rules
```

---

## Core Capabilities

- **Zero Runtime Dependencies**: Written entirely in pure, standard Node.js without bloat.
- **Accurate Unified Diff Parsing**: Scans only newly added lines (`+`), eliminating false positives on unchanged legacy code and handling multi-hunk patches gracefully.
- **Modern AI & Cloud Secret Defense**: Catches OpenAI (`sk-proj-...`), Anthropic Claude (`sk-ant-...`), Google AI Studio (`AIzaSy...`), GitHub tokens, AWS credentials, and payment gateway keys (Stripe, Slack, Hugging Face).
- **AI Hallucination & Mock Detection**: Flags unimplemented stubs, artificial placeholder comments, dummy returns, and phantom NPM/PyPI packages.
- **Strict Enforcement Mode**: Use `--strict` flag to elevate warnings to blocking pipeline failures.
- **Machine-Readable Diagnostics**: Use `--json` flag to integrate directly with automated review agents or GitHub Actions.

---

## CLI Options

| Flag | Description | Default |
| --- | --- | --- |
| `--staged`, `-s` | Inspect staged git changes (`git diff --cached`) | Enabled by default |
| `--unstaged`, `-u` | Inspect working directory unstaged modifications | - |
| `--commit`, `-c <rev>` | Inspect specific commit range (e.g. `HEAD~1`, `origin/main..HEAD`) | - |
| `--file`, `-f <path>` | Inspect a unified `.diff` or `.patch` file from disk | - |
| `--stdin` | Read unified diff stream directly from stdin pipe | - |
| `--ignore <rules>` | Comma-separated rule IDs to skip (e.g. `SEC-003,HAL-003`) | None |
| `--strict` | Treat warnings as blocking errors (exit code 1) | `false` |
| `--rules` | Print catalog of all registered detection rules | - |
| `--json` | Output diagnostic results as structured JSON | `false` |
| `--version`, `-v` | Show PatchGuard version | - |
| `--help`, `-h` | Display usage and options reference | - |

---

## Exit Codes

- `0`: Inspection passed (no blocking security errors or mock stubs found).
- `1`: Blocking violation detected (terminates `git commit` or CI pipeline).

---

## License

[MIT](LICENSE) © [IlhamXkyo](https://github.com/IlhamXkyo)
