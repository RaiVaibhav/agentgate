'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileCode,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  Ban,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ContractStudioPage() {
  const [selectedRepo, setSelectedRepo] = useState<'mvp' | 'ecommerce' | 'saas'>('mvp');
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const { data, mutate, isValidating } = useSWR(
    `/api/contract?repo=${selectedRepo}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const contract = data?.contract;
  const targetToolName = data?.targetTool || 'issue_refund';
  const toolData = contract?.tools?.[targetToolName];

  const handleCopy = () => {
    if (!contract) return;
    navigator.clipboard.writeText(JSON.stringify(contract, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <FileCode className="h-6 w-6 text-indigo-600" />
              Contract Studio & Compiler
            </h1>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-mono">
              Spec v2.0
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            Declarative stateful contracts compiled directly from backend route ASTs (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">ts-morph</code>) and system prompts with zero runtime LLM overhead.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isValidating}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin text-indigo-600' : ''}`} />
            {isValidating ? 'Compiling...' : 'Recompile Contract'}
          </Button>

          <Button
            variant={showJson ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowJson(!showJson)}
            className="flex items-center gap-1.5"
          >
            <FileCode className="h-3.5 w-3.5" />
            {showJson ? 'Visual Cards' : 'View Raw JSON'}
          </Button>

          <Button
            size="sm"
            onClick={handleCopy}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
        </div>
      </div>

      {/* Target Repo Tabs */}
      <div className="flex items-center justify-between">
        <Tabs value={selectedRepo} onValueChange={(v) => setSelectedRepo(v as any)} className="w-auto">
          <TabsList className="bg-gray-100/80 p-1">
            <TabsTrigger value="mvp" className="text-xs font-medium">
              ⚡ Pure MVP (agentgate-mvp)
            </TabsTrigger>
            <TabsTrigger value="ecommerce" className="text-xs font-medium">
              🛒 E-Commerce Refunds
            </TabsTrigger>
            <TabsTrigger value="saas" className="text-xs font-medium">
              🏢 SaaS Invoice Credits
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 font-mono">
          <span>CLI:</span>
          <span className="bg-gray-900 text-gray-100 px-2 py-1 rounded text-[11px]">
            npx agentgate compile --routes routes/
          </span>
        </div>
      </div>

      {showJson ? (
        /* Raw JSON Viewer */
        <Card className="border-gray-200 bg-gray-950 text-gray-100 font-mono text-xs overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900 text-gray-400">
            <span>agentgate.contract.json</span>
            <span>Validated by Zod (v2.0)</span>
          </div>
          <CardContent className="p-4 overflow-x-auto max-h-[600px]">
            <pre>{JSON.stringify(contract, null, 2)}</pre>
          </CardContent>
        </Card>
      ) : (
        /* Visual Cards Breakdown */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column: Invariants & Rules */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Ownership Binding */}
            {toolData?.ownership && (
              <Card className="border-indigo-100 bg-linear-to-br from-indigo-50/40 via-white to-white shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-indigo-600" />
                      1. Ownership Binding & Principal Verification
                    </CardTitle>
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px]">
                      Rule #1
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Allows customer to paste entity IDs from email receipts, but deterministically checks ownership before tool execution.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-gray-100 text-xs font-mono">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Lookup Tool</span>
                      <span className="font-semibold text-gray-800">{toolData.ownership.lookupTool}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Match Argument</span>
                      <span className="font-semibold text-gray-800">{toolData.ownership.matchArg}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Owner Field</span>
                      <span className="font-semibold text-gray-800">{toolData.ownership.ownerField}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Context Binding</span>
                      <span className="font-semibold text-indigo-600">context.{toolData.ownership.equalsContext}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 2. Route AST Preconditions */}
            <Card className="shadow-xs border-gray-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    2. Route AST Preconditions ({toolData?.preconditions?.length || 0} Invariants)
                  </CardTitle>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                    Fail-Closed (BLOCK)
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Extracted via AST analysis from backend route handlers and system prompts. Evaluated in &lt;1ms.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-2.5">
                {toolData?.preconditions?.map((rule: any, i: number) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900">
                          {rule.requirePriorTool
                            ? `requirePriorTool(${rule.requirePriorTool})`
                            : `${rule.field || rule.argField} ${rule.op} ${rule.value ?? rule.targetField}`}
                        </span>
                        {rule.whenArg && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            when reason == {rule.whenArg.value}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono block">
                        Source: {rule.source}
                      </span>
                    </div>

                    <Badge className="w-fit text-[11px] bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-50 font-mono">
                      onViolation: {rule.onViolation}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 3. Thresholds & Manager Escalations */}
            {toolData?.thresholds && toolData.thresholds.length > 0 && (
              <Card className="shadow-xs border-amber-200/70 bg-amber-50/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      3. Operational Thresholds & Human Escalation
                    </CardTitle>
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[11px]">
                      Three-State (ESCALATE)
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Actions within policy execute immediately; amounts exceeding this boundary pause execution for human manager sign-off.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {toolData.thresholds.map((t: any, i: number) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-amber-200 bg-white gap-2 text-xs">
                      <div>
                        <div className="font-mono font-semibold text-gray-900">
                          {t.argField} {t.op} {t.value} (cents)
                        </div>
                        <div className="text-[11px] text-amber-700 font-medium">
                          {t.unitConversionNote}
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">Source: {t.source}</span>
                      </div>
                      <Badge className="w-fit bg-amber-500 text-white font-mono text-[11px]">
                        {t.onViolation}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Budgets, Anti-Stacking & Unmappables */}
          <div className="space-y-6">
            {/* Cumulative Rolling Budget */}
            {toolData?.budget && (
              <Card className="shadow-xs border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    Rolling Customer Budget
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Two-phase atomic reservation prevents parallel tool double-spending and incognito session resets.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3 text-xs">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-2">
                    <div className="flex justify-between font-mono">
                      <span className="text-gray-500">Max Budget:</span>
                      <span className="font-bold text-gray-900">{toolData.budget.maxTotal} cents</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-gray-500">Rolling Window:</span>
                      <span className="font-bold text-gray-900">{toolData.budget.windowSeconds / 3600} hours ({toolData.budget.windowSeconds}s)</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-gray-500">Quota Scope:</span>
                      <span className="font-bold text-indigo-600">principalId (Customer)</span>
                    </div>
                    {toolData.budget.sharedAcrossTools && (
                      <div className="pt-1 border-t border-gray-200/80">
                        <span className="text-gray-500 block text-[10px] mb-1">Shared Across Tools:</span>
                        <div className="flex flex-wrap gap-1">
                          {toolData.budget.sharedAcrossTools.map((t: string) => (
                            <Badge key={t} variant="secondary" className="text-[10px] font-mono">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Anti-Stacking Mutual Exclusion */}
            {toolData?.mutualExclusion && (
              <Card className="shadow-xs border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Ban className="h-4 w-4 text-rose-600" />
                    Anti-Stacking Exclusion
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Prevents agents from sweet-talking stacking multiple resolutions on the same entity.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-2 text-xs">
                  <div className="bg-rose-50/40 border border-rose-100 p-3 rounded-lg space-y-2">
                    <div className="font-mono text-gray-700">
                      <span className="text-gray-400 text-[10px] block">Entity Scope Key:</span>
                      <span className="font-semibold">{toolData.mutualExclusion.scopeKey}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block mb-1">Conflicting Tools:</span>
                      <div className="flex flex-wrap gap-1">
                        {toolData.mutualExclusion.conflictingTools.map((t: string) => (
                          <Badge key={t} className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-mono">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Unmappable Rules Transparency */}
            <Card className="shadow-xs border-gray-200 bg-gray-50/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Unmappable Rules
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                    Rule #6
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Compiler honesty: flags prompt rules that lack corresponding backend schema fields instead of inventing hallucinations.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-xs">
                {contract?.unmappableRules?.length > 0 ? (
                  contract.unmappableRules.map((u: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg border border-amber-200/80 bg-white space-y-1">
                      <p className="font-medium text-gray-900 text-xs italic">
                        "{u.rawText}"
                      </p>
                      <p className="text-[11px] text-rose-600 font-mono">
                        Reason: {u.reason}
                      </p>
                      <span className="text-[10px] text-gray-400 font-mono block">
                        Source: {u.source}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400">All prompt rules successfully mapped to schemas.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
