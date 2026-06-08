import type { DashboardStats, ReviewSummary } from '../types/index';

// Empty string = relative URL, proxied by Netlify to Render via _redirects
// In development, set VITE_API_URL=http://localhost:3000 in .env.local
const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}/api${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
  } catch (err) {
    throw new Error(`Failed to fetch: ${err instanceof Error ? err.message : 'Network error'}`);
  }

  const contentType = res.headers.get('content-type') ?? '';

  // If we got HTML back, the proxy isn't working
  if (contentType.includes('text/html')) {
    throw new Error(`Got HTML instead of JSON from ${url} — check Netlify proxy config`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getDashboardStats: () => apiFetch<DashboardStats>('/dashboard/stats'),
  getReviews: (limit = 20, offset = 0) =>
    apiFetch<ReviewSummary[]>(`/reviews?limit=${limit}&offset=${offset}`),
  getRepositoryAnalytics: (id: string) =>
    apiFetch<ReviewSummary[]>(`/repositories/${id}/analytics`),
};
