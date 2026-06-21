'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldX, AlertTriangle, Loader2, ScrollText } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type AuditEntry = {
  id: string;
  sessionId: string | null;
  agentId: string;
  resourceType: string;
  resourcePath: string;
  action: string;
  effect: 'allowed' | 'denied' | 'anomaly';
  matchedRuleId: string | null;
  timestamp: string;
};

type Agent = { id: string; name: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function EffectBadge({ effect }: { effect: AuditEntry['effect'] }) {
  if (effect === 'allowed')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
        <ShieldCheck className="h-3 w-3" /> allowed
      </span>
    );
  if (effect === 'denied')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
        <ShieldX className="h-3 w-3" /> denied
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
      <AlertTriangle className="h-3 w-3" /> anomaly
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
  const rowBg =
    entry.effect === 'allowed'
      ? 'hover:bg-green-50'
      : entry.effect === 'denied'
      ? 'hover:bg-red-50'
      : 'bg-amber-50 hover:bg-amber-100';

  return (
    <div className={`flex flex-wrap items-center gap-3 py-2.5 px-4 border-b border-gray-100 last:border-0 ${rowBg}`}>
      <EffectBadge effect={entry.effect} />
      <div className="flex-1 min-w-48">
        <p className="text-sm font-mono text-gray-800 truncate">{entry.resourcePath}</p>
        <p className="text-xs text-gray-400">
          {agentName} · {entry.resourceType} · {entry.action}
        </p>
      </div>
      {entry.matchedRuleId ? (
        <span className="text-xs text-gray-400 font-mono hidden sm:block truncate max-w-36">
          rule: {entry.matchedRuleId.slice(0, 8)}…
        </span>
      ) : (
        <span className="text-xs text-gray-300 hidden sm:block">no match</span>
      )}
      <span className="text-xs text-gray-400 shrink-0">
        {getRelativeTime(new Date(entry.timestamp))}
      </span>
    </div>
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

  const { data: entries, isLoading } = useSWR<AuditEntry[]>(
    buildUrl(filters),
    fetcher,
    { refreshInterval: 5000 }
  );

  const agentMap = Object.fromEntries((agents ?? []).map((a) => [a.id, a.name]));

  const anomalies = entries?.filter((e) => e.effect === 'anomaly' || e.effect === 'denied') ?? [];
  const allowed = entries?.filter((e) => e.effect === 'allowed') ?? [];

  const select = 'border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400';

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">Audit Log</h1>
      <p className="text-sm text-gray-500 mb-6">
        Every access decision made by the proxy. Refreshes every 5 seconds.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Agent</label>
          <select
            className={select}
            value={filters.agentId}
            onChange={e => setFilters(f => ({ ...f, agentId: e.target.value }))}
          >
            <option value="">All agents</option>
            {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Effect</label>
          <select
            className={select}
            value={filters.effect}
            onChange={e => setFilters(f => ({ ...f, effect: e.target.value }))}
          >
            <option value="">All</option>
            <option value="allowed">allowed</option>
            <option value="denied">denied</option>
            <option value="anomaly">anomaly</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Limit</label>
          <select
            className={select}
            value={filters.limit}
            onChange={e => setFilters(f => ({ ...f, limit: e.target.value }))}
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
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log...
        </div>
      ) : entries?.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No audit entries yet. Run the proxy and make some check requests.</p>
        </div>
      ) : (
        <>
          {/* Anomalies + denials surfaced first */}
          {anomalies.length > 0 && (
            <Card className="mb-4 border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  Blocked &amp; Anomalous Access
                  <span className="ml-1 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {anomalies.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {anomalies.map((e) => (
                  <AuditRow key={e.id} entry={e} agentName={agentMap[e.agentId] ?? e.agentId} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Allowed entries */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-gray-600">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                Allowed Access
                <span className="ml-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  {allowed.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {allowed.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-4">No allowed entries in this view.</p>
              ) : (
                allowed.map((e) => (
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
