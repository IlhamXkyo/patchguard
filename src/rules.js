/**
 * Security, Secret Leakage, and Hallucination Rules.
 * Evaluates additions in diffs against high-severity patterns.
 */

const RULES = [
  // 1. Secret & Token Detection
  {
    id: 'SEC-001',
    name: 'Exposed GitHub Token',
    category: 'secrets',
    severity: 'error',
    pattern: /(?:ghp_[0-9a-zA-Z]{36}|gho_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82}|ghu_[0-9a-zA-Z]{36}|ghs_[0-9a-zA-Z]{36}|ghr_[0-9a-zA-Z]{36})/,
    message: 'Detected active or hardcoded GitHub Personal Access Token, OAuth token, or installation secret.'
  },
  {
    id: 'SEC-002',
    name: 'Exposed AWS Access Key',
    category: 'secrets',
    severity: 'error',
    pattern: /(?:AKIA[0-9A-Z]{16})/,
    message: 'Detected hardcoded AWS Access Key ID.'
  },
  {
    id: 'SEC-003',
    name: 'Generic API Key / Secret Literal',
    category: 'secrets',
    severity: 'warning',
    pattern: /(?:api[_-]?key|secret|token|password|auth_token)\s*[:=]\s*["']([A-Za-z0-9_\-\.]{16,})["']/i,
    message: 'Possible hardcoded credential or high-entropy key literal found in assignment.'
  },
  {
    id: 'SEC-004',
    name: 'Private Key Block',
    category: 'secrets',
    severity: 'error',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
    message: 'Detected cryptographic private key header in diff additions.'
  },
  {
    id: 'SEC-005',
    name: 'Exposed OpenAI API Key',
    category: 'secrets',
    severity: 'error',
    pattern: /(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}|sk-[A-Za-z0-9]{48})/,
    message: 'Detected exposed OpenAI project or service account API key.'
  },
  {
    id: 'SEC-006',
    name: 'Exposed Anthropic API Key',
    category: 'secrets',
    severity: 'error',
    pattern: /(?:sk-ant-(?:api03|admin01)-[A-Za-z0-9_-]{32,})/,
    message: 'Detected exposed Anthropic Claude API key.'
  },
  {
    id: 'SEC-007',
    name: 'Exposed Google AI / Cloud API Key',
    category: 'secrets',
    severity: 'error',
    pattern: /(?:AIzaSy[0-9A-Za-z_-]{33})/,
    message: 'Detected exposed Google AI Studio or GCP API key.'
  },
  {
    id: 'SEC-008',
    name: 'Exposed Cloud Service & Gateway Token',
    category: 'secrets',
    severity: 'error',
    pattern: /(?:(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}|xox[baprs]-[0-9a-zA-Z]{10,48}|hf_[a-zA-Z0-9]{34}|npm_[a-zA-Z0-9]{36})/,
    message: 'Detected exposed token for Stripe, Slack, Hugging Face, or NPM registry.'
  },

  // 2. Dangerous Remote Code Execution / Injections
  {
    id: 'INJ-001',
    name: 'Arbitrary Eval Execution',
    category: 'injection',
    severity: 'warning',
    pattern: /\b(?:eval|Function)\s*\([^\)]+\)/,
    message: 'Dynamic code execution (eval/Function) introduces code injection risks.'
  },
  {
    id: 'INJ-002',
    name: 'Unescaped Child Process Shell Execution',
    category: 'injection',
    severity: 'warning',
    pattern: /(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|["'].*\+\s*[a-zA-Z_])/,
    message: 'String interpolation or concatenation within exec/execSync indicates potential command injection.'
  },

  // 3. AI Hallucination & Mock Slop Detection
  {
    id: 'HAL-001',
    name: 'Unimplemented AI Stub / Mock Placeholder',
    category: 'hallucination',
    severity: 'error',
    pattern: /(?:(?:\/\/|#|\/\*)\s*(?:TODO:?\s*(?:implement|finish|replace with real|add logic)|mock data for now|placeholder logic|dummy return)\b|\bthrow\s+new\s+Error\s*\(\s*["'](?:TODO|Not implemented|stub)["']\s*\)|\braise\s+NotImplementedError\b|^\s*pass\s+#\s*(?:TODO|stub|implement))/i,
    message: 'Unimplemented stub, artificial placeholder comment, or mock exception detected in patch.'
  },
  {
    id: 'HAL-002',
    name: 'Common AI Hallucinated Dependency',
    category: 'hallucination',
    severity: 'warning',
    message: 'Flags imports of common phantom libraries or hallucinated modules fabricated by LLMs.',
    customCheck: (addition, filePath) => {
      // Flag imports of common hallucinated libraries or phantom modules across JS/TS and Python
      const hallucinatedPackages = [
        'ai-utils', 'react-native-hyper-animator', 'google-gemini-node-official',
        'crypto-browser-pro', 'fast-fetch-enterprise', 'autocache-ts',
        '@anthropic/claude-sdk', 'langchain-core-tools', 'langchain_core_tools',
        'huggingface-hub-utils', 'huggingface_hub_utils', 'openai-agents-sdk', 'openai_agents_sdk'
      ];
      for (const pkg of hallucinatedPackages) {
        // Matches JS/TS: require('pkg'), from 'pkg', or Python: import pkg, from pkg import ...
        const jsPattern = new RegExp(`(?:require\\(['"]|from ['"])${pkg}['"]`);
        const pyPattern = new RegExp(`(?:^|\\s)(?:import\\s+${pkg}\\b|from\\s+${pkg}\\b)`);
        if (jsPattern.test(addition.content) || pyPattern.test(addition.content)) {
          return `Suspicious import of package '${pkg}' which is frequently fabricated by LLM agents.`;
        }
      }
      return null;
    }
  },
  {
    id: 'HAL-003',
    name: 'Production Debugger / Console Leftover',
    category: 'quality',
    severity: 'info',
    pattern: /(?:\bconsole\.log\(|\bdebugger;|\bprint\(f?["']DEBUG:)/,
    message: 'Leftover debugging artifact (console.log / debugger / DEBUG print) in patch additions.'
  }
];

function scanAdditions(parsedFiles, options = {}) {
  const issues = [];
  let ignoredRules = [];
  if (Array.isArray(options.ignoreRules)) {
    ignoredRules = options.ignoreRules;
  } else if (typeof options.ignoreRules === 'string') {
    ignoredRules = options.ignoreRules.split(',').map(s => s.trim());
  }

  for (const file of parsedFiles) {
    if (file.isDeleted) {
      continue;
    }

    const isTestFile = /(?:test|spec|\.test\.|\.spec\.)/i.test(file.filePath);
    const isDocFile = /\.(?:md|markdown|txt|rst|adoc)$/i.test(file.filePath);
    const isCliFile = /(?:^|[/\\])bin[/\\]/i.test(file.filePath);

    if (options.ignoreTests && isTestFile) {
      continue;
    }

    for (const addition of file.additions) {
      for (const rule of RULES) {
        if (ignoredRules.includes(rule.id)) {
          continue;
        }

        // Markdown and documentation files only scan for leaked secrets, not code stubs or injection patterns
        if (isDocFile && rule.category !== 'secrets') {
          continue;
        }

        // CLI entry points use console.log as standard user output
        if (isCliFile && rule.id === 'HAL-003') {
          continue;
        }

        if (isTestFile && (rule.id === 'HAL-003' || rule.id === 'SEC-003')) {
          continue;
        }

        let matched = false;
        let detailMessage = rule.message;

        if (rule.pattern && rule.pattern.test(addition.content)) {
          matched = true;
        } else if (typeof rule.customCheck === 'function') {
          const customError = rule.customCheck(addition, file.filePath);
          if (customError) {
            matched = true;
            detailMessage = customError;
          }
        }

        if (matched) {
          issues.push({
            ruleId: rule.id,
            name: rule.name,
            category: rule.category,
            severity: rule.severity,
            filePath: file.filePath,
            line: addition.line,
            content: addition.content.trim(),
            message: detailMessage
          });
        }
      }
    }
  }

  return issues;
}

module.exports = {
  RULES,
  scanAdditions
};
