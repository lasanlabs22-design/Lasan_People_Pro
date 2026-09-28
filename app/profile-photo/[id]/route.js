import { api, ApiError } from "@/lib/api";

// A person's profile photo, served as an image so pages can lazy-load it with <img>. The API decides
// who may see it (colleagues in the same workspace, admins, and the person themselves) and fetches it
// from photo storage; the browser never sees where it is stored.
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
  // Links carry ?v= that changes with the photo, so a short private cache is safe and keeps lists fast.
  return new Response(Buffer.from(match[2], "base64"), {
    headers: { "content-type": match[1], "cache-control": "private, max-age=3600" },
  });
}
