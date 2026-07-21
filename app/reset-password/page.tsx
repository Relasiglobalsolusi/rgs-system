"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState, useTransition } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";

import { resetPassword } from "@/app/forgot-password/actions";
import AuthLogo from "@/components/auth/AuthLogo";
import BackLink from "@/components/ui/BackLink";
import { useT } from "@/lib/i18n/use-t";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-surface auth-fallback">
          <ResetFallback />
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetFallback() {
  const { t } = useT();
  return <>{t("common.actions.loading")}</>;
}

function ResetPasswordContent() {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage(t("auth.passwordsDoNotMatch"));
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("token", token);

    startTransition(async () => {
      try {
        const result = await resetPassword(formData);

        if (result.status === "invalid_token") {
          setErrorMessage(t("auth.resetInvalidToken"));
          return;
        }

        if (result.status === "weak_password") {
          setErrorMessage(t("auth.passwordTooShort"));
          return;
        }

        router.push("/login?reset=success");
      } catch {
        setErrorMessage(t("auth.resetFailed"));
      }
    });
  }

  if (!token) {
    return (
      <main className="auth-surface auth-shell">
        <div className="mx-auto flex min-h-screen w-full max-w-lg items-center px-6 py-12">
          <div className="w-full">
            <h1 className="text-3xl font-semibold tracking-tight">
              {t("auth.resetInvalidTitle")}
            </h1>
            <p className="auth-text-muted mt-3 text-sm">
              {t("auth.resetInvalidSubtitle")}
            </p>
            <BackLink href="/forgot-password" tone="auth" className="mt-8">
              {t("auth.requestNewResetLink")}
            </BackLink>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-surface auth-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-lg items-center px-6 py-12">
        <div className="w-full">
          <div className="mb-8">
            <AuthLogo />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            {t("auth.resetTitle")}
          </h1>
          <p className="auth-text-muted mt-3 text-sm leading-6">
            {t("auth.resetSubtitle")}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="password"
                className="auth-label mb-2 block text-sm font-medium"
              >
                {t("auth.newPassword")}
              </label>

              <div className="auth-field flex items-center overflow-hidden rounded-xl px-4">
                <LockKeyhole size={18} className="auth-field-icon shrink-0" />

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder={t("auth.enterNewPassword")}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="auth-field-input h-14 w-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm shadow-none outline-none ring-0"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="auth-label mb-2 block text-sm font-medium"
              >
                {t("auth.confirmPassword")}
              </label>

              <div className="auth-field flex items-center overflow-hidden rounded-xl px-4">
                <LockKeyhole size={18} className="auth-field-icon shrink-0" />

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder={t("auth.confirmNewPassword")}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
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
              {pending ? t("common.actions.saving") : t("auth.updatePassword")}
              {!pending && <ArrowRight size={18} />}
            </button>
          </form>

          <BackLink href="/login" tone="auth" className="mt-8">
            {t("auth.backToLogin")}
          </BackLink>
        </div>
      </div>
    </main>
  );
}
