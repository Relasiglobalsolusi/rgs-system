"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, Mail } from "lucide-react";

import { setRecoveryEmail } from "@/app/set-recovery-email/actions";
import AuthLogo from "@/components/auth/AuthLogo";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  username: string;
  displayName: string;
};

function SetRecoveryEmailContent({ username, displayName }: Props) {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [recoveryEmail, setRecoveryEmailValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const result = await setRecoveryEmail(formData);

        if (result.status === "invalid_email") {
          setErrorMessage(t("auth.invalidRecoveryEmail"));
          return;
        }

        if (result.status === "email_taken") {
          setErrorMessage(t("auth.recoveryEmailTaken"));
          return;
        }

        if (result.status === "not_required") {
          await update({ mustSetRecoveryEmail: false });
          router.push(callbackUrl);
          router.refresh();
          return;
        }

        if (result.status !== "success") {
          setErrorMessage(t("auth.saveRecoveryFailed"));
          return;
        }

        await update({ mustSetRecoveryEmail: false });
        router.push(callbackUrl);
        router.refresh();
      } catch {
        setErrorMessage(t("auth.saveRecoveryFailed"));
      }
    });
  }

  return (
    <main className="auth-surface auth-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-lg items-center px-6 py-12">
        <div className="w-full">
          <div className="mb-8">
            <AuthLogo />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            {t("auth.recoveryEmailTitle")}
          </h1>
          <p className="auth-text-muted mt-3 text-sm leading-6">
            {t("auth.welcomeName", { name: displayName })}{" "}
            {t("auth.recoveryEmailSubtitle")}
          </p>
          <p className="auth-text-subtle mt-2 text-xs">
            {t("auth.signedInAs", { username })}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="recoveryEmail"
                className="auth-label mb-2 block text-sm font-medium"
              >
                {t("auth.recoveryEmail")}
              </label>

              <div className="auth-field flex items-center overflow-hidden rounded-xl px-4">
                <Mail size={18} className="auth-field-icon shrink-0" />

                <input
                  id="recoveryEmail"
                  name="recoveryEmail"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.co.id"
                  value={recoveryEmail}
                  onChange={(event) => setRecoveryEmailValue(event.target.value)}
                  className="auth-field-input h-14 w-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm shadow-none outline-none ring-0"
                />
              </div>
            </div>

            {errorMessage && (
              <div role="alert" className="auth-alert-error rounded-xl px-4 py-3 text-sm">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(37,99,235,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? t("common.actions.saving") : t("auth.saveAndContinue")}
              {!pending && <ArrowRight size={18} />}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function SetRecoveryEmailForm(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="auth-surface auth-fallback">
          <SetRecoveryFallback />
        </main>
      }
    >
      <SetRecoveryEmailContent {...props} />
    </Suspense>
  );
}

function SetRecoveryFallback() {
  const { t } = useT();
  return <>{t("common.actions.loading")}</>;
}
