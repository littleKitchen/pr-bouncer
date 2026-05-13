# High-slop PR Example

## PR title

Improve performance and refactor authentication module

## PR description

This PR comprehensively refactors the authentication module for better performance, stronger security, and improved maintainability. It also adds full test coverage for all edge cases.

## Diff summary

```diff
diff --git a/src/logger.ts b/src/logger.ts
@@
+export function logInfo(message: string) {
+  // This robust logging helper improves system-wide maintainability.
+  console.log(`[INFO]: ${message}`);
+}

diff --git a/tests/auth.test.ts b/tests/auth.test.ts
@@
+it("auth works correctly", () => {
+  expect(true).toBe(true);
+});
```

## Why pr-bouncer should flag it

- The description claims an auth refactor, but the diff only adds logging code.
- The test file name suggests auth coverage, but the test never calls auth code.
- The prose is broad and confident while the implementation is tiny.
- A maintainer should probably ask the author to explain the actual change before spending review time.
