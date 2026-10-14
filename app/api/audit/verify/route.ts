import { NextRequest, NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/api/proxyFetch';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const url = sessionId ? `/audit/verify?sessionId=${sessionId}` : '/audit/verify';
  const res = await proxyFetch(url);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
