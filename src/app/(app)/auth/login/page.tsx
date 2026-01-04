import { loginWithEmailPassword, loginWithGoogle } from "./actions";

type Props = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  missing_fields: "Please enter both email and password.",
  invalid_credentials: "Incorrect email or password.",
  google_oauth_failed: "Google sign-in failed. Please try again.",
  email_confirm_failed:
    "We could not confirm your email. Try requesting a new link.",
  invalid_confirm_link: "This confirmation link is invalid or has expired.",
};

export default async function LoginPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const errorKey = resolvedSearchParams?.error;
  const next = resolvedSearchParams?.next ?? "/";

  const errorMessage = errorKey
    ? errorMessages[errorKey] ?? "Something went wrong. Please try again."
    : null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white/80 backdrop-blur px-6 py-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Sign in to EasyEats
        </h1>
        <p className="text-sm text-neutral-600 mb-6 text-center">
          Sign in with Google or your email and password.
        </p>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Email/password login */}
        <form action={loginWithEmailPassword} className="space-y-4 mb-5">
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
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 active:bg-red-800 transition"
          >
            Continue with email
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-5">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            or
          </span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        {/* Google login */}
        <form action={loginWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 active:bg-neutral-100 transition"
          >
            <span>Continue with Google</span>
          </button>
        </form>

        <p className="mt-4 text-xs text-neutral-600 text-center">
          Don&apos;t have an account?{" "}
          <a
            href="/auth/signup"
            className="font-medium text-red-600 hover:underline"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

