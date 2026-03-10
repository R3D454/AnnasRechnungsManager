import { createCookieSessionStorage, redirect } from "react-router";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.AUTH_SECRET ?? "fallback-secret-change-in-production"],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export async function createUserSession(
  userId: string,
  userName: string,
  redirectTo: string
) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  session.set("userName", userName);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export async function getUserSession(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  return {
    userId: session.get("userId") as string | undefined,
    userName: session.get("userName") as string | undefined,
  };
}

export async function requireUser(request: Request) {
  const { userId, userName } = await getUserSession(request);
  if (!userId) throw redirect("/login");
  return { id: userId, name: userName as string | undefined };
}

export async function getApiUser(request: Request) {
  const { userId } = await getUserSession(request);
  return userId ? { id: userId } : null;
}

export async function logout(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}
