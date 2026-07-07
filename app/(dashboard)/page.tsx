import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Eye, Zap, Ban, Lock, ScrollText } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="py-20 lg:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl lg:text-6xl">
            Stop AI agents from
            <span className="block text-orange-500">accessing what they shouldn't</span>
          </h1>
          <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto">
            AgentGate is a permission gateway for MCP. It sits between your AI agent and any API — Stripe, GitHub, databases — and enforces exactly what each session is allowed to do. Every tool call logged. Revoke access in one click.
          </p>
          <div className="mt-10 flex gap-4 justify-center">
            <Link href="/agents">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white rounded-full text-lg px-8">
                Open Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="https://github.com" target="_blank">
              <Button size="lg" variant="outline" className="rounded-full text-lg px-8">
                View Source
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 text-orange-600 mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Add your MCP server</h3>
              <p className="text-sm text-gray-500">
                Paste the config for any MCP server. Tools are discovered automatically — Stripe, GitHub, filesystem, anything.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 text-orange-600 mb-4">
                <Ban className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Set permissions</h3>
              <p className="text-sm text-gray-500">
                Allow or deny each tool per session. Add path patterns to block sensitive files like .env. Default is allow — you only block what matters.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 text-orange-600 mb-4">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Agent connects via gateway</h3>
              <p className="text-sm text-gray-500">
                Give the agent a gateway URL. It can only call allowed tools. Real API keys never leave your server.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What it prevents */}
      <section className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">What it prevents</h2>
          <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
            Real scenarios where agents exceeded their intended scope.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { blocked: 'Agent tries to delete a customer in Stripe', result: '🚫 Blocked — delete_customer denied' },
              { blocked: 'Agent reads .env file containing database credentials', result: '🚫 Blocked — path matches **/.env*' },
              { blocked: 'Agent forks a private repo to a public account', result: '🚫 Blocked — fork_repository denied' },
              { blocked: 'Agent pushes directly to main branch', result: '🚫 Blocked — push_files denied' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-sm text-gray-800 font-medium mb-2">{item.blocked}</p>
                <p className="text-xs font-mono text-red-600 bg-red-50 px-2 py-1 rounded">{item.result}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <Lock className="h-8 w-8 text-orange-500 mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">Credentials never exposed</h3>
              <p className="text-sm text-gray-500">
                API keys stay on your server. The agent only gets a scoped session URL.
              </p>
            </div>
            <div>
              <ScrollText className="h-8 w-8 text-orange-500 mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">Full audit trail</h3>
              <p className="text-sm text-gray-500">
                Every tool call logged with decision, matched rule, and timestamp. Real-time dashboard.
              </p>
            </div>
            <div>
              <Eye className="h-8 w-8 text-orange-500 mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">Instant revocation</h3>
              <p className="text-sm text-gray-500">
                Kill a session with one click. Agent loses access immediately — no key rotation needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Try it now</h2>
          <p className="text-gray-500 mb-8">
            Works with any MCP server. Set up in under 5 minutes.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white rounded-full text-lg px-8">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
