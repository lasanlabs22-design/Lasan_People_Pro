import { api, ApiError } from "@/lib/api";

// A colleague's profile photo for the directory, served as an image so the page can lazy-load it.
// The API only returns photos of active people in the viewer's own workspace.
export async function GET(_request, ctx) {
  const { id } = await ctx.params;
  let photo;
  try {
    ({ photo } = await api(`/directory/${id}/photo`));
  } catch (err) {
    if (err instanceof ApiError) return new Response(err.message, { status: err.status });
    throw err;
  }
  const match = photo.match(/^data:(image\/[a-z]+);base64,(.*)$/);
  if (!match) return new Response("Not found", { status: 404 });
  // Not cached: on a shared device the next person to sign in must not be served it without a check.
  return new Response(Buffer.from(match[2], "base64"), {
    headers: { "content-type": match[1], "cache-control": "private, no-store" },
  });
}
