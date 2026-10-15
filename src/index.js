const { parseDiff } = require('./parser');
const { scanAdditions, RULES } = require('./rules');

function analyzePatch(diffText, options = {}) {
  const parsedFiles = parseDiff(diffText);
  const issues = scanAdditions(parsedFiles, options);

  const errorsCount = issues.filter(i => i.severity === 'error').length;
  const warningsCount = issues.filter(i => i.severity === 'warning').length;
  const infosCount = issues.filter(i => i.severity === 'info').length;
  const isStrict = Boolean(options.strict);

  const summary = {
    totalFiles: parsedFiles.length,
    totalAdditions: parsedFiles.reduce((acc, f) => acc + f.additions.length, 0),
    totalDeletions: parsedFiles.reduce((acc, f) => acc + f.deletions.length, 0),
    errors: errorsCount,
    warnings: warningsCount,
    infos: infosCount,
    strict: isStrict,
    passed: isStrict ? (errorsCount === 0 && warningsCount === 0) : (errorsCount === 0)
  };

  return {
    summary,
    issues,
    files: parsedFiles
  };
}

function formatConsoleReport(analysisResult) {
  const { summary, issues } = analysisResult;
  const lines = [];

  lines.push('\x1b[1m=== PATCHGUARD STATIC INSPECTION REPORT ===\x1b[0m');
  lines.push(`Scanned: ${summary.totalFiles} files (+${summary.totalAdditions} / -${summary.totalDeletions} lines)`);
  if (summary.strict) {
    lines.push('\x1b[35m[Mode: STRICT - Warnings treated as blocking violations]\x1b[0m');
  }
  lines.push('');

  if (issues.length === 0) {
    lines.push('\x1b[32m✔ PASS: No security leaks or AI hallucination patterns detected in diff additions.\x1b[0m');
    return lines.join('\n');
  }

  for (const issue of issues) {
    let color = '\x1b[33m'; // Yellow
    if (issue.severity === 'error') color = '\x1b[31m'; // Red
    if (issue.severity === 'info') color = '\x1b[36m'; // Cyan

    lines.push(`${color}[${issue.severity.toUpperCase()}] ${issue.ruleId}: ${issue.name}\x1b[0m`);
    lines.push(`  --> ${issue.filePath}:${issue.line}`);
    lines.push(`  |   ${issue.content}`);
    lines.push(`  Tip: ${issue.message}`);
    lines.push('');
  }

  lines.push('\x1b[1mSummary:\x1b[0m');
  lines.push(`  Errors:   ${summary.errors} ${summary.errors > 0 ? '\x1b[31m(Blocking)\x1b[0m' : ''}`);
  lines.push(`  Warnings: ${summary.warnings} ${summary.strict && summary.warnings > 0 ? '\x1b[31m(Blocking in strict mode)\x1b[0m' : ''}`);
  lines.push(`  Info:     ${summary.infos}`);
  lines.push('');

  if (summary.passed) {
    lines.push('\x1b[32m✔ RESULT: APPROVED (No blocking errors detected)\x1b[0m');
  } else {
    lines.push('\x1b[31m✘ RESULT: REJECTED (Blocking security or stub errors detected)\x1b[0m');
  }

  return lines.join('\n');
}

module.exports = {
  analyzePatch,
  formatConsoleReport,
  RULES
};
