/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Postgres driver opens raw TCP/TLS sockets; load it with Node's require instead of bundling.
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
