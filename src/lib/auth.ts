import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db";
import { provisionNewUser } from "@/server/provision";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    disableSignUp: process.env.DISABLE_SIGNUP === "true",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
  databaseHooks: {
    user: {
      create: {
        after: async (u) => {
          await provisionNewUser(u.id);
        },
      },
    },
  },
  plugins: [nextCookies()], // must stay last
});

export type Session = typeof auth.$Infer.Session;
