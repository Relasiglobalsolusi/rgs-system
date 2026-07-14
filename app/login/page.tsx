"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";

const features = [
  {
    title: "Business Overview",
    description: "Monitor operations and performance in real time.",
    icon: BarChart3,
    iconClass: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
  },
  {
    title: "Client Management",
    description: "Manage customers, opportunities, and relationships.",
    icon: Users,
    iconClass:
      "border-violet-400/20 bg-violet-500/10 text-violet-300",
  },
  {
    title: "Projects",
    description: "Track project progress, tasks, files, and approvals.",
    icon: BriefcaseBusiness,
    iconClass: "border-blue-400/20 bg-blue-500/10 text-blue-300",
  },
  {
    title: "Inventory",
    description: "Control stock, purchasing, and warehouse activity.",
    icon: Boxes,
    iconClass: "border-teal-400/20 bg-teal-500/10 text-teal-300",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result?.ok) {
        setErrorMessage(
          "The email address or password is incorrect."
        );
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setErrorMessage(
        "We could not sign you in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08111c] text-white">
      <div className="grid min-h-screen lg:grid-cols-[0.88fr_1.12fr]">
        <section className="flex min-h-screen items-center border-r border-white/[0.06] bg-[#071018] px-6 py-12 sm:px-10 lg:px-14 xl:px-20">
          <div className="mx-auto w-full max-w-[510px]">
            <div className="mb-10">
              <div className="w-full max-w-[520px] sm:-ml-6 sm:w-[112%]">
                <Image
                  src="/rgs-one-logo.svg"
                  alt="RGS ONE"
                  width={1100}
                  height={850}
                  priority
                  className="h-auto w-full object-contain mix-blend-screen"
                />
              </div>

              <div className="mt-5 flex items-center gap-4">
                <span className="h-px w-12 bg-gradient-to-r from-cyan-400 to-blue-500" />

                <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-slate-400">
                  One Platform. Complete Visibility.
                </span>
              </div>
            </div>

            <div className="mb-8">
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                Welcome back
              </h1>

              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                Sign in to manage your workspace, projects, and
                business operations.
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Email address
                  </label>

                  <div className="flex items-center rounded-xl border border-slate-700/70 bg-[#0c1723] px-4 transition focus-within:border-cyan-400/60 focus-within:ring-4 focus-within:ring-cyan-400/[0.08]">
                    <Mail
                      size={18}
                      className="shrink-0 text-slate-500"
                    />

                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      className="h-14 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-slate-200"
                    >
                      Password
                    </label>

                    <button
                      type="button"
                      className="text-xs font-medium text-cyan-400 transition hover:text-cyan-300"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className="flex items-center rounded-xl border border-slate-700/70 bg-[#0c1723] px-4 transition focus-within:border-cyan-400/60 focus-within:ring-4 focus-within:ring-cyan-400/[0.08]">
                    <LockKeyhole
                      size={18}
                      className="shrink-0 text-slate-500"
                    />

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      className="h-14 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-600"
                    />

                    <button
                      type="button"
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                      className="text-slate-500 transition hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-600 bg-[#0c1723] accent-cyan-400"
                  />

                  Remember me
                </label>

                {errorMessage && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                  >
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(37,99,235,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign in"}

                  {!loading && <ArrowRight size={18} />}
                </button>
              </div>
            </form>

            <div className="mt-8 border-t border-white/[0.08] pt-6">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <ShieldCheck
                  size={19}
                  className="text-cyan-400"
                />

                Protected by RGS ONE Identity
              </div>

              <div className="mt-8 text-center text-xs text-slate-600">
                RGS ONE
                <span className="mx-3">•</span>
                Enterprise Edition
                <span className="mx-3">•</span>
                Version 1.0
              </div>
            </div>
          </div>
        </section>

        <section className="hidden min-h-screen items-center bg-[#0b1929] px-14 py-14 lg:flex xl:px-24">
          <div className="mx-auto w-full max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">
              RGS ONE
            </p>

            <h2 className="mt-6 max-w-2xl text-5xl font-semibold leading-[1.12] tracking-tight text-white xl:text-6xl">
              The operating system
              <br />
              for{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                modern business.
              </span>
            </h2>

            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-400">
              One secure platform connecting your employees, clients,
              projects, inventory, purchasing, finance, and company
              operations.
            </p>

            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="rounded-2xl border border-slate-700/60 bg-[#0d1c2d] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/20 hover:bg-[#102238]"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border ${feature.iconClass}`}
                      >
                        <Icon size={25} />
                      </div>

                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {feature.title}
                        </h3>

                        <p className="mt-3 text-sm leading-6 text-slate-400">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-12 flex items-center gap-5">
              <span className="h-px w-20 bg-gradient-to-r from-cyan-400 to-blue-500" />

              <span className="text-xs font-medium uppercase tracking-[0.3em] text-slate-500">
                One Platform. Complete Visibility.
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}