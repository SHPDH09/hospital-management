import { ApiResponse } from '@healthcare/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text();

  if (!text) {
    return {
      success: false,
      error: response.ok
        ? 'Empty response from server'
        : `Server error (${response.status}). API may be unavailable — check DATABASE_URL on Vercel.`,
    };
  }

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      error: 'Invalid server response. Ensure the API is deployed and DATABASE_URL is configured.',
    };
  }
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    } catch {
      return { success: false, error: 'Network error. Could not reach the API server.' };
    }

    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        try {
          response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        } catch {
          return { success: false, error: 'Network error after token refresh.' };
        }
        return parseResponse<T>(response);
      }
      this.clearTokens();
      window.location.href = '/login/patient';
    }

    return parseResponse<T>(response);
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      const data = await parseResponse<{ accessToken: string; refreshToken: string }>(res);
      if (data.success && data.data) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }
    } catch {
      // refresh failed
    }
    return false;
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
  }

  put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  }

  delete<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
}

export const api = new ApiClient();
export const apiBaseUrl = API_BASE;
