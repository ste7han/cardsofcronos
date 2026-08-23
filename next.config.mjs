import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Zonder dit gaat Turbopack op zoek naar een package-lock.json boven deze map
    // en waarschuwt hij dat hij er een buiten de repo negeert.
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;
