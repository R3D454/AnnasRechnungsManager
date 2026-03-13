import { createCookieSessionStorage, redirect } from "react-router";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.AUTH_SECRET ?? "fallback-secret-change-in-production"],
    secure: process.env.SESSION_SECURE === "true",
  },
});

export async function login(
  identifier: string,
  password: string,
  request?: Request
) {
  // Allow login via email or username
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
  });

  if (!user) {
    await log({ action: "LOGIN_FAILED", metadata: { identifier }, request });
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await log({ action: "LOGIN_FAILED", metadata: { identifier }, request });
    return null;
  }

  await log({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, request });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function createUserSession(
  userId: string,
  userName: string,
  userRole: string,
  redirectTo: string
) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  session.set("userName", userName);
  session.set("userRole", userRole);
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
    userRole: session.get("userRole") as string | undefined,
  };
}

export async function requireUser(request: Request) {
  const { userId, userName, userRole } = await getUserSession(request);
  if (!userId) throw redirect("/login");
  return { id: userId, name: userName as string | undefined, role: userRole as string | undefined };
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (user.role !== "ADMIN") throw redirect("/");
  return user;
}

export async function getApiUser(request: Request) {
  const { userId, userRole } = await getUserSession(request);
  return userId ? { id: userId, role: userRole } : null;
}

export async function logout(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const userId = session.get("userId") as string | undefined;
  await log({ userId, action: "LOGOUT", entity: "User", entityId: userId, request });
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}
