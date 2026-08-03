import { capitalizeName } from "@/lib/text-case";

export type UserDisplaySource = {
  name?: string | null;
  username?: string | null;
};

/** Prefer display name, then username; capitalize each word for UI. */
export function formatUserDisplayLabel(
  user: UserDisplaySource | null | undefined
): string | null {
  if (!user) return null;

  const displayName = user.name?.trim();
  if (displayName) {
    return capitalizeName(displayName);
  }

  const username = user.username?.trim();
  if (username) {
    return capitalizeName(username);
  }

  return null;
}
