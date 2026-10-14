'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Home,
  LogOut,
  Bot,
  ScrollText,
  UserCheck,
  Sparkles,
  Settings,
  CreditCard,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { signOut } from '@/app/(login)/actions';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/db/schema';
import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/pricing"
          className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Pricing
        </Link>
        <Link
          href="/sign-in"
          className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Sign In
        </Link>
        <Button asChild size="sm" className="bg-gray-950 hover:bg-gray-800 text-white shadow-xs rounded-lg text-xs h-8 px-3.5">
          <Link href="/sign-up">Start 14-Day Pilot</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger className="focus:outline-none">
        <div className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors">
          <Avatar className="size-8 border border-gray-200">
            <AvatarImage alt={user.name || ''} />
            <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-600 text-white text-xs font-semibold">
              {(user.email || 'A')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-lg border-gray-200">
        <div className="px-2 py-1.5 border-b border-gray-100 mb-1">
          <p className="text-xs font-semibold text-gray-900 truncate">{user.name || 'Operator'}</p>
          <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
        </div>
        <DropdownMenuItem asChild className="cursor-pointer text-xs">
          <Link href="/agents" className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-gray-500" />
            <span>Agent Control Plane</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer text-xs">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-gray-500" />
            <span>Team &amp; Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer text-xs">
          <Link href="/pricing" className="flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5 text-gray-500" />
            <span>Billing &amp; Tiers</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <form action={handleSignOut} className="w-full">
          <button type="submit" className="w-full">
            <DropdownMenuItem className="w-full cursor-pointer text-xs text-rose-600 focus:text-rose-600 focus:bg-rose-50">
              <LogOut className="h-3.5 w-3.5 mr-2 text-rose-500" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header() {
  const pathname = usePathname();
  const { data: approvals } = useSWR<Array<{ status: string }>>(
    '/api/approvals?status=pending',
    fetcher,
    { refreshInterval: 6000 }
  );
  const pendingApprovalsCount = approvals?.filter((a) => a.status === 'pending').length ?? 0;

  return (
    <header className="border-b border-gray-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex justify-between items-center">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-gray-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-gray-950 font-sans">
                  AgentGate
                </span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-800 border-emerald-300 font-mono font-medium">
                  v0.4-preview
                </Badge>
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/agents"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                pathname === '/agents' || pathname === '/agents/'
                  ? 'bg-gray-100 text-gray-950 font-semibold'
                  : 'text-gray-600 hover:text-gray-950 hover:bg-gray-50'
              }`}
            >
              <Bot className="h-3.5 w-3.5 text-gray-500" />
              Agents
            </Link>

            <Link
              href="/agents/approvals"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                pathname.startsWith('/agents/approvals')
                  ? 'bg-gray-100 text-gray-950 font-semibold'
                  : 'text-gray-600 hover:text-gray-950 hover:bg-gray-50'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5 text-gray-500" />
              <span>Approvals</span>
              {pendingApprovalsCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                  {pendingApprovalsCount}
                </span>
              )}
            </Link>

            <Link
              href="/agents/audit"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                pathname.startsWith('/agents/audit')
                  ? 'bg-gray-100 text-gray-950 font-semibold'
                  : 'text-gray-600 hover:text-gray-950 hover:bg-gray-50'
              }`}
            >
              <ScrollText className="h-3.5 w-3.5 text-gray-500" />
              Audit Chain
            </Link>

            <Link
              href="/agents/services"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                pathname.startsWith('/agents/services')
                  ? 'bg-gray-100 text-gray-950 font-semibold'
                  : 'text-gray-600 hover:text-gray-950 hover:bg-gray-50'
              }`}
            >
              MCP Tools
            </Link>
          </nav>
        </div>

        {/* Right side status & user */}
        <div className="flex items-center gap-3">
          {/* Status pill */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-800 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Fail-Closed Gate Active</span>
          </div>

          <Suspense fallback={<div className="h-8 w-8 rounded-full bg-gray-100 animate-pulse" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col min-h-screen bg-white">
      <Header />
      {children}
    </section>
  );
}
