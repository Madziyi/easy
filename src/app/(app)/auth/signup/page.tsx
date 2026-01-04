import { signUpWithEmailPassword } from "./actions";

type Props = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    next?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  missing_fields: "Please fill in all fields.",
  password_mismatch: "Passwords do not match.",
  weak_password: "Password should be at least 8 characters long.",
  server_config: "Auth is misconfigured on the server. Please try again later.",
  signup_failed: "Could not sign you up. Please try again.",
};

export default async function SignUpPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const errorKey = resolvedSearchParams?.error;
  const successKey = resolvedSearchParams?.success;
  const next = resolvedSearchParams?.next ?? "/";

  const errorMessage = errorKey
    ? errorMessages[errorKey] ?? "Something went wrong. Please try again."
    : null;

  const successMessage =
    successKey === "check_email"
      ? "Check your email to confirm your account. Once confirmed, you can sign in."
      : null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white/80 backdrop-blur px-6 py-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Create your EasyEats account
        </h1>
        <p className="text-sm text-neutral-600 mb-6 text-center">
          Sign up to save favourites, leave reviews, and manage restaurant profiles.
        </p>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <form action={signUpWithEmailPassword} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-800">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-800">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="At least 8 characters"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-800">
              Confirm Password
            </label>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="Repeat your password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 active:bg-red-800 transition"
          >
            Sign up with email
          </button>
        </form>

        <p className="mt-4 text-xs text-neutral-600 text-center">
          Already have an account?{" "}
          <a
            href="/auth/login"
            className="font-medium text-red-600 hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

