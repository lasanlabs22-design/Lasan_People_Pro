/** TLS for anything that isn't local or Railway's private network. Mirrors server/db/client.js. */
export function sslFor(url, override = process.env.DATABASE_SSL) {
  if (override === "require") return "require";
  if (override === "disable") return false;
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".railway.internal") ? false : "require";
}
