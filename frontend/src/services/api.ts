import type { DashboardStats, ReviewSummary } from '../types/index';

// Use relative URL — Netlify proxies /api/* to Render backend via netlify.toml
// This eliminates CORS issues entirely since the browser only talks to Netlify
const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url);
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
