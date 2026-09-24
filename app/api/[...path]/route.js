import { getApp } from "@/server/app";

// The same API the pages use, exposed for other clients (e.g. a mobile app) with a Bearer token.
async function handle(request) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api/, "") || "/";
  const headers = new Headers(request.headers);
  // Only lib/api.js may set this; outside callers could otherwise dodge rate limits.
  headers.delete("x-lasan-client-ip");
  const hasBody = !["GET", "HEAD"].includes(request.method);
  return getApp().fetch(
    new Request(url, { method: request.method, headers, body: hasBody ? await request.arrayBuffer() : undefined }),
  );
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
