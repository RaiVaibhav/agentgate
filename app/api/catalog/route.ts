import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3003';

export async function GET() {
  const res = await fetch(`${GATEWAY_URL}/catalog`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
