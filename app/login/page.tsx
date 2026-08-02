"use client";

import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import AuthLanguageSwitcher from "@/components/auth/AuthLanguageSwitcher";
import AuthLogo from "@/components/auth/AuthLogo";
import { useT } from "@/lib/i18n/use-t";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-surface auth-fallback">
          <LoginFallback />
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginFallback() {
  const { t } = useT();
  return <>{t("common.actions.loading")}</>;
}

function LoginContent() {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const resetSuccess = searchParams.get("reset") === "success";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    setLoading(true);
    setErrorMessage("");

    try {
      const result = await signIn("credentials", {
        username: username.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result?.ok) {
        const raw = result?.error?.replace(/^Error:\s*/, "") ?? "";
        const isAuthFailure =
          !raw ||
          raw === "CredentialsSignin" ||
          raw === "CallbackRouteError" ||
          /credential/i.test(raw);
        setErrorMessage(
          isAuthFailure ? t("auth.invalidCredentials") : raw
        );
        return;
      }

      const session = await getSession();
      if (session?.user?.mustSetPassword) {
        router.push("/set-password");
      } else if (session?.user?.mustSetRecoveryEmail) {
        router.push("/set-recovery-email");
      } else {
        router.push(callbackUrl);
      }
      router.refresh();
    } catch {
      setErrorMessage(t("auth.signInFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-surface auth-shell">
      <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 py-8 sm:px-10 sm:py-10 lg:max-w-xl lg:px-12">
        <div className="auth-lang-bar mb-8 sm:mb-10">
          <AuthLanguageSwitcher />
        </div>

        <div className="mb-10 sm:mb-12">
          <AuthLogo variant="hero" />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("auth.welcomeBack")}
          </h1>

          <p className="auth-text-muted mt-3 max-w-md text-sm leading-6">
            {t("auth.signInSubtitle")}
          </p>
        </div>

        <form method="post" action="/login" onSubmit={handleLogin}>
          <div className="space-y-5">
            {resetSuccess && (
              <div role="status" className="auth-alert-success rounded-xl px-4 py-3 text-sm">
                {t("auth.passwordUpdated")}
              </div>
            )}

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

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="auth-label text-sm font-medium"
                >
                  {t("auth.password")}
                </label>

                <Link href="/forgot-password" className="auth-link text-xs font-medium">
                  {t("auth.forgotPasswordQuestion")}
                </Link>
              </div>

              <div className="auth-field flex items-center overflow-hidden rounded-xl px-4">
                <LockKeyhole size={18} className="auth-field-icon shrink-0" />

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder={t("auth.enterPassword")}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="auth-field-input h-14 w-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm shadow-none outline-none ring-0"
                />

                <button
                  type="button"
                  aria-label={
                    showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                  }
                  onClick={() => setShowPassword((current) => !current)}
                  className="auth-icon-btn"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div role="alert" className="auth-alert-error rounded-xl px-4 py-3 text-sm">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(47,158,144,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("auth.signingIn") : t("auth.signIn")}
              {!loading && <ArrowRight size={18} />}
            </button>
          </div>
        </form>

        <div className="auth-divider mt-8 border-t pt-6">
          <div className="auth-text-muted flex flex-col items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck size={19} className="text-accent-cyan" />
              {t("auth.protectedBy")}
            </div>

            <Link href="/first-login" className="auth-link font-medium">
              {t("auth.firstTimeSigningIn")}
            </Link>
          </div>

          <div className="auth-text-footer mt-8 text-center text-xs">
            RGS ONE
            <span className="mx-3">•</span>
            {t("auth.enterpriseEdition")}
            <span className="mx-3">•</span>
            {t("auth.version", { version: "1.0" })}
          </div>
        </div>
      </div>
    </main>
  );
}
