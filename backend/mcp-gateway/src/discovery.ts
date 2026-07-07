import { spawn } from 'child_process';
import type { DiscoveredTool } from './db/schema.js';

// ── Remote URL-based discovery (HTTP+SSE transport) ───────────────────────────

export async function discoverToolsRemote(
  url: string,
  headers: Record<string, string> = {}
): Promise<DiscoveredTool[]> {
  // MCP over HTTP: POST tools/list to the remote server's endpoint
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    }),
  });

  if (!res.ok) {
    throw new Error(`Remote MCP server responded with ${res.status}: ${await res.text()}`);
  }

  const contentType = res.headers.get('content-type') ?? '';

  // Handle SSE response (some servers send tools/list response as SSE)
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const msg = JSON.parse(line.slice(6));
          if (msg.result?.tools) return msg.result.tools as DiscoveredTool[];
        } catch { /* keep scanning */ }
      }
    }
    throw new Error('Remote MCP server sent SSE but no tools/list result found');
  }

  // Handle JSON response
  const data = await res.json() as { result?: { tools?: DiscoveredTool[] }; error?: { message: string } };
  if (data.error) throw new Error(`MCP error: ${data.error.message}`);
  if (!data.result?.tools) throw new Error('Remote server returned no tools');
  return data.result.tools;
}

// ── Stdio-based discovery (spawn child process) ───────────────────────────────

export async function discoverToolsStdio(
  command: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<DiscoveredTool[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error('Discovery timed out after 30s — try pre-caching: npx -y <package>'));
    }, 30000);

    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
      // Try to parse as each new chunk arrives
      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          if (msg.id === 1 && msg.result?.tools) {
            clearTimeout(timeout);
            proc.kill();
            resolve(msg.result.tools as DiscoveredTool[]);
            return;
          }
        } catch { /* keep buffering */ }
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn: ${err.message}`));
    });

    proc.on('exit', () => {
      clearTimeout(timeout);
      reject(new Error(`Process exited before responding. stderr: ${stderr.slice(0, 500)}`));
    });

    // Send tools/list after short startup delay
    setTimeout(() => {
      try {
        proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) + '\n');
      } catch { /* process may have exited */ }
    }, 500);
  });
}

// ── Unified entrypoint ────────────────────────────────────────────────────────

export async function discoverTools(config: {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}): Promise<DiscoveredTool[]> {
  if (config.url) {
    return discoverToolsRemote(config.url, config.headers ?? {});
  }
  if (config.command) {
    return discoverToolsStdio(config.command, config.args ?? [], config.env ?? {});
  }
  throw new Error('Service config must have either "url" or "command"');
}
