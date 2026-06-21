/**
 * Authenticated fetch to the proxy service.
 * Reads the current user from the Next.js session cookie and
 * injects X-User-Id so the proxy can scope agents to the right user.
 */
import { getUser } from '@/lib/db/queries';

const PROXY_URL = process.env.PROXY_URL ?? 'http://localhost:3001';

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

  return fetch(`${PROXY_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      'X-User-Id': String(user.id),
    },
  });
}
