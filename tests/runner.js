const assert = require('assert');
const { parseDiff } = require('../src/parser');
const { analyzePatch, RULES } = require('../src/index');

console.log('Running PatchGuard Comprehensive Unit Tests...\n');

// 1. Test Unified Diff Parser & Edge Cases
const multiHunkDiff = `
diff --git a/src/service.js b/src/service.js
index 1111111..2222222 100644
--- a/src/service.js
+++ b/src/service.js
@@ -5,3 +5,4 @@ function init() {
  const a = 1;
+ const b = 2;
  return a;
 }
@@ -20,2 +21,3 @@ function update() {
- const x = 0;
+ const x = 1;
+ +++x;
 }
`;

const parsed = parseDiff(multiHunkDiff);
assert.strictEqual(parsed.length, 1, 'Should parse exactly 1 file');
assert.strictEqual(parsed[0].filePath, 'src/service.js');
assert.strictEqual(parsed[0].additions.length, 3, 'Should have 3 additions across hunks');
assert.strictEqual(parsed[0].additions[0].line, 6);
assert.strictEqual(parsed[0].additions[0].content, ' const b = 2;');
assert.strictEqual(parsed[0].additions[2].content, ' +++x;');
console.log('✔ Test 1 Passed: Multi-hunk diff and lines starting with "+++" parsed accurately.');

// 2. Test GitHub, AWS, and Private Key Rules (SEC-001, SEC-002, SEC-004)
const sampleGhToken = ['ghp', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'].join('_');
const sampleAwsKey = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
const secDiff = `
diff --git a/config.js b/config.js
--- a/config.js
+++ b/config.js
@@ -1,2 +1,4 @@
+const gh = '${sampleGhToken}';
+const aws = '${sampleAwsKey}';
+const pkey = '-----BEGIN RSA PRIVATE KEY-----';
`;
const secRes = analyzePatch(secDiff);
assert.strictEqual(secRes.summary.passed, false);
assert(secRes.issues.some(i => i.ruleId === 'SEC-001'), 'Must flag GitHub PAT');
assert(secRes.issues.some(i => i.ruleId === 'SEC-002'), 'Must flag AWS Access Key');
assert(secRes.issues.some(i => i.ruleId === 'SEC-004'), 'Must flag Private Key header');
console.log('✔ Test 2 Passed: GitHub PAT, AWS Key, and Private Key detected.');

// 3. Test Modern AI Secrets: OpenAI, Anthropic, Google AI Studio (SEC-005, SEC-006, SEC-007)
const sampleOpenAi = ['sk', 'proj', 'abc123456789012345678901234567890123'].join('-');
const sampleAnthropic = ['sk', 'ant', 'api03', 'abcdef123456789012345678901234567890'].join('-');
const sampleGemini = ['AIzaSy', 'B1234567890abcdefghijklmnopqrstuv'].join('');
const aiSecretDiff = `
diff --git a/ai.py b/ai.py
--- a/ai.py
+++ b/ai.py
@@ -1,1 +1,4 @@
+OPENAI_KEY = "${sampleOpenAi}"
+ANTHROPIC_KEY = "${sampleAnthropic}"
+GEMINI_KEY = "${sampleGemini}"
`;
const aiSecRes = analyzePatch(aiSecretDiff);
assert(aiSecRes.issues.some(i => i.ruleId === 'SEC-005'), 'Must flag OpenAI API key');
assert(aiSecRes.issues.some(i => i.ruleId === 'SEC-006'), 'Must flag Anthropic API key');
assert(aiSecRes.issues.some(i => i.ruleId === 'SEC-007'), 'Must flag Google Gemini/GCP API key');
console.log('✔ Test 3 Passed: Modern AI vendor API keys (OpenAI, Anthropic, Gemini) detected.');

// 4. Test Cloud Gateway & Token Services (SEC-008: Stripe, Slack, Hugging Face)
const sampleStripe = ['sk', 'test', '51Abcdefghijklmnopqrstuvwxyz123'].join('_');
const sampleSlack = ['xoxb', '123456789012', '3456789012345', 'abcdef'].join('-');
const sampleHf = ['hf', 'abcdefghijklmnopqrstuvwxyz01234567'].join('_');
const gatewayDiff = `
diff --git a/pay.js b/pay.js
--- a/pay.js
+++ b/pay.js
@@ -1,1 +1,4 @@
+const stripeKey = '${sampleStripe}';
+const slackBot = '${sampleSlack}';
+const hfToken = '${sampleHf}';
`;
const gatewayRes = analyzePatch(gatewayDiff);
assert.strictEqual(gatewayRes.issues.filter(i => i.ruleId === 'SEC-008').length, 3);
console.log('✔ Test 4 Passed: Stripe test key, Slack bot token, and Hugging Face token detected.');

// 5. Test AI Stubs & Mock Exceptions (HAL-001)
const stubDiff = `
diff --git a/app.js b/app.js
--- a/app.js
+++ b/app.js
@@ -1,1 +1,5 @@
+// TODO: implement real logic
+throw new Error("Not implemented");
+raise NotImplementedError
+pass # TODO
`;
const stubRes = analyzePatch(stubDiff);
const stubIssues = stubRes.issues.filter(i => i.ruleId === 'HAL-001');
assert.strictEqual(stubIssues.length, 4, 'Must detect all 4 stub variations');
console.log('✔ Test 5 Passed: AI TODO comments, dummy returns, and mock exception raises detected.');

// 6. Test Hallucinated Dependency Imports across JS and Python (HAL-002)
const hallDiff = `
diff --git a/pipeline.py b/pipeline.py
--- a/pipeline.py
+++ b/pipeline.py
@@ -1,1 +1,3 @@
+import openai_agents_sdk
+from langchain_core_tools import tool
diff --git a/web.js b/web.js
--- a/web.js
+++ b/web.js
@@ -1,1 +1,2 @@
+import { createAgent } from '@anthropic/claude-sdk';
`;
const hallRes = analyzePatch(hallDiff);
const hallIssues = hallRes.issues.filter(i => i.ruleId === 'HAL-002');
assert.strictEqual(hallIssues.length, 3, 'Must detect 3 phantom package imports');
console.log('✔ Test 6 Passed: Phantom JS and Python hallucinated imports detected.');

// 7. Test Rule Ignore Option
const sampleGhCred = ['ghp', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'].join('_');
const ignoreDiff = `
diff --git a/main.js b/main.js
--- a/main.js
+++ b/main.js
@@ -1,1 +1,3 @@
+console.log('Hello');
+const ghCredential = '${sampleGhCred}';
`;
const ignoreRes = analyzePatch(ignoreDiff, { ignoreRules: ['HAL-003', 'SEC-001'] });
assert.strictEqual(ignoreRes.issues.length, 0, 'Ignored rules should not be reported');
assert.strictEqual(ignoreRes.summary.passed, true);
console.log('✔ Test 7 Passed: ignoreRules option suppresses specified rule IDs.');

// 8. Test Strict Mode (Warnings become blocking failures)
const warnDiff = `
diff --git a/exec.js b/exec.js
--- a/exec.js
+++ b/exec.js
@@ -1,1 +1,2 @@
+eval("alert(1)");
`;
const normalRes = analyzePatch(warnDiff, { strict: false });
assert.strictEqual(normalRes.summary.errors, 0);
assert.strictEqual(normalRes.summary.warnings, 1);
assert.strictEqual(normalRes.summary.passed, true, 'Without strict, warnings do not fail');

const strictRes = analyzePatch(warnDiff, { strict: true });
assert.strictEqual(strictRes.summary.passed, false, 'With strict mode, warnings cause failure');
console.log('✔ Test 8 Passed: Strict mode correctly elevates warnings to blocking failures.');

// 9. Test Clean Code Pass
const cleanDiff = `
diff --git a/calc.js b/calc.js
new file mode 100644
--- /dev/null
+++ b/calc.js
@@ -0,0 +1,4 @@
+function multiply(x, y) {
+  return x * y;
+}
+module.exports = { multiply };
`;
const cleanRes = analyzePatch(cleanDiff);
assert.strictEqual(cleanRes.summary.passed, true);
assert.strictEqual(cleanRes.issues.length, 0);
console.log('✔ Test 9 Passed: Clean additions pass validation with 0 issues.');

// 10. Rules Catalog Completeness
assert(RULES.length >= 12, 'RULES catalog should have at least 12 production rules');
console.log(`✔ Test 10 Passed: Rules catalog contains ${RULES.length} verified rules.`);

console.log('\nAll 10 test suites passed successfully! 🚀');
