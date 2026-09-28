import { createHash, randomUUID } from "node:crypto";
import { env } from "../env.js";
import { ApiError } from "./errors.js";

/*
 * Photo storage. Profile and check-in photos are uploaded to Cloudinary as private
 * ("authenticated") images with random names, and the database keeps only a reference,
 * "cld:<public_id>.<format>". The browser never sees a Cloudinary address: our own routes check who
 * is asking and then fetch the image here with a signed URL.
 *
 * Values that are still data URLs (photos saved before the move, or local development without
 * Cloudinary configured) keep working unchanged.
 */

const PREFIX = "cld:";

const configured = () => Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
export const inCloudinary = (value) => typeof value === "string" && value.startsWith(PREFIX);

const sha1 = (s, encoding = "hex") => createHash("sha1").update(s).digest(encoding);
/** Cloudinary API signature: the sorted parameters, then the secret. */
const signParams = (params) =>
  sha1(
    Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&") + env.CLOUDINARY_API_SECRET,
  );
const apiUrl = (path) => `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${path}`;
const storageError = () => new ApiError(503, "Couldn't save the photo right now. Please try again.", "photo_storage");

/**
 * Stores a photo (a data URL) and returns the value to keep in the database. `kind` is the folder:
 * "avatars" or "punches".
 */
export async function storePhoto(dataUrl, kind) {
  if (!configured()) return dataUrl;
  const params = {
    folder: `${env.CLOUDINARY_FOLDER}/${kind}`,
    public_id: randomUUID(),
    timestamp: Math.floor(Date.now() / 1000),
    type: "authenticated",
  };
  const form = new FormData();
  form.set("file", dataUrl);
  for (const [k, v] of Object.entries(params)) form.set(k, String(v));
  form.set("api_key", env.CLOUDINARY_API_KEY);
  form.set("signature", signParams(params));

  let res;
  try {
    res = await fetch(apiUrl("image/upload"), { method: "POST", body: form });
  } catch (err) {
    console.error("photo upload failed:", err.message);
    throw storageError();
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.public_id) {
    console.error("photo upload failed:", res.status, json?.error?.message);
    throw storageError();
  }
  return `${PREFIX}${json.public_id}.${json.format}`;
}

/** A signed delivery URL for a private image; the signature covers the path after it. */
function signedUrl(path) {
  const signature = sha1(path + env.CLOUDINARY_API_SECRET, "base64url").slice(0, 8);
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/authenticated/s--${signature}--/${path}`;
}

/** Returns the photo as a data URL, fetching it from Cloudinary if that's where it lives. */
export async function loadPhoto(value) {
  if (!inCloudinary(value)) return value;
  if (!configured()) return null;
  let res;
  try {
    res = await fetch(signedUrl(value.slice(PREFIX.length)));
  } catch (err) {
    console.error("photo fetch failed:", err.message);
    return null;
  }
  if (!res.ok) {
    console.error("photo fetch failed:", res.status, value);
    return null;
  }
  const type = res.headers.get("content-type") ?? "image/jpeg";
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

/**
 * Deletes a stored photo. Best effort: a failure is logged, never shown to the person acting.
 * Returns true once the file is gone (or was never stored externally).
 */
export async function deletePhoto(value) {
  if (!inCloudinary(value)) return true;
  if (!configured()) return false;
  const path = value.slice(PREFIX.length);
  const params = { invalidate: "true", public_id: path.replace(/\.[a-z0-9]+$/i, ""), timestamp: Math.floor(Date.now() / 1000), type: "authenticated" };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.set(k, String(v));
  form.set("api_key", env.CLOUDINARY_API_KEY);
  form.set("signature", signParams(params));
  try {
    const res = await fetch(apiUrl("image/destroy"), { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    if (res.ok && ["ok", "not found"].includes(json?.result)) return true;
    console.error("photo delete failed:", res.status, json?.result, value);
  } catch (err) {
    console.error("photo delete failed:", err.message, value);
  }
  return false;
}

/**
 * What pages get for a profile photo: a link to our own image route rather than the image itself, so
 * lists of hundreds of people stay light. `v` changes whenever the photo does, so browsers can cache it.
 */
export const avatarUrl = (userId, value) => (value ? `/profile-photo/${userId}?v=${sha1(value).slice(0, 10)}` : null);

/** Deletes every photo whose name starts with `prefix` (test clean-up). */
export async function deletePhotosByPrefix(prefix) {
  if (!configured()) return;
  const auth = Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString("base64");
  await fetch(apiUrl(`resources/image/authenticated?prefix=${encodeURIComponent(prefix)}`), {
    method: "DELETE",
    headers: { authorization: `Basic ${auth}` },
  });
}
