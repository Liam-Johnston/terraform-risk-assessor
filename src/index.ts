import * as core from "@actions/core";
import { createProvider } from "./providers";
import { parsePlanFile, summarizeChanges } from "./plan";
import { assessRisk } from "./assess";
import { postOrUpdateComment } from "./comment";

const run = async () => {
  try {
    // Read inputs
    const planPath = core.getInput("plan-json", { required: true });
    const providerName = core.getInput("provider", { required: true });
    const apiKey = core.getInput("api-key", { required: true });
    const model = core.getInput("model", { required: true });
    const additionalInstructions = core.getInput("additional-instructions");
    const commentOnPr = core.getInput("comment-on-pr") === "true";
    const githubToken = core.getInput("github-token");

    // Parse the terraform plan
    core.info(`Parsing Terraform plan from ${planPath}...`);
    const plan = parsePlanFile(planPath);

    const changeCount = plan.resource_changes.filter(
      (rc) => !rc.change.actions.includes("no-op") && !rc.change.actions.every((a) => a === "read")
    ).length;
    core.info(`Found ${changeCount} resource change(s)`);

    if (changeCount === 0) {
      const noChangeMsg = "## 🔵 Terraform Risk Assessment: **INFO**\n\nNo resource changes detected in this plan.";
      core.setOutput("risk-level", "info");
      core.setOutput("assessment", noChangeMsg);

      if (commentOnPr && githubToken) {
        await postOrUpdateComment(githubToken, noChangeMsg);
      }

      core.info("No changes to assess.");
      return;
    }

    // Summarize changes for the AI
    const summary = summarizeChanges(plan);
    core.info("Plan summary prepared, sending to AI for risk assessment...");
    core.debug(`Plan summary:\n${summary}`);

    // Create AI provider and assess
    const provider = createProvider(providerName, apiKey, model);
    if (additionalInstructions.trim() !== "") {
      core.info("Applying repository-specific additional instructions.");
    }
    const assessment = await assessRisk(provider, summary, additionalInstructions);

    core.info(`Risk assessment complete: ${assessment.overallRisk.toUpperCase()}`);

    // Set outputs
    core.setOutput("risk-level", assessment.overallRisk);
    core.setOutput("assessment", assessment.markdown);

    // Post PR comment if requested
    if (commentOnPr && githubToken) {
      core.info("Posting risk assessment as PR comment...");
      await postOrUpdateComment(githubToken, assessment.markdown);
      core.info("PR comment posted successfully.");
    }

} catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
};

run();
