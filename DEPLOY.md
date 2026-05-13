# Deploy pr-bouncer

This project uses Vercel serverless for the first public deployment path.

Cloudflare Workers is still the nicer long-term target for a tiny stateless bot, but Probot's official deployment docs show Vercel support through `createNodeMiddleware` and do not list a first-party Cloudflare Workers adapter. Rather than make fresh users debug runtime compatibility, pr-bouncer starts with the boring path that should work in under 15 minutes.

## 1. Create the GitHub App

1. Open GitHub Developer Settings, then create a new GitHub App.
2. Set **Homepage URL** to your pr-bouncer repository URL.
3. Set **Webhook URL** to a placeholder for now:

```text
https://example.com/api/github/webhooks
```

4. Generate a webhook secret and save it:

```bash
openssl rand -base64 32
```

5. Give the app these repository permissions:

```text
Contents: Read
Metadata: Read
Pull requests: Read
Issues: Write
```

6. Subscribe to this event:

```text
Pull request
```

7. Create the app, download the private key, and install the app on your sandbox repo.

## 2. Deploy to Vercel

Install the Vercel CLI if you do not already have it:

```bash
npm i -g vercel
```

From the project directory:

```bash
npm install
vercel
```

When Vercel asks, link or create a project. After the preview deploy succeeds, set production environment variables:

```bash
vercel env add APP_ID production
vercel env add WEBHOOK_SECRET production
vercel env add PRIVATE_KEY production
vercel env add NODEJS_HELPERS production
vercel env add ANTHROPIC_API_KEY production
```

Use these values:

```text
APP_ID: your GitHub App ID
WEBHOOK_SECRET: the secret from step 1
PRIVATE_KEY: the full contents of the downloaded .private-key.pem file
NODEJS_HELPERS: 0
ANTHROPIC_API_KEY: your Anthropic key
```

If your repo config uses OpenAI or Gemini, add the matching key instead:

```bash
vercel env add OPENAI_API_KEY production
vercel env add GEMINI_API_KEY production
```

Deploy production:

```bash
vercel --prod
```

Copy the production URL, then update the GitHub App webhook URL:

```text
https://YOUR-VERCEL-PROJECT.vercel.app/api/github/webhooks
```

## 3. Configure a Repository

In the sandbox repository where you installed the app, add `.pr-bouncer.yml`:

```yaml
strictness: medium
threshold_to_comment: 40
provider: claude
model: claude-haiku-4-5
custom_rules:
  - "All new code must include real tests, not stubs"
ignore_authors:
  - "dependabot[bot]"
  - "renovate[bot]"
```

For OpenAI:

```yaml
provider: openai
model: gpt-4o-mini
```

For Gemini:

```yaml
provider: gemini
model: gemini-2.5-flash
```

## 4. Test on a Sandbox Repo

Use a repo where it is okay for the bot to comment.

```bash
git checkout -b pr-bouncer-smoke-test
printf "\n# smoke test\n" >> README.md
git add README.md
git commit -m "smoke test pr-bouncer"
git push -u origin pr-bouncer-smoke-test
gh pr create --title "Smoke test pr-bouncer" --body "Checks that the app receives PR webhooks."
```

Then check:

```bash
vercel logs YOUR-VERCEL-PROJECT.vercel.app
```

If the score is below `threshold_to_comment`, the app may intentionally post nothing. To force a visible smoke test, temporarily set:

```yaml
threshold_to_comment: 0
```

Open another PR or push a new commit to trigger `pull_request.synchronize`.

## Troubleshooting

- **No webhook delivery**: In the GitHub App settings, open **Advanced**, inspect recent deliveries, and confirm the URL ends with `/api/github/webhooks`.
- **401 or signature errors**: Confirm `WEBHOOK_SECRET` exactly matches the GitHub App secret.
- **GitHub authentication errors**: Confirm `APP_ID` is the numeric app ID and `PRIVATE_KEY` contains the full PEM text, including header and footer.
- **Vercel body parsing errors**: Confirm `NODEJS_HELPERS=0`; Probot needs the raw webhook body for signature verification.
- **No comment appears**: Check Vercel logs. pr-bouncer fails safe if the LLM call fails, if the author is ignored, or if the score is below `threshold_to_comment`.
- **Provider key errors**: Match `.pr-bouncer.yml` to the environment variable: Claude uses `ANTHROPIC_API_KEY`, OpenAI uses `OPENAI_API_KEY`, Gemini uses `GEMINI_API_KEY`.

## Checklist

- [ ] GitHub App created
- [ ] Webhook secret saved
- [ ] Private key downloaded
- [ ] Permissions set: Contents read, Metadata read, Pull requests read, Issues write
- [ ] Pull request event subscribed
- [ ] App installed on sandbox repo
- [ ] Vercel project deployed
- [ ] `APP_ID`, `WEBHOOK_SECRET`, `PRIVATE_KEY`, `NODEJS_HELPERS`, and provider API key configured
- [ ] GitHub App webhook URL updated to the Vercel production URL
- [ ] `.pr-bouncer.yml` added to sandbox repo
- [ ] Smoke-test PR opened
- [ ] Vercel logs checked
