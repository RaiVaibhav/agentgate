import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { scanRepository } from "../compiler/ast-scanner";
import { extractContract } from "../compiler/extract";
import type { AgentGateContract } from "../schema/contract";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  AgentGate Compiler Extraction Evaluation (5 Metrics)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const repoPath = path.resolve(__dirname, "../benchmarks/repo-ecommerce");
  const groundTruthPath = path.join(repoPath, "ground-truth.json");

  if (!fs.existsSync(groundTruthPath)) {
    console.error("Ground truth file not found:", groundTruthPath);
    process.exit(1);
  }

  const groundTruth: AgentGateContract = JSON.parse(fs.readFileSync(groundTruthPath, "utf8"));

  console.log("Scanning repository at:", repoPath);
  const scan = scanRepository(repoPath);

  console.log("Compiling rules into declarative contract...");
  const compiled = await extractContract(scan);

  // ───────────────────────────────────────────────────────────
  // Metric 1: Recall (Planted Rules Found) - 7 active rules
  // ───────────────────────────────────────────────────────────
  const issueRefund = compiled.tools["issue_refund"];
  const hasOwnership = !!issueRefund?.ownership;
  const hasDelivered = issueRefund?.preconditions.some((p) => p.field === "status" && p.value === "DELIVERED");
  const hasWindow = issueRefund?.preconditions.some((p) => p.field === "daysSinceDelivery" && p.value === 14);
  const hasAmount = issueRefund?.preconditions.some((p) => p.argField === "amount_cents" && p.targetField === "totalPaid_cents");
  const hasDamage = issueRefund?.preconditions.some((p) => p.lookupTool === "verify_damage_report");
  const hasMutualExclusion = !!issueRefund?.mutualExclusion;
  const hasBudget = !!issueRefund?.budget;

  const foundRules = [hasOwnership, hasDelivered, hasWindow, hasAmount, hasDamage, hasMutualExclusion, hasBudget].filter(Boolean).length;
  const metric1Passed = foundRules === 7;

  // ───────────────────────────────────────────────────────────
  // Metric 2: Unit Normalization ($50 -> 5000, $100 -> 10000)
  // ───────────────────────────────────────────────────────────
  const threshVal = issueRefund?.thresholds?.[0]?.value;
  const budgetVal = issueRefund?.budget?.maxTotal;
  const metric2Passed = threshVal === 5000 && budgetVal === 10000;

  // ───────────────────────────────────────────────────────────
  // Metric 3: Verdict Mapping (Threshold is ESCALATE, others BLOCK)
  // ───────────────────────────────────────────────────────────
  const threshVerdict = issueRefund?.thresholds?.[0]?.onViolation;
  const preVerdicts = issueRefund?.preconditions.map((p) => p.onViolation) ?? [];
  const allPreBlock = preVerdicts.length > 0 && preVerdicts.every((v) => v === "BLOCK");
  const metric3Passed = threshVerdict === "ESCALATE" && allPreBlock;

  // ───────────────────────────────────────────────────────────
  // Metric 4: Decoy Rejection (Precision)
  // ────────────────────────────────----------------───────────
  // Ensure commented out rule 50000 and conversational tone ("apologize") were NOT emitted
  const has50000Decoy = JSON.stringify(compiled).includes("50000");
  const hasPolitenessDecoy = JSON.stringify(compiled).toLowerCase().includes("apologize");
  const metric4Passed = !has50000Decoy && !hasPolitenessDecoy;

  // ───────────────────────────────────────────────────────────
  // Metric 5: Unmappable Rule Flagging (VIP-tier rule in unmappableRules)
  // ───────────────────────────────────────────────────────────
  const hasVipUnmappable = compiled.unmappableRules.some((u) => u.rawText.includes("VIP-tier") || u.reason.includes("isVip") || u.reason.includes("tier"));
  const metric5Passed = hasVipUnmappable;

  console.log("\n───────────────────────────────────────────────────────────");
  console.log("  5-Metric Compiler Scorecard Results:");
  console.log("───────────────────────────────────────────────────────────");

  console.log(`${metric1Passed ? "✅ PASS" : "❌ FAIL"} | Metric 1: Recall (Planted Rules Found)`);
  console.log(`        Expected: 7/7 planted rules (ownership, DELIVERED, window<=14, amount<=total, damage, anti-stacking, budget)`);
  console.log(`        Actual:   ${foundRules}/7 planted rules extracted\n`);

  console.log(`${metric2Passed ? "✅ PASS" : "❌ FAIL"} | Metric 2: Unit Normalization Accuracy`);
  console.log(`        Expected: $50 -> 5000 cents, $100 -> 10000 cents`);
  console.log(`        Actual:   threshold=${threshVal}, budget=${budgetVal}\n`);

  console.log(`${metric3Passed ? "✅ PASS" : "❌ FAIL"} | Metric 3: Verdict Mapping Accuracy`);
  console.log(`        Expected: Preconditions -> BLOCK, High-value threshold -> ESCALATE`);
  console.log(`        Actual:   Preconditions=${allPreBlock ? "BLOCK" : "MIXED"}, Threshold=${threshVerdict}\n`);

  console.log(`${metric4Passed ? "✅ PASS" : "❌ FAIL"} | Metric 4: Decoy Rejection (Precision)`);
  console.log(`        Expected: Commented-out 50000 decoy & conversational fluff rejected`);
  console.log(`        Actual:   has50000Decoy=${has50000Decoy}, hasFluffDecoy=${hasPolitenessDecoy}\n`);

  console.log(`${metric5Passed ? "✅ PASS" : "❌ FAIL"} | Metric 5: Unmappable Rule Flagging`);
  console.log(`        Expected: VIP-tier prompt rule categorized into unmappableRules[]`);
  console.log(`        Actual:   unmappableRules count=${compiled.unmappableRules.length}\n`);

  const allPassed = metric1Passed && metric2Passed && metric3Passed && metric4Passed && metric5Passed;

  if (allPassed) {
    console.log("🎉 ALL 5 COMPILER BENCHMARK METRICS PASSED (100% Score)!\n");
    process.exit(0);
  } else {
    console.error("❌ ONE OR MORE COMPILER METRICS FAILED.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
