import { createAuthClient } from 'better-auth/react';

/**
 * Normalisasi Base URL API backend.
 * Memastikan tidak ada trailing slash atau duplikasi /api pada basePath Better-Auth.
 */
export const getApiBaseUrl = (): string => {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  return raw.trim().replace(/\/+$/, '').replace(/\/api$/, '');
};

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include',
  },
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
