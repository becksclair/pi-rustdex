#!/usr/bin/env node

/**
 * Post-install script for pi-rustdex
 * Ensures rustdex CLI tool is installed and up-to-date via npm
 */

const { spawnSync } = require("child_process");

function log(message) {
  console.log(`[pi-rustdex] ${message}`);
}

function getRustDexVersion() {
  const result = spawnSync("rustdex", ["--version"], {
    encoding: "utf-8",
    timeout: 5000,
  });
  if (result.status === 0) {
    return result.stdout.trim();
  }
  return null;
}

function ensureLatestRustDex() {
  const currentVersion = getRustDexVersion();

  if (currentVersion) {
    log(`${currentVersion} found. Ensuring latest version...`);
  } else {
    log("RustDex not found. Installing via npm...");
  }

  const result = spawnSync("npm", ["install", "-g", "rustdex@latest"], {
    encoding: "utf-8",
    timeout: 120000,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    log("Failed to install/update RustDex. Please install manually:");
    log("  npm install -g rustdex@latest");
    process.exit(1);
  }

  const newVersion = getRustDexVersion();
  log(`RustDex ${newVersion} installed successfully!`);
}

ensureLatestRustDex();