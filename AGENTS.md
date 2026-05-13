# pr-bouncer

## Mission

Build a GitHub App that acts as an **AI bouncer for pull requests**. When a PR is opened, it posts a comment with a "slop score" (0-100) telling the maintainer whether the contributor likely understands their own code, or whether this is low-effort AI-generated slop.

**Positioning**: maintainer-first, not author-first. Existing tools (CodeRabbit, Greptile) help PR authors ship faster. We help maintainers triage incoming PRs.

**Inspiration**: RPCS3 team's public plea to stop AI slop PRs (HN: https://news.ycombinator.com/item?id=48089263), Godot maintainer Rémi Verschelde's complaints about being overwhelmed.

## Project Goal

This is an **open-source side project** to build GitHub reputation. Optimize for:
- GitHub stars (target: 1000+ in first month)
- HN front page potential
- Twitter/X virality
- README quality and demo GIF matter more than feature count

It is **NOT a startup**. Do not add:
- Paid tiers, enterprise features, Stripe, auth flows
- Dashboards, web UIs, databases
- Slack/Discord integrations
- Author reputation databases

## Tech Stack (non-negotiable)

- **Language**: TypeScript, strict mode
- **Framework**: Probot (https://probot.github.io)
- **LLM SDKs**: `@anthropic-ai/sdk`, `openai`, `@google/genai`
- **Supported providers**: Claude, OpenAI, Gemini
- **Default model**: `claude-haiku-4-5`, configurable by `.pr-bouncer.yml`
- **Deployment target**: Cloudflare Workers (research Probot adapter; if blocked, use Vercel serverless and explain why in the README)
- **Tests**: Vitest
- **No database**. Stateless. If rate limiting needed, use Cloudflare KV.

## Constraints

- Total LOC under 800. This is a teaching artifact — devs should read the whole repo in 15 minutes.
- Every source file has a header comment explaining its purpose.
- `prompt.ts` is **the most important file**. The prompt is part of the product. It must be heavily commented so forkers can tune it.
- LLM cost per PR analysis: target under $0.01.
- Error handling fails safe: if the LLM call fails, log and post nothing.
- GitHub API rate limit handling required.

## Workflow Rules (read carefully)

You will execute this project in **phases**. Do not skip ahead. After each phase, **stop and report what you did**, then wait for my approval before the next phase.

### Phase 1: Scaffold + README draft
- Create project structure (see below)
- Write `package.json`, `tsconfig.json`, `.gitignore`, `.github/workflows/ci.yml`
- Write Probot boilerplate in `src/index.ts` (no logic, just the event handler skeleton)
- Write the README first draft (see README requirements below)
- **STOP and show me**: file tree + the full README. Wait for approval.

### Phase 2: Context fetching
- Implement `src/analysis/fetch-context.ts`: pull PR metadata + author signals via Probot's Octokit
- Write fixtures for testing: 5 realistic PR examples (3 sloppy, 1 ambiguous, 1 high-quality) in `tests/fixtures/`
- **STOP and show me**: the fetch-context module and the fixtures. Wait for approval.

### Phase 3: The prompt (most critical phase)
- Write `src/analysis/prompt.ts`: a heavily-commented prompt template
- The prompt must score across 6 dimensions (see Scoring Rubric below)
- The prompt must return strict JSON: `{ slop_score: number, dimensions: {...}, rationale: string[] }`
- **STOP and show me ONLY the prompt**. Do not integrate it yet. Wait for approval.

### Phase 4: Scoring + commenting
- Implement `src/analysis/slop-scorer.ts`: calls the configured LLM provider, parses JSON, handles errors
- Implement `src/comment/format.ts`: renders the markdown comment
- Implement `src/handlers/pull-request.ts`: wires it all together on `pull_request.opened` and `pull_request.synchronize`
- Implement `src/config.ts`: parses `.pr-bouncer.yml` from the target repo
- Run lint + typecheck. Fix all errors.
- **STOP and show me**: end-to-end walkthrough of how a PR webhook flows through the code.

### Phase 5: Tests
- Vitest unit tests for slop-scorer using the fixtures from Phase 2
- Mock LLM SDK calls; do not make real API calls in tests
- Achieve at least 80% line coverage on `src/analysis/`
- **STOP and show me**: test output + coverage report.

### Phase 6: Deployment
- Write `DEPLOY.md`: step-by-step Cloudflare Workers deployment (or Vercel with justification)
- Include GitHub App creation steps, secret configuration, webhook URL setup
- Test the deployed app on a sandbox repo (give me the commands to do this myself; do not deploy anything)
- **STOP and show me**: the deployment doc + a checklist I can follow.

## Scoring Rubric

Each dimension scored 0-100, where 100 = very sloppy.

1. **AI-generation likelihood** (weight 0.20): LLM stylistic markers — excessive em-dashes, verbose redundant comments, "Certainly!" patterns, perfect-but-generic variable names, suspicious uniformity
2. **Description-diff mismatch** (weight 0.25): does the PR description actually match the diff? Hallucinated descriptions are the strongest slop signal
3. **Test coverage hollowness** (weight 0.20): are tests stubs (`expect(true).toBe(true)`), or do they exercise the new code paths?
4. **Architectural fit** (weight 0.15): does new code follow patterns visible in the surrounding codebase?
5. **Author engagement signal** (weight 0.10): account age, prior contributions, prior PRs to this repo, generic username patterns
6. **Commit message quality** (weight 0.10): generic ("fix issues", "update code") vs meaningful

Final `slop_score = Σ(dimension_score × weight)`, rounded to integer.

## Output Format (the comment the bot posts)

```
🚪 **pr-bouncer report**

**Slop probability: 73/100** 🟠

- The PR description claims this "refactors the auth module" but the diff only touches logging code
- New tests added don't actually call any of the new functions (3 of 3 tests are stubs)
- Author created GitHub account 2 days ago with 0 prior contributions

<details>
<summary>Dimension breakdown</summary>

| Dimension | Score |
|-----------|-------|
| AI-generation likelihood | 80 |
| Description-diff mismatch | 95 |
| Test hollowness | 100 |
| Architectural fit | 40 |
| Author signal | 70 |
| Commit quality | 60 |

</details>

_This is an automated triage signal, not a verdict. Use your judgment._
_[pr-bouncer](https://github.com/yourname/pr-bouncer) · 🚪_
```

Emoji thresholds: 🟢 0-30, 🟡 31-60, 🟠 61-80, 🔴 81-100.

Only post the comment if `slop_score >= threshold_to_comment` (from config, default 40).

## Project Structure

```
pr-bouncer/
├── README.md
├── DEPLOY.md
├── AGENTS.md                   # This file
├── package.json
├── tsconfig.json
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml              # Lint + typecheck + test on PRs
├── src/
│   ├── index.ts                # Probot entry point
│   ├── handlers/
│   │   └── pull-request.ts     # PR event handler
│   ├── analysis/
│   │   ├── fetch-context.ts    # GitHub API: PR + author signals
│   │   ├── slop-scorer.ts      # LLM API call + JSON parsing
│   │   └── prompt.ts           # The prompt template (heavily commented)
│   ├── comment/
│   │   └── format.ts           # Markdown comment renderer
│   └── config.ts               # Parse .pr-bouncer.yml
├── examples/
│   ├── high-slop-pr.md         # Realistic example for README
│   └── low-slop-pr.md
└── tests/
    ├── fixtures/
    │   ├── slop-1.json
    │   ├── slop-2.json
    │   ├── slop-3.json
    │   ├── ambiguous-1.json
    │   └── quality-1.json
    └── slop-scorer.test.ts
```

## README Requirements

The README is 80% of the project's success. Structure, in order:

1. Logo placeholder at top: `<!-- LOGO -->`
2. **One-liner**: "The AI bouncer for your pull requests. Tells you if a contributor actually understands their own code."
3. Demo GIF placeholder: `<!-- DEMO GIF -->`
4. **Story** (2-3 paragraphs): reference the RPCS3 incident, link the HN thread, quote Rémi Verschelde
5. **Quick start**: 2 commands max
6. **What it detects**: bulleted list of the 6 scoring dimensions
7. **Example output**: side-by-side high-slop vs low-slop comments
8. **Configuration**: `.pr-bouncer.yml` schema
9. **FAQ**:
   - "Will this catch human-written bad code?"
   - "What about false positives?"
   - "Does this work on private repos?"
   - "How much does the LLM cost per PR?"
   - "Why not use CodeRabbit / Greptile?"
10. **Contributing**: inviting tone
11. **Acknowledgments**: link RPCS3, Godot, original HN threads, adamsreview Show HN

**Tone**: confident, slightly playful, technical but accessible. No corporate-speak. The word "slop" appears prominently — it's the meme.

## Configuration Schema (.pr-bouncer.yml)

```yaml
strictness: medium              # low | medium | high (adjusts weights)
threshold_to_comment: 40        # only post if slop_score >= this
provider: claude                # claude | openai | gemini
model: claude-haiku-4-5         # any model supported by provider
custom_rules:
  - "All new code must include real tests, not stubs"
  - "Follow patterns in src/core/"
ignore_authors:
  - "dependabot[bot]"
  - "renovate[bot]"
```

## Definition of Done

- [ ] All 6 phases complete and approved
- [ ] Lint + typecheck pass clean
- [ ] Tests pass with ≥80% coverage on `src/analysis/`
- [ ] Total LOC under 800 (excluding tests, fixtures, README)
- [ ] README renders well on GitHub (you can use `npx markdown-it README.md` to sanity check)
- [ ] DEPLOY.md takes a fresh user from `git clone` to working bot in under 15 minutes

## Start Here

Begin Phase 1 now. Create the scaffold and README draft. Stop when done and report back.
