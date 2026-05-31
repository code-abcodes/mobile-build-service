const express = require("express");
const https = require("https");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || "code-abcodes/mobile-build-service";
const PUBLIC_URL = process.env.PUBLIC_URL || "https://mobile-build-service-production.up.railway.app";

// In-memory job store — holds pending and completed results
// { [jobId]: { status: "pending"|"done", result: {...} } }
const jobs = {};

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ── POST /build ───────────────────────────────────────────────────────────────
// Called by evaluation-worker.
// Triggers a GitHub Actions workflow_dispatch and polls for the result.
// Body: { repoUrl, branch, language, buildCommand }
// Returns: { success, exitCode, output }

app.post("/build", async (req, res) => {
const {
    repoUrl,
    branch = "main",
    language = "kotlin",
    buildCommand = "./gradlew assembleDebug",
    expectedOutputFile = "app/build/outputs/apk/debug/app-debug.apk",
  } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ success: false, output: "repoUrl is required" });
  }
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ success: false, output: "GITHUB_TOKEN not configured on mobile-build-service" });
  }

  const jobId = crypto.randomBytes(12).toString("hex");
  jobs[jobId] = { status: "pending" };

  const webhookUrl = `${PUBLIC_URL}/webhook/${jobId}`;
  const defaultBuildCommands = {
    kotlin: "./gradlew assembleDebug",
    java: "./gradlew assembleDebug",
    swift: "swift build",
  };
  const resolvedBuildCommand = buildCommand || defaultBuildCommands[language] || "echo 'no build command'";

  console.log(`[${jobId}] triggering GitHub Actions: repo=${repoUrl} branch=${branch} lang=${language}`);

  try {
    const testCommand = req.body.testCommand || "";

    await triggerWorkflow({
      repo_url: repoUrl,
      branch,
      language,
      build_command: resolvedBuildCommand,
      test_command: testCommand,
      expected_output_file: expectedOutputFile,
      job_id: jobId,
      webhook_url: webhookUrl,
    });
  } catch (err) {
    delete jobs[jobId];
    return res.status(500).json({
      success: false,
      output: "failed to trigger GitHub Actions workflow: " + err.message,
    });
  }

  // Poll for result — GitHub Actions typically takes 1-5 min for a Kotlin build
  // Poll every 10s, timeout after 10 min
  const POLL_INTERVAL_MS = 10_000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    const job = jobs[jobId];
    if (job && job.status === "done") {
      delete jobs[jobId];
      console.log(`[${jobId}] done: success=${job.result.success} exitCode=${job.result.exitCode}`);
      return res.json(job.result);
    }
  }

  // Timed out
  delete jobs[jobId];
  console.log(`[${jobId}] timed out after 10 min`);
  return res.json({
    success: false,
    exitCode: 1,
    output: "build timed out after 10 minutes — the Kotlin build may have hung or the runner image is too slow to start",
  });
});

// ── POST /webhook/:jobId ──────────────────────────────────────────────────────
// Called by GitHub Actions when the build completes.
// Body: { jobId, success, exitCode, output }

app.post("/webhook/:jobId", (req, res) => {
  const { jobId } = req.params;
  const { success, exitCode, testExitCode, outputFound, output } = req.body;

  if (!jobs[jobId]) {
    console.warn(`[${jobId}] webhook received for unknown job — ignoring`);
    return res.status(404).json({ error: "unknown job" });
  }

  console.log(`[${jobId}] webhook received: success=${success} exitCode=${exitCode}`);
  jobs[jobId] = {
    status: "done",
    result: {
      success: !!success,
      exitCode: exitCode ?? 1,
      testExitCode: testExitCode ?? -1,
      outputFound: outputFound !== false,
      output: output || "",
    },
  };

  res.json({ ok: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function triggerWorkflow(inputs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      ref: "main",
      inputs: {
        repo_url: inputs.repo_url,
        branch: inputs.branch,
        language: inputs.language,
        build_command: inputs.build_command,
        test_command: inputs.test_command || "",
        expected_output_file: inputs.expected_output_file || "",
        job_id: inputs.job_id,
        webhook_url: inputs.webhook_url,
      },
    });

    const [owner, repo] = GITHUB_REPO.split("/");
    const options = {
      hostname: "api.github.com",
      path: `/repos/${owner}/${repo}/actions/workflows/mobile-build.yml/dispatches`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mobile-build-service",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        // 204 = success, no content
        if (res.statusCode === 204) {
          resolve();
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`mobile-build-service listening on port ${PORT}`);
  console.log(`  GitHub repo:  ${GITHUB_REPO}`);
  console.log(`  Public URL:   ${PUBLIC_URL}`);
  console.log(`  Token set:    ${!!GITHUB_TOKEN}`);
});