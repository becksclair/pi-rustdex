# Pi RustDex Extension

A Pi extension that integrates [RustDex](https://github.com/burggraf/rustdex) - a high-performance, universal code indexer and semantic search tool - directly into your Pi agent workflow.

**What does this do?** RustDex creates a searchable index of your codebase, allowing Pi to find functions, classes, and API endpoints using plain English queries like *"show me where we handle user authentication"* instead of guessing file names.

---

## Features

- **🚀 Index Codebases**: Create searchable indexes of your projects with a single command
- **🔍 Symbol Search**: Find functions, classes, and methods by exact name across repos
- **🧠 Semantic Search**: Search code by natural language descriptions using local BERT embeddings
- **🌐 API Route Extraction**: Automatically identify HTTP endpoints in web frameworks
- **📁 Repository Management**: List and manage all your indexed repositories
- **📖 Symbol Reading**: Read exact symbol source code using byte ranges (token-efficient)
- **🔧 Backward Compatible**: Automatically detects CLI version and adapts to available features

---

## Getting Started (Step by Step)

### What You Need

Pi-RustDex requires **two** components:

1. **The RustDex binary** - The Rust-based indexer that runs on your machine
2. **This Pi extension** - The bridge that lets Pi talk to RustDex

---

### Step 1: Install the RustDex Binary

**Recommended: Install via npm (automatic)**

The easiest way to install RustDex is via npm. When you install this Pi extension, RustDex will be automatically installed for you:

```bash
# Install this extension - RustDex will be installed automatically
pi install npm:pi-rustdex
```

**Or install RustDex manually via npm:**

```bash
npm install -g rustdex
```

The npm package automatically detects your platform and downloads the appropriate binary:
- macOS (ARM64/x64)
- Linux (ARM64/AMD64)
- Windows (ARM64/AMD64)

---

**Manual Installation (alternative)**

If you prefer to install RustDex manually, download a pre-built binary from the [RustDex Releases](https://github.com/burggraf/rustdex/releases) page. The latest release (v0.4.1) includes binaries for all platforms.

**macOS (Apple Silicon):**
```bash
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.4.1/rustdex-v0.4.1-darwin-arm64.zip
unzip rustdex.zip
chmod +x rustdex
sudo mv rustdex /usr/local/bin/
rm rustdex.zip
```

**Linux (x86_64):**
```bash
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.4.1/rustdex-v0.4.1-linux-amd64.zip
unzip rustdex.zip
chmod +x rustdex
sudo mv rustdex /usr/local/bin/
rm rustdex.zip
```

**Windows (x86_64):**
```powershell
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.4.1/rustdex-v0.4.1-windows-amd64.zip
Expand-Archive -Path rustdex.zip -DestinationPath .
Move-Item -Path .\rustdex.exe -Destination C:\Windows\System32\
Remove-Item rustdex.zip
```

**Verify installation:**
```bash
rustdex --version
# Should output: rustdex 0.4.1

rustdex --help
```

> **Don't see your platform?** Build from source: https://github.com/burggraf/rustdex#installation

---

### Step 2: Install the Pi Extension

Inside any Pi session, run:

```bash
pi install npm:pi-rustdex
```

Or add to your project's `pi.json`:

```json
{
  "extensions": ["npm:pi-rustdex"]
}
```

**Verify the extension is loaded:**

Type this in Pi:
```
/rustdex-status
```

You should see: "RustDex is installed