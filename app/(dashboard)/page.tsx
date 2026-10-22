'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  Lock,
  Sparkles,
  Terminal,
  Layers,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  FileCode,
  Copy,
  Check,
  Clock,
  Ban,
  UserCheck,
  Server,
} from 'lucide-react';

export default function HomePage() {
  const [selectedAttack, setSelectedAttack] = useState<'stacking' | 'race' | 'session_reset' | 'unverified'>('stacking');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(3);
  const [copiedCli, setCopiedCli] = useState(false);

  const attackScenarios = {
    stacking: {
      name: 'Multi-Turn Action Stacking',
      target: 'issue_refund + add_wallet_credit',
      turns: [
        { turn: 1, user: 'Can I get a $30 refund on order #104?', status: 'Allowed', backend: '200 OK' },
        { turn: 2, user: 'Wait, I am still unhappy, can you add a $30 wallet credit?', status: 'Blocked by AgentGate', backend: 'Would be 200 OK' },
      ],
      backendOutcome: 'Stateless API returns 200 OK on both ($60 spent).',
      gateOutcome: 'BLOCKED: Anti-stacking rule caught wallet credit conflicting with prior refund on order #104.',
      verdict: 'BLOCK',
      latency: '0.11 ms',
    },
    race: {
      name: 'Parallel Tool Call Race Condition',
      target: 'issue_refund (Concurrent Calls)',
      turns: [
        { turn: 1, user: 'Model emits concurrent tool_calls: [refund($45), refund($45), refund($30)]', status: 'In-Flight', backend: 'All 3 return 200 OK ($120)' },
      ],
      backendOutcome: 'Stateless endpoints execute concurrently, exceeding the $100 budget cap ($120 spent).',
      gateOutcome: 'BLOCKED: Two-phase atomic reservation reserved Call 1 ($45) and Call 2 ($45); synchronously rejected Call 3 ($30).',
      verdict: 'BLOCK',
      latency: '0.14 ms',
    },
    session_reset: {
      name: 'Incognito Session-Reset Bypass',
      target: 'issue_refund (Cross-Session Exploit)',
      turns: [
        { turn: 1, user: 'Tab 1: Customer receives $90 in courtesy credits (cap is $100)', status: 'Committed', backend: '200 OK' },
        { turn: 2, user: 'Tab 2 (Incognito): Resets chat session, asks for another $40', status: 'Blocked by AgentGate', backend: 'Would be 200 OK' },
      ],
      backendOutcome: 'Stateless session tokens reset to $0 in new tab ($130 spent).',
      gateOutcome: 'BLOCKED: Cumulative budget is scoped to principalId over rolling 24h window, immune to session resets.',
      verdict: 'BLOCK',
      latency: '0.12 ms',
    },
    unverified: {
      name: 'Unverified Damaged Item Claim',
      target: 'issue_refund (Missing Prerequisite)',
      turns: [
        { turn: 1, user: 'My package arrived broken! Refund me immediately!', status: 'Blocked by AgentGate', backend: 'Would be 200 OK' },
      ],
      backendOutcome: 'LLM is pressured by customer anger and executes refund without inspection.',
      gateOutcome: 'BLOCKED: Prerequisite tree asserts verify_damage_report returned verified=true before issue_refund.',
      verdict: 'BLOCK',
      latency: '0.09 ms',
    },
  };

  const currentAttack = attackScenarios[selectedAttack];

  function runSimulation(key: typeof selectedAttack) {
    setSelectedAttack(key);
    setIsSimulating(true);
    setSimStep(1);
    setTimeout(() => setSimStep(2), 200);
    setTimeout(() => {
      setSimStep(3);
      setIsSimulating(false);
    }, 400);
  }

  function copyCliCommand() {
    navigator.clipboard.writeText('npx agentgate compile');
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* ─── Hero Section ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-14 pb-20 lg:pt-20 lg:pb-28 border-b border-gray-100 bg-linear-to-b from-gray-50/80 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-900 text-xs font-semibold mb-6 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>AgentGate 2.0 • The Zero-Config Guardrail Compiler & Stateful Runtime</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-950 leading-[1.12]">
              Your Backend APIs Return 200 OK.{' '}
              <span className="bg-linear-to-r from-rose-600 via-amber-600 to-indigo-600 bg-clip-text text-transparent">
                Your AI Agent Just Bleed $500.
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Stateless APIs validate one request at a time. Multi-turn AI agents get sweet-talked into stacking refunds, resetting sessions, and bypassing limits. AgentGate compiles existing backend routes into a declarative stateful contract, enforcing transactional safety in <strong>&lt; 1ms with zero LLM calls</strong>.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/agents">
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-xs">
                  Open Control Plane
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/agents/simulator">
                <Button size="lg" variant="outline" className="border-gray-300 hover:bg-gray-50 font-medium">
                  <Play className="mr-1.5 h-4 w-4 text-indigo-600" />
                  Run 20-Session Trajectory Replay
                </Button>
              </Link>
              <button
                onClick={copyCliCommand}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 text-gray-100 hover:bg-gray-800 text-xs font-mono font-medium transition-colors shadow-xs"
              >
                <span>$ npx agentgate compile</span>
                {copiedCli ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-gray-400" />}
              </button>
            </div>

            {/* Proof Badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> 100% Compiler Scorecard (5/5)
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> 20/20 Attack Trajectories Blocked
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" /> 0.1ms Deterministic Latency
              </span>
            </div>
          </div>

          {/* ─── Interactive Multi-Turn Attack Visualizer ──────────────────────── */}
          <div className="max-w-4xl mx-auto rounded-xl border border-gray-200/90 bg-white shadow-xl overflow-hidden">
            {/* Simulator Header */}
            <div className="bg-gray-900 text-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 text-xs">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono text-gray-400 text-xs">Multi-Turn Attack Simulation Engine</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-gray-400">Enforcement:</span>
                <span className="text-emerald-400 font-semibold">Sub-Millisecond Stateful Ledger</span>
              </div>
            </div>

            {/* Attack Selector Tabs */}
            <div className="border-b border-gray-100 bg-gray-50/70 p-2 flex flex-wrap gap-1.5 justify-center">
              {[
                { id: 'stacking', label: '1. Action Stacking' },
                { id: 'race', label: '2. Parallel Race' },
                { id: 'session_reset', label: '3. Session-Reset' },
                { id: 'unverified', label: '4. Unverified Claim' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => runSimulation(tab.id as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedAttack === tab.id
                      ? 'bg-white text-indigo-700 shadow-xs border border-gray-200/80'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Attack Details & Interactive Output */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{currentAttack.name}</h3>
                  <span className="text-xs text-gray-500 font-mono">Target Mutation: {currentAttack.target}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runSimulation(selectedAttack)}
                  disabled={isSimulating}
                  className="text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className={`h-3 w-3 ${isSimulating ? 'animate-spin' : ''}`} />
                  Re-run Attack
                </Button>
              </div>

              {/* Multi-Turn Conversation Steps */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Agent Multi-Turn Dialogue
                </span>
                {currentAttack.turns.map((t, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-gray-400 font-bold shrink-0">Turn {t.turn}:</span>
                      <span className="text-gray-700 italic">"{t.user}"</span>
                    </div>
                    <Badge variant="outline" className="w-fit text-[10px] font-mono shrink-0">
                      {t.status}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {/* Stateless Backend APIs */}
                <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/30 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                    <XCircle className="h-4 w-4 text-rose-600" />
                    <span>Traditional Stateless APIs</span>
                  </div>
                  <p className="text-gray-600 text-[11px] leading-relaxed">
                    {currentAttack.backendOutcome}
                  </p>
                  <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-[10px] font-mono border-rose-200">
                    FAIL: Business Rules Violated
                  </Badge>
                </div>

                {/* AgentGate Stateful Runtime */}
                <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/30 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>AgentGate Stateful Firewall</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 font-semibold">{currentAttack.latency}</span>
                  </div>
                  <p className="text-gray-600 text-[11px] leading-relaxed">
                    {currentAttack.gateOutcome}
                  </p>
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] font-mono">
                    VERDICT: {currentAttack.verdict} (Deterministic)
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── The Two Halves Architecture ─────────────────────────────────────── */}
      <section className="py-16 border-b border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950">
              The Architecture: The Two Halves
            </h2>
            <p className="mt-3 text-sm text-gray-600">
              AgentGate combines two components that fail when built in isolation: an offline AST compiler and a sub-millisecond stateful runtime ledger.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Half 1: Compiler */}
            <Card className="border-gray-200 shadow-xs bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs font-mono">
                    Half 1 • Offline / CI
                  </Badge>
                  <span className="text-xs text-gray-400 font-mono">npx agentgate compile</span>
                </div>
                <CardTitle className="text-lg font-bold text-gray-900 mt-2 flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-indigo-600" />
                  The Contract Compiler
                </CardTitle>
                <CardDescription className="text-xs">
                  Runs at build time or in Git CI. Uses <code className="font-mono text-indigo-600">ts-morph</code> AST analysis to inspect backend routes, tool schemas, and prompts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs text-gray-600">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Extracts missing route checks into a reviewed <code className="font-mono text-gray-800">agentgate.contract.json</code></span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Schema-aware unit normalization (e.g. prompt $50 → 5000 cents)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Honest decoy rejection: ignores commented-out code and prompt fluff</span>
                </div>
              </CardContent>
            </Card>

            {/* Half 2: Runtime Ledger */}
            <Card className="border-gray-200 shadow-xs bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-mono">
                    Half 2 • Runtime Middleware
                  </Badge>
                  <span className="text-xs text-emerald-700 font-mono font-semibold">&lt; 1ms Latency</span>
                </div>
                <CardTitle className="text-lg font-bold text-gray-900 mt-2 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-emerald-600" />
                  The Stateful Runtime Ledger
                </CardTitle>
                <CardDescription className="text-xs">
                  Wraps MCP servers or plugs into OpenAI's <code className="font-mono text-emerald-600">toolGuardrails</code>. Enforces ownership, anti-stacking, and rolling budgets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs text-gray-600">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Two-phase atomic reservation prevents parallel tool call double spending</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Customer quota scoping immune to incognito session resets</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Zero runtime LLM calls: deterministic JSON AST evaluator in microseconds</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ─── 6 Non-Negotiable Rules ─────────────────────────────────────────── */}
      <section className="py-16 border-b border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950">
              The 6 Non-Negotiable Design Rules
            </h2>
            <p className="mt-3 text-sm text-gray-600">
              Every line of the compiler and runtime adheres to these engineering invariants.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: UserCheck,
                rule: '1. Ownership Binding',
                desc: 'Allow user-supplied order IDs from email receipts, but require a lookup tool and assert userId matches authenticated principalId.',
              },
              {
                icon: Clock,
                rule: '2. Customer & Entity Scoping',
                desc: 'Never scope budgets purely to a chat sessionId. Scope cumulative budgets to principalId over rolling time windows.',
              },
              {
                icon: Zap,
                rule: '3. Two-Phase Reservation',
                desc: 'Synchronous checkAndReserve before tool execution and commit/rollback on completion to prevent concurrent race conditions.',
              },
              {
                icon: Layers,
                rule: '4. Unit Normalization',
                desc: 'Translates human units ($50, 2 weeks) into target schema minor units (5000 amount_cents, 14 days) automatically.',
              },
              {
                icon: AlertTriangle,
                rule: '5. Three-State Verdicts',
                desc: 'Distinguishes between hard BLOCK and human ESCALATE when policies require manager authorization.',
              },
              {
                icon: FileCode,
                rule: '6. Strict JSON Contract',
                desc: 'Zero arbitrary code execution. Outputs a constrained AST validated by Zod with fixed deterministic operators.',
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-indigo-600" />
                    <span className="font-bold text-gray-900 text-sm">{item.rule}</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Framework Compatibility ────────────────────────────────────────── */}
      <section className="py-14 bg-gray-900 text-gray-200 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold block mb-2">
            Universal Ecosystem Compatibility
          </span>
          <h2 className="text-2xl font-bold text-white mb-6">
            Works Wherever Your Agents Run
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-mono text-gray-400">
            <span className="px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700">Model Context Protocol (MCP)</span>
            <span className="px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700">OpenAI Agents SDK (toolGuardrails)</span>
            <span className="px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700">LangGraph / LangChain</span>
            <span className="px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700">Vercel AI SDK</span>
            <span className="px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700">Claude Code & Cursor</span>
          </div>
        </div>
      </section>

      {/* ─── CTA Footer ──────────────────────────────────────────────────────── */}
      <section className="py-16 text-center bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-extrabold text-gray-950 mb-4">
            Protect Your Production Agents Today
          </h2>
          <p className="text-sm text-gray-600 mb-8 max-w-xl mx-auto">
            Stop hoping the prompt holds under pressure. Compile your backend routes into a deterministic stateful firewall in 90 seconds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/agents/contract">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-xs">
                Open Contract Studio
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/agents/simulator">
              <Button size="lg" variant="outline" className="border-gray-300 font-medium">
                Try Attack Simulator
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
