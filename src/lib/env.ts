/**
 * Centralized, server-only access to environment variables.
 *
 * Accessing a missing variable throws a clear, actionable error instead of
 * silently handing `undefined` to a downstream API call. Import this from
 * server code only (route handlers, server components) — never from the client.
 */
export const serverEnv = {
  get openaiApiKey(): string {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OPENAI_API_KEY is not set. Copy .env.local.example to .env.local and add your key, then restart the dev server.",
      );
    }
    return key;
  },
};
