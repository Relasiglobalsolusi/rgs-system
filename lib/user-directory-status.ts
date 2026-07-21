/**

 * User Accounts directory status — canonical soft-delete vs revoke rules.

 *

 * Soft-delete employee/client:

 *   parent → Deleted Employees/Clients, linked login deactivated with credentials kept.

 *   Users cards: Deleted Employee / Deleted Client (and count toward Deleted total).

 *   Soft-deleted parent always wins over revoked for card placement — even if the

 *   login was already revoked before the parent was soft-deleted.

 *

 * Restore employee/client (from Deleted Employees/Clients):

 *   parent returns to Active roster; linked User.active stays false.

 *   Login moves to Revoked Access (inactive user + active parent).

 *   Admin must separately Restore Access before portal login works again.

 *

 * Soft-delete unlinked admin:

 *   login deactivated → Users Deleted (not Client/Employee buckets).

 *

 * Revoke Access (Users action on linked login):

 *   login off only; credentials kept; employee/client stays on the active roster.

 *   Appears under Revoked Access card only — NEVER in Deleted* or No Portal Login.

 *   Restore via Revoked Access → Restore Access (same username/password/numbers).

 *   Roster-active employee statuses: ACTIVE and ON_LEAVE.

 *   Revoked Access = only when parent is still active/on roster AND User.active === false.

 *

 * No Portal Login (Users card):

 *   Client/employee with no linked User row (never had login, or hard-deleted

 *   via Permanently Remove Portal Login Access). Includes soft-deleted parents

 *   with no User until permanently deleted. Soft-deleted parents that still

 *   have a linked inactive User go to Deleted* (not here). Generate is only

 *   for roster-active parents. Inactive linked users are revoked, not here.

 *

 * Forever-deleted employee (archivedFromDirectory):

 *   login should be hard-deleted. If a zombie login remains, treat as permanently

 *   removed — never Active / Revoked / soft-Deleted buckets.

 *

 * Classification uses linked parent state (not User.active alone).

 */



export type UserDirectoryStatusInput = {

  active: boolean;

  employee?: {

    status: string;

    archivedFromDirectory?: boolean;

  } | null;

  client?: { active?: boolean } | null;

  vendor?: { active?: boolean } | null;

};



/** Employee still on the active roster (not soft-deleted / terminated). */

export function isRosterActiveEmployeeStatus(

  status: string | undefined | null

): boolean {

  return status === "ACTIVE" || status === "ON_LEAVE";

}



/** Forever-deleted employee link — login should not appear in User Accounts. */

export function isPermanentlyRemovedLinkedUser(

  user: UserDirectoryStatusInput

): boolean {

  return Boolean(user.employee?.archivedFromDirectory);

}



/**

 * Linked employee off roster (INACTIVE/TERMINATED/…) or client soft-deleted.

 * Used so soft-delete always wins over revoked for Users card placement.

 */

export function hasSoftDeletedLinkedParent(

  user: UserDirectoryStatusInput

): boolean {

  if (isPermanentlyRemovedLinkedUser(user)) return false;



  if (

    user.employee != null &&

    !isRosterActiveEmployeeStatus(user.employee.status)

  ) {

    return true;

  }



  if (user.client != null && user.client.active === false) {

    return true;

  }



  if (user.vendor != null && user.vendor.active === false) {

    return true;

  }



  return false;

}



/**

 * Login disabled while linked employee/client parent is still on the active roster.

 * Soft-deleted parents never count as Revoked Access.

 */

export function isRevokedAccessUser(user: UserDirectoryStatusInput): boolean {

  if (isPermanentlyRemovedLinkedUser(user)) return false;

  if (user.active) return false;

  // Soft-deleted parent always wins over revoked for card placement.

  if (hasSoftDeletedLinkedParent(user)) return false;



  if (isRosterActiveEmployeeStatus(user.employee?.status)) return true;

  // Client still on active directory (treat missing `active` as active).

  if (user.client != null && user.client.active !== false) return true;

  // Vendor still on active directory (treat missing `active` as active).

  if (user.vendor != null && user.vendor.active !== false) return true;

  return false;

}



/**

 * True soft-deleted login — parent soft-deleted (or unlinked admin deactivated).

 * Never includes revoked-only (parent still on roster) or forever-deleted archives.

 */

export function isSoftDeletedUser(user: UserDirectoryStatusInput): boolean {

  if (isPermanentlyRemovedLinkedUser(user)) return false;

  if (user.active) return false;

  if (hasSoftDeletedLinkedParent(user)) return true;

  // Unlinked admin / orphan deactivated — Deleted total, not Client/Employee cards.

  return !isRevokedAccessUser(user);

}



export function getUserStatusPresentation(user: UserDirectoryStatusInput): {

  badgeStatus: "active" | "danger";

  label: string;

} {

  if (isPermanentlyRemovedLinkedUser(user)) {

    return { badgeStatus: "danger", label: "Removed" };

  }



  if (user.active) {

    return { badgeStatus: "active", label: "Active" };

  }



  if (isRevokedAccessUser(user)) {

    // Same danger/red family as Deleted — disabled access, not a muted slate state.

    return { badgeStatus: "danger", label: "Revoked Access" };

  }



  return { badgeStatus: "danger", label: "Deleted" };

}

