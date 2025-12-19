#!/usr/bin/env node

/**
 * cursor-setup – Helper to set up the Cursor CLI for kaczmarek.ai-dev workflows.
 *
 * This script:
 *   - Checks whether `cursor-agent` is available on your PATH.
 *   - If missing, prints the official installation command from the Cursor CLI docs.
 *   - Optionally runs the install command for you when called with --install.
 *
 * Reference:
 *   - Cursor CLI overview & install docs: https://docs.cursor.com/de/cli/overview
 *
 * Usage from your repository root:
 *   - Check status only:
 *       node ./kaczmarek.ai-dev/bin/cursor-setup.js
 *   - Attempt installation (macOS/Linux, requires curl + bash):
 *       node ./kaczmarek.ai-dev/bin/cursor-setup.js --install
 *
 * After running this, you should test Cursor CLI yourself, e.g. by running:
 *   - cursor-agent ls
 *   - cursor-agent "kurze Testanfrage"
 */

const child_process = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function log(msg) {
  process.stdout.write(String(msg) + "\n");
}

function error(msg) {
  process.stderr.write(String(msg) + "\n");
}

function hasCursorAgent() {
  try {
    child_process.execFileSync("cursor-agent", ["--help"], {
      stdio: ["ignore", "ignore", "ignore"]
    });
    return true;
  } catch {
    return false;
  }
}

function cursorAgentInLocalBin() {
  const home = os.homedir();
  const candidate = path.join(home, ".local", "bin", "cursor-agent");
  try {
    const stat = fs.statSync(candidate);
    return stat.isFile() || stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function ensureLocalBinOnPath() {
  const home = os.homedir();
  const localBin = path.join(home, ".local", "bin");
  const currentPath = process.env.PATH || "";

  if (currentPath.split(":").includes(localBin)) {
    return;
  }

  const shell = process.env.SHELL || "";
  let rcFile = null;

  if (shell.endsWith("zsh")) {
    rcFile = path.join(home, ".zshrc");
  } else if (shell.endsWith("bash")) {
    rcFile = path.join(home, ".bashrc");
  }

  if (!rcFile) {
    log(
      'cursor-setup: Unable to detect zsh or bash shell from $SHELL; not modifying any rc file. Please add ~/.local/bin to PATH manually.'
    );
    return;
  }

  let existing = "";
  try {
    existing = fs.readFileSync(rcFile, "utf8");
  } catch {
    existing = "";
  }

  const exportLine = 'export PATH="$HOME/.local/bin:$PATH"';
  if (existing.includes(exportLine)) {
    // Already present; just update this process PATH for immediate checks.
    process.env.PATH = `${localBin}:${currentPath}`;
    return;
  }

  const toAppend = [
    "",
    "# Added by kaczmarek.ai-dev cursor-setup to expose Cursor CLI (cursor-agent)",
    exportLine,
    ""
  ].join("\n");

  try {
    fs.appendFileSync(rcFile, toAppend, "utf8");
    log(`cursor-setup: Appended PATH update for Cursor CLI to ${rcFile}`);
    // Make cursor-agent visible to subsequent checks in this process.
    process.env.PATH = `${localBin}:${currentPath}`;
  } catch (e) {
    error(
      `cursor-setup: Failed to append PATH update to ${rcFile}. Please add ~/.local/bin to PATH manually.`
    );
    error(String(e));
  }
}

function printInstallInstructions() {
  log("Cursor CLI (cursor-agent) does not appear to be installed.");
  log("");
  log("To install it manually (from the official docs at https://docs.cursor.com/de/cli/overview), run in your shell:");
  log("");
  log("  curl https://cursor.com/install -fsS | bash");
  log("");
  log("After installation, you should test it yourself, for example:");
  log("  cursor-agent ls");
  log('  cursor-agent "kurze Testanfrage"');
}

function runInstallCommand() {
  log(
    "Running Cursor CLI install command via: curl https://cursor.com/install -fsS | bash"
  );
  log(
    "This uses the official installer from https://cursor.com as described in the docs."
  );
  try {
    child_process.execSync("curl https://cursor.com/install -fsS | bash", {
      stdio: "inherit",
      shell: true
    });
  } catch (e) {
    error(
      "cursor-setup: installation command failed. Please check the output above and consider running the install command manually."
    );
    error(String(e));
    process.exitCode = 1;
  }
}

function main() {
  const args = process.argv.slice(2);
  const wantInstall = args.includes("--install");

  if (hasCursorAgent()) {
    log("Cursor CLI (cursor-agent) appears to be installed and available on PATH.");
    log("You should test it yourself, for example by running:");
    log("  cursor-agent ls");
    log('  cursor-agent "kurze Testanfrage"');
    return;
  }

  if (!wantInstall) {
    printInstallInstructions();
    return;
  }

  // Try to install, then re-check.
  runInstallCommand();

  if (hasCursorAgent()) {
    log("");
    log("Cursor CLI installation appears to have succeeded.");
    log("You should now test it yourself, for example by running:");
    log("  cursor-agent ls");
    log('  cursor-agent "kurze Testanfrage"');
  } else {
    // Installation may have succeeded but PATH is missing ~/.local/bin.
    if (cursorAgentInLocalBin()) {
      log("");
      log(
        "Cursor CLI appears to be installed under ~/.local/bin but is not yet on your PATH."
      );
      ensureLocalBinOnPath();
      if (hasCursorAgent()) {
        log("");
        log(
          "Cursor CLI is now discoverable in this session after updating PATH."
        );
        log("You should open a new terminal (or source your rc file) and test it yourself, e.g.:");
        log("  cursor-agent ls");
        log('  cursor-agent "kurze Testanfrage"');
        return;
      }
    }

    error("");
    error(
      "cursor-setup: cursor-agent is still not found on PATH after running the installer and attempting to update PATH."
    );
    error(
      "Please verify the installer output and your shell configuration, and consider adding ~/.local/bin to PATH manually."
    );
  }
}

main();


