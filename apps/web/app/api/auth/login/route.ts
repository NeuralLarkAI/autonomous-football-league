import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@afl/db";
import { createSession, getSessionCookieName, hashPassword, verifyPassword } from "@/lib/auth";
import { enforceIpRateLimit } from "@/lib/ip-rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rl = enforceIpRateLimit(req, { key: "auth_login", limit: 20, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Opportunistically upgrade legacy password hashes on successful login.
    if (!user.passwordHash.startsWith("scrypt$")) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(password) },
      }).catch(() => {});
    }

    const token = await createSession(user.id);
    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 14 * 24 * 60 * 60,
    });

    const memberships = await prisma.leagueMember.findMany({
      where: { userId: user.id },
      include: { league: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      leagues: memberships.map((m) => ({ id: m.league.id, slug: m.league.slug, name: m.league.name, role: m.role })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
