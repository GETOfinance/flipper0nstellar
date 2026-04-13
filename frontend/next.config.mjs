import path from "path";
import dotenv from "dotenv";

// In this repo, the main `.env` lives at the monorepo root.
// Next.js only auto-loads env files from the app directory (`frontend/`).
// Loading `../.env` here ensures `NEXT_PUBLIC_*` variables (e.g. Telegram username)
// are available during `next dev` / `next build`.
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env.local") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for Vercel deployment
  output: "standalone",
  // Suppress hydration warnings from wallet extensions injecting into DOM
  reactStrictMode: true,
};

export default nextConfig;
