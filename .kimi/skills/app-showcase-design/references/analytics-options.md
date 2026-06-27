# Free Analytics Options

Decision matrix for adding analytics to the proposal-review-app.

## Web Traffic Analytics

| Tool | Cost | Best For | Consent Banner | Notes |
|------|------|----------|----------------|-------|
| **Google Analytics 4** | Free | Google ecosystem, ads, BigQuery export | Yes (GDPR) | Most powerful free tier; complex UI |
| **Plausible** | Self-hosted free / hosted paid | Simple privacy-first traffic metrics | No (cookieless) | Under 1KB script; open source |
| **Umami** | Self-hosted free / cloud free tier | Developers wanting full data ownership | No (cookieless) | Built with Next.js; MySQL/Postgres |
| **Cloudflare Web Analytics** | Free | Sites already on Cloudflare | No | Lightweight; limited depth |
| **Matomo** | Self-hosted free / cloud paid | Enterprise data ownership | No in anonymized mode | Heavy feature set; plugins cost extra |
| **Microsoft Clarity** | Free | Heatmaps + session recordings | Yes for recordings | "Free forever"; good qualitative insights |

## Product Analytics

| Tool | Cost | Best For | Notes |
|------|------|----------|-------|
| **PostHog** | 1M events + 5K replays free | SaaS product funnels, feature flags, A/B tests | Open source; engineering-focused |
| **Mixpanel** | Free tier (1M events/month) | Retention, funnel analysis | Good free tier; paid at scale |

## Recommended Stack for This App

1. **Start with Plausible or Umami** for privacy-friendly pageview tracking without a consent banner.
2. **Add PostHog** if you need product analytics (proposal upload events, review completion, scoring actions).
3. **Use Microsoft Clarity** selectively if you want heatmaps/session recordings and can handle consent for recordings.

## Next.js Integration Pattern

Most tools provide a small script or npm package. Add the tracker in `app/layout.tsx` or in a dedicated `Analytics` client component rendered in the root layout.

Example (generic script component):

```tsx
// app/analytics.tsx
export function Analytics() {
  return (
    <script
      defer
      data-domain="yourdomain.com"
      src="https://plausible.io/js/script.js"
    />
  );
}
```

For event tracking, wrap the vendor's SDK in a small `trackEvent(name, props)` helper and call it from interactive components.
