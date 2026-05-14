# Calibration

pr-bouncer should be tuned against examples, not vibes.

The calibration set lives in `tests/fixtures/calibration/cases.json`. Each case contains:

- `id`: stable name for the scenario.
- `expected.min` and `expected.max`: the human-labeled acceptable final score range.
- `modelScore`: a representative raw model response for that PR shape.
- `pr`: the compact PR context that pr-bouncer scores.

Run the regression suite with:

```bash
npm test
```

## How to Add a Case

Add a case whenever a real PR score feels wrong or when changing the prompt, scoring weights, or calibration rules.

1. Save the PR shape in `pr`: title/body, additions, changed files, touched files, commits, and author signals.
2. Save the model's raw output in `modelScore` before manual correction.
3. Pick an expected score range by maintainer impact:
   - `0-20`: clearly useful or harmless; should not comment by default.
   - `20-40`: minor concern; probably no maintainer action needed.
   - `40-60`: real triage signal; mismatch or hollow testing, but limited blast radius.
   - `60-80`: likely review-time sink or risky mismatch in production code.
   - `80-100`: severe, broad, deceptive, or dangerous.
4. Keep ranges narrow enough to catch drift, usually 10-20 points wide.
5. Add both false-positive and false-negative cases. Precision needs both.

The goal is not to make every model answer identical. The goal is to make pr-bouncer's final maintainer-facing score stable and defensible.
