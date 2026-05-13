import { describe, expect, it, vi } from "vitest";
import { fetchPullRequestContext } from "../src/analysis/fetch-context.js";

describe("fetchPullRequestContext", () => {
  it("returns compact PR context and trims large patches", async () => {
    const context = makeContext({
      patch: "x".repeat(4_010),
      searchResult: { data: { total_count: 3 } }
    });

    const result = await fetchPullRequestContext(context);

    expect(result?.repository).toBe("owner/repo");
    expect(result?.pull_request.title).toBe("Fix parser");
    expect(result?.files[0]?.patch).toContain("[patch trimmed for cost]");
    expect(result?.author.prior_merged_prs_to_repo).toBe(3);
  });

  it("skips bot-authored pull requests", async () => {
    const context = makeContext({ userType: "Bot" });

    await expect(fetchPullRequestContext(context)).resolves.toBeNull();
  });

  it("throws when GitHub API rate limit is too low", async () => {
    const context = makeContext({ remaining: 12 });

    await expect(fetchPullRequestContext(context)).rejects.toThrow("GitHub API rate limit too low");
  });

  it("keeps going when prior merged PR search fails", async () => {
    const context = makeContext({ searchResult: Promise.reject(new Error("search down")) });

    const result = await fetchPullRequestContext(context);

    expect(result?.author.prior_merged_prs_to_repo).toBeNull();
    expect(context.log.warn).toHaveBeenCalled();
  });
});

type ContextOptions = {
  patch?: string;
  remaining?: number;
  searchResult?: unknown;
  userType?: "User" | "Bot";
};

function makeContext(options: ContextOptions = {}) {
  return {
    payload: {
      pull_request: {
        number: 7,
        user: { login: "contributor", type: options.userType ?? "User" }
      }
    },
    repo: () => ({ owner: "owner", repo: "repo" }),
    log: {
      warn: vi.fn()
    },
    octokit: {
      rateLimit: {
        get: vi.fn().mockResolvedValue({
          data: { resources: { core: { remaining: options.remaining ?? 500, reset: 1_800_000_000 } } }
        })
      },
      pulls: {
        get: vi.fn().mockResolvedValue({
          data: {
            number: 7,
            title: "Fix parser",
            body: null,
            user: { login: "contributor" },
            created_at: "2026-05-01T00:00:00Z",
            additions: 9,
            deletions: 2,
            changed_files: 1
          }
        }),
        listFiles: vi.fn().mockResolvedValue({
          data: [
            {
              filename: "src/parser.ts",
              status: "modified",
              additions: 9,
              deletions: 2,
              patch: options.patch ?? "@@ parser patch"
            }
          ]
        }),
        listCommits: vi.fn().mockResolvedValue({
          data: [{ sha: "abc123", commit: { message: "fix parser branch" } }]
        })
      },
      users: {
        getByUsername: vi.fn().mockResolvedValue({
          data: {
            login: "contributor",
            created_at: "2025-01-01T00:00:00Z",
            public_repos: 6,
            followers: 2
          }
        })
      },
      search: {
        issuesAndPullRequests: vi
          .fn()
          .mockImplementation(() => options.searchResult ?? Promise.resolve({ data: { total_count: 0 } }))
      }
    }
  } as unknown as Parameters<typeof fetchPullRequestContext>[0];
}
