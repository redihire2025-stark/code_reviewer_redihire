import type { DashboardStats, ReviewSummary } from '../types/index';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
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
