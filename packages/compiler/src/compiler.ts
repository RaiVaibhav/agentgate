import fs from 'fs';
import path from 'path';
import { scanToolsFile } from './ast/toolScanner';
import { scanRouteFiles } from './ast/routeScanner';
import { scanPromptFile } from './prompt/promptScanner';
import { AgentGateContractSchema, type AgentGateContract } from '@agentgate/contract';

export interface CompileOptions {
  routesPath: string;
  toolsPath: string;
  promptPath: string;
  targetTool?: string;
  lookupTool?: string;
  outputPath?: string;
}

export function compileContract(options: CompileOptions): AgentGateContract {
  const targetTool = options.targetTool || (options.routesPath.includes('billing') ? 'issue_invoice_credit' : 'issue_refund');
  const lookupTool = options.lookupTool || (options.routesPath.includes('billing') ? 'get_subscription' : 'get_order');

  // 1. Scan MCP Tools
  const toolsMeta = scanToolsFile(options.toolsPath);

  // 2. Scan Route AST
  const routeExtraction = scanRouteFiles(options.routesPath, targetTool, lookupTool);

  // 3. Scan System Prompt
  const promptExtraction = scanPromptFile(options.promptPath, toolsMeta);

  // 4. Assemble Declarative Contract
  const rawContract = {
    version: '2.0',
    tools: {
      [targetTool]: {
        ownership: promptExtraction.ownership,
        preconditions: [
          ...routeExtraction.preconditions,
          ...promptExtraction.promptPreconditions,
        ],
        thresholds: promptExtraction.thresholds,
        mutualExclusion: promptExtraction.mutualExclusion,
        budget: promptExtraction.budget,
      },
    },
    unmappableRules: promptExtraction.unmappableRules,
  };

  // 5. Validate with Zod Schema
  const parseResult = AgentGateContractSchema.safeParse(rawContract);
  if (!parseResult.success) {
    throw new Error(`Contract validation failed: ${parseResult.error.message}`);
  }

  const contract = parseResult.data;

  // 6. Optionally write to output file
  if (options.outputPath) {
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(options.outputPath, JSON.stringify(contract, null, 2), 'utf8');
  }

  return contract;
}
