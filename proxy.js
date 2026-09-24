import { NextResponse } from "next/server";

const PUBLIC = new Set(["/login", "/signup"]);

// Optimistic routing only. Every API call re-checks the token, tenant, role and revocation server-side.
export function proxy(request) {
  const { pathname, search } = request.nextUrl;
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

  if (pathname === "/" || (pathname.startsWith("/admin") && role !== "admin") || (pathname.startsWith("/employee") && role === "admin")) {
    return NextResponse.redirect(new URL(home, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup", "/admin/:path*", "/employee/:path*", "/change-password"],
};
