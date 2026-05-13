// Fetches the compact PR context that the scorer will inspect later.
import type { Context } from "probot";

export type PullRequestWebhook = "pull_request.opened" | "pull_request.synchronize";

export type ChangedFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

export type CommitSummary = {
  sha: string;
  message: string;
};

export type AuthorSignals = {
  login: string;
  account_created_at: string | null;
  public_repos: number | null;
  followers: number | null;
  prior_merged_prs_to_repo: number | null;
};

export type PullRequestAnalysisContext = {
  repository: string;
  pull_request: {
    number: number;
    title: string;
    body: string;
    author: string;
    created_at: string;
    additions: number;
    deletions: number;
    changed_files: number;
  };
  files: ChangedFile[];
  commits: CommitSummary[];
  author: AuthorSignals;
};

const MAX_FILES = 30;
const MAX_COMMITS = 20;
const MAX_PATCH_CHARS = 4_000;

export async function fetchPullRequestContext(
  context: Context<PullRequestWebhook>
): Promise<PullRequestAnalysisContext | null> {
  if (context.payload.pull_request.user.type === "Bot") {
    return null;
  }

  const repo = context.repo();
  const pull_number = context.payload.pull_request.number;
  await assertRateLimitIsHealthy(context);

  const [pull, files, commits, user] = await Promise.all([
    context.octokit.pulls.get({ ...repo, pull_number }),
    context.octokit.pulls.listFiles({ ...repo, pull_number, per_page: MAX_FILES }),
    context.octokit.pulls.listCommits({ ...repo, pull_number, per_page: MAX_COMMITS }),
    context.octokit.users.getByUsername({
      username: context.payload.pull_request.user.login
    })
  ]);

  const priorMergedPrs = await countPriorMergedPrs(context);

  return {
    repository: `${repo.owner}/${repo.repo}`,
    pull_request: {
      number: pull.data.number,
      title: pull.data.title,
      body: pull.data.body ?? "",
      author: pull.data.user.login,
      created_at: pull.data.created_at,
      additions: pull.data.additions,
      deletions: pull.data.deletions,
      changed_files: pull.data.changed_files
    },
    files: files.data.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: trimPatch(file.patch)
    })),
    commits: commits.data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message
    })),
    author: {
      login: user.data.login,
      account_created_at: user.data.created_at,
      public_repos: user.data.public_repos,
      followers: user.data.followers,
      prior_merged_prs_to_repo: priorMergedPrs
    }
  };
}

async function assertRateLimitIsHealthy(
  context: Context<PullRequestWebhook>
): Promise<void> {
  const rateLimit = await context.octokit.rateLimit.get();
  const core = rateLimit.data.resources.core;

  if (core.remaining < 50) {
    const resetAt = new Date(core.reset * 1_000).toISOString();
    throw new Error(
      `GitHub API rate limit too low: ${String(core.remaining)} remaining until ${resetAt}`
    );
  }
}

async function countPriorMergedPrs(
  context: Context<PullRequestWebhook>
): Promise<number | null> {
  const repo = context.repo();
  const author = context.payload.pull_request.user.login;

  try {
    const result = await context.octokit.search.issuesAndPullRequests({
      q: `repo:${repo.owner}/${repo.repo} type:pr is:merged author:${author}`,
      per_page: 1
    });

    return result.data.total_count;
  } catch (error) {
    context.log.warn({ error, author }, "could not fetch prior merged PR count");
    return null;
  }
}

function trimPatch(patch: string | undefined): string | undefined {
  if (!patch) {
    return undefined;
  }

  if (patch.length <= MAX_PATCH_CHARS) {
    return patch;
  }

  return `${patch.slice(0, MAX_PATCH_CHARS)}\n...[patch trimmed for cost]`;
}
