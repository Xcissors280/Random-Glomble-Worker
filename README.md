# Glomble Video Scraper - Cloudflare Workers

A Cloudflare Workers application that scrapes video IDs from Glomble.com, stores them in KV storage, and serves a random video player frontend.

## Features

- 🔄 Automatic scraping on deployment
- ⏰ Updates every 12 hours via Cron Triggers
- 💾 Uses Cloudflare KV (no R2 needed!)
- 🌐 Serves frontend and API from single Worker
- 🎥 Random video player with preloading

## Setup Instructions

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create KV Namespace

```bash
wrangler kv:namespace create "VIDEO_DATA"
```

This will output something like:
```
{ binding = "VIDEO_DATA", id = "abc123..." }
```

Copy the `id` value and update `wrangler.toml`:

```toml
kv_namespaces = [
  { binding = "VIDEO_DATA", id = "YOUR_KV_NAMESPACE_ID" }  # Replace with your ID
]
```

### 4. Deploy

```bash
wrangler deploy
```

The Worker will be deployed to: `https://glomble-scraper.YOUR_SUBDOMAIN.workers.dev`

### 5. Trigger Initial Scrape

After deployment, trigger the first scrape:

```bash
curl -X POST https://glomble-scraper.YOUR_SUBDOMAIN.workers.dev/api/scrape
```

Or visit the URL in your browser - it will show "No data available yet" until the first scrape completes.

## Endpoints

- `GET /` - Frontend HTML (random video player)
- `GET /api/videos` - JSON API with all video IDs
- `POST /api/scrape` - Manually trigger a scrape

## Scheduled Updates

The Worker is configured to re-scrape every 12 hours using Cloudflare Cron Triggers:
- Schedule: `0 */12 * * *` (every 12 hours at :00)
- Runs automatically in the background
- No manual intervention needed

## Development

Test locally:

```bash
wrangler dev
```

View logs:

```bash
wrangler tail
```

## Cost

- **Workers Free Tier**: 100,000 requests/day
- **KV Free Tier**: 100,000 reads/day, 1,000 writes/day, 1 GB storage
- **Cron Triggers**: Free (2 triggers/day = 60/month, well under 1M limit)

This project fits comfortably within Cloudflare's free tier!

## Customization

### Change Scrape Frequency

Edit `wrangler.toml`:

```toml
crons = ["0 */6 * * *"]  # Every 6 hours
crons = ["0 0 * * *"]    # Once daily at midnight
```

### Adjust Scraping Speed

Edit `worker.js`:

```javascript
const MAX_CONCURRENT_PAGES = 5;  // Pages to fetch in parallel
const SCRAPE_DELAY_MS = 1000;    // Delay between requests
```

## Troubleshooting

### "CPU limit exceeded" error

Workers have a 50ms CPU time limit on the free tier. The scraper runs in the background using `ctx.waitUntil()`, which allows longer execution. If you still hit limits:

1. Increase the batch delay
2. Reduce concurrent pages
3. Upgrade to Workers Paid plan ($5/month for 50s CPU time)

### Data not updating

Check the cron trigger status:

```bash
wrangler tail
```

Manually trigger a scrape:

```bash
curl -X POST https://glomble-scraper.YOUR_SUBDOMAIN.workers.dev/api/scrape
```

### KV data not showing

Verify KV namespace is created and ID is correct in `wrangler.toml`:

```bash
wrangler kv:namespace list
```

## Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ GET /
       ▼
┌─────────────────────┐
│ Cloudflare Worker   │
│  - Serves HTML      │
│  - API /api/videos  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐      ┌──────────────┐
│   Cron Trigger      │──────│ Scraper Fn   │
│  Every 12 hours     │      │ (background) │
└─────────────────────┘      └──────┬───────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │ KV Storage  │
                             │ video_ids   │
                             └─────────────┘
```

---

## Legacy Version (Bun/Node.js)

The original local scraper is still available in `scraper.js`. See below for usage.

### Requirements

- [Bun](https://bun.sh/) runtime

### Usage

Run the scraper:
```bash
bun run scraper.js
```

### Output

Creates `glomble_videos.csv` with three columns:
- `video_id` - The unique video identifier
- `video_url` - The full URL to the video page
- `media_url` - The direct URL to the MP4 file

## License

MIT
