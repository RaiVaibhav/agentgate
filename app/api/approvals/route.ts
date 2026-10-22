import { NextRequest, NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/api/proxyFetch';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const status = searchParams.get('status');

    const params = new URLSearchParams();
    if (agentId) params.set('agentId', agentId);
    if (status) params.set('status', status);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await proxyFetch(`/approvals${query}`);
    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }
    const data = await res.json();
    return NextResponse.json(Array.isArray(data) ? data : [], { status: 200 });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
