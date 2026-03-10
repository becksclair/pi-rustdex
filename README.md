# Pi RustDex Extension

A Pi extension that integrates [RustDex](https://github.com/burggraf/rustdex) - a high-performance, universal code indexer and semantic search tool - directly into your Pi agent workflow.

## Features

- **🚀 Index Codebases**: Create searchable indexes of your projects with a single command
- **🔍 Symbol Search**: Find functions, classes, and methods by exact name across repos
- **🧠 Semantic Search**: Search code by natural language descriptions using local BERT embeddings
- **🌐 API Route Extraction**: Automatically identify HTTP endpoints in web frameworks
- **📁 Repository Management**: List and manage all your indexed repositories
- **📖 Symbol Reading**: Read exact symbol source code using byte ranges (token-efficient)

## Prerequisites

Before using this extension, you need to install RustDex:

```bash
# Clone and build from source
git clone https://github.com/burggraf/rustdex.git
cd rustdex
cargo build --release

# Move to PATH
cp target/release/rustdex /usr/local/bin/
```

## Installation

Install the extension using Pi's package manager:

```bash
pi install npm:pi-rustdex
```

Or add to your project's `pi.json`:

```json
{
  "extensions": ["npm:pi-rustdex"]
}
```

## Available Tools

### `rustdex_index`
Index a codebase for searching.

**Parameters:**
- `project_path` (string, required): Absolute path to the project directory
- `name` (string, optional): Name for the index (defaults to folder name)

**Example:**
```typescript
{
  "project_path": "/home/user/my-project",
  "name": "my-project"
}
```

### `rustdex_search`
Search for symbols by exact name.

**Parameters:**
- `query` (string, required): Symbol name to search for
- `repo` (string, required): Repository name from rustdex_index

**Example:**
```typescript
{
  "query": "validate_user",
  "repo": "my-project"
}
```

### `rustdex_semantic`
Search code by natural language description.

**Parameters:**
- `query` (string, required): Natural language query
- `repo` (string, required): Repository name
- `limit` (number, optional): Maximum results (default: 10)

**Example:**
```typescript
{
  "query": "how do we handle password hashing",
  "repo": "my-project",
  "limit": 5
}
```

### `rustdex_routes`
Extract HTTP routes from web frameworks.

**Parameters:**
- `repo` (string, required): Repository name
- `method` (string, optional): Filter by HTTP method (GET, POST, PUT, DELETE, etc.)

**Example:**
```typescript
{
  "repo": "my-project",
  "method": "POST"
}
```

### `rustdex_list_repos`
List all indexed repositories.

**Parameters:** None

### `rustdex_read_symbol`
Read the source code of a symbol using its byte range (from search results).

**Parameters:**
- `file` (string, required): Absolute path to the source file
- `start_byte` (number, required): Start byte offset
- `end_byte` (number, required): End byte offset

**Example:**
```typescript
{
  "file": "/home/user/my-project/src/auth.ts",
  "start_byte": 1234,
  "end_byte": 1567
}
```

## Available Commands

### `/rustdex-status`
Check if RustDex is installed and available.

## Usage Examples

### Index a Project
```
Please index my project at /home/user/webapp
```

### Search for a Function
```
Find the validateToken function in webapp
```

### Semantic Search
```
Search for "user authentication logic" in webapp
```

### Read Symbol Source
```
Show me the source code of the validateToken function from the last search result
```

## Supported Languages

RustDex supports a wide range of programming languages:
- **Rust**, **Python**, **JavaScript**, **TypeScript (TSX)**
- **Go**, **Java**, **PHP**, **C**, **C++**
- **Elixir**, **Ruby**, **Vue**

## Storage Location

All data is stored in `~/.rustdex/`:
- `registry.db`: Tracks all projects and their paths
- `<repo_name>.db`: Contains the actual index for each project

## Why Use RustDex with Pi?

- **100% Local**: All embeddings and indexes run locally - no API keys required
- **Token Efficient**: Instead of reading entire files, get exact byte ranges for symbols
- **Fast**: High-performance Rust implementation with Tree-sitter parsing
- **Semantic Understanding**: Find code by what it does, not just what it's called

## License

MIT

## Repository

https://github.com/burggraf/pi-rustdex
