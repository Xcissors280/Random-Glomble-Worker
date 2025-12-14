# Random Glomble Video Player

A Cloudflare Worker that scrapes and plays random videos from [Glomble.com](https://glomble.com) with a beautiful, immersive video player interface.

## Features

- 🎲 **Random Video Selection** - Fetches videos from random pages to ensure unique content every time
- 🎥 **Full Video Playback** - Embedded video player with controls
- 📊 **Complete Metadata Display** - Shows views, score, likes, dislikes, comments, and upload date
- 🖼️ **Dynamic Backgrounds** - Uses video banner/thumbnail as blurred background
- 🔗 **Direct Link** - Clickable link to watch on Glomble.com
- ⏭️ **Auto-Play Next** - Automatically loads another random video when current video ends
- 🎯 **Manual Next Button** - Large button to instantly load another random video

## How It Works

1. Randomly selects a page number from Glomble.com (1-50)
2. Scrapes the page to find all video IDs
3. Picks a random video from that page
4. Fetches the video page to extract:
   - Title
   - Views, score, likes, dislikes, comments
   - Upload date
   - Banner image
   - Video URL
5. Displays everything in a beautiful, responsive interface
6. Auto-plays the next random video when current one finishes

## Deployment

### Option 1: Cloudflare Pages (Recommended - Easiest!)

1. Push this repository to GitHub
2. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
3. Click "Create a project" and connect your GitHub repository
4. Configure build settings:
   - **Build command**: Leave empty or use `echo "No build needed"`
   - **Build output directory**: `/`
5. Click "Save and Deploy"

That's it! Your worker will be live at `https://your-project.pages.dev`

The `_worker.js` file is automatically detected and deployed by Cloudflare Pages.

### Option 2: Cloudflare Workers (via Wrangler CLI)

**Prerequisites:**
- [Node.js](https://nodejs.org/) (v16 or later)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

**Steps:**

1. Install Wrangler globally:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Deploy the worker:
   ```bash
   wrangler deploy
   ```

Your worker will be available at `https://random-glomble-worker.your-subdomain.workers.dev`

### Local Development

If you have Wrangler installed, you can test locally:

```bash
wrangler dev
```

Visit `http://localhost:8787` to see it in action!

## API Endpoints

- `GET /` - Main HTML page with video player
- `GET /api/random` - Returns random video data as JSON

### Example API Response

```json
{
  "id": "YepQqgyRHGpz",
  "title": "(original music) chaotic situation",
  "views": 72,
  "score": 96.1,
  "likes": 15,
  "dislikes": 2,
  "comments": 14,
  "uploadDate": "5 days, 19 hours ago",
  "videoUrl": "https://media.glomble.com/uploads/videos/YepQqgyRHGpz.mp4",
  "thumbnailUrl": "https://media.glomble.com/uploads/thumbnails/YepQqgyRHGpz.png",
  "bannerUrl": "https://media.glomble.com/profiles/banners/...",
  "pageUrl": "https://glomble.com/videos/YepQqgyRHGpz"
}
```

## Technical Details

- Built with vanilla JavaScript (no frameworks needed!)
- Uses Cloudflare Workers fetch API for scraping
- Regex-based HTML parsing for extracting video data
- Responsive CSS Grid layout
- HTML5 video player with auto-play functionality

## Customization

You can customize the worker by modifying these values in `worker.js`:

- **Page Range**: Change `Math.floor(Math.random() * 50) + 1` to adjust the random page range
- **Video URL Pattern**: Modify `https://media.glomble.com/uploads/videos/${videoId}.mp4` if the pattern differs
- **Auto-Play Delay**: Adjust `setTimeout(() => { loadRandomVideo(); }, 1000)` to change delay between videos

## Notes

- The video URL pattern is inferred based on Glomble's media CDN structure
- Some videos may not load if the URL pattern differs or if they're still processing
- The worker respects Glomble's public video pages and doesn't bypass any authentication

## License

MIT
