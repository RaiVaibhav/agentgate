import { SignJWT, jwtVerify } from 'jose';

const key = new TextEncoder().encode(process.env.PROXY_SECRET!);

export type SessionTokenPayload = {
  sessionId: string;
  agentId: string;
};

export async function signSessionToken(payload: SessionTokenPayload, expiresAt: Date): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key);
}

export async function verifySessionToken(token: string): Promise<SessionTokenPayload> {
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
  return payload as SessionTokenPayload;
}
