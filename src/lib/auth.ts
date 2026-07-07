import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// No adapter: JWT strategy + Credentials-only auth does not need a database
// adapter. PrismaAdapter conflicts with this setup because our schema uses
// emailVerified: Boolean (not DateTime), which causes NextAuth to fail its
// internal user lookup and return false 401s for valid credentials.
export const { auth, signIn, signOut, handlers } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as unknown as { role: string }).role;
        token.emailVerified = (user as unknown as { emailVerified: boolean }).emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).emailVerified = token.emailVerified;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
