import { NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import { auth } from "@/lib/auth";

export async function getSessionFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    try {
      const decoded = await decode({
        token,
        secret: process.env.AUTH_SECRET!,
        salt: "authjs.session-token",
      });

      if (decoded && decoded.id) {
        return {
          user: {
            id: decoded.id as string,
            email: decoded.email as string,
            name: decoded.name as string,
            role: decoded.role as string,
          },
        };
      }
    } catch {
      return null;
    }
  }

  return auth();
}
