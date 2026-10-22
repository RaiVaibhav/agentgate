#!/usr/bin/env node

import path from 'path';
import { compileContract } from './compiler';

function printHelp() {
  console.log(`
AgentGate Contract Compiler v2.0
Usage: npx agentgate compile [options]

Options:
  --routes <path>    Path to backend routes directory or file (default: routes)
  --tools <path>     Path to MCP tools definition file (default: tools.ts)
  --prompt <path>    Path to agent system prompt file (default: prompt.md)
  --out <path>       Output JSON file path (default: agentgate.contract.json)
  --help             Show this help message
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      result[key] = val;
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const routesPath = args.routes || path.resolve(process.cwd(), 'routes');
  const toolsPath = args.tools || path.resolve(process.cwd(), 'mcp/tools.ts');
  const promptPath = args.prompt || path.resolve(process.cwd(), 'agent/prompt.md');
  const outputPath = args.out || path.resolve(process.cwd(), 'agentgate.contract.json');

  console.log(`🛡️  Compiling AgentGate Contract...`);
  console.log(`   Routes: ${routesPath}`);
  console.log(`   Tools:  ${toolsPath}`);
  console.log(`   Prompt: ${promptPath}`);

  try {
    const contract = compileContract({
      routesPath,
      toolsPath,
      promptPath,
      outputPath,
    });

    console.log(`✅ Successfully compiled declarative contract to: ${outputPath}`);
    console.log(`   Tools mapped: ${Object.keys(contract.tools).join(', ')}`);
    if (contract.unmappableRules && contract.unmappableRules.length > 0) {
      console.log(`   ⚠️  Unmappable rules flagged: ${contract.unmappableRules.length}`);
    }
  } catch (err) {
    console.error(`❌ Compilation failed:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
