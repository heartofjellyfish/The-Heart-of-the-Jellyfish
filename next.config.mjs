/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // `/medusa` was the shader treatment's address while it lived alongside the
      // R3F descent. It's the front page now; keep the old link alive.
      { source: '/medusa', destination: '/', permanent: true },
    ];
  },
};
export default nextConfig;
