"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";

import { setInitialPassword } from "@/app/first-login/actions";
import AuthLogo from "@/components/auth/AuthLogo";
import BackLink from "@/components/ui/BackLink";
import { useT } from "@/lib/i18n/use-t";

export default function FirstLoginForm() {
  const { t } = useT();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
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

    startTransition(async () => {
      try {
        const result = await setInitialPassword(formData);

        if (result.status === "weak_password") {
          setErrorMessage(t("auth.passwordTooShort"));
          return;
        }

        if (result.status === "mismatch") {
          setErrorMessage(t("auth.passwordsDoNotMatch"));
          return;
        }

        if (result.status === "invalid_email") {
          setErrorMessage(t("auth.invalidRecoveryEmail"));
          return;
        }

        if (result.status === "email_taken") {
          setErrorMessage(t("auth.recoveryEmailTaken"));
          return;
        }

        if (result.status === "not_required") {
          setErrorMessage(t("auth.accountAlreadySetUp"));
          return;
        }

        if (result.status === "inactive") {
          setErrorMessage(t("auth.accountDeleted"));
          return;
        }

        if (result.status === "not_found") {
          setErrorMessage(t("auth.accountNotFound"));
          return;
        }

        const signInResult = await signIn("credentials", {
          username: username.trim().toLowerCase(),
          password,
          redirect: false,
          callbackUrl: "/dashboard",
        });

        if (!signInResult?.ok) {
          router.push("/login?reset=success");
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } catch {
        setErrorMessage(t("auth.setupFailed"));
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
            {t("auth.firstLoginTitle")}
          </h1>
          <p className="auth-text-muted mt-3 text-sm leading-6">
            {t("auth.firstLoginSubtitle")}
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
                  placeholder={t("auth.yourUsername")}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="auth-field-input h-14 w-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm shadow-none outline-none ring-0"
                />
              </div>
            </div>

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
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                  className="auth-field-input h-14 w-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm shadow-none outline-none ring-0"
                />
              </div>
              <p className="auth-text-subtle mt-2 text-xs">
                {t("auth.recoveryEmailHelp")}
              </p>
            </div>

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
              {pending ? t("auth.settingUp") : t("auth.saveAndSignIn")}
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
