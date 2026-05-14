import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyScoreCalibration } from "../src/analysis/slop-scorer.js";
import type { PullRequestAnalysisContext } from "../src/analysis/fetch-context.js";
import type { SlopScore } from "../src/analysis/slop-scorer.js";

type CalibrationCase = {
  id: string;
  expected: {
    min: number;
    max: number;
  };
  modelScore: SlopScore;
  pr: PullRequestAnalysisContext;
};

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "tests", "fixtures", "calibration", "cases.json"), "utf8")
) as CalibrationCase[];

describe("calibration fixtures", () => {
  it.each(cases)("keeps $id within its human-labeled score range", (testCase) => {
    const calibrated = applyScoreCalibration(testCase.modelScore, testCase.pr);

    expect(calibrated.slop_score).toBeGreaterThanOrEqual(testCase.expected.min);
    expect(calibrated.slop_score).toBeLessThanOrEqual(testCase.expected.max);
  });
});
