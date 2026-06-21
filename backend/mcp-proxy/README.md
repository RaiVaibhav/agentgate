# @agent-permission/mcp-proxy

A transparent MCP proxy that enforces permission rules on any MCP server.
Zero dependencies on any server, database, or network call.

## How it works

```
Cursor / Claude / Kiro
        │
        ▼
  mcp-proxy (this)       ← reads rules.json, decides allow/deny in-process
        │
        ▼ (only if allowed)
  real MCP server        ← filesystem, GitHub, Postgres, anything
        │
        ▼
  actual resource
```

Every decision is appended to `agent-permissions.log` in your project root.

---

## Setup (3 steps)

### 1. Copy and edit the rules file

```bash
cp backend/mcp-proxy/rules.example.json rules.json
# Edit rules.json to match your project
```

### 2. Build

```bash
pnpm proxy-wrap:build
```

### 3. Point your AI tool at it

In `.kiro/settings/mcp.json` (or Cursor's mcp.json):

```json
{
  "mcpServers": {
    "filesystem-guarded": {
      "command": "node",
      "args": [
        "/Users/vaibhav/saas-starter/backend/mcp-proxy/dist/index.js",
        "--config", "/Users/vaibhav/saas-starter/rules.json",
        "--target", "npx -y @modelcontextprotocol/server-filesystem /Users/vaibhav/saas-starter"
      ]
    }
  }
}
```

Restart your AI tool. Done.

---

## Verifying it works

Ask your AI: `"read the file .env"`
→ Response: `🚫 Permission denied — Matched deny rule: "**/.env*"`
→ Log entry appended to `agent-permissions.log`

Ask your AI: `"read the file src/index.ts"`
→ Response: file contents
→ Log entry: allowed

Tail the log in real time:
```bash
tail -f agent-permissions.log | jq
```

---

## rules.json format

```json
{
  "toolMappings": [
    {
      "tool": "read_file",       // MCP tool name
      "pathArg": "path",         // which argument holds the file path
      "resourceType": "file",
      "action": "read"
    }
  ],
  "rules": [
    {
      "resourceType": "file",
      "pattern": "**/.env*",     // glob pattern (supports ** and ?)
      "action": "any",           // "read" | "write" | "delete" | "any"
      "effect": "deny",          // "allow" | "deny"
      "priority": 100,           // higher = evaluated first
      "comment": "optional note"
    }
  ]
}
```

**Rule evaluation:**
- Rules sorted by priority descending — highest evaluated first
- First matching rule wins
- No match → **denied by default** (fail-closed)
- Tools with no mapping in `toolMappings` → denied by default

---

## Supported MCP servers (out of the box mappings)

The example config includes mappings for `@modelcontextprotocol/server-filesystem`:
- `read_file`, `write_file`, `create_file`, `edit_file`
- `delete_file`, `list_directory`, `directory_tree`
- `search_files`, `get_file_info`, `move_file`

To add support for another MCP server, add entries to `toolMappings`.

---

## Log format

Each line in `agent-permissions.log` is a JSON object:

```json
{
  "timestamp": "2026-06-20T12:34:56.789Z",
  "tool": "read_file",
  "resourcePath": "/project/.env",
  "action": "read",
  "effect": "denied",
  "reason": "Matched deny rule (priority 100): \"**/.env*\"",
  "matchedRule": "deny \"**/.env*\" p=100"
}
```
