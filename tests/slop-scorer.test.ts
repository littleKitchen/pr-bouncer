import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrBouncerConfig } from "../src/config.js";
import type { PullRequestAnalysisContext } from "../src/analysis/fetch-context.js";

const mocks = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  openaiCreate: vi.fn(),
  geminiGenerate: vi.fn()
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(function MockAnthropic() {
    return {
    messages: {
      create: mocks.anthropicCreate
    }
    };
  })
}));

vi.mock("openai", () => ({
  default: vi.fn(function MockOpenAI() {
    return {
    chat: {
      completions: {
        create: mocks.openaiCreate
      }
    }
    };
  })
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function MockGoogleGenAI() {
    return {
    models: {
      generateContent: mocks.geminiGenerate
    }
    };
  })
}));

const baseConfig: PrBouncerConfig = {
  strictness: "medium",
  threshold_to_comment: 40,
  provider: "claude",
  model: "claude-haiku-4-5",
  custom_rules: ["All new code must include real tests, not stubs"],
  ignore_authors: []
};

const scoreJson = {
  slop_score: 73,
  dimensions: {
    ai_generation_likelihood: 80,
    description_diff_mismatch: 95,
    test_coverage_hollowness: 100,
    architectural_fit: 40,
    author_engagement_signal: 70,
    commit_message_quality: 60
  },
  rationale: [
    "The PR description claims an auth refactor but the diff only touches logging code.",
    "New tests do not call the changed functions.",
    "Commit message is generic."
  ]
};

describe("scorePullRequest", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it("scores a high-slop fixture with Claude", async () => {
    const { scorePullRequest } = await import("../src/analysis/slop-scorer.js");
    mocks.anthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(scoreJson) }]
    });

    const score = await scorePullRequest(loadFixture("slop-1.json"), baseConfig);

    expect(score?.slop_score).toBe(73);
    expect(score?.dimensions.description_diff_mismatch).toBe(95);
    expect(mocks.anthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5",
        temperature: 0
      })
    );
  });

  it("scores an ambiguous fixture with OpenAI", async () => {
    const { scorePullRequest } = await import("../src/analysis/slop-scorer.js");
    mocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ ...scoreJson, slop_score: 42 }) } }]
    });

    const score = await scorePullRequest(loadFixture("ambiguous-1.json"), {
      ...baseConfig,
      provider: "openai",
      model: "gpt-4o-mini"
    });

    expect(score?.slop_score).toBe(42);
    expect(mocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" }
      })
    );
  });

  it("scores a quality fixture with Gemini", async () => {
    const { scorePullRequest } = await import("../src/analysis/slop-scorer.js");
    mocks.geminiGenerate.mockResolvedValue({
      text: JSON.stringify({ ...scoreJson, slop_score: 18 })
    });

    const score = await scorePullRequest(loadFixture("quality-1.json"), {
      ...baseConfig,
      provider: "gemini",
      model: "gemini-2.5-flash"
    });

    expect(score?.slop_score).toBe(18);
    expect(mocks.geminiGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-flash",
        config: { temperature: 0, maxOutputTokens: 900, responseMimeType: "application/json" }
      })
    );
  });

  it("fails safe when the provider throws", async () => {
    const { scorePullRequest } = await import("../src/analysis/slop-scorer.js");
    mocks.anthropicCreate.mockRejectedValue(new Error("provider down"));

    await expect(scorePullRequest(loadFixture("slop-2.json"), baseConfig)).resolves.toBeNull();
  });

  it("fails safe when the required API key is missing", async () => {
    const { scorePullRequest } = await import("../src/analysis/slop-scorer.js");
    delete process.env.ANTHROPIC_API_KEY;

    await expect(scorePullRequest(loadFixture("slop-3.json"), baseConfig)).resolves.toBeNull();
  });
});

describe("parseScore", () => {
  it("extracts JSON from wrapped model text and clamps scores", async () => {
    const { parseScore } = await import("../src/analysis/slop-scorer.js");

    const score = parseScore(`Here is JSON:\n${JSON.stringify({
      ...scoreJson,
      slop_score: 101.7,
      dimensions: {
        ...scoreJson.dimensions,
        ai_generation_likelihood: -4,
        commit_message_quality: 61.2
      },
      rationale: ["one", "two", "three", "four", "five"]
    })}`);

    expect(score.slop_score).toBe(100);
    expect(score.dimensions.ai_generation_likelihood).toBe(0);
    expect(score.dimensions.commit_message_quality).toBe(61);
    expect(score.rationale).toHaveLength(4);
  });

  it("rejects invalid model responses", async () => {
    const { parseScore } = await import("../src/analysis/slop-scorer.js");

    expect(() => parseScore("not json")).toThrow("LLM response did not contain JSON");
    expect(() => parseScore(JSON.stringify({ slop_score: 12 }))).toThrow(
      "LLM response did not match SlopScore schema"
    );
  });
});

function loadFixture(name: string): PullRequestAnalysisContext {
  const raw = readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf8");
  return JSON.parse(raw) as PullRequestAnalysisContext;
}
