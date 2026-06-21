'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShieldCheck, ShieldX, Clock, Loader2, Plus, Ban, Copy, Check } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const GATEWAY_BASE = 'http://localhost:3003';

type Session = { id: string; agentId: string; serviceId: string; token: string; startedAt: string; expiresAt: string; status: 'active' | 'expired' | 'revoked' };
type Agent = { id: string; name: string };
type Service = { id: string; agentId: string; name: string; tools: Array<{ name: string; description?: string }> };
type PermDraft = { toolName: string; effect: 'allow' | 'deny'; pathArg: string; pathPattern: string; priority: number };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function StatusBadge({ status }: { status: Session['status'] }) {
  if (status === 'active') return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700"><ShieldCheck className="h-3 w-3" /> active</span>;
  if (status === 'revoked') return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700"><ShieldX className="h-3 w-3" /> revoked</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"><Clock className="h-3 w-3" /> expired</span>;
}

function SessionRow({ session, agentName, serviceName }: { session: Session; agentName: string; serviceName: string }) {
  const [revoking, setRevoking] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const gatewayUrl = `${GATEWAY_BASE}/mcp/${session.token}`;

  return (
    <div className="py-3 px-4 border-b border-gray-100 last:border-0">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={session.status} />
        <div className="flex-1 min-w-40">
          <p className="text-sm font-medium text-gray-900">{agentName}</p>
          <p className="text-xs text-gray-400">{serviceName} · {session.id.slice(0, 8)}...</p>
        </div>
        <p className="text-xs text-gray-500">Expires: {new Date(session.expiresAt).toLocaleString()}</p>
        <div className="flex gap-2">
          {session.status === 'active' && (
            <>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowUrl(!showUrl)}>
                {showUrl ? 'Hide URL' : 'Show URL'}
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 h-7"
                onClick={async () => { setRevoking(true); await fetch(`/api/sessions/${session.id}/revoke`, { method: 'POST' }); mutate('/api/sessions'); setRevoking(false); }}
                disabled={revoking}>
                {revoking ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Ban className="h-3 w-3 mr-1" /> Revoke</>}
              </Button>
            </>
          )}
        </div>
      </div>
      {showUrl && session.status === 'active' && (
        <div className="mt-2 p-2 bg-gray-50 rounded-md border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 font-medium">Gateway URL</p>
            <CopyButton text={gatewayUrl} />
          </div>
          <code className="text-xs font-mono text-orange-600 break-all block">{gatewayUrl}</code>
        </div>
      )}
    </div>
  );
}

function CreateSessionForm({ agents }: { agents: Agent[] }) {
  const [agentId, setAgentId] = useState('');
  const [duration, setDuration] = useState(60);
  const [responseCheck, setResponseCheck] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ gatewayUrl: string } | null>(null);
  const [permissions, setPermissions] = useState<Record<string, PermDraft>>({});

  // Fetch services for selected agent
  const { data: agentServices } = useSWR<Service[]>(
    agentId ? `/api/services?agentId=${agentId}` : null, fetcher
  );
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const selectedService = agentServices?.find((s) => s.id === selectedServiceId);
  const tools = (selectedService?.tools ?? []) as Array<{ name: string; description?: string }>;

  // When service changes, reset permissions to all-allow (default MCP behavior)
  function handleServiceChange(serviceId: string) {
    setSelectedServiceId(serviceId);
    const svc = agentServices?.find((s) => s.id === serviceId);
    const t = (svc?.tools ?? []) as Array<{ name: string }>;
    const initial: Record<string, PermDraft> = {};
    t.forEach((tool) => { initial[tool.name] = { toolName: tool.name, effect: 'allow', pathArg: '', pathPattern: '', priority: 1 }; });
    setPermissions(initial);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId) { setError('Select an agent'); return; }
    if (!selectedServiceId) { setError('Select a service'); return; }
    setSaving(true); setError(''); setResult(null);

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        serviceId: selectedServiceId,
        durationMinutes: duration,
        responseCheckEnabled: responseCheck,
        permissions: Object.values(permissions).flatMap((p, i) => {
          const base = {
            toolName: p.toolName,
            effect: p.effect,
            priority: tools.length - i,
          };
          const result = [base];
          // If there's a path rule on an allowed tool, add a higher-priority deny
          if (p.effect === 'allow' && p.pathArg && p.pathPattern.trim()) {
            result.push({
              toolName: p.toolName,
              effect: 'deny' as const,
              pathArg: p.pathArg,
              pathPattern: p.pathPattern.trim(),
              priority: tools.length + 10,  // higher priority than the allow
            } as any);
          }
          return result;
        }),
      }),
    });
    const data = await res.json();
    if (res.ok) { setResult({ gatewayUrl: data.gatewayUrl }); mutate('/api/sessions'); }
    else { setError(data.error ?? 'Failed to create session'); }
    setSaving(false);
  }

  const select = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400';

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle className="text-base">New Session</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1 flex-1 min-w-40">
              <Label className="text-xs">Agent</Label>
              <select className={select} value={agentId} onChange={e => { setAgentId(e.target.value); setSelectedServiceId(''); }}>
                <option value="">Select agent...</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-40">
              <Label className="text-xs">Service</Label>
              <select className={select} value={selectedServiceId} onChange={e => handleServiceChange(e.target.value)} disabled={!agentId}>
                <option value="">Select service...</option>
                {agentServices?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <Label className="text-xs">Duration (min)</Label>
              <Input type="number" min={1} max={1440} value={duration}
                onChange={e => setDuration(parseInt(e.target.value, 10) || 60)} className="h-9" />
            </div>
          </div>

          {/* Response security check toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="response-check"
              checked={responseCheck}
              onChange={e => setResponseCheck(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
            />
            <div>
              <label htmlFor="response-check" className="text-sm font-medium text-gray-900 cursor-pointer">
                🛡️ Response security scanner
              </label>
              <p className="text-xs text-gray-400">
                Scans tool responses for leaked secrets, prompt injection, and PII before returning to agent.
              </p>
            </div>
          </div>

          {/* Tool permissions */}
          {tools.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-500">Tool permissions for this session</p>
                <p className="text-xs text-gray-400">All tools allowed by default. Deny what the agent shouldn't access.</p>
              </div>
              {tools.map((tool) => {
                const perm = permissions[tool.name];
                const pathArgName = Object.keys((tool as any).inputSchema?.properties ?? {})
                  .find((k: string) => ['path', 'file', 'source', 'destination', 'filepath', 'owner', 'repo', 'query'].includes(k)) ?? '';

                return (
                  <div key={tool.name} className="px-3 py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-mono text-gray-800">{tool.name}</p>
                        {tool.description && <p className="text-xs text-gray-400">{tool.description}</p>}
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button"
                          onClick={() => setPermissions(p => ({ ...p, [tool.name]: { ...p[tool.name], effect: 'allow' } }))}
                          className={`text-xs px-2.5 py-1 rounded-full border ${perm?.effect === 'allow' ? 'bg-green-100 text-green-700 border-green-200' : 'text-gray-400 border-gray-200 hover:border-green-200'}`}>
                          Allow
                        </button>
                        <button type="button"
                          onClick={() => setPermissions(p => ({ ...p, [tool.name]: { ...p[tool.name], effect: 'deny' } }))}
                          className={`text-xs px-2.5 py-1 rounded-full border ${perm?.effect === 'deny' ? 'bg-red-100 text-red-700 border-red-200' : 'text-gray-400 border-gray-200 hover:border-red-200'}`}>
                          Deny
                        </button>
                      </div>
                      {pathArgName && perm?.effect === 'allow' && (
                        <button type="button"
                          onClick={() => setPermissions(p => ({
                            ...p,
                            [tool.name]: { ...p[tool.name], pathArg: p[tool.name].pathArg ? '' : pathArgName, pathPattern: '' }
                          }))}
                          className="text-xs text-gray-400 hover:text-gray-600 underline">
                          {perm.pathArg ? '- path rule' : '+ path rule'}
                        </button>
                      )}
                    </div>
                    {perm?.pathArg && perm.effect === 'allow' && (
                      <div className="mt-2 ml-0 flex gap-2 items-center text-xs">
                        <span className="text-gray-400">except when <code className="bg-gray-100 px-1 rounded">{perm.pathArg}</code> matches</span>
                        <input
                          type="text"
                          className="flex-1 h-6 px-2 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-400"
                          placeholder="e.g. **/.env* or **/secrets/**"
                          value={perm.pathPattern}
                          onChange={e => setPermissions(p => ({ ...p, [tool.name]: { ...p[tool.name], pathPattern: e.target.value } }))}
                        />
                        <span className="text-gray-400">→ deny</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white h-9" disabled={saving || !selectedServiceId}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create Session
          </Button>
        </form>

        {result && (
          <div className="p-3 bg-green-50 rounded-md border border-green-200">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-green-700 font-semibold">✅ Session created</p>
              <CopyButton text={result.gatewayUrl} />
            </div>
            <code className="text-xs font-mono text-orange-600 break-all block">{result.gatewayUrl}</code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SessionsPage() {
  const { data: sessions, isLoading } = useSWR<Session[]>('/api/sessions', fetcher, { refreshInterval: 10000 });
  const { data: agents } = useSWR<Agent[]>('/api/agents', fetcher);

  const agentMap = Object.fromEntries((agents ?? []).map((a) => [a.id, a.name]));

  // We'd need to fetch services to show names — for now show serviceId
  const active = sessions?.filter((s) => s.status === 'active') ?? [];
  const inactive = sessions?.filter((s) => s.status !== 'active') ?? [];

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">Sessions</h1>
      <CreateSessionForm agents={agents ?? []} />

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500" /> Active Sessions
                {active.length > 0 && <span className="ml-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{active.length}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {active.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-4">No active sessions.</p>
              ) : (
                active.map((s) => <SessionRow key={s.id} session={s} agentName={agentMap[s.agentId] ?? s.agentId} serviceName={s.serviceId.slice(0, 8)} />)
              )}
            </CardContent>
          </Card>
          {inactive.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base text-gray-500">Past Sessions</CardTitle></CardHeader>
              <CardContent className="p-0">
                {inactive.map((s) => <SessionRow key={s.id} session={s} agentName={agentMap[s.agentId] ?? s.agentId} serviceName={s.serviceId.slice(0, 8)} />)}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
