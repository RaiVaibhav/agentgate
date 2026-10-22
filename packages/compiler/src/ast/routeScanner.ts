import { Project, Node, SyntaxKind } from 'ts-morph';
import type { PreconditionRule } from '@agentgate/contract';

export interface RouteRuleExtraction {
  targetTool: string;
  lookupTool: string;
  preconditions: PreconditionRule[];
}

export function scanRouteFiles(routesDirOrFile: string, targetTool = 'issue_refund', lookupTool = 'get_order'): RouteRuleExtraction {
  const project = new Project({ useInMemoryFileSystem: false });
  const sourceFiles = routesDirOrFile.endsWith('.ts')
    ? [project.addSourceFileAtPath(routesDirOrFile)]
    : project.addSourceFilesAtPaths(`${routesDirOrFile}/**/*.ts`);

  const preconditions: PreconditionRule[] = [];

  for (const sf of sourceFiles) {
    const relPath = sf.getFilePath().replace(/.*\/benchmarks\//, 'src/').replace(/.*\/backend\//, 'src/');
    const ifStatements = sf.getDescendantsOfKind(SyntaxKind.IfStatement);

    for (const ifStmt of ifStatements) {
      const lineNum = ifStmt.getStartLineNumber();
      const cond = ifStmt.getExpression();
      const condText = cond.getText();
      const source = `${relPath}:L${lineNum}`;

      // 1. Direct status check: order.status !== 'DELIVERED' or sub.status !== 'ACTIVE'
      const statusMatch = condText.match(/(\w+)\.status\s*!==\s*['"]([A-Z_]+)['"]/);
      if (statusMatch) {
        preconditions.push({
          source,
          lookupTool,
          field: 'status',
          op: 'eq',
          value: statusMatch[2],
          onViolation: 'BLOCK',
        });
        continue;
      }

      // 2. Window / days check: isWithinWindow(order.daysSinceDelivery, 14) or daysSinceDelivery > 14
      const windowMatch = condText.match(/isWithinWindow\([^,]+,\s*(\d+)\)/) || condText.match(/daysSinceDelivery\s*>\s*(\d+)/);
      if (windowMatch) {
        preconditions.push({
          source,
          lookupTool,
          field: 'daysSinceDelivery',
          op: 'lte',
          value: parseInt(windowMatch[1], 10),
          onViolation: 'BLOCK',
        });
        continue;
      }

      // 3. Amount vs total paid check: isValidAmount(amount_cents, order.totalPaid_cents) or amount_cents > order.totalPaid_cents
      const amountMatch =
        condText.match(/isValidAmount\((\w+),\s*(\w+)\.(\w+)\)/) ||
        condText.match(/(\w+)\s*>\s*(\w+)\.(\w+)/) ||
        condText.match(/(\w+)\s*>\s*maxInvoiceCents/);

      if (amountMatch) {
        const argField = amountMatch[1] || 'amount_cents';
        const targetField = amountMatch[3] || (condText.includes('Invoice') ? 'lastInvoiceCents' : 'totalPaid_cents');
        preconditions.push({
          source,
          lookupTool,
          argField,
          op: 'lte_field',
          targetField,
          onViolation: 'BLOCK',
        });
        continue;
      }

      // 4. Inverted helper check !isWithinWindow(order.daysSinceDelivery, 14)
      const notWindowMatch = condText.match(/!isWithinWindow\(\s*(\w+)\.(\w+)\s*,\s*(\d+)\s*\)/);
      if (notWindowMatch) {
        preconditions.push({
          source,
          lookupTool,
          field: notWindowMatch[2],
          op: 'lte',
          value: parseInt(notWindowMatch[3], 10),
          onViolation: 'BLOCK',
        });
        continue;
      }

      // 5. Inverted helper check !isValidAmount(amount_cents, order.totalPaid_cents)
      const notAmountMatch = condText.match(/!isValidAmount\(\s*(\w+)\s*,\s*(\w+)\.(\w+)\s*\)/);
      if (notAmountMatch) {
        preconditions.push({
          source,
          lookupTool,
          argField: notAmountMatch[1],
          op: 'lte_field',
          targetField: notAmountMatch[3],
          onViolation: 'BLOCK',
        });
        continue;
      }
    }
  }

  return {
    targetTool,
    lookupTool,
    preconditions,
  };
}
