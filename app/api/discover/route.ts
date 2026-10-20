import { NextRequest, NextResponse } from 'next/server';

let rawGatewayUrl = process.env.GATEWAY_URL ?? 'http://localhost:3003';
if (!rawGatewayUrl.startsWith('http://') && !rawGatewayUrl.startsWith('https://')) {
  rawGatewayUrl = `https://${rawGatewayUrl}`;
}
const GATEWAY_URL = rawGatewayUrl.replace(/\/$/, '');

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${GATEWAY_URL}/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
