// Probot entry point. Wires GitHub webhook events to pr-bouncer handlers.
import type { Probot } from "probot";
import { handlePullRequest } from "./handlers/pull-request.js";

export default (app: Probot): void => {
  app.on(["pull_request.opened", "pull_request.synchronize"], handlePullRequest);
};
