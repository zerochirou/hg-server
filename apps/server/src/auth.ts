import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { prisma } from './db/db.service';
import { bearer } from 'better-auth/plugins';

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
  trustedOrigins: [clientURL],
  plugins: [bearer()],
});
