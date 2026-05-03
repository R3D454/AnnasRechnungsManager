import { createCookieSessionStorage, redirect } from "react-router";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";

/**
 * AUTH_SECRET wird nur aus .env gelesen, falls die Umgebungsvariable nicht existiert.
 * Falls nicht gesetzt, wird eine zufällige generiert.
 * Bei jedem Containerstart mit ephemerem Secret werden alle bestehenden Sessions invalidiert.
 */
const AUTH_SECRET = process.env.AUTH_SECRET || randomBytes(32).toString("base64");

if (!AUTH_SECRET) {
  throw new Error("AUTH_SECRET could not be generated");
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 4, // 4 Stunden
    path: "/",
    sameSite: "lax",
    secrets: [AUTH_SECRET],
    secure: process.env.NODE_ENV === "production",
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
    // Dummy-Vergleich verhindert Timing-Angriffe zur Benutzernamen-Enumeration
    await bcrypt.compare(password, "$2a$12$dummyhashfortimingattackprevention000000000000000000000");
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
  try {
    const session = await sessionStorage.getSession(
      request.headers.get("Cookie")
    );
    return {
      userId: session.get("userId") as string | undefined,
      userName: session.get("userName") as string | undefined,
      userRole: session.get("userRole") as string | undefined,
    };
  } catch (error) {
    // Session-Cookie ist ungültig (z.B. nach Neustart mit neuem AUTH_SECRET)
    // Gib eine leere Session zurück, damit der Nutzer zum Login weitergeleitet wird
    return {
      userId: undefined,
      userName: undefined,
      userRole: undefined,
    };
  }
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
