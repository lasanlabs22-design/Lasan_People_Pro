import { NextResponse } from "next/server";

const PUBLIC = new Set(["/login"]);
const isConsolePath = (p) => p === "/platform" || p.startsWith("/platform/") || p.startsWith("/api/platform");
const isSignInFlow = (p) => ["/", "/login", "/change-password"].includes(p) || /^\/(admin|employee)(\/|$)/.test(p);

/**
 * Which address serves what. With APP_HOST and CONSOLE_HOST set (app.lasanpeople.com and
 * ops.lasanpeople.com), customers never reach the console on their address, the console only answers
 * on its own, and the old Railway address forwards to the right one. Unset (local development), every
 * address serves everything.
 */
function routeByHost(request) {
  const appHost = process.env.APP_HOST;
  const consoleHost = process.env.CONSOLE_HOST;
  if (!appHost || !consoleHost) return null;

  const { pathname, search } = request.nextUrl;
  // Railway's health check and other in-process callers reach the app on internal addresses.
  if (pathname === "/api/health") return null;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const to = (h, path = pathname) => NextResponse.redirect(`https://${h}${path}${search}`, 308);

  if (host === consoleHost) {
    if (pathname === "/") return NextResponse.redirect(`https://${consoleHost}/platform`, 307);
    return isConsolePath(pathname) ? null : to(appHost);
  }
  if (host === appHost) {
    // The console doesn't exist here, as far as anyone on the customer address can tell.
    return isConsolePath(pathname) ? new NextResponse("Not found", { status: 404 }) : null;
  }
  // The old *.up.railway.app address (bookmarks, earlier links) forwards to the right new one.
  if (host.endsWith(".up.railway.app")) return to(isConsolePath(pathname) ? consoleHost : appHost);
  return null;
}

// Optimistic routing only. Every API call re-checks the token, tenant, role and revocation server-side.
export function proxy(request) {
  const byHost = routeByHost(request);
  if (byHost) return byHost;

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

  if (!isSignInFlow(pathname)) return NextResponse.next();

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
  // Everything except build assets, so the address rules also cover the API, photos and legal pages.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
