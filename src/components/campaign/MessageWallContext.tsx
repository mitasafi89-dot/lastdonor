'use client';

import { createContext, useCallback, useContext, useRef } from 'react';
import type { MessageItem } from '@/components/campaign/MessageWall';

type AddMessageFn = (msg: MessageItem) => void;

const MessageWallContext = createContext<{
  register: (fn: AddMessageFn) => void;
  addMessage: (msg: MessageItem) => void;
} | null>(null);

/**
 * Provider that enables MessageForm to push optimistic messages
 * into MessageWall without global coupling.
 *
 * Wrap both components with this provider. MessageWall registers
 * its add function; MessageForm calls addMessage.
 */
export function MessageWallProvider({ children }: { children: React.ReactNode }) {
  const fnRef = useRef<AddMessageFn | null>(null);

  const register = useCallback((fn: AddMessageFn) => {
    fnRef.current = fn;
  }, []);

  const addMessage = useCallback((msg: MessageItem) => {
    fnRef.current?.(msg);
  }, []);

  return (
    <MessageWallContext.Provider value={{ register, addMessage }}>
      {children}
    </MessageWallContext.Provider>
  );
}

/** Used by MessageWall to register its optimistic-add callback. */
export function useMessageWallRegister() {
  const ctx = useContext(MessageWallContext);
  return ctx?.register ?? null;
}

/** Used by MessageForm to push a new message into MessageWall. */
export function useAddOptimisticMessage() {
  const ctx = useContext(MessageWallContext);
  return ctx?.addMessage ?? null;
}
