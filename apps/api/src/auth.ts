import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './lib/prisma.js';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:8001',
  database: prismaAdapter(prisma, {
    provider: 'postgresql'
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for now, can enable later
    sendResetPassword: async ({ user, url }) => {
      // TODO: Implement email sending
      console.log(`Password reset link for ${user.email}: ${url}`);
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day - refresh if older
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5 // 5 minutes
    }
  },
  user: {
    additionalFields: {
      stripeCustomerId: {
        type: 'string',
        required: false
      },
      stripeSubscriptionId: {
        type: 'string',
        required: false
      },
      stripePriceId: {
        type: 'string', 
        required: false
      },
      stripeCurrentPeriodEnd: {
        type: 'date',
        required: false
      }
    }
  },
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://bom-api.fly.dev'
  ]
});

// Export types for use elsewhere
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session['user'];
