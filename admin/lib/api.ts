const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Admin auth
  login: (email: string, password: string) =>
    request<{ token: string; admin: any }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string, inviteCode: string) =>
    request<{ token: string; admin: any }>('/api/admin/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, inviteCode }),
    }),

  me: () => request<any>('/api/admin/me'),

  // Events
  createEvent: (data: { name: string; description?: string; duration_per_round: number }) =>
    request<any>('/api/events', { method: 'POST', body: JSON.stringify(data) }),

  listEvents: () => request<any[]>('/api/events'),

  getEvent: (id: string) => request<{ event: any; participants: any[] }>(`/api/events/${id}`),

  getQR: (id: string) => request<{ qr: string; joinUrl: string }>(`/api/events/${id}/qr`),

  updateEvent: (id: string, data: { name?: string; description?: string; duration_per_round?: number }) =>
    request<any>(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteEvent: (id: string) =>
    request<any>(`/api/events/${id}`, { method: 'DELETE' }),

  getRounds: (id: string) =>
    request<{ round_number: number; match_count: number }[]>(`/api/events/${id}/rounds`),
};
