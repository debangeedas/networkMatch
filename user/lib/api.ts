const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('user_token');
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
  getEventPublic: (eventId: string) =>
    request<any>(`/api/events/${eventId}/public`),

  joinEvent: (data: {
    event_id: string;
    name?: string;
    linkedin?: string;
    role?: string;
    company?: string;
    looking_for?: string[];
    offering?: string[];
    interests?: string[];
    user_id?: string;
  }) => request<{ token: string; user: any }>('/api/users/join', { method: 'POST', body: JSON.stringify(data) }),

  getMe: () => request<any>('/api/users/me'),

  getMyMatch: (eventId: string) => request<{ match: any }>(`/api/events/${eventId}/my-match`),

  saveConnection: (eventId: string, data: { connected_user_id: string; match_id?: string }) =>
    request<any>(`/api/events/${eventId}/save-connection`, { method: 'POST', body: JSON.stringify(data) }),

  getSavedConnections: (eventId: string) =>
    request<any[]>(`/api/events/${eventId}/saved-connections`),

  getLinkedInMessage: (toUserId: string, matchReason: string) =>
    request<{ message: string }>('/api/users/linkedin-message', {
      method: 'POST',
      body: JSON.stringify({ to_user_id: toUserId, match_reason: matchReason }),
    }),
};
