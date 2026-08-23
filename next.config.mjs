/**
 * @type {import('next').NextConfig}
 */

/*
 * PostHog, served from our own domain.
 *
 * Events are sent to /ingest on qi.land and rewritten here to PostHog's
 * endpoints. The point is not speed, it is existing: content blockers ship
 * `*.i.posthog.com` on their default lists, so an unproxied setup quietly
 * loses whatever share of an indie-music audience runs uBlock — which is a
 * large share, and not a random one. A first-party path is not on any list.
 *
 * Rewrites are resolved at build time, so the region is a build-time env var
 * (Vercel exposes it to the build the same as to the runtime). US is the
 * default because that is where posthog.com signs you up unless you ask for
 * EU. If the project is EU, set POSTHOG_REGION=eu here AND
 * NEXT_PUBLIC_POSTHOG_UI_HOST=https://eu.posthog.com for the toolbar — the two
 * are separate hosts and getting one right while the other is wrong fails in a
 * way that looks like a broken key.
 */
const PH = process.env.POSTHOG_REGION === 'eu'
  ? { api: 'https://eu.i.posthog.com', assets: 'https://eu-assets.i.posthog.com' }
  : { api: 'https://us.i.posthog.com', assets: 'https://us-assets.i.posthog.com' };

const nextConfig = {
  reactStrictMode: true,
  /*
   * Required by the proxy above, not by us. Some PostHog endpoints are posted
   * to with a trailing slash and Next's default is to answer those with a 308
   * to the slash-less form — which a beacon POST does not follow, so the event
   * is lost with no error anywhere. This turns that redirect off.
   */
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // Order matters: the assets host serves the lazily-loaded chunks (the
      // session recorder, surveys), and it is a different origin from the API.
      { source: '/ingest/static/:path*', destination: PH.assets + '/static/:path*' },
      { source: '/ingest/:path*', destination: PH.api + '/:path*' },
    ];
  },
  async redirects() {
    return [
      // `/medusa` was the shader treatment's address while it lived alongside the
      // R3F descent. It's the front page now; keep the old link alive.
      { source: '/medusa', destination: '/', permanent: true },
    ];
  },
};
export default nextConfig;
