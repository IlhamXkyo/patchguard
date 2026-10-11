const assert = require('assert');
const { parseDiff } = require('../src/parser');
const { analyzePatch } = require('../src/index');

console.log('Running PatchGuard Unit Tests...');

// 1. Test Diff Parser
const sampleDiff = `
diff --git a/src/auth.js b/src/auth.js
index 1234567..89abcdef 100644
--- a/src/auth.js
+++ b/src/auth.js
@@ -10,4 +10,6 @@ function authenticate() {
-  const token = oldMethod();
+  const token = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
+  // TODO: implement proper token validation
+  return token;
 }
`;

const parsed = parseDiff(sampleDiff);
assert.strictEqual(parsed.length, 1, 'Should parse 1 file');
assert.strictEqual(parsed[0].filePath, 'src/auth.js');
assert.strictEqual(parsed[0].additions.length, 3, 'Should have 3 additions');
assert.strictEqual(parsed[0].deletions.length, 1, 'Should have 1 deletion');
console.log('✔ Test 1 Passed: Unified Diff Parser operates accurately.');

// 2. Test Security & Token Detection
const analysis = analyzePatch(sampleDiff);
assert.strictEqual(analysis.summary.passed, false, 'Sample diff should fail due to secrets and stubs');
assert.strictEqual(analysis.summary.errors, 2, 'Should find 2 errors (SEC-001 and HAL-001)');

const secIssue = analysis.issues.find(i => i.ruleId === 'SEC-001');
assert(secIssue, 'Must detect hardcoded GitHub token');
assert.strictEqual(secIssue.severity, 'error');

const stubIssue = analysis.issues.find(i => i.ruleId === 'HAL-001');
assert(stubIssue, 'Must detect AI TODO stub');
assert.strictEqual(stubIssue.severity, 'error');
console.log('✔ Test 2 Passed: Leaked secret and AI stub detected.');

// 3. Test Clean Diff Approval
const cleanDiff = `
diff --git a/src/math.js b/src/math.js
new file mode 100644
--- /dev/null
+++ b/src/math.js
@@ -0,0 +1,5 @@
+function add(a, b) {
+  return a + b;
+}
+module.exports = { add };
`;

const cleanAnalysis = analyzePatch(cleanDiff);
assert.strictEqual(cleanAnalysis.summary.passed, true, 'Clean code must pass');
assert.strictEqual(cleanAnalysis.issues.length, 0, 'No issues should be found in clean code');
console.log('✔ Test 3 Passed: Clean additions pass validation without false positives.');

// 4. Test Hallucinated Module Import
const hallDiff = `
diff --git a/app.js b/app.js
--- a/app.js
+++ b/app.js
@@ -1,3 +1,4 @@
+const utils = require('google-gemini-node-official');
`;

const hallAnalysis = analyzePatch(hallDiff);
const hallIssue = hallAnalysis.issues.find(i => i.ruleId === 'HAL-002');
assert(hallIssue, 'Must detect hallucinated module import');
console.log('✔ Test 4 Passed: AI hallucinated module detected.');

console.log('\nAll 4 test suites passed successfully! 🚀');
