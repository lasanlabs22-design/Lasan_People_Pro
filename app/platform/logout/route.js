import { clearPlatformSession } from "@/lib/session";

export async function GET() {
  await clearPlatformSession();
  // Relative for the same reason as /logout: behind Railway's proxy request.url is localhost.
  return new Response(null, { status: 303, headers: { Location: "/platform/login" } });
}

export const POST = GET;
