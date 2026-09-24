import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function GET(request) {
  await clearSession();
  const url = new URL("/login", request.url);
  const reason = request.nextUrl.searchParams.get("reason");
  if (reason) url.searchParams.set("reason", reason);
  // 303 so a POST from the sign-out form becomes a GET of /login.
  return NextResponse.redirect(url, 303);
}

export const POST = GET;
