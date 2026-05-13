// Handles PR webhooks by fetching context, scoring slop, and posting the triage comment.
import type { Context } from "probot";
import { fetchPullRequestContext, type PullRequestWebhook } from "../analysis/fetch-context.js";
import { scorePullRequest } from "../analysis/slop-scorer.js";
import { formatComment } from "../comment/format.js";
import { loadConfig } from "../config.js";

export async function handlePullRequest(context: Context<PullRequestWebhook>): Promise<void> {
  console.info("pr-bouncer received pull request event", {
    repository: context.payload.repository.full_name,
    pull_number: context.payload.pull_request.number,
    action: context.payload.action
  });
  const config = await loadConfig(context);
  const author = context.payload.pull_request.user.login;

  if (config.ignore_authors.includes(author)) {
    context.log.info({ author }, "ignored pull request author");
    return;
  }

  try {
    const prContext = await fetchPullRequestContext(context);
    if (!prContext) {
      console.info("pr-bouncer skipped bot-authored PR");
      return;
    }

    console.info("pr-bouncer fetched PR context", {
      repository: prContext.repository,
      pull_number: prContext.pull_request.number,
      changed_files: prContext.pull_request.changed_files
    });

    const score = await scorePullRequest(prContext, config);
    if (!score) {
      console.info("pr-bouncer did not post because scoring returned null", {
        repository: prContext.repository,
        pull_number: prContext.pull_request.number,
        provider: config.provider,
        model: config.model
      });
      context.log.warn("scoring failed safe without posting");
      return;
    }

    console.info("pr-bouncer computed score", {
      repository: prContext.repository,
      pull_number: prContext.pull_request.number,
      score: score.slop_score,
      threshold: config.threshold_to_comment
    });

    if (score.slop_score < config.threshold_to_comment) {
      console.info("pr-bouncer score below comment threshold", {
        score: score.slop_score,
        threshold: config.threshold_to_comment
      });
      context.log.info({ score: score.slop_score }, "score below comment threshold");
      return;
    }

    console.info("pr-bouncer posting comment", {
      repository: prContext.repository,
      pull_number: prContext.pull_request.number
    });

    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: context.payload.pull_request.number,
      body: formatComment(score)
    });
  } catch (error) {
    console.info("pr-bouncer handler failed safe", {
      repository: context.payload.repository.full_name,
      pull_number: context.payload.pull_request.number,
      error: error instanceof Error ? error.message : String(error)
    });
    context.log.warn({ error }, "pr-bouncer failed safe without posting");
  }
}
