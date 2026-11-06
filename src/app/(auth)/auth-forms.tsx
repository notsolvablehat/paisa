"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { createPasswordRules, PasswordStrength } from "@/components/arc/password-strength/password-strength";
import { signIn, signUp } from "@/lib/auth-client";

const PASSWORD_MIN = 10; // matches the server (lib/auth.ts)
const rules = createPasswordRules({ minLength: PASSWORD_MIN });

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-control)] border border-(--p-warnLine) bg-(--p-warnTint) px-3.5 py-2.5 text-[13px] text-(--p-warn)"
    >
      {message}
    </div>
  );
}

function PasswordField(props: React.ComponentProps<typeof Input>) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute right-1.5 bottom-0 grid h-[var(--control-height-md)] w-9 place-items-center text-(--p-fg3) hover:text-(--p-ink)"
      >
        <i className={shown ? "ri-eye-off-line text-[17px]" : "ri-eye-line text-[17px]"} aria-hidden />
      </button>
    </div>
  );
}

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const f = new FormData(e.currentTarget);
    const res = await signIn.email({ email: String(f.get("email") ?? "").trim(), password: String(f.get("password") ?? "") });
    setPending(false);
    if (res.error) return setError(res.error.message ?? "Could not sign you in");
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Input label="Email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      <PasswordField label="Password" name="password" required autoComplete="current-password" placeholder="Your password" maxLength={128} />
      <FormError message={error} />
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Log in
      </Button>
      <p className="mt-2 text-center text-sm text-(--p-fg2)">
        New to paisa?{" "}
        <Link href="/sign-up" className="font-medium text-(--p-accent) hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (Array.from(password).length < PASSWORD_MIN) return setError(`Use at least ${PASSWORD_MIN} characters for your password.`);
    setPending(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const name = String(f.get("name") ?? "").trim() || email.split("@")[0];
    const res = await signUp.email({ email, password, name });
    setPending(false);
    if (res.error) return setError(res.error.message ?? "Could not create your account");
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Input label="Your name" name="name" autoComplete="name" maxLength={60} placeholder="Aarav Mehta" />
      <Input label="Email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      <PasswordStrength
        label="Password"
        name="password"
        autoComplete="new-password"
        placeholder="Create a password"
        maxLength={128}
        required
        rules={rules}
        value={password}
        onValueChange={(v) => setPassword(v)}
      />
      <FormError message={error} />
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Create account
      </Button>
      <p className="mt-2 text-center text-sm text-(--p-fg2)">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-(--p-accent) hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
