// Cloudflare Worker for Random Glomble Video Player

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request)
  }
}

async function handleRequest(request) {
  const url = new URL(request.url)

  // API endpoint to get random video data
  if (url.pathname === '/api/random') {
    return getRandomVideo()
  }

  // Serve the main HTML page
  return new Response(getHTML(), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  })
}

async function getRandomVideo() {
  try {
    // Random page between 1-50 (adjust based on site)
    const randomPage = Math.floor(Math.random() * 50) + 1
    const pageUrl = `https://glomble.com/?page=${randomPage}`

    // Fetch the listing page
    const response = await fetch(pageUrl)
    const html = await response.text()

    // Extract video IDs from the page
    const videoIds = extractVideoIds(html)

    if (videoIds.length === 0) {
      throw new Error('No videos found on page')
    }

    // Pick a random video from the page
    const randomVideoId = videoIds[Math.floor(Math.random() * videoIds.length)]

    // Fetch the video page to get detailed info
    const videoPageUrl = `https://glomble.com/videos/${randomVideoId}`
    const videoResponse = await fetch(videoPageUrl)
    const videoHtml = await videoResponse.text()

    // Extract video details
    const videoData = extractVideoData(videoHtml, randomVideoId)

    return new Response(JSON.stringify(videoData), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function extractVideoIds(html) {
  const videoIds = []
  // Match video URLs like /videos/[VIDEO_ID]
  const regex = /\/videos\/([a-zA-Z0-9_-]+)/g
  let match

  // Common non-video IDs to filter out
  const blacklist = ['favico', 'favicon', 'home', 'main', 'styles', 'style', 'script', 'scripts', 'index', 'about', 'contact', 'login', 'register', 'search', 'upload', 'settings', 'profile', 'profiles']

  while ((match = regex.exec(html)) !== null) {
    const id = match[1]
    // Only add if not in blacklist and has proper video ID format (12 characters, mixed case)
    if (!videoIds.includes(id) &&
        !blacklist.includes(id.toLowerCase()) &&
        id.length >= 10 &&
        /[A-Z]/.test(id) &&
        /[a-z]/.test(id)) {
      videoIds.push(id)
    }
  }

  return videoIds
}

function extractVideoData(html, videoId) {
  const data = {
    id: videoId,
    title: '',
    views: 0,
    score: 0,
    likes: 0,
    dislikes: 0,
    comments: 0,
    uploadDate: '',
    videoUrl: `https://media.glomble.com/uploads/video_files/${videoId}.mp4`,
    thumbnailUrl: `https://media.glomble.com/uploads/thumbnails/${videoId}.png`,
    bannerUrl: '',
    pageUrl: `https://glomble.com/videos/${videoId}`
  }

  // Extract title - try multiple methods
  let titleMatch = html.match(/<title>([^<]+)<\/title>/)
  if (titleMatch) {
    const title = titleMatch[1].replace(' - Glomble', '').replace('Glomble - ', '').trim()
    if (title && title !== 'Glomble') {
      data.title = title
    }
  }
  // Try h5 tag (where Glomble actually puts the title) - try multiple times
  if (!data.title) {
    const h5Matches = html.match(/<h5[^>]*>([^<]+)<\/h5>/gi)
    if (h5Matches && h5Matches.length > 0) {
      // Get the first h5 match and extract text
      const h5Match = h5Matches[0].match(/<h5[^>]*>([^<]+)<\/h5>/i)
      if (h5Match) data.title = h5Match[1].trim()
    }
  }
  // Try h1 as fallback
  if (!data.title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) data.title = h1Match[1].trim()
  }
  // Try h2 as last resort
  if (!data.title) {
    const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i)
    if (h2Match) data.title = h2Match[1].trim()
  }
  // If still no title, use video ID
  if (!data.title) {
    data.title = `Video ${videoId}`
  }

  // Extract views - look for view-count span
  let viewsMatch = html.match(/<span class="view-count"[^>]*>(\d+)<\/span>/i)
  if (!viewsMatch) viewsMatch = html.match(/Views:\s*<span[^>]*>(\d+)<\/span>/i)
  if (!viewsMatch) viewsMatch = html.match(/Views:\s*(\d+)/i)
  if (viewsMatch) {
    data.views = parseInt(viewsMatch[1])
  }

  // Extract score - look for score span
  let scoreMatch = html.match(/<span id="score">([^<]+)<\/span>/i)
  if (!scoreMatch) scoreMatch = html.match(/Score:\s*<span[^>]*>([\d.]+)<\/span>/i)
  if (!scoreMatch) scoreMatch = html.match(/Score:\s*([\d.]+)/i)
  if (scoreMatch) {
    data.score = parseFloat(scoreMatch[1])
  }

  // Extract likes - look for bx-like with span (confusingly named dislike-count)
  let likesMatch = html.match(/bx-like[^>]*><span class="dislike-count">(\d+)<\/span>/i)
  if (!likesMatch) likesMatch = html.match(/bx-like[^>]*><span>(\d+)<\/span>/i)
  if (!likesMatch) likesMatch = html.match(/(\d+)\s*likes?/i)
  if (likesMatch) data.likes = parseInt(likesMatch[1])

  // Extract dislikes - look for bx-dislike with span
  let dislikesMatch = html.match(/bx-dislike[^>]*><span>(\d+)<\/span>/i)
  if (!dislikesMatch) dislikesMatch = html.match(/(\d+)\s*dislikes?/i)
  if (dislikesMatch) data.dislikes = parseInt(dislikesMatch[1])

  // Extract comments count - count comment sections or look for comment text
  let commentsMatch = html.match(/class="comment-section"/g)
  if (commentsMatch) {
    data.comments = commentsMatch.length
  } else {
    commentsMatch = html.match(/(\d+)\s*comments?/i)
    if (commentsMatch) data.comments = parseInt(commentsMatch[1])
  }

  // Extract upload date and convert to actual date
  const dateMatch = html.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?(?:,\s*(\d+)\s+(second|minute|hour|day|week|month|year)s?)?\s+ago/i)
  if (dateMatch) {
    const value1 = parseInt(dateMatch[1])
    const unit1 = dateMatch[2].toLowerCase()
    const value2 = dateMatch[3] ? parseInt(dateMatch[3]) : 0
    const unit2 = dateMatch[4] ? dateMatch[4].toLowerCase() : ''

    const now = new Date()
    let uploadDate = new Date(now)

    // Subtract time units
    const subtractTime = (val, unit) => {
      switch(unit) {
        case 'second': return val * 1000
        case 'minute': return val * 60 * 1000
        case 'hour': return val * 60 * 60 * 1000
        case 'day': return val * 24 * 60 * 60 * 1000
        case 'week': return val * 7 * 24 * 60 * 60 * 1000
        case 'month': return val * 30 * 24 * 60 * 60 * 1000
        case 'year': return val * 365 * 24 * 60 * 60 * 1000
        default: return 0
      }
    }

    uploadDate = new Date(now.getTime() - subtractTime(value1, unit1) - subtractTime(value2, unit2))

    // Check if it's today
    const isToday = uploadDate.toDateString() === now.toDateString()

    if (isToday) {
      const hours = uploadDate.getHours().toString().padStart(2, '0')
      const minutes = uploadDate.getMinutes().toString().padStart(2, '0')
      data.uploadDate = `${hours}:${minutes}`
    } else {
      const month = (uploadDate.getMonth() + 1).toString().padStart(2, '0')
      const day = uploadDate.getDate().toString().padStart(2, '0')
      const year = uploadDate.getFullYear()
      data.uploadDate = `${month}/${day}/${year}`
    }
  }

  // Extract banner URL
  const bannerMatch = html.match(/background-image:\s*url\((https:\/\/media\.glomble\.com\/profiles\/banners\/[^)]+)\)/)
  if (bannerMatch) {
    data.bannerUrl = bannerMatch[1]
  }

  return data
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Random Glomble Video Player</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #000;
      color: #fff;
      height: 100vh;
      position: relative;
      overflow: hidden;
    }

    .background-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
      z-index: -1;
    }

    .container {
      max-width: 100%;
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .loading {
      text-align: center;
      padding: 100px 20px;
      font-size: 24px;
    }

    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-top: 4px solid #fff;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .video-title {
      font-size: 24px;
      font-weight: bold;
      padding: 10px;
      text-align: center;
      color: #fff;
      background: #000;
      border: 2px solid #fff;
      border-top: none;
      margin: 0;
      flex-shrink: 0;
    }

    .video-container {
      background: #000;
      border: 2px solid #fff;
      border-top: none;
      overflow: hidden;
      margin: 0 10px 8px 10px;
      flex: 1;
      min-height: 0;
    }

    video {
      width: 100%;
      height: 100%;
      display: block;
      background: #000;
      object-fit: contain;
    }

    .metadata {
      display: flex;
      justify-content: space-evenly;
      align-items: center;
      padding: 0 10px 10px 10px;
      background: transparent;
      margin: 0;
      flex-shrink: 0;
      flex-wrap: wrap;
      gap: 8px;
      width: 100%;
    }

    .metadata-item {
      background: #000;
      padding: 6px 12px;
      text-align: center;
      border: 2px solid #fff;
      flex: 1 1 auto;
      min-width: 80px;
    }

    .metadata-label {
      font-size: 10px;
      color: #fff;
      text-transform: uppercase;
      margin-bottom: 3px;
    }

    .metadata-value {
      font-size: 16px;
      font-weight: bold;
      color: #fff;
    }

    .video-link {
      display: block;
      text-align: center;
      margin: 0 10px 8px 10px;
      padding: 8px;
      background: #000;
      border: 2px solid #fff;
      text-decoration: none;
      color: #fff;
      font-size: 11px;
      font-family: monospace;
      word-break: break-all;
      flex-shrink: 0;
    }

    .video-link:hover {
      background: #fff;
      color: #000;
    }

    .next-button {
      display: block;
      width: calc(100% - 20px);
      margin: 0 10px 8px 10px;
      padding: 10px;
      font-size: 16px;
      font-weight: bold;
      background: #000;
      color: #fff;
      border: 2px solid #fff;
      cursor: pointer;
      flex-shrink: 0;
    }

    .next-button:hover {
      background: #fff;
      color: #000;
    }

    .next-button:active {
      transform: scale(0.98);
    }

    .error {
      background: #000;
      border: 2px solid #fff;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="background-overlay" id="background"></div>

  <div class="container">
    <div id="content">
      <div class="loading">
        <div class="spinner"></div>
        <div>Loading random video...</div>
      </div>
    </div>
  </div>

  <script>
    let currentVideoElement = null;

    async function loadRandomVideo() {
      try {
        const response = await fetch('/api/random');
        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        displayVideo(data);
      } catch (error) {
        const content = document.getElementById('content');
        content.innerHTML = \`
          <div class="error">
            <h2>Error Loading Video</h2>
            <p>\${error.message}</p>
            <button class="next-button" onclick="loadRandomVideo()">Try Again</button>
          </div>
        \`;
      }
    }

    function displayVideo(data) {
      const content = document.getElementById('content');
      const background = document.getElementById('background');

      // Update background
      if (data.bannerUrl) {
        background.style.backgroundImage = \`url(\${data.bannerUrl})\`;
      } else if (data.thumbnailUrl) {
        background.style.backgroundImage = \`url(\${data.thumbnailUrl})\`;
      }

      // Create video player
      content.innerHTML = \`
        <h1 class="video-title">\${escapeHtml(data.title)}</h1>

        <div class="video-container">
          <video id="videoPlayer" controls autoplay>
            <source src="\${data.videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
        </div>

        <div class="metadata">
          <div class="metadata-item">
            <div class="metadata-label">Views</div>
            <div class="metadata-value">\${formatNumber(data.views)}</div>
          </div>
          <div class="metadata-item">
            <div class="metadata-label">Score</div>
            <div class="metadata-value">\${data.score.toFixed(1)}</div>
          </div>
          <div class="metadata-item">
            <div class="metadata-label">Likes</div>
            <div class="metadata-value">\${formatNumber(data.likes)}</div>
          </div>
          <div class="metadata-item">
            <div class="metadata-label">Dislikes</div>
            <div class="metadata-value">\${formatNumber(data.dislikes)}</div>
          </div>
          <div class="metadata-item">
            <div class="metadata-label">Comments</div>
            <div class="metadata-value">\${formatNumber(data.comments)}</div>
          </div>
          <div class="metadata-item">
            <div class="metadata-label">Uploaded</div>
            <div class="metadata-value" style="font-size: 12px;">\${data.uploadDate || 'Unknown'}</div>
          </div>
        </div>

        <a href="\${data.pageUrl}" target="_blank" class="video-link">
          \${data.pageUrl}
        </a>

        <button class="next-button" onclick="loadRandomVideo()">
          Get Another Random Video
        </button>
      \`;

      // Set up auto-play next video when current ends
      currentVideoElement = document.getElementById('videoPlayer');
      currentVideoElement.addEventListener('ended', () => {
        loadRandomVideo(); // Load immediately
      });
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatNumber(num) {
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
      } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
      }
      return num.toString();
    }

    // Load first video on page load
    loadRandomVideo();
  </script>
</body>
</html>`
}
