// Loads and normalizes the target repository's .pr-bouncer.yml configuration.
import type { Context } from "probot";
import { parse } from "yaml";
import type { PullRequestWebhook } from "./analysis/fetch-context.js";
import type { Strictness } from "./analysis/prompt.js";

export type LlmProvider = "claude" | "openai" | "gemini";

export type PrBouncerConfig = {
  strictness: Strictness;
  threshold_to_comment: number;
  provider: LlmProvider;
  model: string;
  custom_rules: string[];
  ignore_authors: string[];
};

const DEFAULT_CONFIG: PrBouncerConfig = {
  strictness: "medium",
  threshold_to_comment: 40,
  provider: "claude",
  model: "claude-haiku-4-5",
  custom_rules: [],
  ignore_authors: ["dependabot[bot]", "renovate[bot]"]
};

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  claude: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash"
};

export async function loadConfig(
  context: Context<PullRequestWebhook>
): Promise<PrBouncerConfig> {
  try {
    const result = await context.octokit.repos.getContent({
      ...context.repo(),
      path: ".pr-bouncer.yml",
      ref: context.payload.pull_request.base.ref
    });

    if (Array.isArray(result.data) || result.data.type !== "file" || !("content" in result.data)) {
      return DEFAULT_CONFIG;
    }

    const raw = Buffer.from(result.data.content, "base64").toString("utf8");
    return normalizeConfig(parse(raw));
  } catch (error) {
    context.log.info({ error }, "using default config");
    return DEFAULT_CONFIG;
  }
}

function normalizeConfig(raw: unknown): PrBouncerConfig {
  if (!isRecord(raw)) {
    return DEFAULT_CONFIG;
  }

  const provider = parseProvider(raw.provider);

  return {
    strictness: parseStrictness(raw.strictness),
    threshold_to_comment: clampNumber(raw.threshold_to_comment, 0, 100, 40),
    provider,
    model: typeof raw.model === "string" && raw.model.length > 0 ? raw.model : DEFAULT_MODELS[provider],
    custom_rules: parseStringArray(raw.custom_rules),
    ignore_authors: parseStringArray(raw.ignore_authors)
  };
}

function parseStrictness(value: unknown): Strictness {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function parseProvider(value: unknown): LlmProvider {
  return value === "openai" || value === "gemini" || value === "claude" ? value : "claude";
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
