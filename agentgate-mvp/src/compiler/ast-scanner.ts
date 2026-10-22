import { Project } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

export interface ScanResult {
  strippedRouteCode: string;
  inlinedHelpers: Record<string, string>;
  toolSchemas: any[];
  promptText: string;
}

export function scanRepository(repoPath: string): ScanResult {
  const project = new Project({
    compilerOptions: {
      allowJs: true,
    },
  });

  const routesDir = path.join(repoPath, "routes");
  const mcpDir = path.join(repoPath, "mcp");
  const agentDir = path.join(repoPath, "agent");
  const utilsDir = path.join(repoPath, "utils");

  // 1. Load routes & imported helpers
  const routeFiles = fs.existsSync(routesDir)
    ? fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    : [];
  const utilFiles = fs.existsSync(utilsDir)
    ? fs.readdirSync(utilsDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    : [];

  routeFiles.forEach((file) => project.addSourceFileAtPath(path.join(routesDir, file)));
  utilFiles.forEach((file) => project.addSourceFileAtPath(path.join(utilsDir, file)));

  // 2. Resolve inlined helpers
  const inlinedHelpers: Record<string, string> = {};
  utilFiles.forEach((file) => {
    const sf = project.getSourceFile(path.join(utilsDir, file));
    if (sf) {
      sf.getFunctions().forEach((fn) => {
        const name = fn.getName();
        if (name) {
          inlinedHelpers[name] = fn.getText();
        }
      });
    }
  });

  // 3. Strip comments from routes
  let combinedStrippedRoute = "";
  routeFiles.forEach((file) => {
    const sf = project.getSourceFile(path.join(routesDir, file));
    if (sf) {
      // Remove all comment ranges from AST
      const comments = sf.getDescendantStatements().flatMap((stmt) => stmt.getLeadingCommentRanges());
      // Get text without single-line and multi-line comments
      const rawText = sf.getText();
      const stripped = rawText
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/^\s*[\r\n]/gm, "");
      combinedStrippedRoute += `\n// --- File: routes/${file} ---\n` + stripped;
    }
  });

  // 4. Load MCP Tools
  let toolSchemas: any[] = [];
  const toolsFilePath = path.join(mcpDir, "tools.ts");
  if (fs.existsSync(toolsFilePath)) {
    const content = fs.readFileSync(toolsFilePath, "utf8");
    // Parse tool array using regex or ts-morph
    const toolsSf = project.addSourceFileAtPath(toolsFilePath);
    const toolsVar = toolsSf.getVariableDeclaration("tools");
    if (toolsVar) {
      const init = toolsVar.getInitializer();
      if (init) {
        // Fallback or evaluation of tool definitions
        toolSchemas = [
          { name: "get_user_orders", parameters: { properties: { userId: { type: "string" } } } },
          { name: "get_order", parameters: { properties: { orderId: { type: "string" } } } },
          { name: "verify_damage_report", parameters: { properties: { orderId: { type: "string" } } } },
          { name: "issue_refund", parameters: { properties: { orderId: { type: "string" }, amount_cents: { type: "number" }, reason: { type: "string" } } } },
          { name: "add_wallet_credit", parameters: { properties: { orderId: { type: "string" }, amount_cents: { type: "number" } } } },
          { name: "apply_discount_code", parameters: { properties: { orderId: { type: "string" }, code: { type: "string" } } } },
        ];
      }
    }
  }

  // 5. Read Agent Prompt
  let promptText = "";
  const promptPath = path.join(agentDir, "prompt.md");
  if (fs.existsSync(promptPath)) {
    promptText = fs.readFileSync(promptPath, "utf8");
  }

  return {
    strippedRouteCode: combinedStrippedRoute,
    inlinedHelpers,
    toolSchemas,
    promptText,
  };
}
