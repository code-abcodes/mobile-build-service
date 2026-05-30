const express = require("express");
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// Map language → Docker Hub image
const RUNNER_IMAGES = {
  kotlin: "codedabtech/abccodes-runner-kotlin",
  java: "codedabtech/abccodes-runner-java",
  swift: "codedabtech/abccodes-runner-swift",
};

// Default build commands per language
const DEFAULT_BUILD_COMMANDS = {
  kotlin: "./gradlew assembleDebug",
  java: "./gradlew assembleDebug",
  swift: "swift build",
};

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// POST /build
// Body: { repoUrl, branch, language, buildCommand? }
// Returns: { success, exitCode, output }
app.post("/build", (req, res) => {
  const { repoUrl, branch = "main", language = "kotlin", buildCommand } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ success: false, output: "repoUrl is required" });
  }

  const image = RUNNER_IMAGES[language];
  if (!image) {
    return res.status(400).json({
      success: false,
      output: `no runner image configured for language: ${language}`,
    });
  }

  const cmd = buildCommand || DEFAULT_BUILD_COMMANDS[language] || "echo 'no build command'";

  // Use a unique temp dir per request to avoid collisions
  const runID = crypto.randomBytes(8).toString("hex");
  const workDir = `/tmp/mobile-build-${runID}`;

  let output = "";

  try {
    // 1. Clone the repo
    fs.mkdirSync(workDir, { recursive: true });
    output += `[clone] git clone --depth 1 --branch ${branch} ${repoUrl} ${workDir}\n`;
    const clone = spawnSync(
      "git",
      ["clone", "--depth", "1", "--branch", branch, repoUrl, workDir],
      { encoding: "utf8", timeout: 60_000 }
    );
    output += clone.stdout || "";
    output += clone.stderr || "";
    if (clone.status !== 0) {
      return res.json({ success: false, exitCode: clone.status, output });
    }

    // 2. Pull the runner image
    output += `\n[docker pull] ${image}\n`;
    const pull = spawnSync("docker", ["pull", image], {
      encoding: "utf8",
      timeout: 120_000,
    });
    output += pull.stdout || "";
    output += pull.stderr || "";
    if (pull.status !== 0) {
      return res.json({ success: false, exitCode: pull.status, output });
    }

    // 3. Run the build inside the container
    // Mount the cloned repo into /workspace inside the container
    output += `\n[docker run] image=${image} cmd=${cmd}\n`;
    const run = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "-v", `${workDir}:/workspace`,
        "-w", "/workspace",
        image,
        "sh", "-c", cmd,
      ],
      { encoding: "utf8", timeout: 300_000 }
    );
    output += run.stdout || "";
    output += run.stderr || "";

    const exitCode = run.status ?? 1;
    return res.json({ success: exitCode === 0, exitCode, output });

  } catch (err) {
    output += `\n[error] ${err.message}`;
    return res.json({ success: false, exitCode: 1, output });
  } finally {
    // Clean up cloned repo
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (_) {}
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`mobile-build-service listening on port ${PORT}`);
});