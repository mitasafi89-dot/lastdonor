import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@/types';

const SESSION_MAX_AGE: Record<UserRole, number> = {
  donor: 604800,    // 7 days
  editor: 86400,    // 24 hours
  admin: 28800,     // 8 hours
};

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();

function checkAccountLocked(email: string): boolean {
  const record = failedAttempts.get(email);
  if (!record) return false;

  const elapsed = Date.now() - record.firstAttempt;
  if (elapsed > LOCKOUT_WINDOW_MS) {
    failedAttempts.delete(email);
    return false;
  }

  return record.count >= LOCKOUT_THRESHOLD;
}

function recordFailedAttempt(email: string): void {
  const record = failedAttempts.get(email);
  const now = Date.now();

  if (!record || now - record.firstAttempt > LOCKOUT_WINDOW_MS) {
    failedAttempts.set(email, { count: 1, firstAttempt: now });
    return;
  }

  record.count += 1;
}

function clearFailedAttempts(email: string): void {
  failedAttempts.delete(email);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    newUser: '/register',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        if (checkAccountLocked(email)) {
          throw new Error('Account temporarily locked. Try again in 15 minutes.');
        }

        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);

        if (!user?.passwordHash) {
          recordFailedAttempt(email);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          recordFailedAttempt(email);
          return null;
        }

        clearFailedAttempts(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        const [dbUser] = await db
          .select({ role: schema.users.role })
          .from(schema.users)
          .where(eq(schema.users.id, user.id))
          .limit(1);
        token.role = dbUser?.role ?? 'donor';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      // Apply role-based session maxAge
      const role = (token.role as UserRole) ?? 'donor';
      const maxAge = SESSION_MAX_AGE[role];
      if (token.iat && typeof token.iat === 'number') {
        const elapsed = Math.floor(Date.now() / 1000) - token.iat;
        if (elapsed > maxAge) {
          // Session expired for this role
          return { ...session, expires: new Date(0).toISOString() } as typeof session;
        }
      }
      return session;
    },
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'ForbiddenError';
  }
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  const role = session.user.role as UserRole;
  if (!allowedRoles.includes(role)) throw new ForbiddenError();
  return session;
}

export { UnauthorizedError, ForbiddenError };
