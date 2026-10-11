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
    pattern: /(?:ghp_[0-9a-zA-Z]{36}|gho_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82})/,
    message: 'Detected active or hardcoded GitHub Personal Access Token or OAuth token.'
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
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    message: 'Detected cryptographic private key header in diff additions.'
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
    pattern: /(?:exec|execSync)\s*\(\s*`[^`]*\$\{/,
    message: 'String interpolation within exec/execSync indicates potential command injection.'
  },

  // 3. AI Hallucination & Mock Slop Detection
  {
    id: 'HAL-001',
    name: 'Unimplemented AI Stub / Mock Placeholder',
    category: 'hallucination',
    severity: 'error',
    pattern: /(?:\/\/|#|\/\*)\s*(?:TODO:?\s*(?:implement|finish|replace with real|add logic)|mock data for now|placeholder logic|dummy return)\b/i,
    message: 'Unimplemented stub or artificial AI mock placeholder detected in patch.'
  },
  {
    id: 'HAL-002',
    name: 'Common AI Hallucinated Dependency',
    category: 'hallucination',
    severity: 'warning',
    customCheck: (addition, filePath) => {
      // Flag imports of common hallucinated libraries or phantom modules
      const hallucinatedPackages = [
        'ai-utils', 'react-native-hyper-animator', 'google-gemini-node-official',
        'crypto-browser-pro', 'fast-fetch-enterprise', 'autocache-ts'
      ];
      for (const pkg of hallucinatedPackages) {
        const importPattern = new RegExp(`(?:require\\(['"]|from ['"])${pkg}['"]`);
        if (importPattern.test(addition.content)) {
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
    pattern: /(?:\bconsole\.log\(|\bdebugger;)/,
    message: 'Leftover debugging artifact (console.log / debugger) in patch additions.'
  }
];

function scanAdditions(parsedFiles, options = {}) {
  const issues = [];

  for (const file of parsedFiles) {
    if (file.isDeleted) {
      continue;
    }

    // Skip scanning test files for mock/debug warnings if configured
    const isTestFile = /(?:test|spec|\.test\.|\.spec\.)/i.test(file.filePath);

    for (const addition of file.additions) {
      for (const rule of RULES) {
        if (options.ignoreRules && options.ignoreRules.includes(rule.id)) {
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
