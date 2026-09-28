/**
 * Deletes check-in photos older than PUNCH_PHOTO_RETENTION_DAYS (7 by default) right now. The app
 * also does this on its own every six hours; this is for running it by hand.
 *
 *   npm run photos:purge
 */
import "./lib/load-env.js";
import { purgeExpiredPunchPhotos } from "../server/lib/photo-retention.js";
import { closeDb } from "../server/db/client.js";

try {
  const removed = await purgeExpiredPunchPhotos();
  console.log(`Removed ${removed} expired check-in photo(s).`);
} finally {
  await closeDb();
}
