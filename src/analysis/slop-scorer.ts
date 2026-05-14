// Calls the configured LLM provider and validates the strict JSON score response.
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import type { LlmProvider, PrBouncerConfig } from "../config.js";
import type { PullRequestAnalysisContext } from "./fetch-context.js";
import { buildSlopPrompt } from "./prompt.js";

export type SlopDimensions = {
  ai_generation_likelihood: number;
  description_diff_mismatch: number;
  test_coverage_hollowness: number;
  architectural_fit: number;
  author_engagement_signal: number;
  commit_message_quality: number;
};

export type SlopScore = {
  slop_score: number;
  dimensions: SlopDimensions;
  rationale: string[];
};

const MAX_TOKENS = 900;
const REQUEST_TIMEOUT_MS = 7_000;
const SMALL_DEMO_SCORE_CAP = 55;

export async function scorePullRequest(
  pr: PullRequestAnalysisContext,
  config: PrBouncerConfig
): Promise<SlopScore | null> {
  const prompt = buildSlopPrompt(pr, {
    strictness: config.strictness,
    custom_rules: config.custom_rules
  });

  try {
    console.info("pr-bouncer calling LLM provider", {
      provider: config.provider,
      model: config.model,
      prompt_chars: prompt.length
    });
    const text = await callProvider(config.provider, config.model, prompt);
    console.info("pr-bouncer LLM provider returned", {
      provider: config.provider,
      model: config.model,
      response_chars: text.length
    });
    return applyScoreCalibration(parseScore(text), pr);
  } catch (error) {
    console.info("pr-bouncer scoring failed safe", {
      provider: config.provider,
      model: config.model,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function callProvider(provider: LlmProvider, model: string, prompt: string): Promise<string> {
  if (provider === "claude") {
    const client = new Anthropic({
      apiKey: requireApiKey("ANTHROPIC_API_KEY"),
      maxRetries: 0,
      timeout: REQUEST_TIMEOUT_MS
    });
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    });
    const block = response.content.find((item) => item.type === "text");
    return block?.text ?? "";
  }

  if (provider === "openai") {
    const client = new OpenAI({
      apiKey: requireApiKey("OPENAI_API_KEY"),
      maxRetries: 0,
      timeout: REQUEST_TIMEOUT_MS
    });
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    });
    return response.choices[0]?.message.content ?? "";
  }

  const client = new GoogleGenAI({ apiKey: requireApiKey("GEMINI_API_KEY") });
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0,
      maxOutputTokens: MAX_TOKENS,
      responseMimeType: "application/json"
    }
  });
  return response.text ?? "";
}

export function parseScore(text: string): SlopScore {
  const parsed: unknown = JSON.parse(extractJson(text));

  if (!isScore(parsed)) {
    throw new Error("LLM response did not match SlopScore schema");
  }

  return {
    slop_score: clampScore(parsed.slop_score),
    dimensions: {
      ai_generation_likelihood: clampScore(parsed.dimensions.ai_generation_likelihood),
      description_diff_mismatch: clampScore(parsed.dimensions.description_diff_mismatch),
      test_coverage_hollowness: clampScore(parsed.dimensions.test_coverage_hollowness),
      architectural_fit: clampScore(parsed.dimensions.architectural_fit),
      author_engagement_signal: clampScore(parsed.dimensions.author_engagement_signal),
      commit_message_quality: clampScore(parsed.dimensions.commit_message_quality)
    },
    rationale: parsed.rationale.slice(0, 4)
  };
}

export function applyScoreCalibration(score: SlopScore, pr: PullRequestAnalysisContext): SlopScore {
  if (isSmallDemoPr(pr) && score.slop_score > SMALL_DEMO_SCORE_CAP) {
    return { ...score, slop_score: SMALL_DEMO_SCORE_CAP };
  }

  return score;
}

function isSmallDemoPr(pr: PullRequestAnalysisContext): boolean {
  return pr.pull_request.additions <= 15 && pr.pull_request.changed_files <= 3 && hasDemoSignal(pr);
}

function hasDemoSignal(pr: PullRequestAnalysisContext): boolean {
  const haystack = [
    pr.repository,
    pr.pull_request.title,
    pr.pull_request.body,
    ...pr.files.map((file) => `${file.filename}\n${file.patch ?? ""}`)
  ]
    .join("\n")
    .toLowerCase();

  return ["demo", "sandbox", "fixture", "intentional mismatch", "calibration"].some((signal) =>
    haystack.includes(signal)
  );
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not contain JSON");
  }

  return trimmed.slice(start, end + 1);
}

function requireApiKey(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function isScore(value: unknown): value is SlopScore {
  if (!isRecord(value) || !isRecord(value.dimensions) || !Array.isArray(value.rationale)) {
    return false;
  }

  return (
    isScoreNumber(value.slop_score) &&
    isScoreNumber(value.dimensions.ai_generation_likelihood) &&
    isScoreNumber(value.dimensions.description_diff_mismatch) &&
    isScoreNumber(value.dimensions.test_coverage_hollowness) &&
    isScoreNumber(value.dimensions.architectural_fit) &&
    isScoreNumber(value.dimensions.author_engagement_signal) &&
    isScoreNumber(value.dimensions.commit_message_quality) &&
    value.rationale.every((item) => typeof item === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isScoreNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
