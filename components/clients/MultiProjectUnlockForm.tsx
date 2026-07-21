"use client";

import { useActionState } from "react";

import {
  unlockMultiProjectAccess,
  type UnlockFormState,
} from "@/app/multi-project-unlock/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";

const initialState: UnlockFormState = {};

type Props = {
  clientName: string;
  picHint: string;
};

export default function MultiProjectUnlockForm({ clientName, picHint }: Props) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState(
    unlockMultiProjectAccess,
    initialState
  );

  return (
    <form action={formAction} className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-text">
          {t("pages.multiProjectUnlock.title")}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t("pages.multiProjectUnlock.description", { client: clientName })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="picName" className="text-sm font-medium text-text">
          {t("pages.multiProjectUnlock.picName")}
        </label>
        <Input
          id="picName"
          name="picName"
          autoComplete="name"
          placeholder={picHint}
          required
          className="h-11"
        />
        <p className="text-xs text-subtle">
          {t("pages.multiProjectUnlock.picNameHint")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="securityCode" className="text-sm font-medium text-text">
          {t("pages.multiProjectUnlock.securityCode")}
        </label>
        <Input
          id="securityCode"
          name="securityCode"
          autoComplete="one-time-code"
          required
          className="h-11 font-mono tracking-wide"
        />
      </div>

      {state.error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 font-semibold">
        {pending
          ? t("pages.multiProjectUnlock.unlocking")
          : t("pages.multiProjectUnlock.unlock")}
      </Button>
    </form>
  );
}
