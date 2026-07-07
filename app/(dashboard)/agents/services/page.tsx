'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Zap, ShieldCheck, ShieldX } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Agent = { id: string; name: string };
type DiscoveredTool = { name: string; description?: string; inputSchema?: Record<string, unknown> };
type CatalogEntry = { id: string; name: string; description: string; url: string; authType: 'oauth' | 'bearer' | 'none'; authLabel?: string; authPlaceholder?: string; oauthNote?: string; docsUrl?: string };

type ToolPermissionDraft = {
  toolName: string;
  effect: 'allow' | 'deny';
  pathArg: string;
  pathPattern: string;
  priority: number;
};

// ── Tool row ──────────────────────────────────────────────────────────────────

function ToolRow({ tool, permission, onChange }: {
  tool: DiscoveredTool;
  permission: ToolPermissionDraft;
  onChange: (p: ToolPermissionDraft) => void;
}) {
  const [showPath, setShowPath] = useState(!!permission.pathPattern);
  const pathArgName = Object.keys((tool.inputSchema?.properties as Record<string, unknown>) ?? {})
    .find((k) => ['path', 'file', 'source', 'destination', 'filepath'].includes(k)) ?? '';

  return (
    <div className="py-3 px-4 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 font-mono">{tool.name}</p>
          {tool.description && <p className="text-xs text-gray-400 mt-0.5">{tool.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onChange({ ...permission, effect: 'allow' })}
            className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${permission.effect === 'allow' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-400 border-gray-200 hover:border-green-200'}`}>
            <ShieldCheck className="h-3 w-3" /> Allow
          </button>
          <button onClick={() => onChange({ ...permission, effect: 'deny' })}
            className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${permission.effect === 'deny' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-400 border-gray-200 hover:border-red-200'}`}>
            <ShieldX className="h-3 w-3" /> Deny
          </button>
        </div>
        {pathArgName && (
          <button onClick={() => setShowPath(!showPath)} className="text-xs text-gray-400 hover:text-gray-600 underline">
            {showPath ? 'Remove path rule' : '+ Path rule'}
          </button>
        )}
      </div>
      {showPath && pathArgName && (
        <div className="mt-2 flex gap-2 items-center">
          <span className="text-xs text-gray-400">if {pathArgName} matches</span>
          <Input className="h-7 text-xs font-mono flex-1" placeholder="e.g. **/.env* or /src/**"
            value={permission.pathPattern}
            onChange={(e) => onChange({ ...permission, pathArg: pathArgName, pathPattern: e.target.value })} />
          <span className="text-xs text-gray-400">→</span>
          <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            value={permission.effect} onChange={(e) => onChange({ ...permission, effect: e.target.value as 'allow' | 'deny' })}>
            <option value="deny">deny</option>
            <option value="allow">allow</option>
          </select>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const { data: agents } = useSWR<Agent[]>('/api/agents', fetcher);
  const { data: catalog } = useSWR<CatalogEntry[]>('/api/catalog', fetcher);

  const [configType, setConfigType] = useState<'catalog' | 'remote' | 'stdio'>('catalog');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [remoteConfig, setRemoteConfig] = useState('{\n  "url": "https://mcp.example.com",\n  "headers": {\n    "Authorization": "Bearer YOUR_KEY_HERE"\n  }\n}');
  const [stdioConfig, setStdioConfig] = useState('{\n  "command": "npx",\n  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/vaibhav/saas-starter"]\n}');
  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveredTools, setDiscoveredTools] = useState<DiscoveredTool[]>([]);
  const [permissions, setPermissions] = useState<Record<string, ToolPermissionDraft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedCatalogEntry = catalog?.find((e) => e.id === selectedCatalogId);

  function buildDiscoverConfig() {
    if (configType === 'catalog') {
      if (!selectedCatalogEntry) throw new Error('Select a service from the catalog');
      if (selectedCatalogEntry.authType === 'bearer' && !apiKey.trim()) {
        throw new Error(`Enter your ${selectedCatalogEntry.authLabel}`);
      }
      return {
        url: selectedCatalogEntry.url,
        headers: selectedCatalogEntry.authType === 'bearer'
          ? { Authorization: `Bearer ${apiKey.trim()}` }
          : {},
      };
    }
    if (configType === 'remote') {
      const parsed = JSON.parse(remoteConfig);
      // Handle nested mcp.json format: { servers: { name: { url, headers } } }
      if (parsed.servers) {
        const first = Object.values(parsed.servers)[0] as any;
        return { url: first?.url, headers: first?.headers ?? {} };
      }
      return parsed;
    }
    // stdio
    const parsed = JSON.parse(stdioConfig);
    if (parsed.servers) {
      const first = Object.values(parsed.servers)[0] as any;
      return { command: first?.command, args: first?.args ?? [], env: first?.env ?? {} };
    }
    return parsed;
  }

  async function handleDiscover() {
    setError('');
    setDiscoveredTools([]);
    setDiscovering(true);
    try {
      let config;
      try {
        config = buildDiscoverConfig();
      } catch (e) {
        throw e; // validation error — rethrow to show in UI
      }
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Discovery failed');

      const tools: DiscoveredTool[] = data.tools;
      setDiscoveredTools(tools);

      // Auto-set name from catalog
      if (configType === 'catalog' && selectedCatalogEntry && !name) {
        setName(selectedCatalogEntry.name);
      }

      // All tools deny by default
      const initial: Record<string, ToolPermissionDraft> = {};
      tools.forEach((t) => {
        initial[t.name] = { toolName: t.name, effect: 'deny', pathArg: '', pathPattern: '', priority: 1 };
      });
      setPermissions(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    }
    setDiscovering(false);
  }

  async function handleSave() {
    if (!agentId || !name) { setError('Select an agent and enter a name'); return; }
    if (discoveredTools.length === 0) { setError('Discover tools first'); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const config = buildDiscoverConfig();
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          name,
          command: config.command ?? null,
          args: config.args ?? [],
          env: config.env ?? {},
          url: config.url ?? null,
          headers: config.headers ?? {},
          tools: discoveredTools,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setSuccess('Service saved! Now go to Sessions to create a session with permissions.');
      mutate('/api/agents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  }

  const select = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400';

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">Add MCP Service</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect any MCP server to an agent. Tools are discovered automatically — you set allow/deny on each one.
      </p>

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">

          {/* Agent + name */}
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-48">
              <Label className="text-xs">Agent</Label>
              <select className={select} value={agentId} onChange={e => setAgentId(e.target.value)}>
                <option value="">Select agent...</option>
                {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-48">
              <Label className="text-xs">Service name</Label>
              <Input placeholder="e.g. Stripe, Filesystem" value={name}
                onChange={e => setName(e.target.value)} className="h-9" />
            </div>
          </div>

          {/* Config type tabs */}
          <div className="flex gap-2 flex-wrap">
            {(['catalog', 'remote', 'stdio'] as const).map((t) => (
              <button key={t} onClick={() => setConfigType(t)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${configType === t ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-gray-400 border-gray-200 hover:border-orange-200'}`}>
                {t === 'catalog' ? '⭐ Known services' : t === 'remote' ? '🌐 Remote URL' : '⚙️ Local (npx/uvx)'}
              </button>
            ))}
          </div>

          {/* Catalog picker */}
          {configType === 'catalog' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {catalog?.map((entry) => (
                  <button key={entry.id} onClick={() => setSelectedCatalogId(entry.id)}
                    className={`text-left p-3 rounded-lg border transition-colors ${selectedCatalogId === entry.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-200'}`}>
                    <p className="text-sm font-medium text-gray-900">{entry.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{entry.description}</p>
                  </button>
                ))}
              </div>
              {selectedCatalogEntry && (
                <>
                  {selectedCatalogEntry.authType === 'oauth' && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-xs text-blue-700">
                        ℹ️ {selectedCatalogEntry.oauthNote}
                      </p>
                      <a href={selectedCatalogEntry.docsUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline mt-1 block">
                        View setup docs →
                      </a>
                    </div>
                  )}
                  {selectedCatalogEntry.authType === 'bearer' && (
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">{selectedCatalogEntry.authLabel}</Label>
                      <Input type="password" className="h-9 font-mono"
                        placeholder={selectedCatalogEntry.authPlaceholder}
                        value={apiKey} onChange={e => setApiKey(e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Remote URL config */}
          {configType === 'remote' && (
            <div>
              <Label className="text-xs mb-1 block">mcp.json config (remote)</Label>
              <textarea className="w-full font-mono text-sm border border-gray-200 rounded-md p-3 h-28 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                value={remoteConfig} onChange={e => setRemoteConfig(e.target.value)} spellCheck={false} />
            </div>
          )}

          {/* Stdio config */}
          {configType === 'stdio' && (
            <div>
              <Label className="text-xs mb-1 block">mcp.json config (stdio)</Label>
              <textarea className="w-full font-mono text-sm border border-gray-200 rounded-md p-3 h-28 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                value={stdioConfig}
                onChange={e => setStdioConfig(e.target.value)} spellCheck={false} />
            </div>
          )}

          <Button onClick={handleDiscover} disabled={discovering} variant="outline" className="h-9">
            {discovering
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Discovering tools...</>
              : <><Zap className="mr-2 h-4 w-4" /> Discover Tools</>}
          </Button>
        </CardContent>
      </Card>

      {/* Discovered tools (informational only — permissions are set per-session) */}
      {discoveredTools.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{discoveredTools.length} tools discovered</CardTitle>
            <p className="text-xs text-gray-400">Permissions will be set when you create a session.</p>
          </CardHeader>
          <CardContent className="p-0">
            {discoveredTools.map((tool) => (
              <div key={tool.name} className="flex items-center gap-3 py-2 px-4 border-b border-gray-100 last:border-0">
                <p className="text-sm font-mono text-gray-800">{tool.name}</p>
                {tool.description && <p className="text-xs text-gray-400">— {tool.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(discoveredTools.length > 0 || error || success) && (
        <div className="space-y-3">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}
          {discoveredTools.length > 0 && (
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
              {saving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                : <><Plus className="mr-2 h-4 w-4" /> Save Service</>}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
