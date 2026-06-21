import { NextRequest, NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/api/proxyFetch';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await proxyFetch(`/sessions/${id}/revoke`, { method: 'POST' });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
