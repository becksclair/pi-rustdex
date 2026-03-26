import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@mariozechner/pi-ai";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

/**
 * Execute rustdex command and return parsed JSON result
 */
function runRustDex(
  args: string[],
  cwd?: string
): { success: boolean; output: any; error?: string } {
  try {
    const result = spawnSync("rustdex", args, {
      encoding: "utf-8",
      cwd: cwd || process.cwd(),
      timeout: 120000, // 2 minutes for indexing operations
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
 * Check if rustdex binary is available
 */
function isRustDexAvailable(): boolean {
  const result = spawnSync("which", ["rustdex"], { encoding: "utf-8" });
  return result.status === 0;
}

/** Apply orange truecolor to text for status bar */
function orange(text: string): string {
  return `\x1b[38;2;255;165;0m${text}\x1b[0m`;
}

const STATUS_KEY = "pi-rustdex";
const READY_FLASH_MS = 1000;
const INDEXED_SYMBOL = "⛁";
const WATCHING_SYMBOL = "◉";
const STATUS_SEPARATOR = " · ";

type StatusTone = "success" | "warning";

export default function (pi: ExtensionAPI) {
  let watchProcess: ChildProcess | null = null;
  let indexProcess: ChildProcess | null = null;
  let readyStatusTimeout: ReturnType<typeof setTimeout> | null = null;
  let isShuttingDown = false;

  function clearReadyStatusTimeout(): void {
    if (!readyStatusTimeout) return;
    clearTimeout(readyStatusTimeout);
    readyStatusTimeout = null;
  }

  function renderStatus(ctx: ExtensionContext, indexTone: StatusTone, watchTone: StatusTone): void {
    const { theme } = ctx.ui;
    ctx.ui.setStatus(
      STATUS_KEY,
      `${theme.fg(indexTone, INDEXED_SYMBOL)}${STATUS_SEPARATOR}${theme.fg(watchTone, WATCHING_SYMBOL)}`
    );
  }

  function setNotReadyStatus(ctx: ExtensionContext): void {
    renderStatus(ctx, "warning", "warning");
  }

  function setAnalyzingStatus(ctx: ExtensionContext): void {
    const { theme } = ctx.ui;
    ctx.ui.setStatus(
      STATUS_KEY,
      `${orange(INDEXED_SYMBOL)}${STATUS_SEPARATOR}${theme.fg("warning", WATCHING_SYMBOL)}`
    );
  }

  function syncSteadyStatus(ctx: ExtensionContext): void {
    if (watchProcess && !watchProcess.killed && watchProcess.exitCode === null) {
      renderStatus(ctx, "success", "success");
      return;
    }

    renderStatus(ctx, "success", "warning");
  }

  function flashReadyStatus(ctx: ExtensionContext): void {
    clearReadyStatusTimeout();
    renderStatus(ctx, "success", "success");
    readyStatusTimeout = setTimeout(() => {
      readyStatusTimeout = null;
      if (isShuttingDown) return;
      syncSteadyStatus(ctx);
    }, READY_FLASH_MS);
    readyStatusTimeout.unref();
  }

  /**
   * Spawn `rustdex index` asynchronously, streaming per-file progress
   * to the status bar. Returns a promise that resolves when indexing completes.
   */
  function runAsyncIndex(
    projectPath: string,
    ctx: ExtensionContext
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const args = ["index", projectPath];
      const proc = spawn("rustdex", args, {
        cwd: projectPath,
        stdio: ["ignore", "pipe", "pipe"],
      });
      indexProcess = proc;

      const rl = createInterface({ input: proc.stdout! });

      rl.on("line", (line: string) => {
        // Match "Indexing <file>..." lines
        const match = line.match(/^Indexing\s+(.+)\.\.\.$/);
        if (match) {
          setAnalyzingStatus(ctx);
        }
      });

      let stderrChunks: string[] = [];
      proc.stderr?.on("data", (data: Buffer) => {
        stderrChunks.push(data.toString());
      });

      proc.on("close", (code: number | null) => {
        indexProcess = null;
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: stderrChunks.join("") || `Exit code: ${code}` });
        }
      });

      proc.on("error", (err: Error) => {
        indexProcess = null;
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Spawn `rustdex watch` as a long-running background process.
   * The returned ChildProcess is stored for cleanup on shutdown.
   */
  function spawnWatcher(projectPath: string, ctx: ExtensionContext): ChildProcess {
    const proc = spawn("rustdex", ["watch", projectPath], {
      cwd: projectPath,
      stdio: "ignore",
    });

    proc.on("error", () => {
      // Watcher failed to start or crashed — not critical
      if (watchProcess === proc) {
        watchProcess = null;
        if (!isShuttingDown) {
          clearReadyStatusTimeout();
          syncSteadyStatus(ctx);
        }
      }
    });

    proc.on("exit", () => {
      if (watchProcess === proc) {
        watchProcess = null;
        if (!isShuttingDown) {
          clearReadyStatusTimeout();
          syncSteadyStatus(ctx);
        }
      }
    });

    return proc;
  }

  /** Kill a child process gracefully (SIGTERM, then SIGKILL fallback) */
  function killProcess(proc: ChildProcess | null): void {
    if (!proc || proc.killed || proc.exitCode !== null) return;
    proc.kill("SIGTERM");
    // Force-kill after 2 seconds if still alive
    const forceKill = setTimeout(() => {
      if (!proc.killed && proc.exitCode === null) {
        proc.kill("SIGKILL");
      }
    }, 2000);
    forceKill.unref();
  }

  // Auto-index CWD on startup, then spawn watcher
  pi.on("session_start", async (_event, ctx) => {
    if (!isRustDexAvailable()) {
      setNotReadyStatus(ctx);
      ctx.ui.notify(
        "RustDex not found. Install from https://github.com/burggraf/rustdex",
        "warning"
      );
      return;
    }

    const projectPath = ctx.cwd;

    clearReadyStatusTimeout();
    killProcess(watchProcess);
    watchProcess = null;

    // Show initial indexing status
    setAnalyzingStatus(ctx);

    // Run index asynchronously with per-file progress
    const result = await runAsyncIndex(projectPath, ctx);

    if (isShuttingDown) return;

    if (result.success) {
      // Start the file watcher in the background before settling the status.
      watchProcess = spawnWatcher(projectPath, ctx);
      flashReadyStatus(ctx);
    } else {
      setNotReadyStatus(ctx);
      ctx.ui.notify(`RustDex indexing failed: ${result.error}`, "warning");
    }
  });

  // Clean up background processes on shutdown
  pi.on("session_shutdown", async (_event, _ctx) => {
    isShuttingDown = true;
    clearReadyStatusTimeout();
    killProcess(watchProcess);
    killProcess(indexProcess);
    watchProcess = null;
    indexProcess = null;
  });

  // Register: rustdex_index - Index a codebase
  pi.registerTool({
    name: "rustdex_index",
    label: "Index Codebase",
    description:
      "Index a codebase with RustDex for symbol search and semantic search. Creates a local SQLite database with symbol metadata and embeddings.",
    promptSnippet:
      "Index a codebase so RustDex tools can search symbols, semantics, routes, and source efficiently.",
    promptGuidelines: [
      "Use rustdex_index before other RustDex tools when the repository has not been indexed yet.",
      "Use rustdex_index when the user wants semantic search, symbol search, or route extraction over a local codebase.",
      "Pass an absolute project path to rustdex_index.",
    ],
    parameters: Type.Object({
      project_path: Type.String({
        description: "Absolute path to the project directory to index",
      }),
      name: Type.Optional(
        Type.String({
          description:
            "Name for the index (defaults to folder name if omitted)",
        })
      ),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!isRustDexAvailable()) {
        throw new Error(
          "rustdex binary not found. Install from https://github.com/burggraf/rustdex"
        );
      }

      const args = ["index", params.project_path, "--json"];
      if (params.name) {
        args.push("--name", params.name);
      }

      onUpdate?.({
        content: [{ type: "text", text: `Indexing ${params.project_path}...` }],
        details: {},
      });

      const result = runRustDex(args);

      if (!result.success) {
        throw new Error(`Failed to index: ${result.error}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `Successfully indexed ${params.project_path}.`,
          },
        ],
        details: result.output,
      };
    },
  });

  // Register: rustdex_search - Search for symbols
  pi.registerTool({
    name: "rustdex_search",
    label: "Search Symbols",
    description:
      "Search for functions, classes, or methods by exact name across an indexed repository.",
    promptSnippet:
      "Find functions, classes, or methods by exact symbol name in an indexed repository.",
    promptGuidelines: [
      "Use rustdex_search when you know the exact symbol name you want to inspect.",
      "Prefer rustdex_search over semantic search for exact identifiers like function, class, or method names.",
      "After rustdex_search returns byte ranges, use rustdex_read_symbol to read the matched symbol body efficiently.",
    ],
    parameters: Type.Object({
      query: Type.String({
        description: "Symbol name to search for (e.g., 'validate_user')",
      }),
      repo: Type.String({
        description: "Repository name (from rustdex_index)",
      }),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!isRustDexAvailable()) {
        throw new Error("rustdex binary not found");
      }

      const args = ["search", params.query, "--repo", params.repo, "--json"];
      const result = runRustDex(args);

      if (!result.success) {
        throw new Error(`Search failed: ${result.error}`);
      }

      const results = Array.isArray(result.output) ? result.output : [];

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No symbols found matching "${params.query}" in ${params.repo}.`,
            },
          ],
          details: { results: [], query: params.query, repo: params.repo },
        };
      }

      // Format results for display
      const formatted = results
        .map(
          (r: any, i: number) =>
            `${i + 1}. **${r.name}** (${r.kind})\n   File: ${r.file}:${r.line}\n   Byte range: ${r.start_byte}-${r.end_byte}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} symbol(s) matching "${params.query}" in ${params.repo}:\n\n${formatted}`,
          },
        ],
        details: { results, query: params.query, repo: params.repo },
      };
    },
  });

  // Register: rustdex_semantic - Semantic search
  pi.registerTool({
    name: "rustdex_semantic",
    label: "Semantic Search",
    description:
      "Search code by natural language description using local BERT embeddings (e.g., 'how do we handle password hashing').",
    promptSnippet:
      "Search code by natural-language intent or behavior using local semantic embeddings.",
    promptGuidelines: [
      "Use rustdex_semantic when the user describes behavior, architecture, or intent rather than an exact symbol name.",
      "Prefer rustdex_semantic for questions like 'where do we handle auth', 'how is retry logic implemented', or 'what validates passwords'.",
      "After rustdex_semantic returns promising hits, use rustdex_read_symbol to inspect the exact source for the best matches.",
    ],
    parameters: Type.Object({
      query: Type.String({
        description: "Natural language query (e.g., 'user authentication logic')",
      }),
      repo: Type.String({
        description: "Repository name (from rustdex_index)",
      }),
      limit: Type.Optional(
        Type.Number({
          default: 10,
          description: "Maximum number of results to return",
        })
      ),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!isRustDexAvailable()) {
        throw new Error("rustdex binary not found");
      }

      const args = [
        "semantic",
        params.query,
        "--repo",
        params.repo,
        "--json",
      ];

      onUpdate?.({
        content: [
          {
            type: "text",
            text: `Running semantic search for "${params.query}"...`,
          },
        ],
        details: {},
      });

      const result = runRustDex(args);

      if (!result.success) {
        throw new Error(`Semantic search failed: ${result.error}`);
      }

      const results = Array.isArray(result.output) ? result.output : [];
      const limited = results.slice(0, params.limit || 10);

      if (limited.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No results found for "${params.query}" in ${params.repo}.`,
            },
          ],
          details: { results: [], query: params.query, repo: params.repo },
        };
      }

      // Format results with similarity scores
      const formatted = limited
        .map(
          (r: any, i: number) =>
            `${i + 1}. **${r.name}** (${r.kind}) - Score: ${(r.score * 100).toFixed(1)}%\n   File: ${r.file}:${r.line}\n   Byte range: ${r.start_byte}-${r.end_byte}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${limited.length} result(s) for "${params.query}" in ${params.repo}:\n\n${formatted}`,
          },
        ],
        details: {
          results: limited,
          query: params.query,
          repo: params.repo,
        },
      };
    },
  });

  // Register: rustdex_routes - Extract HTTP routes
  pi.registerTool({
    name: "rustdex_routes",
    label: "Extract API Routes",
    description:
      "Extract HTTP routes from web frameworks (Flask, FastAPI, Django, Express) in an indexed repository.",
    promptSnippet:
      "Extract HTTP routes from indexed web apps, optionally filtered by method.",
    promptGuidelines: [
      "Use rustdex_routes when mapping API surface area or finding handlers for HTTP endpoints.",
      "Use rustdex_routes instead of text search when the task is 'show me the routes', 'where is POST /login handled', or similar endpoint discovery.",
      "If a specific route result needs deeper inspection, follow up by reading the referenced file or symbol.",
    ],
    parameters: Type.Object({
      repo: Type.String({
        description: "Repository name (from rustdex_index)",
      }),
      method: Type.Optional(
        Type.String({
          description: "Filter by HTTP method (GET, POST, PUT, DELETE, etc.)",
        })
      ),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!isRustDexAvailable()) {
        throw new Error("rustdex binary not found");
      }

      const args = ["routes", params.repo, "--json"];
      if (params.method) {
        args.push("--method", params.method.toUpperCase());
      }

      const result = runRustDex(args);

      if (!result.success) {
        throw new Error(`Route extraction failed: ${result.error}`);
      }

      const results = Array.isArray(result.output) ? result.output : [];

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No HTTP routes found in ${params.repo}${
                params.method ? ` for method ${params.method}` : ""
              }.`,
            },
          ],
          details: { routes: [], repo: params.repo },
        };
      }

      // Group by file for display
      const byFile: Record<string, any[]> = {};
      for (const r of results) {
        if (!byFile[r.file]) byFile[r.file] = [];
        byFile[r.file].push(r);
      }

      const formatted = Object.entries(byFile)
        .map(([file, routes]) => {
          const routeList = routes
            .map((r) => `  ${r.method} ${r.path} (line ${r.line})`)
            .join("\n");
          return `**${file}**:\n${routeList}`;
        })
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} HTTP route(s) in ${params.repo}:\n\n${formatted}`,
          },
        ],
        details: { routes: results, repo: params.repo },
      };
    },
  });

  // Register: rustdex_list_repos - List indexed repositories
  pi.registerTool({
    name: "rustdex_list_repos",
    label: "List Indexed Repos",
    description:
      "List all repositories that have been indexed by RustDex.",
    promptSnippet:
      "List repositories already indexed by RustDex so other RustDex tools can target them.",
    promptGuidelines: [
      "Use rustdex_list_repos when you need a repo name for another RustDex tool and the indexed repositories are unknown.",
      "Call rustdex_list_repos before rustdex_search, rustdex_semantic, or rustdex_routes if the repo parameter is ambiguous.",
    ],
    parameters: Type.Object({}),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!isRustDexAvailable()) {
        throw new Error("rustdex binary not found");
      }

      const result = runRustDex(["list-repos", "--json"]);

      if (!result.success) {
        throw new Error(`Failed to list repos: ${result.error}`);
      }

      const repos = Array.isArray(result.output) ? result.output : [];

      if (repos.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No indexed repositories found. Use rustdex_index to index a codebase.",
            },
          ],
          details: { repos: [] },
        };
      }

      const formatted = repos
        .map(
          (r: any, i: number) =>
            `${i + 1}. **${r.name}**\n   Path: ${r.path}\n   Indexed: ${r.indexed_at || "Unknown"}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `${repos.length} indexed repository(ies):\n\n${formatted}`,
          },
        ],
        details: { repos },
      };
    },
  });

  // Register: rustdex_read_symbol - Read symbol content by byte range
  pi.registerTool({
    name: "rustdex_read_symbol",
    label: "Read Symbol",
    description:
      "Read the actual source code of a symbol using its file path and byte range (from search results).",
    promptSnippet:
      "Read the exact source for a symbol using byte ranges returned by RustDex search results.",
    promptGuidelines: [
      "Use rustdex_read_symbol after rustdex_search or rustdex_semantic when you want the exact symbol body without reading the whole file.",
      "Prefer rustdex_read_symbol for token-efficient follow-up inspection of search results.",
      "Pass the file, start_byte, and end_byte fields returned by RustDex search results directly into rustdex_read_symbol.",
    ],
    parameters: Type.Object({
      file: Type.String({
        description: "Absolute path to the source file",
      }),
      start_byte: Type.Number({
        description: "Start byte offset",
      }),
      end_byte: Type.Number({
        description: "End byte offset",
      }),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const fs = await import("node:fs");

      if (!fs.existsSync(params.file)) {
        throw new Error(`File not found: ${params.file}`);
      }

      const content = fs.readFileSync(params.file, "utf-8");
      const slice = content.slice(params.start_byte, params.end_byte);

      // Get line numbers for context
      const linesBefore = content.slice(0, params.start_byte).split("\n");
      const startLine = linesBefore.length;

      return {
        content: [
          {
            type: "text",
            text: `**${params.file}:${startLine}**\n\n\`\`\`\n${slice}\n\`\`\``,
          },
        ],
        details: {
          file: params.file,
          start_byte: params.start_byte,
          end_byte: params.end_byte,
          start_line: startLine,
          content: slice,
        },
      };
    },
  });

  // Register command: /rustdex-status
  pi.registerCommand("rustdex-status", {
    description: "Check RustDex installation status",
    handler: async (args, ctx) => {
      if (isRustDexAvailable()) {
        const version = runRustDex(["--version"]);
        ctx.ui.notify(
          `RustDex is installed${
            version.success ? `: ${version.output}` : ""
          }`,
          "info"
        );
      } else {
        ctx.ui.notify(
          "RustDex not found. Install from https://github.com/burggraf/rustdex",
          "error"
        );
      }
    },
  });
}
