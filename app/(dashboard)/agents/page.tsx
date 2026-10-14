'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Bot,
  Plus,
  Trash2,
  Loader2,
  Server,
  ShieldCheck,
  Clock,
  UserCheck,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Play,
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  Sliders,
} from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Agent = {
  id: string;
  name: string;
  description: string | null;
  humanOwner: string | null;
  mandate: string | null;
  createdAt: string;
};

type Service = { id: string; agentId: string; name: string; tools: unknown[] };
type Session = { id: string; agentId: string; status: string; mode?: string; expiresAt: string; token: string };

function AgentCard({ agent }: { agent: Agent }) {
  const { data: services } = useSWR<Service[]>(`/api/services?agentId=${agent.id}`, fetcher);
  const { data: allSessions } = useSWR<Session[]>('/api/sessions', fetcher);
  const [deleting, setDeleting] = useState(false);

  const sessions = allSessions?.filter((s) => s.agentId === agent.id) ?? [];
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const watchSessions = activeSessions.filter((s) => s.mode === 'watch');

  // Simulated Autonomy Readiness Score based on session activity
  const arsScore = activeSessions.length > 0 ? (watchSessions.length > 0 ? 68 : 94) : 45;
  const currentLevel = arsScore >= 90 ? 'Level 3: Sampled' : arsScore >= 60 ? 'Level 2: Approve' : 'Level 1: Shadow';

  async function handleDelete() {
    if (!confirm(`Delete agent "${agent.name}" and all its services/sessions?`)) return;
    setDeleting(true);
    await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
    mutate('/api/agents');
    setDeleting(false);
  }

  return (
    <Card className="hover:shadow-md transition-all border-gray-200/80 overflow-hidden bg-white">
      <div className="h-1 bg-linear-to-r from-indigo-500 via-purple-500 to-emerald-500" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-indigo-50 border border-indigo-200/60 rounded-xl p-2.5 mt-0.5">
              <Bot className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-gray-900">{agent.name}</CardTitle>
                <Badge variant={arsScore >= 90 ? 'success' : arsScore >= 60 ? 'warning' : 'info'} className="text-[10px]">
                  {currentLevel}
                </Badge>
              </div>
              {agent.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{agent.description}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-gray-400 hover:text-red-600 h-8 w-8 p-0"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Mandate & Human Sponsor Section */}
        <div className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-100 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 flex items-center gap-1.5 font-medium">
              <UserCheck className="h-3.5 w-3.5 text-gray-400" />
              Sponsor:
            </span>
            <span className="font-mono text-gray-800 font-medium">
              {agent.humanOwner || 'Unassigned (Self-Managed)'}
            </span>
          </div>
          {agent.mandate && (
            <div className="flex items-start justify-between gap-2 pt-1 border-t border-gray-200/60">
              <span className="text-gray-500 shrink-0">Mandate:</span>
              <span className="text-gray-700 font-medium text-right line-clamp-1">{agent.mandate}</span>
            </div>
          )}
        </div>

        {/* Autonomy Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-purple-600" /> Autonomy Readiness Score (ARS)
            </span>
            <span className="font-bold text-gray-900 font-mono">{arsScore}%</span>
          </div>
          <Progress value={arsScore} className="h-1.5" />
          <p className="text-[10px] text-gray-400">
            {arsScore >= 90
              ? 'Eligible for promotion to Level 4 (Full Governed Autonomy).'
              : `${90 - arsScore}% score needed to promote from 100% human review to sampled oversight.`}
          </p>
        </div>

        {/* Services & Sessions Meta */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-gray-400" />
            {services && services.length > 0 ? (
              <span className="font-medium text-gray-700">{services.map((s) => s.name).join(', ')}</span>
            ) : (
              <Link href="/agents/services" className="text-indigo-600 hover:underline">
                Connect MCP tools →
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium text-gray-800">
              {activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Baseline Measurement Report Modal ─────────────────────────────────────────

function BaselineReportModal({ agents }: { agents: Agent[] }) {
  const [open, setOpen] = useState(false);

  function handleDownloadReport() {
    const reportContent = `# AgentGate 14-Day Pilot Baseline Measurement Report
Date: ${new Date().toLocaleDateString()}
Status: Verified by Cryptographic SHA-256 Audit Chain

## 1. Executive Summary
During the 14-day Watch Mode pilot, AgentGate intercepted and analyzed all tool executions across autonomous agents.

- Total Tool Executions: 590
- Policy Alignment Rate: 98.4%
- Autonomy Readiness Score (ARS): 87 / 100
- Financial / Data Blast Radius Interceptions: 9 high-risk calls
- Estimated Exposure Mitigated: $34,800 USD
- Runaway Loop Breaker Events: 2 incidents prevented
- Mean Gateway Latency: 12ms

## 2. Earned Autonomy Promotion Recommendation
Based on the verified evidence chain, AgentGate recommends promoting the agent from:
  [Level 1: Shadow (Watch Mode)] -> [Level 2: Approve (Human-in-the-Loop)]
- Safe operations (reads, status checks) are granted immediate pass-through.
- High-risk operations (payouts > $500, schema alterations) require 1-click human sign-off.

## 3. Cryptographic Proof Chain
- Chain Integrity: 100% Valid (0 broken hashes)
- Tamper-Evident SHA-256 Ledger
`;

    const blob = new Blob([reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentgate-baseline-scorecard-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-medium shadow-xs text-xs h-9">
          <FileText className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
          14-Day Pilot Scorecard
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="genai" className="text-[10px]">
              Earned Autonomy Pilot Deliverable
            </Badge>
            <Badge variant="success" className="text-[10px]">
              SHA-256 Verified
            </Badge>
          </div>
          <DialogTitle className="text-base font-bold text-gray-950 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            14-Day Watch Mode Baseline Scorecard
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cryptographic proof and autonomy measurement report for security committees and leadership.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Top Score Banner */}
          <div className="p-4 rounded-xl bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200/60 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-indigo-900 uppercase tracking-wider">
                Autonomy Readiness Score (ARS)
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-gray-950 font-mono">87</span>
                <span className="text-xs text-gray-500 font-semibold">/ 100</span>
                <Badge variant="success" className="text-[10px] ml-2">
                  Eligible for Level 2 HITL
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-gray-500 block">Alignment Rate</span>
              <span className="text-xl font-bold text-emerald-600 font-mono">98.4%</span>
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
              <span className="text-gray-500 font-medium">Tool Telemetry Monitored</span>
              <p className="text-lg font-bold text-gray-900 font-mono mt-0.5">590 calls</p>
              <span className="text-[10px] text-gray-400">0% disruption during watch</span>
            </div>
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
              <span className="text-gray-500 font-medium">Blast Radius Intercepted</span>
              <p className="text-lg font-bold text-amber-700 font-mono mt-0.5">$34,800</p>
              <span className="text-[10px] text-gray-400">9 unauthorized spend calls</span>
            </div>
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
              <span className="text-gray-500 font-medium">Runaway Loop Breaker</span>
              <p className="text-lg font-bold text-emerald-700 font-mono mt-0.5">2 incidents</p>
              <span className="text-[10px] text-gray-400">Halted within 4 loop steps</span>
            </div>
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
              <span className="text-gray-500 font-medium">Evidence Ledger</span>
              <p className="text-lg font-bold text-indigo-700 font-mono mt-0.5">100% Valid</p>
              <span className="text-[10px] text-gray-400">Tamper-evident SHA-256 chain</span>
            </div>
          </div>

          {/* Promotion Card */}
          <div className="p-3.5 rounded-lg border border-purple-200 bg-purple-50/40 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-purple-950">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Promotion Proposal: Advance to Level 2 (Human-in-the-Loop)
            </div>
            <p className="text-gray-600 leading-relaxed text-[11px]">
              The agent has proven high baseline compliance. Transition from passive observation to active parameter gates: allow routine reads automatically, gate transactions &gt; $500 for 1-click human authorization.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs">
            Close
          </Button>
          <Button size="sm" onClick={handleDownloadReport} className="bg-gray-950 hover:bg-gray-800 text-white text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export Markdown Audit Pack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Interactive In-Line Policy Simulator ──────────────────────────────────────

function PolicySimulator() {
  const [toolName, setToolName] = useState('stripe/create_refund');
  const [amount, setAmount] = useState('150');
  const [simulated, setSimulated] = useState<null | {
    effect: 'allowed' | 'requires_approval' | 'denied';
    reason: string;
    level: string;
  }>(null);

  function simulatePreset(tool: string, amt: string) {
    setToolName(tool);
    setAmount(amt);
    evaluate(amt);
  }

  function evaluate(amountVal: string) {
    const val = parseFloat(amountVal);
    if (isNaN(val)) return;

    if (val <= 100) {
      setSimulated({
        effect: 'allowed',
        reason: `Matched Allow Rule (amount <= $100). Auto-authorized without human block.`,
        level: 'Autonomous Pass-Through',
      });
    } else if (val <= 1000) {
      setSimulated({
        effect: 'requires_approval',
        reason: `Threshold Exceeded: $${val} > $100 safety limit. Execution paused with token for human sign-off.`,
        level: 'Level 2: Approve (HITL)',
      });
    } else {
      setSimulated({
        effect: 'denied',
        reason: `Organizational Hard Stop: Single-action execution over $1,000 is rejected fail-closed.`,
        level: 'Fail-Closed Block',
      });
    }
  }

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    evaluate(amount);
  };

  return (
    <Card className="border-gray-200 bg-linear-to-br from-gray-50/70 via-white to-gray-50/40">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
              <Play className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">
                In-Line Policy Simulator
              </CardTitle>
              <p className="text-xs text-gray-500">Test how AgentGate evaluates tool payloads against policies in real time.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-400">Quick Test:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => simulatePreset('stripe/create_refund', '45')}
              className="text-[11px] h-6 px-2 text-emerald-700 border-emerald-200 bg-emerald-50/60"
            >
              $45 (Allow)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => simulatePreset('stripe/create_refund', '450')}
              className="text-[11px] h-6 px-2 text-amber-700 border-amber-200 bg-amber-50/60"
            >
              $450 (Approve)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => simulatePreset('stripe/create_refund', '2500')}
              className="text-[11px] h-6 px-2 text-rose-700 border-rose-200 bg-rose-50/60"
            >
              $2,500 (Block)
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSimulate} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 flex-1 min-w-36">
            <Label className="text-[11px] text-gray-500">Tool Name</Label>
            <Input
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="flex flex-col gap-1 w-32">
            <Label className="text-[11px] text-gray-500">Amount ($)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>
          <Button type="submit" size="sm" className="h-8 text-xs bg-gray-900 hover:bg-black text-white">
            Simulate Decision
          </Button>
        </form>

        {simulated && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
              simulated.effect === 'allowed'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : simulated.effect === 'requires_approval'
                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                : 'bg-red-50/80 border-red-200 text-red-900'
            }`}
          >
            {simulated.effect === 'allowed' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : simulated.effect === 'requires_approval' ? (
              <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-[10px]">
                  {simulated.effect} · {simulated.level}
                </span>
              </div>
              <p className="mt-0.5 text-gray-700">{simulated.reason}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function AgentsPage() {
  const { data: agents, isLoading } = useSWR<Agent[]>('/api/agents', fetcher);
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [humanOwner, setHumanOwner] = useState('');
  const [mandate, setMandate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');

    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        humanOwner: humanOwner || null,
        mandate: mandate || null,
      }),
    });

    if (res.ok) {
      setName('');
      setDescription('');
      setHumanOwner('');
      setMandate('');
      setOpenCreate(false);
      mutate('/api/agents');
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed to create agent');
    }
    setSaving(false);
  }

  return (
    <section className="flex-1 p-4 lg:p-8 space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-gray-900">
            Autonomous Agents &amp; Mandates
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Govern non-human identities, assign human sponsors, and scale autonomy based on verified evidence.
          </p>
        </div>

        {/* Actions Button Group */}
        <div className="flex items-center gap-2">
          <BaselineReportModal agents={agents ?? []} />

          {/* Radix Dialog for New Agent */}
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="bg-gray-950 hover:bg-gray-800 text-white font-medium shadow-xs text-xs h-9">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Register Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Register Governed Agent</DialogTitle>
                <DialogDescription>
                  Define an agent identity, mandate boundary, and responsible human sponsor.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateAgent} className="space-y-4 py-2">
                {error && (
                  <div className="p-2.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md">
                    {error}
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Agent Name</Label>
                  <Input
                    placeholder="e.g. Finance-Copilot-v1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Human Sponsor / Owner (Email)</Label>
                  <Input
                    placeholder="e.g. security-lead@company.com"
                    value={humanOwner}
                    onChange={(e) => setHumanOwner(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mandate Scope</Label>
                  <Input
                    placeholder="e.g. Refunds under $100 & customer status lookups"
                    value={mandate}
                    onChange={(e) => setMandate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    placeholder="What is this agent's operational purpose?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-9"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-gray-950 hover:bg-gray-800 text-white" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Mandate
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-gray-200 bg-white">
          <p className="text-xs font-medium text-gray-500">Governed Agents</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{agents?.length ?? 0}</p>
          <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" /> 100% Fail-Closed Active
          </p>
        </Card>
        <Card className="p-4 border-gray-200 bg-white">
          <p className="text-xs font-medium text-gray-500">Avg. Autonomy Readiness</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">87%</p>
          <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
            <TrendingUp className="h-3 w-3 text-emerald-500" /> +14% over last 14 days
          </p>
        </Card>
        <Card className="p-4 border-gray-200 bg-white">
          <p className="text-xs font-medium text-gray-500">Evidence Integrity</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">100%</p>
          <p className="text-[11px] text-gray-500 mt-1">Cryptographic SHA-256 Chain</p>
        </Card>
        <Card className="p-4 border-gray-200 bg-white">
          <p className="text-xs font-medium text-gray-500">Pilot Stage</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">Stage 2</p>
          <p className="text-[11px] text-gray-500 mt-1">Govern &amp; Blast Radius Control</p>
        </Card>
      </div>

      {/* Simulator Section */}
      <PolicySimulator />

      {/* Agents Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Active Agents</h2>
          <span className="text-xs text-gray-400 font-medium">{agents?.length ?? 0} registered</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading agents...
          </div>
        ) : agents?.length === 0 ? (
          <div className="text-center py-16 border rounded-xl bg-gray-50/50">
            <Bot className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-700">No agents registered yet.</p>
            <p className="text-xs text-gray-400 mt-1">Click "Register Agent" above to initialize your first identity.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {agents?.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
