import { punchPhotoRetention } from "../db/client.js";
import { env } from "../env.js";
import { deletePhoto } from "./photos.js";

const BATCH = 200;
const EVERY = 6 * 60 * 60_000;

/**
 * Deletes check-in photos older than the retention period: the file in photo storage first, then
 * the row, so a storage hiccup leaves the row to retry next time instead of an orphaned file.
 * Returns how many photos were removed.
 */
export async function purgeExpiredPunchPhotos({ days = env.PUNCH_PHOTO_RETENTION_DAYS } = {}) {
  let removed = 0;
  for (;;) {
    const rows = await punchPhotoRetention.expired(days, BATCH);
    let progress = 0;
    for (const row of rows) {
      if (await deletePhoto(row.photo)) {
        await punchPhotoRetention.forget(row.attendance_id, row.kind);
        progress++;
      }
    }
    removed += progress;
    // Stop when caught up, or when storage refused every delete in the batch (try again later).
    if (rows.length < BATCH || progress === 0) return removed;
  }
}

/** Runs the purge shortly after the server starts and then every six hours. */
export function startPunchPhotoRetention() {
  if (globalThis.__lasanPhotoRetention) return;
  const run = async () => {
    try {
      const removed = await purgeExpiredPunchPhotos();
      if (removed) console.log(`photo retention: removed ${removed} check-in photo(s) older than ${env.PUNCH_PHOTO_RETENTION_DAYS} days`);
    } catch (err) {
      console.error("photo retention failed:", err.message);
    }
  };
  const first = setTimeout(run, 2 * 60_000);
  const repeat = setInterval(run, EVERY);
  first.unref?.();
  repeat.unref?.();
  globalThis.__lasanPhotoRetention = { first, repeat };
}
