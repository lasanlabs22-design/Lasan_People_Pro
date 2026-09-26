import { api, ApiError } from "@/lib/api";

// Serves a punch selfie as an image so pages can lazy-load it with <img>. The API decides who may
// see it (employees their own, admins everyone's), using the session cookie like any page load.
export async function GET(_request, ctx) {
  const { id, kind } = await ctx.params;
  let photo;
  try {
    ({ photo } = await api(`/attendance/${id}/photos/${kind}`));
  } catch (err) {
    if (err instanceof ApiError) return new Response(err.message, { status: err.status });
    throw err;
  }
  const [, type, data] = photo.match(/^data:(image\/[a-z]+);base64,(.*)$/);
  return new Response(Buffer.from(data, "base64"), {
    headers: { "content-type": type, "cache-control": "private, max-age=86400, immutable" },
  });
}
