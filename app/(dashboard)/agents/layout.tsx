'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Bot, ShieldCheck, ScrollText, Menu, Server } from 'lucide-react';

const navItems = [
  { href: '/agents',           icon: Bot,         label: 'Agents'   },
  { href: '/agents/services',  icon: Server,      label: 'Services' },
  { href: '/agents/sessions',  icon: ShieldCheck, label: 'Sessions' },
  { href: '/agents/audit',     icon: ScrollText,  label: 'Audit Log'},
];

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <span className="font-medium">Agent Permissions</span>
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
          className={`w-64 bg-white lg:bg-gray-50 border-r border-gray-200 lg:block ${
            sidebarOpen ? 'block' : 'hidden'
          } lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="h-full overflow-y-auto p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-3">
              Agent Permissions
            </p>
            {navItems.map((item) => {
              const isActive =
                item.href === '/agents'
                  ? pathname === '/agents'
                  : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} passHref>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={`shadow-none my-1 w-full justify-start ${isActive ? 'bg-gray-100' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-0 lg:p-4">{children}</main>
      </div>
    </div>
  );
}
