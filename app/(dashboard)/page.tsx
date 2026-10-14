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
  Eye,
  AlertTriangle,
  Play,
  RotateCcw,
  Cpu,
  FileCode,
  Sliders,
} from 'lucide-react';

export default function HomePage() {
  // Interactive Hero Simulator State
  const [selectedScenario, setSelectedScenario] = useState<'high_spend' | 'sql_drop' | 'safe_read'>('high_spend');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(3); // 3 = fully evaluated

  const scenarios = {
    high_spend: {
      tool: 'stripe/create_payout',
      args: { amount: 2500, currency: 'USD', destination: 'acct_098847' },
      verdict: 'HUMAN_APPROVAL_REQUIRED',
      reason: 'Rule "max_payout_amount" exceeded ($2,500 > $500 threshold)',
      action: 'Diverted to Operator Queue',
      color: 'amber',
      hash: '3f9a7c2b...8e11',
    },
    sql_drop: {
      tool: 'postgres/execute_query',
      args: { query: 'DROP TABLE customers CASCADE;', database: 'prod_main' },
      verdict: 'BLOCKED_FAIL_CLOSED',
      reason: 'Destructive DDL blocked by mandatory safety policy',
      action: 'Execution Terminated & Key Revoked',
      color: 'rose',
      hash: 'd48e21aa...04fb',
    },
    safe_read: {
      tool: 'github/get_pull_request',
      args: { repo: 'agentgate/core', pull_number: 42 },
      verdict: 'ALLOWED_AUTOMATIC',
      reason: 'Read-only tool permitted under Level 2 Agent Mandate',
      action: 'Proxied with Ephemeral Token',
      color: 'emerald',
      hash: '77c01bfe...a912',
    },
  };

  const currentSim = scenarios[selectedScenario];

  function runSimulation(scenarioKey: 'high_spend' | 'sql_drop' | 'safe_read') {
    setSelectedScenario(scenarioKey);
    setIsSimulating(true);
    setSimStep(1);
    setTimeout(() => setSimStep(2), 250);
    setTimeout(() => {
      setSimStep(3);
      setIsSimulating(false);
    }, 500);
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-32 border-b border-gray-100 bg-linear-to-b from-gray-50/60 via-white to-white">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-900 text-xs font-semibold mb-6 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>The Earned Autonomy Layer for AI Agents</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-950 leading-[1.12]">
              Give AI Agents Hands.{' '}
              <span className="bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Keep the Keys in Your Vault.
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              AgentGate is the authorization gateway for Model Context Protocol (MCP). It intercepts rogue tool executions, enforces parameter-level gates, breaks infinite loops, and builds tamper-evident cryptographic audit chains.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-gray-950 hover:bg-gray-800 text-white shadow-md rounded-xl text-sm px-6 h-11">
                <Link href="/agents">
                  Open Operator Console
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-sm px-6 h-11">
                <Link href="/agents/approvals">
                  View Live Approval Queue
                </Link>
              </Button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500 font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Fail-Closed Enforced
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-indigo-500" /> AES-256 Vault
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-purple-500" /> SHA-256 Proof Chains
              </span>
            </div>
          </div>

          {/* Interactive Live Gateway Interception Simulator */}
          <div className="max-w-4xl mx-auto">
            <Card className="border-gray-200/90 shadow-xl overflow-hidden bg-white">
              <CardHeader className="bg-gray-950 text-white px-6 py-4 border-b border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-xs font-semibold text-gray-200">
                      LIVE IN-LINE INTERCEPTION SIMULATOR
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">Select Test Vector:</span>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant={selectedScenario === 'high_spend' ? 'secondary' : 'outline'}
                        onClick={() => runSimulation('high_spend')}
                        className={`text-xs h-7 px-2.5 font-mono ${
                          selectedScenario === 'high_spend'
                            ? 'bg-amber-400 text-gray-950 hover:bg-amber-300'
                            : 'text-gray-300 border-gray-700 hover:bg-gray-800'
                        }`}
                      >
                        Payout &gt; $500
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedScenario === 'sql_drop' ? 'secondary' : 'outline'}
                        onClick={() => runSimulation('sql_drop')}
                        className={`text-xs h-7 px-2.5 font-mono ${
                          selectedScenario === 'sql_drop'
                            ? 'bg-rose-400 text-gray-950 hover:bg-rose-300'
                            : 'text-gray-300 border-gray-700 hover:bg-gray-800'
                        }`}
                      >
                        SQL DROP
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedScenario === 'safe_read' ? 'secondary' : 'outline'}
                        onClick={() => runSimulation('safe_read')}
                        className={`text-xs h-7 px-2.5 font-mono ${
                          selectedScenario === 'safe_read'
                            ? 'bg-emerald-400 text-gray-950 hover:bg-emerald-300'
                            : 'text-gray-300 border-gray-700 hover:bg-gray-800'
                        }`}
                      >
                        Safe Read
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="grid md:grid-cols-12 gap-6">
                  {/* Left: Simulated LLM Tool Call */}
                  <div className="md:col-span-6 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                      <span className="flex items-center gap-1.5">
                        <Cpu className="h-4 w-4 text-indigo-600" />
                        AI Agent Attempted Call
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        MCP JSON-RPC 2.0
                      </Badge>
                    </div>

                    <div className="rounded-xl bg-zinc-950 p-4 text-xs font-mono text-zinc-100 border border-zinc-800 shadow-inner">
                      <div className="text-zinc-500 mb-1">// Outbound from Claude 3.7 / Cursor</div>
                      <div className="text-emerald-400">
                        POST <span className="text-white">/gateway/call</span>
                      </div>
                      <div className="text-zinc-400 mt-2">
                        tool: <span className="text-amber-300">"{currentSim.tool}"</span>
                      </div>
                      <div className="text-zinc-400 mt-1">args:</div>
                      <pre className="text-zinc-300 pl-3 border-l border-zinc-800 mt-1">
                        {JSON.stringify(currentSim.args, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Right: AgentGate Decision & Evidence */}
                  <div className="md:col-span-6 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-3">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          AgentGate In-Line Evaluation
                        </span>
                        <span className="text-[11px] text-gray-400 font-mono">latency: 14ms</span>
                      </div>

                      <div className={`p-4 rounded-xl border ${
                        currentSim.color === 'amber'
                          ? 'bg-amber-50/70 border-amber-300/80 text-amber-950'
                          : currentSim.color === 'rose'
                          ? 'bg-rose-50/70 border-rose-300/80 text-rose-950'
                          : 'bg-emerald-50/70 border-emerald-300/80 text-emerald-950'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {currentSim.color === 'amber' ? (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          ) : currentSim.color === 'rose' ? (
                            <XCircle className="h-4 w-4 text-rose-600" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          )}
                          <span className="font-mono text-xs font-bold tracking-wider">
                            {currentSim.verdict}
                          </span>
                        </div>
                        <p className="text-xs font-medium leading-relaxed mb-3">
                          {currentSim.reason}
                        </p>
                        <div className="pt-2 border-t border-black/10 flex items-center justify-between text-xs font-mono">
                          <span className="text-gray-600">Gate Action:</span>
                          <span className="font-semibold">{currentSim.action}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cryptographic block hash badge */}
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs font-mono text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5 text-gray-400" />
                        <span>Audit Block Hash:</span>
                      </div>
                      <span className="text-indigo-600 font-semibold">{currentSim.hash}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* The 4-Stage Earned Autonomy Framework */}
      <section className="py-20 bg-gray-50/60 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="genai" className="mb-3">
              Governance Architecture
            </Badge>
            <h2 className="text-3xl font-extrabold text-gray-950 tracking-tight">
              The 4-Stage Earned Autonomy Ladder
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Don't guess AI agent safety. Promote agents through verifiable operational milestones based on cryptographic evidence.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                stage: 'Stage 1',
                title: 'Watch Mode (Shadow)',
                level: '14-Day Baseline',
                desc: 'Zero friction. Agent requests pass passively through the gateway. AgentGate records full tool telemetry to measure baseline alignment without breaking workflows.',
                badge: 'Level 1: Passive',
                icon: Eye,
                color: 'blue',
              },
              {
                stage: 'Stage 2',
                title: 'Human-in-the-Loop',
                level: 'Active Gate',
                desc: 'Sensitive parameter rules activate. Any action with high financial or data blast radius (e.g., payouts > $500, drop table) pauses for 1-click human sign-off.',
                badge: 'Level 2: Approve',
                icon: ShieldAlert,
                color: 'amber',
              },
              {
                stage: 'Stage 3',
                title: 'Sampled Autonomy',
                level: 'Audited Autonomy',
                desc: 'Agents that sustain >98% human approval graduate. Safe high-frequency operations run automatically, with 10% randomly audited and velocity limits enforced.',
                badge: 'Level 3: Sampled',
                icon: Sliders,
                color: 'purple',
              },
              {
                stage: 'Stage 4',
                title: 'Governed Autonomy',
                level: 'Production Scale',
                desc: 'Full autonomy bounded by strict spend breakers, circuit breakers against infinite loops, and an immutable SHA-256 tamper-evident evidence log.',
                badge: 'Level 4: Governed',
                icon: ShieldCheck,
                color: 'emerald',
              },
            ].map((ladder) => (
              <Card key={ladder.stage} className="border-gray-200/90 shadow-xs hover:shadow-md transition-shadow bg-white flex flex-col justify-between">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      {ladder.stage}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {ladder.level}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold text-gray-950 flex items-center gap-2">
                    <ladder.icon className="h-4 w-4 text-indigo-600" />
                    {ladder.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">
                    {ladder.desc}
                  </p>
                  <div className="pt-3 border-t border-gray-100">
                    <span className="text-[11px] font-semibold text-gray-700 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200 inline-block">
                      {ladder.badge}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Security Guarantees */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-gray-950 tracking-tight">
              Enterprise-Grade Control Architecture
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Engineered specifically for security teams and engineering leaders adopting autonomous AI agents.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-gray-950">Zero Raw Key Exposure</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Upstream API credentials for Stripe, GitHub, Postgres, and Salesforce are encrypted in the AES-256-GCM proxy vault. Agents only receive scoped, short-lived gateway tokens.
              </p>
            </div>

            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                <Terminal className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-gray-950">Cryptographic SHA-256 Proofs</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Every tool request, payload, latency, and gate decision is linked into a tamper-evident blockchain-style hash chain. Any retro-active modification invalidates the entire log.
              </p>
            </div>

            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <RotateCcw className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-gray-950">Loop &amp; Velocity Breakers</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Prevents catastrophic runaway loops where an agent spends an entire quarterly budget over a weekend. Trip wires trigger automatic fail-closed locks on repetitive calls.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 bg-gray-950 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Badge variant="outline" className="text-xs border-gray-800 text-gray-400 mb-4 font-mono">
            14-Day Enterprise Watch Mode Pilot
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Start governing your AI agents today.
          </h2>
          <p className="text-sm text-gray-400 max-w-xl mx-auto mb-8">
            Deploy AgentGate in 5 minutes with zero code changes to your existing agents. Works seamlessly with any MCP server.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-white text-gray-950 hover:bg-gray-100 rounded-xl px-8 font-semibold">
              <Link href="/agents">
                Open Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-gray-800 text-white hover:bg-gray-900 rounded-xl px-8">
              <Link href="/pricing">
                View Pricing Tiers
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
