# Low-slop PR Example

## PR title

Preserve retry delay when requeueing failed jobs

## PR description

Requeued jobs lost their original retry delay because the requeue payload was rebuilt from defaults. This keeps the stored delay and adds coverage for delayed retry behavior.

## Diff summary

```diff
diff --git a/src/jobs/requeue.ts b/src/jobs/requeue.ts
@@
-  delayMs: DEFAULT_RETRY_DELAY_MS,
+  delayMs: job.retry.delayMs,

diff --git a/src/jobs/requeue.test.ts b/src/jobs/requeue.test.ts
@@
+it("preserves retry delay when requeueing failed jobs", () => {
+  const payload = buildRequeuePayload(failedJob({ delayMs: 45_000 }));
+  expect(payload.delayMs).toBe(45_000);
+});
```

## Why pr-bouncer should let it pass quietly

- The description matches the changed code.
- The test exercises the new behavior directly.
- The scope is narrow and easy for a maintainer to verify.
- The commit message can be specific without being verbose.
