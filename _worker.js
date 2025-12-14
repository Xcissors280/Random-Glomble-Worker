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

  while ((match = regex.exec(html)) !== null) {
    if (!videoIds.includes(match[1])) {
      videoIds.push(match[1])
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
    videoUrl: `https://media.glomble.com/uploads/videos/${videoId}.mp4`,
    thumbnailUrl: `https://media.glomble.com/uploads/thumbnails/${videoId}.png`,
    bannerUrl: '',
    pageUrl: `https://glomble.com/videos/${videoId}`
  }

  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/)
  if (titleMatch) {
    data.title = titleMatch[1].replace(' - Glomble', '').trim()
  }

  // Extract views
  const viewsMatch = html.match(/Views:\s*<\/strong>\s*(\d+)/i) ||
                     html.match(/(\d+)\s*views?/i)
  if (viewsMatch) {
    data.views = parseInt(viewsMatch[1])
  }

  // Extract score
  const scoreMatch = html.match(/Score:\s*<\/strong>\s*([\d.]+)/i) ||
                     html.match(/score["\s:]+?([\d.]+)/i)
  if (scoreMatch) {
    data.score = parseFloat(scoreMatch[1])
  }

  // Extract likes and dislikes
  const likesMatch = html.match(/(\d+)\s*like/i)
  const dislikesMatch = html.match(/(\d+)\s*dislike/i)
  if (likesMatch) data.likes = parseInt(likesMatch[1])
  if (dislikesMatch) data.dislikes = parseInt(dislikesMatch[1])

  // Extract comments count
  const commentsMatch = html.match(/(\d+)\s*comment/i) ||
                        html.match(/Comments:\s*<\/strong>\s*(\d+)/i)
  if (commentsMatch) {
    data.comments = parseInt(commentsMatch[1])
  }

  // Extract upload date
  const dateMatch = html.match(/(\d+\s+(?:second|minute|hour|day|week|month|year)s?,\s*\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)/i) ||
                    html.match(/(\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)/i)
  if (dateMatch) {
    data.uploadDate = dateMatch[1]
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
      background: #0a0a0a;
      color: #fff;
      min-height: 100vh;
      position: relative;
      overflow-x: hidden;
    }

    .background-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
      filter: blur(20px) brightness(0.3);
      z-index: -1;
      transition: background-image 0.5s ease;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
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
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 20px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      text-align: center;
    }

    .video-container {
      background: rgba(0,0,0,0.7);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      margin-bottom: 20px;
    }

    video {
      width: 100%;
      display: block;
      max-height: 70vh;
      background: #000;
    }

    .metadata {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      padding: 20px;
      background: rgba(0,0,0,0.6);
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .metadata-item {
      background: rgba(255,255,255,0.05);
      padding: 15px;
      border-radius: 6px;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .metadata-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 5px;
    }

    .metadata-value {
      font-size: 20px;
      font-weight: bold;
      color: #fff;
    }

    .video-link {
      display: block;
      text-align: center;
      margin-bottom: 20px;
      padding: 15px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      text-decoration: none;
      color: #4da6ff;
      font-size: 16px;
      transition: background 0.3s;
    }

    .video-link:hover {
      background: rgba(255,255,255,0.1);
    }

    .next-button {
      display: block;
      width: 100%;
      max-width: 400px;
      margin: 30px auto;
      padding: 20px;
      font-size: 20px;
      font-weight: bold;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }

    .next-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(102, 126, 234, 0.6);
    }

    .next-button:active {
      transform: translateY(0);
    }

    .error {
      background: rgba(255,0,0,0.2);
      border: 1px solid #ff0000;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin: 20px 0;
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
      const content = document.getElementById('content');
      content.innerHTML = '<div class="loading"><div class="spinner"></div><div>Loading random video...</div></div>';

      try {
        const response = await fetch('/api/random');
        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        displayVideo(data);
      } catch (error) {
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
            <div class="metadata-value" style="font-size: 14px;">\${data.uploadDate || 'Unknown'}</div>
          </div>
        </div>

        <a href="\${data.pageUrl}" target="_blank" class="video-link">
          🔗 Watch on Glomble.com
        </a>

        <button class="next-button" onclick="loadRandomVideo()">
          🎲 Get Another Random Video
        </button>
      \`;

      // Set up auto-play next video when current ends
      currentVideoElement = document.getElementById('videoPlayer');
      currentVideoElement.addEventListener('ended', () => {
        setTimeout(() => {
          loadRandomVideo();
        }, 1000); // Wait 1 second before loading next video
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
