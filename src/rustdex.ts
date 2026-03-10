/**
 * RustDex utility functions for the pi-rustdex extension
 */

import { spawnSync } from "node:child_process";

export interface RustDexResult {
  success: boolean;
  output: any;
  error?: string;
}

export interface SymbolResult {
  name: string;
  kind: string;
  file: string;
  line: number;
  start_byte: number;
  end_byte: number;
}

export interface SemanticResult extends SymbolResult {
  score: number;
}

export interface RouteResult {
  method: string;
  path: string;
  file: string;
  line: number;
  handler?: string;
}

export interface RepoInfo {
  name: string;
  path: string;
  indexed_at?: string;
}

/**
 * Check if rustdex binary is available in PATH
 */
export function isRustDexAvailable(): boolean {
  const result = spawnSync("which", ["rustdex"], { encoding: "utf-8" });
  return result.status === 0;
}

/**
 * Execute a rustdex command and return the result
 */
export function runRustDex(
  args: string[],
  cwd?: string,
  timeout: number = 120000
): RustDexResult {
  try {
    const result = spawnSync("rustdex", args, {
      encoding: "utf-8",
      cwd: cwd || process.cwd(),
      timeout,
    });

    if (result.error) {
      return { success: false, output: null, error: result.error.message };
    }

    if (result.status !== 0) {
      return {
        success: false,
        output: null,
        error: result.stderr || `Exit code: ${result.status}`,
      };
    }

    // Try to parse as JSON, fallback to text
    let output: any;
    try {
      output = JSON.parse(result.stdout);
    } catch {
      output = result.stdout.trim();
    }

    return { success: true, output };
  } catch (e: any) {
    return { success: false, output: null, error: e.message };
  }
}

/**
 * Get rustdex version
 */
export function getRustDexVersion(): string | null {
  const result = runRustDex(["--version"], undefined, 5000);
  if (result.success && typeof result.output === "string") {
    return result.output;
  }
  return null;
}

/**
 * Index a codebase
 */
export function indexCodebase(
  projectPath: string,
  name?: string
): RustDexResult {
  const args = ["index", projectPath, "--json"];
  if (name) {
    args.push("--name", name);
  }
  return runRustDex(args, undefined, 300000); // 5 min timeout for indexing
}

/**
 * Search for symbols
 */
export function searchSymbols(query: string, repo: string): SymbolResult[] {
  const args = ["search", query, "--repo", repo, "--json"];
  const result = runRustDex(args);
  if (result.success && Array.isArray(result.output)) {
    return result.output;
  }
  return [];
}

/**
 * Semantic search
 */
export function semanticSearch(
  query: string,
  repo: string
): SemanticResult[] {
  const args = ["semantic", query, "--repo", repo, "--json"];
  const result = runRustDex(args);
  if (result.success && Array.isArray(result.output)) {
    return result.output;
  }
  return [];
}

/**
 * Extract HTTP routes
 */
export function extractRoutes(
  repo: string,
  method?: string
): RouteResult[] {
  const args = ["routes", repo, "--json"];
  if (method) {
    args.push("--method", method.toUpperCase());
  }
  const result = runRustDex(args);
  if (result.success && Array.isArray(result.output)) {
    return result.output;
  }
  return [];
}

/**
 * List indexed repositories
 */
export function listRepos(): RepoInfo[] {
  const result = runRustDex(["list-repos", "--json"]);
  if (result.success && Array.isArray(result.output)) {
    return result.output;
  }
  return [];
}
