import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { compileContract } from '@/packages/compiler/src/compiler';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repo = searchParams.get('repo') || 'ecommerce';

  try {
    const baseDir = process.cwd();
    let routesPath: string;
    let toolsPath: string;
    let promptPath: string;
    let targetTool: string;
    let lookupTool: string;

    if (repo === 'mvp') {
      const gtPath = path.join(baseDir, 'agentgate-mvp/src/benchmarks/repo-ecommerce/ground-truth.json');
      const contract = JSON.parse(await import('fs').then(fs => fs.promises.readFile(gtPath, 'utf8')));
      return NextResponse.json({
        success: true,
        repo: 'mvp',
        targetTool: 'issue_refund',
        contract,
      });
    }

    if (repo === 'saas') {
      const saasDir = path.join(baseDir, 'benchmarks/repo-saas-billing');
      routesPath = path.join(saasDir, 'routes/billing.ts');
      toolsPath = path.join(saasDir, 'mcp/tools.ts');
      promptPath = path.join(saasDir, 'agent/prompt.md');
      targetTool = 'issue_invoice_credit';
      lookupTool = 'get_subscription';
    } else {
      const ecomDir = path.join(baseDir, 'benchmarks/repo-ecommerce');
      routesPath = path.join(ecomDir, 'routes/refunds.ts');
      toolsPath = path.join(ecomDir, 'mcp/tools.ts');
      promptPath = path.join(ecomDir, 'agent/prompt.md');
      targetTool = 'issue_refund';
      lookupTool = 'get_order';
    }

    const contract = compileContract({
      routesPath,
      toolsPath,
      promptPath,
      targetTool,
      lookupTool,
    });

    return NextResponse.json({
      success: true,
      repo,
      targetTool,
      contract,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Compilation failed',
      },
      { status: 500 }
    );
  }
}
