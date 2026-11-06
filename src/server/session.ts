import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

/** The single place that turns a request into a user id. Throws if not signed in. */
export async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new UnauthorizedError();
  return session.user.id;
}

export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null;
}
