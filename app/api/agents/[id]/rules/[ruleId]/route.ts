import { NextRequest, NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/api/proxyFetch';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const { id, ruleId } = await params;
  const res = await proxyFetch(`/agents/${id}/rules/${ruleId}`, {
    method: 'DELETE',
  });
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
