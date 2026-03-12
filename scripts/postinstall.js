#!/usr/bin/env node

/**
 * Post-install script for pi-rustdex
 * Automatically installs the rustdex CLI tool via npm if not already installed
 */

const { spawnSync } = require("child_process");

function log(message) {
  console.log(`[pi-rustdex] ${message}`);
}

function checkRustDexInstalled() {
  const result = spawnSync("rustdex", ["--version"], {
    encoding: "utf-8",
    timeout: 5000,
  });
  return result.status === 0;
}

function installRustDex() {
  log("RustDex not found. Installing via npm...");

  const result = spawnSync("npm", ["install", "-g", "rustdex"], {
    encoding: "utf-8",
    timeout: 120000,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    log("Failed to install RustDex. Please install manually:");
    log("  npm install -g rustdex");
    process.exit(1);
  }

  log("RustDex installed successfully!");
}

// Check if rustdex is installed
if (checkRustDexInstalled()) {
  const versionResult = spawnSync("rustdex", ["--version"], {
    encoding: "utf-8",
  });
  const version = versionResult.stdout.trim();
  log(`RustDex is already installed: ${version}`);
} else {
  installRustDex();
}