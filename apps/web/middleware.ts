import { NextRequest, NextResponse } from "next/server";

const DEFAULT_SLUG = "afl-prime";
const SESSION_COOKIE = "afl_session";

const LEGACY_MAP: Record<string, string> = {
  "/": "/dashboard",
  "/agents": "/agents",
  "/tasks": "/tasks",
  "/games": "/games",
  "/standings": "/standings",
  "/approvals": "/approvals",
  "/ops": "/ops",
  "/feed": "/feed",
  "/social": "/social",
  "/combine": "/combine",
  "/ranked": "/ranked",
  "/season": "/season",
  "/runbooks": "/runbooks",
  "/incidents": "/incidents",
};

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/claim/") ||
    pathname.startsWith("/watch") ||
    pathname.startsWith("/p/")
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const currentLeagueSlug = req.cookies.get("league_slug")?.value || DEFAULT_SLUG;

  if (!sessionToken && !isPublicPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/l/")) {
    const parts = pathname.split("/");
    const slug = parts[2];
    const res = NextResponse.next();
    if (slug) {
      res.cookies.set("league_slug", slug, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
    }
    return res;
  }

  const mapped = LEGACY_MAP[pathname];
  if (mapped && sessionToken) {
    const url = req.nextUrl.clone();
    url.pathname = `/l/${currentLeagueSlug}${mapped}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
