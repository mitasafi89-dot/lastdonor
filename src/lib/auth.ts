import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@/types';

/* ---- Custom credential errors (code surfaces in client result.code) ---- */
class NoAccountError extends CredentialsSignin { code = 'no_account'; }
class OAuthOnlyError extends CredentialsSignin { code = 'oauth_only'; }
class InvalidPasswordError extends CredentialsSignin { code = 'invalid_password'; }
class AccountLockedError extends CredentialsSignin { code = 'account_locked'; }
class PasswordResetRequiredError extends CredentialsSignin { code = 'password_reset_required'; }

const SESSION_MAX_AGE: Record<UserRole, number> = {
  donor: 604800,    // 7 days
  editor: 86400,    // 24 hours
  admin: 28800,     // 8 hours
};

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function checkAccountLocked(email: string): Promise<boolean> {
  const [user] = await db
    .select({
      failedLoginCount: schema.users.failedLoginCount,
      failedLoginWindowStart: schema.users.failedLoginWindowStart,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!user?.failedLoginWindowStart) return false;

  const elapsed = Date.now() - user.failedLoginWindowStart.getTime();
  if (elapsed > LOCKOUT_WINDOW_MS) {
    // Window expired, reset
    await db
      .update(schema.users)
      .set({ failedLoginCount: 0, failedLoginWindowStart: null })
      .where(eq(schema.users.email, email));
    return false;
  }

  return user.failedLoginCount >= LOCKOUT_THRESHOLD;
}

async function recordFailedAttempt(email: string): Promise<void> {
  const [user] = await db
    .select({
      failedLoginCount: schema.users.failedLoginCount,
      failedLoginWindowStart: schema.users.failedLoginWindowStart,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!user) return;

  const now = new Date();

  if (!user.failedLoginWindowStart || now.getTime() - user.failedLoginWindowStart.getTime() > LOCKOUT_WINDOW_MS) {
    // Start a new window
    await db
      .update(schema.users)
      .set({ failedLoginCount: 1, failedLoginWindowStart: now })
      .where(eq(schema.users.email, email));
    return;
  }

  // Increment within the existing window
  await db
    .update(schema.users)
    .set({ failedLoginCount: user.failedLoginCount + 1 })
    .where(eq(schema.users.email, email));
}

async function clearFailedAttempts(email: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ failedLoginCount: 0, failedLoginWindowStart: null })
    .where(eq(schema.users.email, email));
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
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.callback-url'
        : 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Host-next-auth.csrf-token'
        : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
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

        if (await checkAccountLocked(email)) {
          throw new AccountLockedError();
        }

        try {
          const [user] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);

          if (!user) throw new NoAccountError();
          if (!user.passwordHash) throw new OAuthOnlyError();

          const { verifyPassword, verifyLegacyPassword } = await import('@/lib/password');
          const valid = await verifyPassword(password, user.passwordHash);
          if (!valid) {
            // Check if this is a legacy (unpeppered) hash - correct password
            // but hash was created before the pepper was introduced.
            const isLegacyHash = await verifyLegacyPassword(password, user.passwordHash);
            if (isLegacyHash) {
              throw new PasswordResetRequiredError();
            }
            await recordFailedAttempt(email);
            throw new InvalidPasswordError();
          }

          await clearFailedAttempts(email);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatarUrl,
          };
        } catch (err) {
          if (err instanceof CredentialsSignin) throw err;
          console.error('[auth] authorize error:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        try {
          const [dbUser] = await db
            .select({ role: schema.users.role })
            .from(schema.users)
            .where(eq(schema.users.id, user.id))
            .limit(1);
          token.role = dbUser?.role ?? 'donor';
        } catch {
          token.role = 'donor';
        }
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
