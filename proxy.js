import { NextResponse } from "next/server";

const PUBLIC = new Set(["/login"]);

// Optimistic routing only. Every API call re-checks the token, tenant, role and revocation server-side.
export function proxy(request) {
  const { pathname, search } = request.nextUrl;

  // The platform console has its own session, independent of any workspace sign-in.
  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    if (pathname === "/platform/logout" || pathname === "/platform/forgot") return NextResponse.next();
    const hasPlatform = Boolean(request.cookies.get("lasan_pro_platform")?.value);
    if (pathname === "/platform/login") {
      return hasPlatform ? NextResponse.redirect(new URL("/platform", request.url)) : NextResponse.next();
    }
    return hasPlatform ? NextResponse.next() : NextResponse.redirect(new URL("/platform/login", request.url));
  }

  const hasSession = Boolean(request.cookies.get("lasan_pro_session")?.value);
  const role = request.cookies.get("lasan_pro_role")?.value;
  const home = role === "admin" ? "/admin" : "/employee";

  if (PUBLIC.has(pathname)) {
    return hasSession ? NextResponse.redirect(new URL(home, request.url)) : NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // Only "/" is routed by the role hint. Which area a person may use is decided by the admin and
  // employee layouts from their real role; bouncing between /admin and /employee here as well
  // looped forever whenever the hint was stale (someone promoted or demoted while signed in).
  if (pathname === "/") return NextResponse.redirect(new URL(home, request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/employee/:path*", "/change-password", "/platform", "/platform/:path*"],
};
