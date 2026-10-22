import { NextRequest, NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/api/proxyFetch';

export async function GET() {
  try {
    const res = await proxyFetch('/agents');
    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }
    const data = await res.json();
    return NextResponse.json(Array.isArray(data) ? data : [], { status: 200 });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
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
