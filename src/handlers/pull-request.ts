// Handles PR webhooks by fetching context, scoring slop, and posting the triage comment.
import type { Context } from "probot";
import { fetchPullRequestContext, type PullRequestWebhook } from "../analysis/fetch-context.js";
import { scorePullRequest } from "../analysis/slop-scorer.js";
import { formatComment } from "../comment/format.js";
import { loadConfig } from "../config.js";

export async function handlePullRequest(context: Context<PullRequestWebhook>): Promise<void> {
  const config = await loadConfig(context);
  const author = context.payload.pull_request.user.login;

  if (config.ignore_authors.includes(author)) {
    context.log.info({ author }, "ignored pull request author");
    return;
  }

  try {
    const prContext = await fetchPullRequestContext(context);
    if (!prContext) {
      return;
    }

    const score = await scorePullRequest(prContext, config);
    if (!score) {
      context.log.warn("scoring failed safe without posting");
      return;
    }

    if (score.slop_score < config.threshold_to_comment) {
      context.log.info({ score: score.slop_score }, "score below comment threshold");
      return;
    }

    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: context.payload.pull_request.number,
      body: formatComment(score)
    });
  } catch (error) {
    context.log.warn({ error }, "pr-bouncer failed safe without posting");
  }
}
