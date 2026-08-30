export type SessionLiveness = "ok" | "replaced" | "revoked";

type SessionWatchListener = (claimedToken: string) => void;

const listeners = new Map<string, Set<SessionWatchListener>>();

/** Wake any open session-watch streams on this Node process. */
export function notifyLoginSessionClaimed(
  userId: string,
  sessionToken: string
) {
  const set = listeners.get(userId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(sessionToken);
    } catch {
      // A broken watcher must not fail the new login.
    }
  }
}

export function subscribeLoginSessionWatch(
  userId: string,
  listener: SessionWatchListener
): () => void {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(userId);
  };
}

export function sessionLiveness(
  jwtSessionToken: string | null | undefined,
  dbSessionToken: string | null | undefined,
  active: boolean
): SessionLiveness {
  if (!active) return "revoked";
  if (!dbSessionToken || dbSessionToken !== (jwtSessionToken ?? "")) {
    return "replaced";
  }
  return "ok";
}
