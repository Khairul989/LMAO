/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // game owns its own RAF/WebGL lifecycle; double-invoke breaks it
};

export default nextConfig;
