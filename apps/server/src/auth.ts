import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { prisma } from './db/db.service';

const baseURL = process.env.BASE_URL || 'http://localhost:4000';
const clientURL = process.env.CLIENT_URL || 'http://localhost:3000';

export const auth = betterAuth({
  baseURL: baseURL,
  clientURL: clientURL,
  basePath: '/api/auth',
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
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
  trustedOrigins: [clientURL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  plugins: [bearer()],
});
