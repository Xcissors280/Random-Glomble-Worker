// Cloudflare Worker for Glomble Video Scraper
// Serves frontend, provides API, and runs scheduled scrapes

const MAX_CONCURRENT_PAGES = 5;
const SCRAPE_DELAY_MS = 1000; // Reduced delay for Workers

// HTML frontend (embedded)
const HTML_FRONTEND = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Random Glomble Video</title>
    <style>
        html { overflow: hidden; }
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background: #000000;
            color: #ffffff;
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        body.white-mode {
            background: #ffffff;
            color: #000000;
        }
        #container {
            flex: 1;
            display: flex;
            flex-direction: column;
            width: 100%;
            padding: 8px;
            box-sizing: border-box;
            min-height: 0;
        }
        h1 {
            margin: 0 0 8px 0;
            font-size: 20px;
            flex-shrink: 0;
            text-align: center;
        }
        #video-container {
            position: relative;
            width: 100%;
            background: #000000;
            overflow: hidden;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 0;
        }
        #video-player {
            max-width: 100%;
            max-height: 100%;
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
            background: #000000;
        }
        #controls {
            margin-top: 12px;
            flex-shrink: 0;
            text-align: center;
        }
        button {
            background: transparent;
            color: #ffffff;
            border: 2px solid #ffffff;
            padding: 10px 20px;
            font-size: 14px;
            cursor: pointer;
        }
        body.white-mode button {
            color: #000000;
            border-color: #000000;
        }
        button:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        body.white-mode button:hover {
            background: rgba(0, 0, 0, 0.1);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        #current-url {
            margin-top: 8px;
            font-size: 11px;
            word-break: break-all;
            flex-shrink: 0;
            text-align: center;
        }
        #current-url a {
            color: #ffffff;
            text-decoration: none;
        }
        body.white-mode #current-url a {
            color: #000000;
        }
        #current-url a:hover {
            text-decoration: underline;
        }
        #error-message {
            margin-top: 8px;
            font-size: 11px;
            color: #ff6666;
            flex-shrink: 0;
            text-align: center;
        }
        body.white-mode #error-message {
            color: #cc0000;
        }
    </style>
</head>
<body>
    <div id="container">
        <h1>Random Glomble Video</h1>
        <div id="video-container">
            <video id="video-player" controls preload="auto">
                Your browser does not support the video tag.
            </video>
        </div>
        <div id="controls">
            <button id="new-video-btn" onclick="loadRandomVideo(true)">Random Video</button>
        </div>
        <div id="current-url"></div>
        <div id="error-message"></div>
    </div>
    <script>
        let videoIds = [];
        let isLoading = false;
        let nextVideoPreloaded = null;

        // Randomly decide white mode on page load (1 in 1000)
        if (Math.random() < 0.001) {
            document.body.classList.add('white-mode');
        }

        // Fetch video list from API
        async function loadVideoIds() {
            if (isLoading) return;
            isLoading = true;
            try {
                const response = await fetch('/api/videos');
                const data = await response.json();
                videoIds = data.videos;
                console.log(\`Loaded \${videoIds.length} video IDs\`);
            } catch (error) {
                console.error('Error loading video IDs:', error);
            } finally {
                isLoading = false;
            }
        }

        function getRandomVideoId() {
            if (videoIds.length === 0) return null;
            return videoIds[Math.floor(Math.random() * videoIds.length)];
        }

        async function preloadNextVideo() {
            const videoId = getRandomVideoId();
            if (videoId) {
                const mp4Url = \`https://media.glomble.com/uploads/video_files/\${videoId}.mp4\`;
                const videoPageUrl = \`https://glomble.com/videos/\${videoId}\`;
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'video';
                link.href = mp4Url;
                document.head.appendChild(link);
                nextVideoPreloaded = { mp4Url, videoPageUrl, linkElement: link };
            }
        }

        async function loadRandomVideo(usePreloaded = false) {
            const button = document.getElementById('new-video-btn');
            const currentUrl = document.getElementById('current-url');
            const errorMessage = document.getElementById('error-message');
            const videoPlayer = document.getElementById('video-player');

            button.disabled = true;
            errorMessage.textContent = '';

            // Maybe toggle white mode (1 in 1000)
            if (Math.random() < 0.001) {
                document.body.classList.add('white-mode');
            } else {
                document.body.classList.remove('white-mode');
            }

            let mp4Url, videoPageUrl;

            // Use preloaded video if available
            if (usePreloaded && nextVideoPreloaded) {
                mp4Url = nextVideoPreloaded.mp4Url;
                videoPageUrl = nextVideoPreloaded.videoPageUrl;
                if (nextVideoPreloaded.linkElement) {
                    nextVideoPreloaded.linkElement.remove();
                }
                nextVideoPreloaded = null;
            } else {
                const videoId = getRandomVideoId();
                if (!videoId) {
                    errorMessage.textContent = 'No videos available. Reloading...';
                    await loadVideoIds();
                    button.disabled = false;
                    return;
                }
                mp4Url = \`https://media.glomble.com/uploads/video_files/\${videoId}.mp4\`;
                videoPageUrl = \`https://glomble.com/videos/\${videoId}\`;
            }

            try {
                videoPlayer.src = mp4Url;
                videoPlayer.muted = false;
                videoPlayer.load();
                videoPlayer.onloadeddata = function() {
                    videoPlayer.play().catch(e => {
                        console.log('Autoplay prevented:', e);
                    });
                };
                videoPlayer.onerror = function() {
                    errorMessage.textContent = 'Video failed to load. Trying another...';
                    setTimeout(() => loadRandomVideo(), 1000);
                };
                currentUrl.innerHTML = \`<a href="\${videoPageUrl}" target="_blank">\${videoPageUrl}</a>\`;
                videoPlayer.onplaying = function() {
                    if (!nextVideoPreloaded) {
                        preloadNextVideo();
                    }
                };
            } catch (error) {
                console.error('Error loading video:', error);
                errorMessage.textContent = 'Error loading video. Trying another...';
                setTimeout(() => loadRandomVideo(), 1000);
            }

            button.disabled = false;
        }

        // Auto-play next random video when current one ends
        document.getElementById('video-player').addEventListener('ended', function() {
            console.log('Video ended, loading next random video...');
            loadRandomVideo(true);
        });

        // Initialize
        (async function() {
            await loadVideoIds();
            if (videoIds.length > 0) {
                loadRandomVideo(false);
            }
        })();
    </script>
</body>
</html>`;

// Scraper functions
async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: AbortSignal.timeout(10000)
            });
            if (response.ok) return response;
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        }
    }
    throw new Error('Max retries exceeded');
}

async function fetchMaxPage() {
    try {
        console.log('Detecting max page number...');
        let low = 1;
        let high = 500;
        let maxFound = 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const url = mid === 1 ? 'https://glomble.com/' : `https://glomble.com/?page=${mid}`;

            try {
                const response = await fetchWithRetry(url, 2);
                const html = await response.text();
                const hasVideos = /\/videos\/([a-zA-Z0-9_-]+)/.test(html);

                if (hasVideos) {
                    maxFound = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            } catch (error) {
                high = mid - 1;
            }

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`Detected max page: ${maxFound}`);
        return maxFound;
    } catch (error) {
        console.error('Error detecting max page:', error.message);
        return 200;
    }
}

async function fetchPageVideoIds(pageNumber) {
    const url = pageNumber === 1 ? 'https://glomble.com/' : `https://glomble.com/?page=${pageNumber}`;
    await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY_MS));

    try {
        const response = await fetchWithRetry(url);
        const html = await response.text();
        const regex = /\/videos\/([a-zA-Z0-9_-]+)/g;
        const matches = [...html.matchAll(regex)];
        const videoIds = matches.map(m => m[1]);
        const uniqueIds = [...new Set(videoIds)];
        console.log(`Page ${pageNumber}: Found ${uniqueIds.length} unique video IDs`);
        return uniqueIds;
    } catch (error) {
        console.log(`Page ${pageNumber}: Error - ${error.message}`);
        return [];
    }
}

async function scrapeAllPages(maxPage) {
    const allVideoIds = new Set();

    for (let i = 1; i <= maxPage; i += MAX_CONCURRENT_PAGES) {
        const batch = [];
        const end = Math.min(i + MAX_CONCURRENT_PAGES - 1, maxPage);
        console.log(`Processing pages ${i} to ${end}...`);

        for (let page = i; page <= end; page++) {
            batch.push(fetchPageVideoIds(page));
        }

        const results = await Promise.all(batch);
        results.flat().forEach(id => allVideoIds.add(id));
        console.log(`Total unique video IDs so far: ${allVideoIds.size}`);
    }

    return Array.from(allVideoIds).sort();
}

async function runScraper(env) {
    console.log('Starting Glomble video scraper...');
    const startTime = Date.now();

    try {
        const maxPage = await fetchMaxPage();
        console.log(`Will scrape ${maxPage} pages`);

        const videoIds = await scrapeAllPages(maxPage);

        // Store in KV
        await env.VIDEO_DATA.put('video_ids', JSON.stringify({
            videos: videoIds,
            lastUpdated: new Date().toISOString(),
            count: videoIds.length
        }));

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Completed in ${duration} seconds`);
        console.log(`Total unique videos found: ${videoIds.length}`);

        return { success: true, count: videoIds.length, duration };
    } catch (error) {
        console.error('Fatal error:', error);
        return { success: false, error: error.message };
    }
}

// Worker event handlers
export default {
    // Handle HTTP requests
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Serve frontend HTML
        if (url.pathname === '/' || url.pathname === '/index.html') {
            return new Response(HTML_FRONTEND, {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        // API endpoint to get video list
        if (url.pathname === '/api/videos') {
            const data = await env.VIDEO_DATA.get('video_ids', 'json');
            if (!data) {
                return new Response(JSON.stringify({
                    videos: [],
                    lastUpdated: null,
                    count: 0,
                    message: 'No data available yet. Scraping in progress...'
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            return new Response(JSON.stringify(data), {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
                }
            });
        }

        // Manual trigger endpoint (optional)
        if (url.pathname === '/api/scrape' && request.method === 'POST') {
            // Run scraper in background
            ctx.waitUntil(runScraper(env));
            return new Response(JSON.stringify({ message: 'Scraping started' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Not Found', { status: 404 });
    },

    // Handle scheduled events (every 12 hours)
    async scheduled(event, env, ctx) {
        console.log('Scheduled scrape triggered');
        ctx.waitUntil(runScraper(env));
    }
};
