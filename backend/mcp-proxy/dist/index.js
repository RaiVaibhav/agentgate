#!/usr/bin/env node
/**
 * @agent-permission/mcp-proxy
 *
 * A transparent MCP proxy that sits between an AI agent and any MCP server.
 * It enforces permission rules defined in a local JSON config file before
 * forwarding tool calls to the real MCP server.
 *
 * Usage:
 *   node dist/index.js --config rules.json --target "npx @modelcontextprotocol/server-filesystem ."
 *
 * In mcp.json (Cursor / Kiro / Claude):
 *   {
 *     "command": "node",
 *     "args": ["/path/to/mcp-proxy/dist/index.js",
 *              "--config", "/path/to/rules.json",
 *              "--target", "npx @modelcontextprotocol/server-filesystem /your/project"]
 *   }
 *
 * Everything gets logged to ./agent-permissions.log (override with LOG_FILE env var).
 * No network calls. No database. No server required.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import readline from 'readline';
import { decide } from './engine.js';
import { log, getLogFile } from './logger.js';
// ── Args ──────────────────────────────────────────────────────────────────────
function parseArgs() {
    const args = process.argv.slice(2);
    const configIdx = args.indexOf('--config');
    const targetIdx = args.indexOf('--target');
    if (configIdx === -1 || targetIdx === -1) {
        process.stderr.write('Usage: mcp-proxy --config <rules.json> --target "<mcp server command>"\n\n' +
            'Example:\n' +
            '  mcp-proxy --config rules.json --target "npx @modelcontextprotocol/server-filesystem ."\n');
        process.exit(1);
    }
    return {
        configPath: args[configIdx + 1],
        targetCmd: args[targetIdx + 1],
    };
}
// ── Config ────────────────────────────────────────────────────────────────────
function loadConfig(configPath) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
}
function findMapping(config, toolName) {
    return config.toolMappings.find((m) => m.tool === toolName) ?? null;
}
function errorResponse(id, message) {
    const res = {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message },
    };
    return JSON.stringify(res);
}
function deniedResponse(id, toolName, reason) {
    const res = {
        jsonrpc: '2.0',
        id,
        result: {
            content: [
                {
                    type: 'text',
                    text: `🚫 Permission denied\n\nTool: ${toolName}\nReason: ${reason}\n\nThis attempt has been logged to agent-permissions.log`,
                },
            ],
            isError: true,
        },
    };
    return JSON.stringify(res);
}
// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    const { configPath, targetCmd } = parseArgs();
    const config = loadConfig(configPath);
    process.stderr.write(`[mcp-proxy] Starting\n` +
        `[mcp-proxy] Config:  ${configPath} (${config.rules.length} rules, ${config.toolMappings.length} tool mappings)\n` +
        `[mcp-proxy] Target:  ${targetCmd}\n` +
        `[mcp-proxy] Log:     ${getLogFile()}\n`);
    // Spawn the real MCP server as a child process
    const [cmd, ...cmdArgs] = targetCmd.split(' ');
    const target = spawn(cmd, cmdArgs, {
        stdio: ['pipe', 'pipe', 'inherit'], // pipe stdin/stdout, inherit stderr
    });
    target.on('error', (err) => {
        process.stderr.write(`[mcp-proxy] Failed to start target: ${err.message}\n`);
        process.exit(1);
    });
    target.on('exit', (code) => {
        process.stderr.write(`[mcp-proxy] Target exited with code ${code}\n`);
        process.exit(code ?? 0);
    });
    // ── AI → Proxy ──────────────────────────────────────────────────────────────
    // Read JSON-RPC messages from stdin (sent by the AI agent / Cursor)
    const fromAI = readline.createInterface({ input: process.stdin });
    fromAI.on('line', (line) => {
        if (!line.trim())
            return;
        let msg;
        try {
            msg = JSON.parse(line);
        }
        catch {
            // Unparseable — forward as-is
            target.stdin.write(line + '\n');
            return;
        }
        // Only intercept tool calls — pass everything else through unchanged
        if (msg.method !== 'tools/call') {
            target.stdin.write(line + '\n');
            return;
        }
        // Extract tool name and arguments
        const toolName = msg.params?.name ?? '';
        const toolArgs = msg.params?.arguments ?? {};
        const mapping = findMapping(config, toolName);
        if (!mapping) {
            // No mapping defined for this tool → deny by default
            const reason = `No permission mapping defined for tool "${toolName}" — denied by default`;
            log({
                timestamp: new Date().toISOString(),
                tool: toolName,
                resourcePath: JSON.stringify(toolArgs),
                action: 'unknown',
                effect: 'denied',
                reason,
                matchedRule: null,
            });
            process.stdout.write(deniedResponse(msg.id, toolName, reason) + '\n');
            return;
        }
        // Get the resource path from the tool arguments
        const resourcePath = String(toolArgs[mapping.pathArg] ?? '');
        // Run the decision engine (pure in-process, no network)
        const decision = decide(config.rules, resourcePath, mapping.action);
        log({
            timestamp: new Date().toISOString(),
            tool: toolName,
            resourcePath,
            action: mapping.action,
            effect: decision.effect,
            reason: decision.reason,
            matchedRule: decision.rule
                ? `${decision.rule.effect} "${decision.rule.pattern}" p=${decision.rule.priority}`
                : null,
        });
        if (decision.effect === 'denied') {
            process.stdout.write(deniedResponse(msg.id, toolName, decision.reason) + '\n');
            return;
        }
        // Allowed — forward the original message to the real MCP server
        target.stdin.write(line + '\n');
    });
    // ── Target → AI ─────────────────────────────────────────────────────────────
    // Pass responses from the real MCP server back to the AI unchanged
    const fromTarget = readline.createInterface({ input: target.stdout });
    fromTarget.on('line', (line) => {
        process.stdout.write(line + '\n');
    });
    // Handle clean shutdown
    process.on('SIGINT', () => target.kill('SIGINT'));
    process.on('SIGTERM', () => target.kill('SIGTERM'));
}
main().catch((err) => {
    process.stderr.write(`[mcp-proxy] Fatal: ${err.message}\n`);
    process.exit(1);
});
