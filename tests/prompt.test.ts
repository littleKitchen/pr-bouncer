import { describe, expect, it } from "vitest";
import { buildSlopPrompt } from "../src/analysis/prompt.js";
import type { PullRequestAnalysisContext } from "../src/analysis/fetch-context.js";

describe("buildSlopPrompt", () => {
  it("calibrates tiny demo mismatches below high-risk scoring", () => {
    const prompt = buildSlopPrompt(demoMismatchFixture, {
      strictness: "medium",
      custom_rules: ["All new code must include real tests, not stubs"]
    });

    expect(prompt).toContain("A tiny PR with a clear mismatch");
    expect(prompt).toContain("Reserve final scores 70+");
    expect(prompt).toContain("keep the final score below\n  60");
    expect(prompt).toContain("demo, sandbox, fixture, or intentional mismatch");
  });
});

const demoMismatchFixture: PullRequestAnalysisContext = {
  repository: "littleKitchen/pr-bouncer-demo-target",
  pull_request: {
    number: 1,
    title: "Refactor authentication module and add complete tests",
    body: "This comprehensively refactors the authentication module and adds full test coverage.",
    author: "littleKitchen",
    created_at: "2026-05-13T04:01:26Z",
    additions: 10,
    deletions: 0,
    changed_files: 3
  },
  files: [
    {
      filename: "README.md",
      status: "modified",
      additions: 2,
      deletions: 0,
      patch: "This branch intentionally contains a mismatched PR description for the pr-bouncer demo."
    },
    {
      filename: "src/logger.ts",
      status: "added",
      additions: 4,
      deletions: 0,
      patch: "export function logInfo(message: string): void {\n  console.log(`[INFO]: ${message}`);\n}"
    },
    {
      filename: "tests/auth.test.ts",
      status: "modified",
      additions: 4,
      deletions: 0,
      patch: "it('comprehensively validates the authentication refactor', () => {\n  expect(true).toBe(true);\n});"
    }
  ],
  commits: [
    { sha: "abfe027", message: "Comprehensive auth refactor" },
    { sha: "dc0ddec", message: "update demo notes" }
  ],
  author: {
    login: "littleKitchen",
    account_created_at: "2019-10-19T00:00:00Z",
    public_repos: 42,
    followers: 0,
    prior_merged_prs_to_repo: null
  }
};
