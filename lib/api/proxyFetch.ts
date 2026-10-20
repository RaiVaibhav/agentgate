/**
 * Authenticated fetch to the proxy service.
 * Reads the current user from the Next.js session cookie and
 * injects X-User-Id so the proxy can scope agents to the right user.
 */
import { getUser } from '@/lib/db/queries';

let rawProxyUrl = process.env.PROXY_URL ?? 'http://localhost:3001';
if (!rawProxyUrl.startsWith('http://') && !rawProxyUrl.startsWith('https://')) {
  rawProxyUrl = `https://${rawProxyUrl}`;
}
const PROXY_URL = rawProxyUrl.replace(/\/$/, '');

export async function proxyFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${PROXY_URL}${cleanPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      'X-User-Id': String(user.id),
    },
  });
}
