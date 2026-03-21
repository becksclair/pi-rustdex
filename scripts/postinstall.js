#!/usr/bin/env node

/**
 * Post-install script for pi-rustdex
 * Ensures rustdex CLI tool is available via npm
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

function installRustDex() {
  log("Installing RustDex via npm...");

  const result = spawnSync("npm", ["install", "-g", "rustdex@latest"], {
    encoding: "utf-8",
    timeout: 120000,
    stdio: "inherit",
  });

  return result.status === 0;
}

const currentVersion = getRustDexVersion();

if (currentVersion) {
  log(`${currentVersion} is installed.`);
  log("To update to the latest version, run: npm install -g rustdex@latest");
} else {
  log("RustDex not found. Installing via npm...");

  if (!installRustDex()) {
    log("Failed to install RustDex. Please install manually:");
    log("  npm install -g rustdex@latest");
    process.exit(1);
  }

  const newVersion = getRustDexVersion();
  log(`RustDex ${newVersion} installed successfully!`);
}