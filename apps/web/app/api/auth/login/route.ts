import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@afl/db";
import { createSession, getSessionCookieName, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
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

    const token = await createSession(user.id);
    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
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
