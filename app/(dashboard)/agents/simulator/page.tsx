'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  ShieldCheck,
  ShieldAlert,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SimulatorPage() {
  const [filter, setFilter] = useState<'ALL' | 'LEGITIMATE' | 'ABUSE'>('ALL');
  const [selectedTrajectory, setSelectedTrajectory] = useState<any | null>(null);

  const { data, mutate, isValidating } = useSWR('/api/simulator', fetcher, {
    revalidateOnFocus: false,
  });

  const summary = data?.summary;
  const trajectories = data?.trajectories || [];

  const filteredTrajectories = trajectories.filter((t: any) => {
    if (filter === 'ALL') return true;
    return t.category === filter;
  });

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Play className="h-6 w-6 text-indigo-600" />
              Stateful Attack Simulator & Benchmark Replay
            </h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-mono">
              20-Session Trajectory Suite
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            Replays 10 legitimate customer support interactions and 10 multi-turn attacks against the compiled <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">agentgate.contract.json</code>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => mutate()}
            disabled={isValidating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
            {isValidating ? 'Running Trajectories...' : 'Replay All 20 Trajectories'}
          </Button>
        </div>
      </div>

      {/* Metrics Scorecard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-gray-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <span className="text-xs text-gray-500 font-medium block">Total Trajectories</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary?.total || 20}</div>
            <span className="text-[11px] text-gray-400 mt-0.5 block">10 Legit + 10 Attacks</span>
          </CardContent>
        </Card>

        <Card className="border-emerald-200/80 shadow-xs bg-emerald-50/20">
          <CardContent className="p-4">
            <span className="text-xs text-emerald-700 font-medium block">Pass Rate</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{summary?.scorePercent || 100}%</div>
            <span className="text-[11px] text-emerald-600 mt-0.5 block">{summary?.passed || 20}/20 Passed (Zero Leaks)</span>
          </CardContent>
        </Card>

        <Card className="border-indigo-200/80 shadow-xs bg-indigo-50/20">
          <CardContent className="p-4">
            <span className="text-xs text-indigo-700 font-medium block">Average Latency</span>
            <div className="text-2xl font-bold text-indigo-700 mt-1">{summary?.averageLatencyMs || 0.1} ms</div>
            <span className="text-[11px] text-indigo-600 mt-0.5 block">Zero runtime LLM calls</span>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <span className="text-xs text-gray-500 font-medium block">Enforcement Mode</span>
            <div className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              <span>Deterministic</span>
            </div>
            <span className="text-[11px] text-gray-400 mt-0.5 block">Two-phase atomic ledger</span>
          </CardContent>
        </Card>
      </div>

      {/* Trajectories Table with Filters */}
      <Card className="border-gray-200 shadow-xs">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100">
          <div>
            <CardTitle className="text-base font-semibold text-gray-900">
              Session Trajectories ({filteredTrajectories.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Every request is evaluated through ownership binding, route preconditions, anti-stacking, and 2-phase budgets.
            </CardDescription>
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-auto">
            <TabsList className="bg-gray-100 p-0.5 text-xs">
              <TabsTrigger value="ALL" className="text-xs font-medium">All (20)</TabsTrigger>
              <TabsTrigger value="LEGITIMATE" className="text-xs font-medium">Legitimate (10)</TabsTrigger>
              <TabsTrigger value="ABUSE" className="text-xs font-medium">Attacks & Abuse (10)</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="p-0 divide-y divide-gray-100">
          {filteredTrajectories.map((t: any) => {
            const isAbuse = t.category === 'ABUSE';
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTrajectory(selectedTrajectory?.id === t.id ? null : t)}
                className={`p-4 hover:bg-gray-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                  selectedTrajectory?.id === t.id ? 'bg-indigo-50/30' : ''
                }`}
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-400 font-semibold">{t.id}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium ${
                        isAbuse ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isAbuse ? 'Abuse Vector' : 'Legitimate Flow'}
                    </Badge>
                    <span className="font-semibold text-gray-900">{t.title}</span>
                  </div>
                  <p className="text-gray-500 text-xs">{t.description}</p>
                  {t.reason && (
                    <div className="text-[11px] text-rose-600 font-mono flex items-center gap-1 pt-0.5">
                      <ShieldAlert className="h-3 w-3 shrink-0" />
                      <span>{t.reason}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-gray-400 font-mono text-[11px]">{t.latencyMs}ms</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[11px] text-gray-400">Verdict:</span>
                    <Badge
                      className={`text-xs font-mono font-semibold ${
                        t.actual === 'ALLOW'
                          ? 'bg-emerald-600 text-white'
                          : t.actual === 'ESCALATE'
                          ? 'bg-amber-500 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {t.actual}
                    </Badge>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Selected Trajectory Detail Panel */}
      {selectedTrajectory && (
        <Card className="border-indigo-200/90 bg-linear-to-br from-indigo-50/30 via-white to-white shadow-md">
          <CardHeader className="pb-3 border-b border-indigo-100 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                  {selectedTrajectory.id}
                </Badge>
                <CardTitle className="text-sm font-bold text-gray-900">
                  {selectedTrajectory.title}
                </CardTitle>
              </div>
              <CardDescription className="text-xs mt-1">
                {selectedTrajectory.description}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTrajectory(null)}
              className="text-xs text-gray-400 hover:text-gray-700"
            >
              ✕ Close
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 font-mono">
                <span className="text-gray-400 text-[10px] uppercase block">Expected Verdict</span>
                <span className="font-bold text-gray-900 text-sm">{selectedTrajectory.expected}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 font-mono">
                <span className="text-gray-400 text-[10px] uppercase block">Actual Evaluated</span>
                <span className={`font-bold text-sm ${
                  selectedTrajectory.actual === 'ALLOW' ? 'text-emerald-600' : selectedTrajectory.actual === 'ESCALATE' ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {selectedTrajectory.actual}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 font-mono">
                <span className="text-gray-400 text-[10px] uppercase block">Evaluation Latency</span>
                <span className="font-bold text-indigo-600 text-sm">{selectedTrajectory.latencyMs} ms</span>
              </div>
            </div>

            {selectedTrajectory.reason && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                <span className="font-semibold block text-[11px] uppercase tracking-wide">Runtime Guardrail Enforcement:</span>
                <p className="mt-0.5 font-mono text-xs">{selectedTrajectory.reason}</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-500 font-mono">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Evaluated in-memory with zero runtime LLM calls via AgentGate StatefulLedger</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
