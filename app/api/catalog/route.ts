import { NextResponse } from 'next/server';

let rawGatewayUrl = process.env.GATEWAY_URL ?? 'http://localhost:3003';
if (!rawGatewayUrl.startsWith('http://') && !rawGatewayUrl.startsWith('https://')) {
  rawGatewayUrl = `https://${rawGatewayUrl}`;
}
const GATEWAY_URL = rawGatewayUrl.replace(/\/$/, '');

export async function GET() {
  const res = await fetch(`${GATEWAY_URL}/catalog`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
