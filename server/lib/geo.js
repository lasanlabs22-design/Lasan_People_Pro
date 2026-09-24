const EARTH_RADIUS_M = 6_371_000;
const rad = (deg) => (deg * Math.PI) / 180;

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// 850 m, 1.2 km, 1,682 km. Mirrors fmtDistance in lib/format.js.
export function formatDistance(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString("en-IN")} km`;
}

// GPS accuracy is forgiven up to this many metres; beyond that a fix is too vague to trust.
const MAX_ACCURACY_ALLOWANCE_M = 50;

/**
 * Finds the nearest active office and whether the point falls inside its fence.
 * Returns { office, distance, inside } — office is null when none are configured.
 */
export function evaluateGeofence(offices, { latitude, longitude, accuracy = 0 }) {
  let best = null;
  for (const office of offices) {
    const distance = distanceMeters(latitude, longitude, office.latitude, office.longitude);
    const slack = Math.min(Math.max(accuracy, 0), MAX_ACCURACY_ALLOWANCE_M);
    const inside = distance - slack <= office.radiusMeters;
    if (!best || (inside && !best.inside) || (inside === best.inside && distance < best.distance)) {
      best = { office, distance: Math.round(distance), inside };
    }
  }
  return best ?? { office: null, distance: null, inside: false };
}
