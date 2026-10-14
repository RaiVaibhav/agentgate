'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Loader2,
  ScrollText,
  Clock,
  Eye,
  CheckCircle2,
  Lock,
} from 'lucide-react';


// ── Types ─────────────────────────────────────────────────────────────────────

type AuditEntry = {
  id: string;
  sessionId: string | null;
  agentId: string;
  serviceId: string | null;
  toolName: string;
  toolArgs: Record<string, unknown> | null;
  effect: 'allowed' | 'denied' | 'requires_approval' | 'anomaly';
  reason: string;
  matchedPermissionId: string | null;
  prevHash: string | null;
  entryHash: string | null;
  latencyMs: number | null;
  simulatedEffect: string | null;
  timestamp: string;
};

type Agent = { id: string; name: string };

type VerifyResult = {
  valid: boolean;
  totalEntries: number;
  verifiedCount?: number;
  error?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function EffectBadge({ entry }: { entry: AuditEntry }) {
  if (entry.simulatedEffect) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
        <Eye className="h-3 w-3" /> watch mode ({entry.simulatedEffect})
      </span>
    );
  }
  if (entry.effect === 'allowed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
        <ShieldCheck className="h-3 w-3" /> allowed
      </span>
    );
  }
  if (entry.effect === 'requires_approval') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
        <Clock className="h-3 w-3" /> approval required
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
      <ShieldX className="h-3 w-3" /> denied
    </span>
  );
}

function getRelativeTime(date: Date) {
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

function AuditRow({ entry, agentName }: { entry: AuditEntry; agentName: string }) {
  const [openModal, setOpenModal] = useState(false);

  const rowBg =
    entry.simulatedEffect
      ? 'hover:bg-blue-50/50'
      : entry.effect === 'allowed'
      ? 'hover:bg-green-50/40'
      : entry.effect === 'requires_approval'
      ? 'hover:bg-amber-50/50'
      : 'hover:bg-red-50/40';

  return (
    <>
      <div
        onClick={() => setOpenModal(true)}
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 border-b border-gray-100 last:border-0 ${rowBg} transition-colors cursor-pointer group`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <EffectBadge entry={entry} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
                {entry.toolName}
              </span>
              {entry.latencyMs !== null && (
                <span className="text-xs text-gray-400 font-mono">{entry.latencyMs}ms</span>
              )}
              {entry.entryHash && (
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded hidden md:inline" title={`SHA-256: ${entry.entryHash}`}>
                  #{entry.entryHash.slice(0, 8)}…
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Agent: <span className="font-medium text-gray-700">{agentName}</span> · {entry.reason}
            </p>
            {entry.toolArgs && Object.keys(entry.toolArgs).length > 0 && (
              <p className="text-xs font-mono text-gray-400 truncate max-w-xl mt-0.5">
                args: {JSON.stringify(entry.toolArgs)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
          {entry.effect === 'requires_approval' && (
            <a href="/agents/approvals" className="text-xs text-orange-600 hover:underline font-medium">
              Review Approval →
            </a>
          )}
          <span className="text-xs text-gray-400">
            {getRelativeTime(new Date(entry.timestamp))}
          </span>
        </div>
      </div>

      {/* Radix Dialog Inspection Modal */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-base">
              <span>{entry.toolName}</span>
              <EffectBadge entry={entry} />
            </DialogTitle>
            <DialogDescription>
              Cryptographically verified event record captured at {new Date(entry.timestamp).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <p className="text-gray-400 font-medium">Agent</p>
                <p className="font-semibold text-gray-900 mt-0.5">{agentName}</p>
              </div>
              <div>
                <p className="text-gray-400 font-medium">Execution Latency</p>
                <p className="font-semibold text-gray-900 mt-0.5">{entry.latencyMs ?? 0} ms</p>
              </div>
              <div className="col-span-2 pt-2 border-t border-gray-200/60">
                <p className="text-gray-400 font-medium">Decision &amp; Policy Reason</p>
                <p className="font-medium text-gray-800 mt-0.5">{entry.reason}</p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-gray-700 mb-1">Tool Arguments Payload</p>
              <pre className="p-3 bg-gray-950 text-gray-100 font-mono text-[11px] rounded-lg overflow-x-auto max-h-48">
                {JSON.stringify(entry.toolArgs ?? {}, null, 2)}
              </pre>
            </div>

            <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200/60 font-mono text-[11px] space-y-1">
              <p className="font-semibold text-emerald-900 font-sans flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-600" /> Tamper-Evident SHA-256 Proof Chain
              </p>
              <p className="text-gray-600 break-all">
                <span className="text-gray-400 font-bold">Entry Hash:</span> {entry.entryHash || 'Legacy / Unhashed'}
              </p>
              <p className="text-gray-600 break-all">
                <span className="text-gray-400 font-bold">Prev Hash:</span> {entry.prevHash || 'GENESIS'}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


// ── Filters ───────────────────────────────────────────────────────────────────

type Filters = { agentId: string; effect: string; limit: string };

function buildUrl(filters: Filters) {
  const p = new URLSearchParams();
  if (filters.agentId) p.set('agentId', filters.agentId);
  if (filters.effect) p.set('effect', filters.effect);
  p.set('limit', filters.limit);
  return `/api/audit?${p.toString()}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { data: agents } = useSWR<Agent[]>('/api/agents', fetcher);
  const [filters, setFilters] = useState<Filters>({ agentId: '', effect: '', limit: '50' });
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const { data: entries, isLoading } = useSWR<AuditEntry[]>(
    buildUrl(filters),
    fetcher,
    { refreshInterval: 5000 }
  );

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/audit/verify');
      const data = await res.json();
      setVerifyResult(data);
    } catch {
      setVerifyResult({ valid: false, totalEntries: 0, error: 'Network error verifying chain' });
    } finally {
      setVerifying(false);
    }
  };

  const agentMap = Object.fromEntries((agents ?? []).map((a) => [a.id, a.name]));

  const criticalEntries = entries?.filter((e) => e.effect === 'denied' || e.effect === 'requires_approval' || !!e.simulatedEffect) ?? [];
  const allowedEntries = entries?.filter((e) => e.effect === 'allowed' && !e.simulatedEffect) ?? [];

  const select = 'border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400';

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-lg lg:text-2xl font-semibold text-gray-900">Tamper-Evident Audit Trail</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cryptographically hash-chained evidence log for all agent tool executions and policy decisions.
          </p>
        </div>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerifyChain}
            disabled={verifying}
            className="flex items-center gap-1.5 text-xs font-medium border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
          >
            {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5 text-emerald-600" />}
            Verify SHA-256 Chain
          </Button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verifyResult && (
        <div className={`mb-6 p-3 rounded-lg border flex items-center justify-between ${verifyResult.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          <div className="flex items-center gap-2">
            {verifyResult.valid ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">
                {verifyResult.valid
                  ? `Cryptographic Chain Intact: ${verifyResult.verifiedCount ?? verifyResult.totalEntries} entries verified with SHA-256 hash chaining.`
                  : `Integrity Check Failed: ${verifyResult.error}`}
              </p>
              <p className="text-xs text-gray-500">
                {verifyResult.valid ? 'Zero unauthorized insertions, alterations, or deletions detected.' : 'Evidence tampering detected!'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setVerifyResult(null)} className="h-7 text-xs">
            Dismiss
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Agent</label>
          <select
            className={select}
            value={filters.agentId}
            onChange={(e) => setFilters((f) => ({ ...f, agentId: e.target.value }))}
          >
            <option value="">All agents</option>
            {agents?.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Effect</label>
          <select
            className={select}
            value={filters.effect}
            onChange={(e) => setFilters((f) => ({ ...f, effect: e.target.value }))}
          >
            <option value="">All decisions</option>
            <option value="allowed">allowed</option>
            <option value="denied">denied</option>
            <option value="requires_approval">requires_approval</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Limit</label>
          <select
            className={select}
            value={filters.limit}
            onChange={(e) => setFilters((f) => ({ ...f, limit: e.target.value }))}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ agentId: '', effect: '', limit: '50' })}
            className="h-8"
          >
            Reset
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-12">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading audit logs...
        </div>
      ) : entries?.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border rounded-lg bg-gray-50/50">
          <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No audit entries yet. Run an agent through the gateway to generate evidence.</p>
        </div>
      ) : (
        <>
          {/* Critical: Blocks, Approvals, and Watch Mode Observations */}
          {criticalEntries.length > 0 && (
            <Card className="mb-6 border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between text-amber-900">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Security Incidents, Approvals &amp; Observations
                  </span>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                    {criticalEntries.length} events
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {criticalEntries.map((e) => (
                  <AuditRow key={e.id} entry={e} agentName={agentMap[e.agentId] ?? e.agentId} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Allowed entries */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between text-gray-800">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Authorized &amp; Executed Actions
                </span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {allowedEntries.length} events
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {allowedEntries.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-6">No allowed entries in this filter view.</p>
              ) : (
                allowedEntries.map((e) => (
                  <AuditRow key={e.id} entry={e} agentName={agentMap[e.agentId] ?? e.agentId} />
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
