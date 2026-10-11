const { parseDiff } = require('./parser');
const { scanAdditions, RULES } = require('./rules');

function analyzePatch(diffText, options = {}) {
  const parsedFiles = parseDiff(diffText);
  const issues = scanAdditions(parsedFiles, options);

  const summary = {
    totalFiles: parsedFiles.length,
    totalAdditions: parsedFiles.reduce((acc, f) => acc + f.additions.length, 0),
    totalDeletions: parsedFiles.reduce((acc, f) => acc + f.deletions.length, 0),
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    infos: issues.filter(i => i.severity === 'info').length,
    passed: issues.filter(i => i.severity === 'error').length === 0
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
  lines.push(`  Warnings: ${summary.warnings}`);
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
