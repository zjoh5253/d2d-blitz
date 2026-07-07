import { type DefaultSession, type DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      emailVerified: boolean;
    } & Omit<NonNullable<DefaultSession["user"]>, "emailVerified">;
  }

  interface User {
    role: string;
    emailVerified: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    emailVerified: boolean;
  }
}
