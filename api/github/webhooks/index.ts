// Vercel serverless entry point for GitHub webhook delivery.
import { createNodeMiddleware, createProbot } from "probot";
import app from "../../../src/index.js";

export default createNodeMiddleware(app, {
  probot: createProbot(),
  webhooksPath: "/api/github/webhooks"
});
