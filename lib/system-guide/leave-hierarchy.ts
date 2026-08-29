import type { AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  LEAVE_APPROVER_RULES,
  LEAVE_REQUESTER_TIER_ORDER,
  type LeaveApproverKind,
  type LeaveRequesterTier,
} from "@/lib/leave-approval-hierarchy";

function requesterLabel(tier: LeaveRequesterTier, locale: AppLocale): string {
  return translate(locale, `pages.systemGuide.leaveChain.requester.${tier}`);
}

function approverLabel(kind: LeaveApproverKind, locale: AppLocale): string {
  return translate(locale, `pages.systemGuide.leaveChain.approver.${kind}`);
}

/**
 * Live leave-approval copy. Changing {@link LEAVE_APPROVER_RULES} updates
 * the next System Guide download.
 */
export function liveLeaveHierarchyCopy(locale: AppLocale): {
  steps: string[];
  remember: string[];
} {
  const joiner = translate(locale, "pages.systemGuide.leaveChain.joiner");
  const steps = LEAVE_REQUESTER_TIER_ORDER.map((tier) => {
    const approvers = LEAVE_APPROVER_RULES[tier]
      .map((kind) => approverLabel(kind, locale))
      .join(joiner);
    return translate(locale, "pages.systemGuide.leaveChain.forTier", {
      requester: requesterLabel(tier, locale),
      approvers,
    });
  });

  return {
    steps: [
      translate(locale, "pages.systemGuide.leaveChain.intro"),
      ...steps,
    ],
    remember: [
      translate(locale, "pages.systemGuide.leaveChain.ownerPower"),
      translate(locale, "pages.systemGuide.leaveChain.noSelf"),
    ],
  };
}
