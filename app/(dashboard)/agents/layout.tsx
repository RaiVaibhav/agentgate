'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  ShieldCheck,
  ScrollText,
  Menu,
  Server,
  CheckCircle2,
  Sparkles,
  Lock,
  Layers,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const navItems = [
  { href: '/agents', icon: Bot, label: 'Agents & Mandates' },
  { href: '/agents/services', icon: Server, label: 'MCP Services & Tools' },
  { href: '/agents/sessions', icon: ShieldCheck, label: 'Active Sessions' },
  { href: '/agents/approvals', icon: CheckCircle2, label: 'Human Approvals' },
  { href: '/agents/audit', icon: ScrollText, label: 'Evidence & Audit' },
];

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch pending approvals count to badge the nav
  const { data: approvals } = useSWR<Array<{ status: string }>>(
    '/api/approvals?status=pending',
    fetcher,
    { refreshInterval: 6000 }
  );
  const pendingCount = approvals?.filter((a) => a.status === 'pending').length ?? 0;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full">
      {/* Subheader / Status Bar */}
      <div className="border-b border-gray-200 bg-linear-to-r from-gray-50 via-white to-gray-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-gray-800">AgentGate In-Line Gateway</span>
          <Badge variant="outline" className="text-[10px] h-4 bg-emerald-50 text-emerald-800 border-emerald-300">
            Fail-Closed Enforced
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-gray-500">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-gray-400" />
            <span>AES-256-GCM Vault</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-gray-700 font-medium">Earned Autonomy Engine</span>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <span className="font-semibold text-gray-900">Control Plane</span>
        <Button
          className="-mr-3"
          variant="ghost"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <aside
          className={`w-64 bg-white lg:bg-gray-50/80 border-r border-gray-200 lg:block ${
            sidebarOpen ? 'block' : 'hidden'
          } lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="h-full overflow-y-auto p-4 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Governance
                </p>
                <Layers className="h-3.5 w-3.5 text-gray-400" />
              </div>

              {navItems.map((item) => {
                const isActive =
                  item.href === '/agents'
                    ? pathname === '/agents'
                    : pathname.startsWith(item.href);

                const isApprovals = item.href === '/agents/approvals';

                return (
                  <Link key={item.href} href={item.href} passHref>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={`shadow-none my-1 w-full justify-between group transition-all text-xs font-medium ${
                        isActive
                          ? 'bg-white text-gray-950 font-semibold shadow-xs border border-gray-200/80'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon
                          className={`h-4 w-4 transition-colors ${
                            isActive ? 'text-orange-600' : 'text-gray-400 group-hover:text-gray-600'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>

                      {isApprovals && pendingCount > 0 && (
                        <span className="inline-flex items-center justify-center h-4 min-w-4 px-1.5 text-[10px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                          {pendingCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </div>

            {/* Bottom info widget */}
            <div className="p-3 bg-linear-to-b from-gray-50 to-gray-100/90 rounded-xl border border-gray-200 mt-6 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-gray-800 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                <span>Autonomy Ladder</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                4-tier progressive freedom based on cryptographic evidence &amp; human alignment.
              </p>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-0 lg:p-4 bg-white/50">{children}</main>
      </div>
    </div>
  );
}
