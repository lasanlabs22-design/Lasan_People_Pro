import { clearSession } from "@/lib/session";

export async function GET(request) {
  await clearSession();
  const reason = request.nextUrl.searchParams.get("reason");
  const target = reason ? `/login?${new URLSearchParams({ reason })}` : "/login";
  // Relative on purpose: behind Railway's proxy request.url is the internal http://localhost:PORT
  // address, so an absolute URL built from it sent people to "localhost" after signing out.
  // 303 so a POST from the sign-out form becomes a GET of /login.
  return new Response(null, { status: 303, headers: { Location: target } });
}

export const POST = GET;
