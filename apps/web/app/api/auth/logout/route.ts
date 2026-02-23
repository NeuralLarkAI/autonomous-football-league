import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@afl/db";
import { getSessionCookieName, hashValue } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (token) {
    const tokenHash = hashValue(token);
    await prisma.userSession.deleteMany({ where: { tokenHash } }).catch(() => {});
  }
  cookieStore.delete(getSessionCookieName());
  return NextResponse.json({ ok: true });
}
