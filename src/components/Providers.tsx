'use client';

import { SessionProvider } from 'next-auth/react';
import { TawkProvider } from '@/components/TawkProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      {/*
       * TawkProvider is a sibling of {children}, not a wrapper.
       * It returns null (zero DOM output) so it adds no layout or
       * rendering cost to the content tree. It must live inside
       * SessionProvider because it calls useSession() internally.
       */}
      <TawkProvider />
    </SessionProvider>
  );
}
