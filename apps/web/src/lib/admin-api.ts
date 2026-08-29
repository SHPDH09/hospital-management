import { ApiResponse } from '@healthcare/shared';
import { api } from './api';

/** Admin query helper — throws when the API returns success:false so React Query surfaces errors. */
export async function adminGet<T>(endpoint: string): Promise<ApiResponse<T>> {
  const res = await api.get<T>(endpoint);
  if (!res.success) {
    throw new Error(res.error || 'Failed to load admin data');
  }
  return res;
}

export async function adminPost<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await api.post<T>(endpoint, body);
  if (!res.success) {
    throw new Error(res.error || 'Request failed');
  }
  return res;
}
