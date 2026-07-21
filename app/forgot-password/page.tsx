"use client";

import { FormEvent, useState, useTransition } from "react";
import { ArrowRight, UserRound } from "lucide-react";

import { requestPasswordReset } from "@/app/forgot-password/actions";
import AuthLogo from "@/components/auth/AuthLogo";
import BackLink from "@/components/ui/BackLink";
import { useT } from "@/lib/i18n/use-t";

export default function ForgotPasswordPage() {
  const { t } = useT();
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const result = await requestPasswordReset(formData);

        if (result.status === "no_email") {
          setErrorMessage(t("auth.forgotNoEmail"));
          return;
        }

        setMessage(t("auth.forgotSuccess"));
        setUsername("");
      } catch {
        setErrorMessage(t("auth.forgotFailed"));
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
            {t("auth.forgotTitle")}
          </h1>
          <p className="auth-text-muted mt-3 text-sm leading-6">
            {t("auth.forgotSubtitle")}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="username"
                className="auth-label mb-2 block text-sm font-medium"
              >
                {t("auth.username")}
              </label>

              <div className="auth-field flex items-center overflow-hidden rounded-xl px-4">
                <UserRound size={18} className="auth-field-icon shrink-0" />

                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder={t("auth.username")}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="auth-field-input h-14 w-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm shadow-none outline-none ring-0"
                />
              </div>
            </div>

            {message && (
              <div role="status" className="auth-alert-success rounded-xl px-4 py-3 text-sm">
                {message}
              </div>
            )}

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
              {pending ? t("auth.sending") : t("auth.sendResetLink")}
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
