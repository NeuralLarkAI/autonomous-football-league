import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@afl/db";

const SESSION_COOKIE = "afl_session";
const DEV_SESSION_DAYS = 14;

export function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string): string {
  return hashValue(`afl_pw:${password}`);
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  return hashPassword(password) === passwordHash;
}

export function randomToken(size = 24): string {
  return crypto.randomBytes(size).toString("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken(24);
  const tokenHash = hashValue(token);
  const expiresAt = new Date(Date.now() + DEV_SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.userSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
  return token;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashValue(token);
  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}
