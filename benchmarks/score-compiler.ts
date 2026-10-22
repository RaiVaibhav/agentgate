import path from 'path';
import { compileContract } from '../packages/compiler/src/compiler';

interface MetricResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

async function runCompilerBenchmark() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  AgentGate Compiler Extraction Benchmark (5 Metrics)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const ecommerceDir = path.resolve(__dirname, 'repo-ecommerce');
  const saasDir = path.resolve(__dirname, 'repo-saas-billing');

  // 1. Compile E-Commerce Repo
  console.log('📦 Compiling benchmark: repo-ecommerce...');
  const ecomContract = compileContract({
    routesPath: path.join(ecommerceDir, 'routes/refunds.ts'),
    toolsPath: path.join(ecommerceDir, 'mcp/tools.ts'),
    promptPath: path.join(ecommerceDir, 'agent/prompt.md'),
    targetTool: 'issue_refund',
    lookupTool: 'get_order',
  });

  // 2. Compile SaaS Billing Repo
  console.log('📦 Compiling benchmark: repo-saas-billing...');
  const saasContract = compileContract({
    routesPath: path.join(saasDir, 'routes/billing.ts'),
    toolsPath: path.join(saasDir, 'mcp/tools.ts'),
    promptPath: path.join(saasDir, 'agent/prompt.md'),
    targetTool: 'issue_invoice_credit',
    lookupTool: 'get_subscription',
  });

  const results: MetricResult[] = [];

  // ── Metric 1: Recall (True Positives) ──────────────────────────────
  const ecomPreconds = ecomContract.tools['issue_refund']?.preconditions || [];
  const hasStatusRule = ecomPreconds.some((p) => p.field === 'status' && p.value === 'DELIVERED');
  const hasWindowRule = ecomPreconds.some((p) => p.field === 'daysSinceDelivery' && p.value === 14);
  const hasAmountRule = ecomPreconds.some((p) => p.targetField === 'totalPaid_cents');
  const hasDamageRule = ecomPreconds.some((p) => p.requirePriorTool === 'verify_damage_report');
  const hasMutualExclusion = !!ecomContract.tools['issue_refund']?.mutualExclusion;
  const hasBudget = !!ecomContract.tools['issue_refund']?.budget;

  const allEcomRecall = hasStatusRule && hasWindowRule && hasAmountRule && hasDamageRule && hasMutualExclusion && hasBudget;
  results.push({
    name: 'Metric 1 — Recall (True Positives across routes & prompt)',
    passed: allEcomRecall,
    expected: '6/6 planted rules found (status, window, amount, damage, exclusion, budget)',
    actual: `${[hasStatusRule, hasWindowRule, hasAmountRule, hasDamageRule, hasMutualExclusion, hasBudget].filter(Boolean).length}/6 rules extracted`,
  });

  // ── Metric 2: Unit Normalization ──────────────────────────────────
  const ecomThreshold = ecomContract.tools['issue_refund']?.thresholds?.[0]?.value;
  const ecomBudget = ecomContract.tools['issue_refund']?.budget?.maxTotal;
  const saasThreshold = saasContract.tools['issue_invoice_credit']?.thresholds?.[0]?.value;
  const saasBudget = saasContract.tools['issue_invoice_credit']?.budget?.maxTotal;

  const unitNormPassed = ecomThreshold === 5000 && ecomBudget === 10000 && saasThreshold === 25000 && saasBudget === 50000;
  results.push({
    name: 'Metric 2 — Unit Normalization ($50->$100->cents)',
    passed: unitNormPassed,
    expected: '$50->5000 cents, $100->10000 cents, $250->25000 cents, $500->50000 cents',
    actual: `ecomThreshold=${ecomThreshold}, ecomBudget=${ecomBudget}, saasThreshold=${saasThreshold}, saasBudget=${saasBudget}`,
  });

  // ── Metric 3: Verdict Mapping ─────────────────────────────────────
  const thresholdAction = ecomContract.tools['issue_refund']?.thresholds?.[0]?.onViolation;
  const precondActions = ecomPreconds.every((p) => p.onViolation === 'BLOCK');
  const verdictPassed = thresholdAction === 'ESCALATE' && precondActions;

  results.push({
    name: 'Metric 3 — Verdict Mapping (BLOCK vs ESCALATE)',
    passed: verdictPassed,
    expected: 'Preconditions -> BLOCK, Manager escalation threshold -> ESCALATE',
    actual: `Preconditions: BLOCK, Threshold: ${thresholdAction}`,
  });

  // ── Metric 4: Precision (Decoy Rejection) ─────────────────────────
  const hasDecoyRule = ecomPreconds.some((p) => (p.field && p.field.includes('isGift')) || JSON.stringify(p).includes('isGift'));
  const hasFluffRule = JSON.stringify(ecomContract).includes('empathetic') || JSON.stringify(ecomContract).includes('greetings');
  const decoyRejected = !hasDecoyRule && !hasFluffRule;

  results.push({
    name: 'Metric 4 — Precision (Decoy Rejection of commented code & fluff)',
    passed: decoyRejected,
    expected: 'Ignore commented-out "// if (order.isGift)" and conversational fluff',
    actual: decoyRejected ? 'Decoys cleanly ignored by AST parser' : 'Failed to reject decoy',
  });

  // ── Metric 5: Unmappable Honesty ──────────────────────────────────
  const ecomUnmappable = ecomContract.unmappableRules || [];
  const foundVipUnmappable = ecomUnmappable.some((u) => u.rawText.includes('VIP') && u.reason.includes('tier'));
  const saasUnmappable = saasContract.unmappableRules || [];
  const foundSlaUnmappable = saasUnmappable.some((u) => u.rawText.includes('Enterprise SLA'));

  const honestyPassed = foundVipUnmappable && foundSlaUnmappable;
  results.push({
    name: 'Metric 5 — Unmappable Honesty (VIP tier into unmappableRules[])',
    passed: honestyPassed,
    expected: 'Flag "VIP tier" & "Enterprise SLA" in unmappableRules[] rather than inventing fake fields',
    actual: `ecom=${ecomUnmappable.length} unmappable, saas=${saasUnmappable.length} unmappable`,
  });

  // ── Print Scorecard ──────────────────────────────────────────────
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  5-Metric Compiler Scorecard Results:');
  console.log('───────────────────────────────────────────────────────────');

  let allPassed = true;
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    if (!r.passed) allPassed = false;
    console.log(`${symbol} | ${r.name}`);
    console.log(`        Expected: ${r.expected}`);
    console.log(`        Actual:   ${r.actual}\n`);
  }

  if (allPassed) {
    console.log('🎉 ALL 5 COMPILER BENCHMARK METRICS PASSED (100% Score)!\n');
  } else {
    console.error('⚠️ Some benchmark metrics failed.\n');
    process.exit(1);
  }
}

runCompilerBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
