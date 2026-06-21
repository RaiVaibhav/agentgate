import { NextRequest, NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/api/proxyFetch';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  ['agentId', 'sessionId', 'effect', 'limit'].forEach((key) => {
    const val = searchParams.get(key);
    if (val) params.set(key, val);
  });
  const res = await proxyFetch(`/audit?${params.toString()}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
