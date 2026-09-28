// Runs once when a server instance starts: schedules the check-in photo clean-up
// (server/lib/photo-retention.js). Skipped while building.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startPunchPhotoRetention } = await import("./server/lib/photo-retention.js");
  startPunchPhotoRetention();
}
