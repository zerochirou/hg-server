import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { prisma } from './db/db.service';

const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.BASE_URL ||
  'http://localhost:4000';
const clientURL = process.env.CLIENT_URL || 'http://localhost:3000';

export const auth = betterAuth({
  baseURL: baseURL,
  clientURL: clientURL,
  basePath: '/api/auth',
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  user: {
    additionalFields: {
      isOnboarded: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: true,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  trustedOrigins: [
    clientURL,
    baseURL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8081',
    'http://127.0.0.1:8081',

    // Native Custom Schemes for HyperGrid Mobile App (Production, Staging, Dev Client, Beta)
    'hypergrid://',
    'hypergrid://*',
    'hypergrid://**',
    'hg-mobile-beta://',
    'hg-mobile-beta://*',
    'hg-mobile-beta://**',

    // Expo Go / Dev Client Schemes (All environments & local network IPs)
    'exp://',
    'exp://*',
    'exp://**',
    'exp://*.*.*.*:*/**',
    'exp://10.0.2.2:*/**',
    'exp://localhost:*/**',
    ...(process.env.ADDITIONAL_TRUSTED_ORIGINS
      ? process.env.ADDITIONAL_TRUSTED_ORIGINS.split(',').map((o) => o.trim())
      : []),
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    },
  },
  plugins: [bearer(), expo()],
});
