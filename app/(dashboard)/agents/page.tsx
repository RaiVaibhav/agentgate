'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Plus, Trash2, Loader2, Server, ShieldCheck, Clock } from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Agent = { id: string; name: string; description: string | null; createdAt: string };
type Service = { id: string; agentId: string; name: string; tools: unknown[] };
type Session = { id: string; agentId: string; status: string; expiresAt: string; token: string };

function AgentCard({ agent }: { agent: Agent }) {
  const { data: services } = useSWR<Service[]>(`/api/services?agentId=${agent.id}`, fetcher);
  const { data: allSessions } = useSWR<Session[]>('/api/sessions', fetcher);
  const [deleting, setDeleting] = useState(false);

  const sessions = allSessions?.filter((s) => s.agentId === agent.id) ?? [];
  const activeSessions = sessions.filter((s) => s.status === 'active');

  async function handleDelete() {
    if (!confirm(`Delete agent "${agent.name}" and all its services/sessions?`)) return;
    setDeleting(true);
    await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
    mutate('/api/agents');
    setDeleting(false);
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 rounded-full p-2">
              <Bot className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-base">{agent.name}</CardTitle>
              {agent.description && <p className="text-xs text-gray-500 mt-0.5">{agent.description}</p>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}
            className="text-gray-400 hover:text-red-600 h-8 w-8 p-0">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          {/* Services */}
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" />
            {services && services.length > 0 ? (
              <span>{services.map((s) => s.name).join(', ')}</span>
            ) : (
              <Link href="/agents/services" className="text-orange-600 hover:underline">
                Add a service →
              </Link>
            )}
          </div>
          {/* Active sessions */}
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''}</span>
          </div>
          {/* Tools count */}
          {services && services.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span>{services.reduce((acc, s) => acc + ((s.tools as unknown[])?.length ?? 0), 0)} tools configured</span>
            </div>
          )}
        </div>

        {/* Quick session info */}
        {activeSessions.length > 0 && (
          <div className="mt-3 space-y-1">
            {activeSessions.slice(0, 2).map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-50 text-green-600">
                  <Clock className="h-3 w-3" />
                  expires {new Date(s.expiresAt).toLocaleTimeString()}
                </span>
                <code className="text-gray-400 truncate max-w-48">{s.id.slice(0, 8)}...</code>
              </div>
            ))}
            {activeSessions.length > 2 && (
              <p className="text-xs text-gray-400">+{activeSessions.length - 2} more</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateAgentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (res.ok) { setName(''); setDescription(''); onCreated(); }
    else { const d = await res.json(); setError(d.error ?? 'Failed'); }
    setSaving(false);
  }

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle className="text-base">New Agent</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <Label htmlFor="agent-name" className="text-xs">Name</Label>
            <Input id="agent-name" placeholder="e.g. GitHub Bot" value={name}
              onChange={e => setName(e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-48">
            <Label htmlFor="agent-desc" className="text-xs">Description (optional)</Label>
            <Input id="agent-desc" placeholder="What does this agent do?" value={description}
              onChange={e => setDescription(e.target.value)} className="h-9" />
          </div>
          <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white h-9" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create Agent
          </Button>
        </form>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default function AgentsPage() {
  const { data: agents, mutate: refreshAgents, isLoading } = useSWR<Agent[]>('/api/agents', fetcher);

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">Agents</h1>
      <CreateAgentForm onCreated={() => refreshAgents()} />
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : agents?.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No agents yet. Create one above.</p>
        </div>
      ) : (
        agents?.map((agent) => <AgentCard key={agent.id} agent={agent} />)
      )}
    </section>
  );
}
