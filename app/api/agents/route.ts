import { NextRequest, NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/api/proxyFetch';

export async function GET() {
  const res = await proxyFetch('/agents');
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await proxyFetch('/agents', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
