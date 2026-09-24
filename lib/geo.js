const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres. Mirrors server/lib/geo.js (the server's check is authoritative). */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

export function nearestOffice(offices, lat, lng) {
  let best = null;
  for (const o of offices) {
    const d = distanceMeters(lat, lng, o.latitude, o.longitude);
    if (!best || d < best.distance) best = { office: o, distance: Math.round(d) };
  }
  return best;
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser can't share your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) =>
        reject(
          new Error(
            e.code === 1
              ? "Location access is blocked. Allow it for this site in your browser settings, then try again."
              : e.code === 3
                ? "Getting your location took too long. Try again."
                : "Couldn't determine your location. Move closer to a window and retry.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
