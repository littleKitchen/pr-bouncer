// Renders the maintainer-facing pull request comment.
import type { SlopScore } from "../analysis/slop-scorer.js";

const REPO_URL = "https://github.com/littleKitchen/pr-bouncer";

const DIMENSION_LABELS: Record<keyof SlopScore["dimensions"], string> = {
  ai_generation_likelihood: "AI-generation likelihood",
  description_diff_mismatch: "Description-diff mismatch",
  test_coverage_hollowness: "Test hollowness",
  architectural_fit: "Architectural fit",
  author_engagement_signal: "Author signal",
  commit_message_quality: "Commit quality"
};

export function formatComment(score: SlopScore): string {
  const lines = [
    "🚪 **pr-bouncer report**",
    "",
    `**Slop probability: ${String(score.slop_score)}/100** ${scoreEmoji(score.slop_score)}`,
    "",
    ...score.rationale.map((item) => `- ${item}`),
    "",
    "<details>",
    "<summary>Dimension breakdown</summary>",
    "",
    "| Dimension | Score |",
    "|-----------|-------|",
    ...Object.entries(score.dimensions).map(
      ([key, value]) => `| ${DIMENSION_LABELS[key as keyof SlopScore["dimensions"]]} | ${String(value)} |`
    ),
    "",
    "</details>",
    "",
    "_This is an automated triage signal, not a verdict. Use your judgment._",
    `_[pr-bouncer](${REPO_URL}) · 🚪_`
  ];

  return lines.join("\n");
}

function scoreEmoji(score: number): string {
  if (score <= 30) {
    return "🟢";
  }

  if (score <= 60) {
    return "🟡";
  }

  if (score <= 80) {
    return "🟠";
  }

  return "🔴";
}
