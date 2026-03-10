# Pi RustDex API Reference

## Tools

### rustdex_index

Indexes a codebase for symbol search and semantic search.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_path` | string | Yes | Absolute path to the project directory |
| `name` | string | No | Name for the index (defaults to folder name) |

**Returns:**
```typescript
{
  content: [{ type: "text", text: string }],
  details: {
    // rustdex index output
  }
}
```

---

### rustdex_search

Search for functions, classes, or methods by exact name.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Symbol name to search for |
| `repo` | string | Yes | Repository name from rustdex_index |

**Returns:**
```typescript
{
  content: [{ type: "text", text: string }],
  details: {
    results: Array<{
      name: string;
      kind: string;
      file: string;
      line: number;
      start_byte: number;
      end_byte: number;
    }>,
    query: string,
    repo: string
  }
}
```

---

### rustdex_semantic

Search code by natural language description using BERT embeddings.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language query |
| `repo` | string | Yes | Repository name |
| `limit` | number | No | Maximum results (default: 10) |

**Returns:**
```typescript
{
  content: [{ type: "text", text: string }],
  details: {
    results: Array<{
      name: string;
      kind: string;
      file: string;
      line: number;
      start_byte: number;
      end_byte: number;
      score: number;  // Similarity score 0-1
    }>,
    query: string,
    repo: string
  }
}
```

---

### rustdex_routes

Extract HTTP routes from web frameworks.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo` | string | Yes | Repository name |
| `method` | string | No | Filter by HTTP method (GET, POST, PUT, DELETE) |

**Returns:**
```typescript
{
  content: [{ type: "text", text: string }],
  details: {
    routes: Array<{
      method: string;
      path: string;
      file: string;
      line: number;
      handler?: string;
    }>,
    repo: string
  }
}
```

---

### rustdex_list_repos

List all indexed repositories.

**Parameters:** None

**Returns:**
```typescript
{
  content: [{ type: "text", text: string }],
  details: {
    repos: Array<{
      name: string;
      path: string;
      indexed_at?: string;
    }>
  }
}
```

---

### rustdex_read_symbol

Read the actual source code of a symbol using its byte range.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | string | Yes | Absolute path to the source file |
| `start_byte` | number | Yes | Start byte offset |
| `end_byte` | number | Yes | End byte offset |

**Returns:**
```typescript
{
  content: [{ type: "text", text: string }],
  details: {
    file: string;
    start_byte: number;
    end_byte: number;
    start_line: number;
    content: string;  // The actual source code
  }
}
```

---

## Commands

### /rustdex-status

Check if RustDex is installed and available.

**Usage:**
```
/rustdex-status
```

**Output:** Shows a notification with RustDex installation status and version.
