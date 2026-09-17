export type AuthWelcomeState = {
  open: boolean;
  leaving: boolean;
  name: string;
};

const EMPTY: AuthWelcomeState = { open: false, leaving: false, name: "" };
const STORAGE_KEY = "rgs-auth-welcome";
const HOLD_MS = 2400;
const LEAVE_MS = 520;

type PersistedWelcome = {
  name: string;
  shownAt: number;
};

type WelcomeStore = {
  state: AuthWelcomeState;
  listeners: Set<() => void>;
  timers: number[];
  hydrated: boolean;
};

function getStore(): WelcomeStore {
  const globalRef = globalThis as typeof globalThis & {
    __rgsAuthWelcome?: WelcomeStore;
  };
  if (!globalRef.__rgsAuthWelcome) {
    globalRef.__rgsAuthWelcome = {
      state: EMPTY,
      listeners: new Set(),
      timers: [],
      hydrated: false,
    };
  }
  return globalRef.__rgsAuthWelcome;
}

function emit(next: AuthWelcomeState) {
  const store = getStore();
  store.state = next;
  store.listeners.forEach((listener) => listener());
}

function clearTimers() {
  const store = getStore();
  for (const id of store.timers) window.clearTimeout(id);
  store.timers = [];
}

function persist(payload: PersistedWelcome | null) {
  try {
    if (!payload) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

function readPersisted(): PersistedWelcome | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWelcome;
    if (!parsed?.name || typeof parsed.shownAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function finishWelcome() {
  persist(null);
  emit(EMPTY);
}

function scheduleWelcome(name: string, shownAt: number) {
  clearTimers();
  emit({ open: true, leaving: false, name });
  persist({ name, shownAt });

  const store = getStore();
  const remainingHold = Math.max(0, HOLD_MS - (Date.now() - shownAt));
  const hold = window.setTimeout(() => {
    emit({ open: true, leaving: true, name });
    const hide = window.setTimeout(() => {
      finishWelcome();
    }, LEAVE_MS);
    store.timers.push(hide);
  }, remainingHold);
  store.timers.push(hold);
}

export function getAuthWelcomeState() {
  return getStore().state;
}

export function subscribeAuthWelcome(listener: () => void) {
  const store = getStore();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

/** Resume after a login refresh so Welcome is not lost when the session cookie lands. */
export function hydrateAuthWelcome() {
  if (typeof window === "undefined") return;
  const store = getStore();
  if (store.hydrated) return;
  store.hydrated = true;
  const persisted = readPersisted();
  if (!persisted) return;
  if (Date.now() - persisted.shownAt > HOLD_MS + LEAVE_MS) {
    persist(null);
    return;
  }
  scheduleWelcome(persisted.name, persisted.shownAt);
}

/** Lives outside React so login → dashboard layout refresh cannot drop the overlay. */
export function revealWelcome(name: string): Promise<void> {
  const displayName = name.trim();
  const shownAt = Date.now();
  scheduleWelcome(displayName, shownAt);

  return new Promise((resolve) => {
    const store = getStore();
    const done = window.setTimeout(() => {
      resolve();
    }, Math.max(0, HOLD_MS - (Date.now() - shownAt)) + LEAVE_MS);
    store.timers.push(done);
  });
}
