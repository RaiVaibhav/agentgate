# AgentGate: Master Architecture & MVP Build Specification

**AgentGate** is a zero-config guardrail compiler and stateful runtime firewall that prevents AI agents from executing unauthorized financial or operational transactions across multi-turn conversations. Because traditional backend APIs are stateless (validating one request at a time) while AI agents are stateful across turns, an agent can be sweet-talked or prompt-injected into stacking refunds and credits, skipping verification steps, or exceeding customer limits while every individual backend endpoint returns `200 OK`. AgentGate scans a startup's existing backend routes, tool schemas, and system prompts at compile time to generate a **Declarative Stateful Contract**, and enforces it at runtime in under a millisecond with zero extra LLM calls.

---

## 1. Core Positioning (For Investors & Customers)

* **What we do NOT pitch:** "We prevent prompt injection." (Probabilistic text filters are crowded and bypassable when a normal user simply sweet-talks or argues with a support agent).
* **What we DO pitch:** **"Transactional Safety for AI Agents."** We assume the LLM *will* get confused, sweet-talked, or manipulated—and we make it deterministically impossible for the agent to violate business logic when it does.
* **Initial Target Customer (ICP):** Engineering teams building **transactional, external-facing agents** (e-commerce support, fintech/billing operations, travel rebooking, B2B subscription management) using MCP (`@modelcontextprotocol/sdk`), OpenAI Agents SDK (`toolGuardrails`), Vercel AI SDK, or LangGraph.

---

## 2. System Architecture: The Two Halves

AgentGate combines two components that fail when built in isolation:

| Component | When It Runs | What It Does |
| --- | --- | --- |
| **1. The Contract Compiler (`@agentgate/compiler`)** | **Offline / CI (`npx agentgate compile`)** | Uses AST analysis (`ts-morph`) + a structured LLM pass to inspect existing backend web routes (`routes/`), MCP/agent tool schemas (`tools/`), and system prompts (`prompt.md`). Extracts unwritten business rules and missing route checks into a reviewed `agentgate.contract.json` file. |
| **2. The Stateful Runtime Ledger (`@agentgate/runtime`)** | **Runtime (Sub-millisecond middleware)** | Wraps MCP servers or plugs into OpenAI's `toolGuardrails` hook. Tracks live multi-turn conversation and customer history to deterministically enforce ownership, prerequisites, anti-stacking, budgets, and human escalation. |

---

## 3. The 6 Non-Negotiable Design Rules (v2 Spec)

Every piece of the compiler and runtime must obey these six engineering rules:

1. **Ownership Binding Over Strict Provenance:** Do not block a customer who pastes an `orderId` directly from their email receipt. Allow user-supplied IDs, but require a lookup tool (`get_order`) and assert that `get_order.output.userId` matches the authenticated `context.principalId`.
2. **Customer & Entity Scoping (No Session-Reset Bypass):** Never scope financial budgets purely to a chat `sessionId` (which a user can reset by opening a new tab). Scope anti-stacking rules to the target entity (`orderId`) and cumulative budgets to the authenticated `principalId` (`customerId`) over a rolling time window (`windowSeconds: 86400`).
3. **Two-Phase Atomic Reservation (Concurrency Safety):** To prevent parallel `tool_calls` in a single turn from bypassing a budget cap simultaneously, the runtime ledger must run a synchronous `checkAndReserve(callId)` before tool execution and `commit(callId)` or `rollback(callId)` upon completion.
4. **Schema-Aware Unit Normalization:** Prompts are written in human units (`"$50"`, `"2 weeks"`), while tool schemas often use minor units (`amount_cents`, `paise`). The compiler must inspect the target parameter's name, type, and docstring and convert prompt literals automatically (`"$50"` → `5000` for `amount_cents`).
5. **Three-State Verdict (`ALLOW` | `BLOCK` | `ESCALATE`):** Rules containing conditional approval phrases (*"without manager approval"*, *"above $50 requires escalation"*) must compile to `onViolation: "ESCALATE"` (pausing for human approval) rather than a hard `BLOCK`.
6. **Constrained Declarative JSON Contract (Zero Arbitrary Code):** The compiler must never emit raw LLM-generated JavaScript functions. It must output a strict JSON AST validated by Zod using fixed operators (`eq`, `neq`, `lte`, `gte`, `in`, `lte_field`).

---

## 4. The Target Artifact: `agentgate.contract.json`

The compiler outputs this exact declarative format, which the developer reviews in Git and the runtime enforces:

```json
{
  "version": "2.0",
  "tools": {
    "issue_refund": {
      "ownership": {
        "lookupTool": "get_order",
        "matchArg": "orderId",
        "ownerField": "userId",
        "equalsContext": "principalId"
      },
      "preconditions": [
        {
          "source": "src/routes/refunds.ts:L14",
          "lookupTool": "get_order",
          "field": "status",
          "op": "eq",
          "value": "DELIVERED",
          "onViolation": "BLOCK"
        },
        {
          "source": "src/routes/refunds.ts:L18",
          "lookupTool": "get_order",
          "field": "daysSinceDelivery",
          "op": "lte",
          "value": 14,
          "onViolation": "BLOCK"
        },
        {
          "source": "src/routes/refunds.ts:L22",
          "lookupTool": "get_order",
          "argField": "amount_cents",
          "op": "lte_field",
          "targetField": "totalPaid_cents",
          "onViolation": "BLOCK"
        },
        {
          "source": "src/agent/prompt.md:L6",
          "whenArg": { "field": "reason", "op": "eq", "value": "DAMAGED" },
          "requirePriorTool": "verify_damage_report",
          "matchArg": "orderId",
          "outputField": "verified",
          "op": "eq",
          "value": true,
          "onViolation": "BLOCK"
        }
      ],
      "thresholds": [
        {
          "source": "src/agent/prompt.md:L8",
          "argField": "amount_cents",
          "op": "lte",
          "value": 5000,
          "unitConversionNote": "Converted $50 in prompt.md to 5000 cents",
          "onViolation": "ESCALATE"
        }
      ],
      "mutualExclusion": {
        "source": "src/agent/prompt.md:L4",
        "conflictingTools": ["add_wallet_credit", "apply_discount_code"],
        "scopeKey": "orderId",
        "onViolation": "BLOCK"
      },
      "budget": {
        "source": "src/agent/prompt.md:L5",
        "argField": "amount_cents",
        "sharedAcrossTools": ["issue_refund", "add_wallet_credit"],
        "scope": "principalId",
        "windowSeconds": 86400,
        "maxTotal": 10000,
        "unitConversionNote": "Converted $100 in prompt.md to 10000 cents",
        "onViolation": "BLOCK"
      }
    }
  },
  "unmappableRules": [
    {
      "source": "src/agent/prompt.md:L11",
      "rawText": "Never refund VIP-tier users without calling their account manager.",
      "reason": "No tool schema or output exposes a user 'tier' field."
    }
  ]
}
```

---

## 5. What We Need to Build Now (Step-by-Step Execution Plan)

We test the **hardest technical risk first** (Compiler Extraction Accuracy) before polishing the runtime wrapper.

### Phase 1: The Compiler Extraction Benchmark (Days 1–2)

Build the test corpus and extraction pipeline to prove that AgentGate can reliably read messy code and prompts without hallucinating:

1. **Create Two Test Repositories (`benchmarks/`):**
   * **`repo-ecommerce/`:** Contains an Express route (`routes/refunds.ts`) that imports a helper (`utils/validators.ts`), a system prompt (`agent/prompt.md`) written in dollars with non-actionable fluff (*"Be empathetic"*), and 6 MCP tools (`mcp/tools.ts`) operating in `amount_cents` that skip the route guards. Include two traps: a commented-out code rule in the route file and an unmappable rule (*"VIP tier"*) in the prompt.
   * **`repo-saas-billing/`:** A second, structurally different domain (B2B SaaS subscriptions with `cancel_subscription`, `issue_invoice_credit`, `extend_trial`, and `apply_retention_coupon`) where rules live inside middleware and `@tool` docstrings.

2. **Build the Extractor (`src/compiler/extract.ts`):**
   * Use `ts-morph` to locate mutation sinks inside each tool handler and trace references to matching web routes and helper functions.
   * Pass the matched route AST, tool schema, and system prompt into a structured LLM compiler pass constrained by the v2 Zod Contract Schema.

3. **Run the 5-Metric Compiler Scorecard (`src/benchmark/score-compiler.ts`):**
   * **Metric 1 — Recall (True Positives):** Did it find all planted route and prompt rules across both repos?
   * **Metric 2 — Unit Normalization:** Did it convert `"$50"` and `"$100"` into `5000` and `10000` (`amount_cents`)?
   * **Metric 3 — Verdict Mapping:** Did it distinguish `BLOCK` vs. `ESCALATE` accurately?
   * **Metric 4 — Precision (Decoy Rejection):** Did it ignore commented-out code and conversational prompt fluff?
   * **Metric 5 — Unmappable Honesty:** Did it place the `"VIP tier"` rule into `unmappableRules[]` instead of inventing a fake schema field?

---

### Phase 2: The Stateful Runtime & End-to-End Replay (Days 3–4)

Once the compiler scores high on Phase 1, wire the emitted `agentgate.contract.json` into the runtime engine:

1. **Build `@agentgate/runtime` (`src/runtime/`):**
   * Implement `StatefulLedger` with two-phase atomic reservation (`checkAndReserve`, `commit`, `rollback`) scoped by `principalId` and `entityId`.
   * Implement the deterministic evaluator for `ownership`, `preconditions`, `thresholds`, `mutualExclusion`, and `budget`.

2. **Run the 20-Session End-to-End Trajectory Test (`src/benchmark/score-runtime.ts`):**
   * Replay 10 legitimate multi-turn customer support flows (including users pasting order IDs from emails) and 10 multi-turn abuse flows (action stacking, parallel refund race conditions, cross-session budget resets, and unverified damaged-item claims) using the **compiler-generated contract**.
