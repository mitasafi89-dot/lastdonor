/**
 * Global type declarations for the Tawk.to Live Chat JavaScript API.
 *
 * Tawk.to injects a widget via a CDN script. It exposes a global `Tawk_API`
 * object on `window` that callers can use to identify visitors, show/hide the
 * widget, and respond to chat lifecycle events.
 *
 * All methods are typed as optional because the object is populated
 * progressively: `window.Tawk_API` is created as an empty object before the
 * script loads (to allow pre-registration of callbacks), and individual methods
 * are attached only once the library finishes initializing.
 *
 * This is a script-scope `.d.ts` file (no imports/exports). Top-level
 * interface declarations here merge directly with the corresponding globals.
 *
 * @see https://help.tawk.to/article/tawk-messenger-javascript-api
 */

type TawkAttributeCallback = (error?: Error) => void;

interface TawkAPI {
  /**
   * Fires once when the widget is fully initialized and all API methods are
   * available. This is the correct point to call setAttributes for the first
   * time if the session may have loaded before the script.
   */
  onLoad?: () => void;

  /**
   * Fires whenever the agent availability status changes.
   * Useful for adapting UI messaging ("We're online" vs "Leave a message").
   */
  onStatusChange?: (status: 'online' | 'away' | 'offline') => void;

  /** Fires when a chat message is sent by the visitor. */
  onChatMessageVisitor?: (message: string) => void;

  /** Makes the floating chat button visible. */
  showWidget?: () => void;

  /** Hides the floating chat button. Does not close an active conversation. */
  hideWidget?: () => void;

  /** Opens (maximizes) the chat window. */
  maximize?: () => void;

  /** Closes (minimizes) the chat window to the floating button state. */
  minimize?: () => void;

  /** Toggles between maximized and minimized states. */
  toggle?: () => void;

  /** Returns true if the floating button is currently hidden. */
  isChatHidden?: () => boolean;

  /** Returns true if the chat window is currently open. */
  isChatMaximized?: () => boolean;

  /**
   * Associates the current visitor with a known identity for display in the
   * Tawk.to agent dashboard. This surfaces name, email, and any custom
   * key-value pairs alongside the conversation so agents have context before
   * they respond.
   *
   * SECURITY NOTE: On the free Tawk.to plan, attributes are unauthenticated
   * (no HMAC hash verification). They function as display hints for support
   * agents, not as verified identity claims. No access-control decisions
   * should be made server-side based on these values.
   *
   * @param attributes - Plain object; all values must be strings.
   * @param callback   - Called with an Error if Tawk rejected the call.
   */
  setAttributes?: (
    attributes: { name?: string; email?: string; [key: string]: string | undefined },
    callback?: TawkAttributeCallback,
  ) => void;

  /** Attach categorization tags to the current chat session for categorization. */
  addTags?: (tags: string[], callback?: TawkAttributeCallback) => void;
}

// Augment the global Window interface. In a script-scope .d.ts file (no
// import/export statements), top-level interface declarations merge with the
// DOM globals directly — no `declare global {}` wrapper is needed or correct.
interface Window {
  /**
   * Tawk.to Live Chat API object. Created as an empty object before the
   * Tawk CDN script loads so that `onLoad` and other callbacks can be
   * registered in advance without a race condition.
   */
  Tawk_API?: TawkAPI;

  /**
   * Timestamp recorded immediately before the Tawk script element is
   * inserted. Tawk uses this internally to measure widget load latency.
   */
  Tawk_LoadStart?: Date;
}
