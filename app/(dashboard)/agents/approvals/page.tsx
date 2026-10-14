'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Terminal,
  UserCheck,
  AlertTriangle,
  FileCode,
  Sparkles,
  Bot,
  Server,
  ArrowRight,
  ShieldCheck,
  Layers,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Approval = {
  id: string;
  sessionId: string;
  agentId: string;
  agentName: string;
  serviceId: string;
  serviceName: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: number;
  decisionNotes?: string;
};

const QUICK_REJECTION_REASONS = [
  'Parameter amount exceeds authorized safety limit',
  'Unauthorized filesystem path or sensitive credential access',
  'Tool invocation outside current agent mandate',
  'Anomalous tool frequency / repetitive looping detected',
];

export default function ApprovalsPage() {
  const { data: approvals, error, isLoading } = useSWR<Approval[]>(
    '/api/approvals',
    fetcher,
    { refreshInterval: 4000 }
  );

  const [activeTab, setActiveTab] = useState<string>('pending');
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingApproval, setRejectingApproval] = useState<Approval | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const pendingCount = approvals?.filter((a) => a.status === 'pending').length ?? 0;
  const approvedCount = approvals?.filter((a) => a.status === 'approved').length ?? 0;
  const rejectedCount = approvals?.filter((a) => a.status === 'rejected').length ?? 0;
  const totalCount = approvals?.length ?? 0;

  const filteredApprovals = (approvals ?? []).filter((item) => {
    if (activeTab === 'all') return true;
    return item.status === activeTab;
  });

  async function handleApprove(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`/api/approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Authorized via Operator Dashboard' }),
      });
      if (res.ok) {
        mutate('/api/approvals');
      }
    } finally {
      setActingId(null);
    }
  }

  async function handleConfirmReject() {
    if (!rejectingApproval) return;
    setActingId(rejectingApproval.id);
    try {
      const res = await fetch(`/api/approvals/${rejectingApproval.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason || 'Action rejected by security administrator',
        }),
      });
      if (res.ok) {
        setRejectingApproval(null);
        setRejectReason('');
        mutate('/api/approvals');
      }
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="flex-1 p-4 lg:p-8 max-w-6xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-950 tracking-tight flex items-center gap-2">
              Human Approvals Gate
            </h1>
            {pendingCount > 0 ? (
              <Badge variant="warning" className="animate-pulse">
                {pendingCount} Awaiting Authorization
              </Badge>
            ) : (
              <Badge variant="success">All Clear</Badge>
            )}
          </div>
          <p className="text-xs lg:text-sm text-gray-500 mt-1">
            Real-time human-in-the-loop authorization queue for sensitive parameter thresholds and Level 2 agent tool calls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate('/api/approvals')}
            className="text-xs text-gray-600 border-gray-200 hover:bg-gray-50 h-8"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Sync Queue
          </Button>
        </div>
      </div>

      {/* Info Strip */}
      <div className="mb-6 p-3.5 rounded-xl bg-linear-to-r from-amber-50/70 via-indigo-50/40 to-emerald-50/60 border border-amber-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-gray-700">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            <strong>Fail-Closed Gate Active:</strong> Intercepted tool executions pause with execution tokens until explicitly signed off.
          </span>
        </div>
        <div className="flex items-center gap-3 text-gray-500 font-mono text-[11px]">
          <span>Webhook: Slack / Teams connected</span>
          <span>•</span>
          <span>Auto-Timeout: 10m fail-block</span>
        </div>
      </div>

      {/* Radix Tabs Filter */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="bg-gray-100/80 p-1 rounded-lg">
          <TabsTrigger value="pending" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <span>Pending</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
              pendingCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'
            }`}>
              {pendingCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <span>Approved</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
              {approvedCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <span>Rejected</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
              {rejectedCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <span>All History</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-600">
              {totalCount}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <Card className="border-gray-200 shadow-xs">
              <CardContent className="p-12 text-center text-gray-500">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-xs">Listening for agent execution gates...</p>
              </CardContent>
            </Card>
          ) : filteredApprovals.length === 0 ? (
            <Card className="border-dashed border-gray-200 shadow-xs bg-gray-50/40">
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-900">
                  {activeTab === 'pending' ? 'No pending approvals in queue' : `No ${activeTab} items recorded`}
                </h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                  {activeTab === 'pending'
                    ? 'When an agent calls a tool that triggers a parameter gate (e.g. transfer > $500), execution will pause here in real-time.'
                    : 'All decisions made by operators or automated gates are signed and logged for audit compliance.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredApprovals.map((req) => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';

                return (
                  <Card
                    key={req.id}
                    className={`border transition-all shadow-xs overflow-hidden ${
                      isPending
                        ? 'border-amber-300/80 bg-amber-50/15 ring-1 ring-amber-400/20'
                        : 'border-gray-200/90 bg-white hover:border-gray-300'
                    }`}
                  >
                    <CardHeader className="pb-3 pt-4 px-5 bg-white border-b border-gray-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2 rounded-lg ${
                              isPending
                                ? 'bg-amber-100 text-amber-800'
                                : isApproved
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isPending ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : isApproved ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-bold text-gray-950">
                                {req.toolName}
                              </span>
                              <Badge variant="outline" className="text-[10px] font-mono text-gray-600 bg-gray-50">
                                <Server className="h-3 w-3 mr-1 text-gray-400" />
                                {req.serviceName}
                              </Badge>
                              <Badge variant="ai" className="text-[10px]">
                                <Bot className="h-3 w-3 mr-1 text-indigo-500" />
                                {req.agentName}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 self-start sm:self-auto">
                          <Badge
                            variant={isPending ? 'warning' : isApproved ? 'success' : 'destructive'}
                            className="capitalize text-xs font-semibold"
                          >
                            {req.status}
                          </Badge>
                          <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3" />
                            {new Date(req.requestedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="px-5 py-4 space-y-3">
                      {req.reason && (
                        <div className="text-xs text-amber-950 bg-amber-50/80 border border-amber-200/70 rounded-lg px-3.5 py-2 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Interception Trigger:</span> {req.reason}
                          </div>
                        </div>
                      )}

                      {/* Arguments Inspector */}
                      <div className="rounded-xl bg-zinc-950 text-zinc-100 p-3.5 font-mono text-xs overflow-x-auto border border-zinc-800 shadow-inner">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 border-b border-zinc-800 pb-2 mb-2">
                          <span className="flex items-center gap-1.5 text-zinc-300 font-sans font-semibold">
                            <FileCode className="h-3.5 w-3.5 text-emerald-400" />
                            Proposed Execution Payload
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            req_id: {req.id.slice(0, 8)}
                          </span>
                        </div>
                        <pre className="text-emerald-400 leading-relaxed overflow-x-auto">
                          {JSON.stringify(req.toolArgs, null, 2)}
                        </pre>
                      </div>

                      {/* Decision Notes */}
                      {req.decisionNotes && (
                        <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2">
                          <span className="font-semibold text-gray-900">Operator Notes:</span>{' '}
                          {req.decisionNotes}{' '}
                          {req.resolvedAt && (
                            <span className="text-gray-400 font-mono text-[11px]">
                              (signed at {new Date(req.resolvedAt).toLocaleTimeString()})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Pending Actions */}
                      {isPending && (
                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actingId === req.id}
                            onClick={() => {
                              setRejectingApproval(req);
                              setRejectReason('');
                            }}
                            className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 h-8 font-medium"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Deny &amp; Block
                          </Button>

                          <Button
                            size="sm"
                            disabled={actingId === req.id}
                            onClick={() => handleApprove(req.id)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs h-8 font-medium"
                          >
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            {actingId === req.id ? 'Authorizing...' : 'Authorize Execution'}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Radix Dialog for Rejection */}
      <Dialog
        open={rejectingApproval !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingApproval(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 text-base">
              <XCircle className="h-5 w-5" />
              Deny Tool Execution
            </DialogTitle>
            <DialogDescription className="text-xs">
              Rejecting will send a fail-closed response back to the agent with cryptographic audit evidence.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="text-xs font-semibold text-gray-700">Quick Justification Presets:</div>
            <div className="space-y-1.5">
              {QUICK_REJECTION_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRejectReason(preset)}
                  className={`w-full text-left text-xs p-2 rounded-lg border transition-colors ${
                    rejectReason === preset
                      ? 'border-rose-400 bg-rose-50 text-rose-900 font-medium'
                      : 'border-gray-200 bg-gray-50/60 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Custom Rejection Reason
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter specific policy violation explanation..."
                className="w-full text-xs p-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectingApproval(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmReject}
              disabled={actingId !== null}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {actingId !== null ? 'Rejecting...' : 'Confirm Denial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
