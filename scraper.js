// Glomble Video ID Scraper
// Scrapes all video IDs from every page and outputs to CSV

const proxyUrl = 'https://api.allorigins.win/raw?url=';
const baseUrl = 'https://glomble.com/';
const maxConcurrentPages = 10; // Number of pages to fetch in parallel

async function testPageHasVideos(pageNum, retryCount = 0) {
    const url = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`;

    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const response = await fetch(proxyUrl + encodeURIComponent(url), {
            signal: AbortSignal.timeout(20000)
        });

        if (!response.ok) {
            if (retryCount < 3) {
                console.log(`Testing page ${pageNum}: Got ${response.status}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return testPageHasVideos(pageNum, retryCount + 1);
            }
            return false;
        }

        const html = await response.text();
        return /\/videos\/([a-zA-Z0-9_-]+)/.test(html);
    } catch (error) {
        if (retryCount < 3) {
            console.log(`Testing page ${pageNum}: Error, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return testPageHasVideos(pageNum, retryCount + 1);
        }
        return false;
    }
}

async function fetchMaxPage() {
    try {
        console.log('Detecting max page number...');

        // Binary search approach to find the last valid page
        let low = 1;
        let high = 300; // Increased estimate
        let maxFound = 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            console.log(`Testing page ${mid}...`);

            const hasVideos = await testPageHasVideos(mid);

            if (hasVideos) {
                maxFound = mid;
                console.log(`Page ${mid} has videos, trying higher...`);
                low = mid + 1;
            } else {
                console.log(`Page ${mid} empty, trying lower...`);
                high = mid - 1;
            }
        }

        console.log(`Detected max page: ${maxFound}`);
        return maxFound;
    } catch (error) {
        console.error('Error detecting max page:', error.message);
        console.log('Using fallback max page: 250');
        return 250;
    }
}

async function fetchPageVideoIds(pageNumber, retryCount = 0) {
    const url = pageNumber === 1 ? baseUrl : `${baseUrl}?page=${pageNumber}`;

    // Add delay before each request (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        const response = await fetch(proxyUrl + encodeURIComponent(url), {
            signal: AbortSignal.timeout(20000)
        });

        if (!response.ok) {
            // If we get a 429 or other error, retry after 4 seconds
            console.log(`Page ${pageNumber}: Got HTTP ${response.status}, waiting 4s and retrying (attempt ${retryCount + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 4000));
            return fetchPageVideoIds(pageNumber, retryCount + 1);
        }

        const html = await response.text();
        const regex = /\/videos\/([a-zA-Z0-9_-]+)/g;
        const matches = [...html.matchAll(regex)];
        const videoIds = matches.map(m => m[1]);

        // Remove duplicates from this page
        const uniqueIds = [...new Set(videoIds)];

        const retryInfo = retryCount > 0 ? ` (after ${retryCount} retries)` : '';
        console.log(`Page ${pageNumber}: Found ${uniqueIds.length} unique video IDs${retryInfo}`);
        return uniqueIds;
    } catch (error) {
        // Retry on any error
        console.log(`Page ${pageNumber}: Error - ${error.message}, waiting 4s and retrying (attempt ${retryCount + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 4000));
        return fetchPageVideoIds(pageNumber, retryCount + 1);
    }
}

async function scrapeAllPages(maxPage) {
    const allVideoIds = new Set();

    // Process pages in batches for parallel fetching
    for (let i = 1; i <= maxPage; i += maxConcurrentPages) {
        const batch = [];
        const end = Math.min(i + maxConcurrentPages - 1, maxPage);

        console.log(`\nProcessing pages ${i} to ${end}...`);

        for (let page = i; page <= end; page++) {
            batch.push(fetchPageVideoIds(page));
        }

        const results = await Promise.all(batch);

        // Add all IDs to the set
        results.flat().forEach(id => allVideoIds.add(id));

        console.log(`Total unique video IDs so far: ${allVideoIds.size}`);

        // Delay between batches is now handled by individual request delays
    }

    return Array.from(allVideoIds);
}

function saveToCSV(videoIds, filename = 'glomble_videos.csv') {
    // Create CSV content with header
    let csv = 'video_id,video_url,media_url\n';

    videoIds.forEach(id => {
        const videoUrl = `https://glomble.com/videos/${id}`;
        const mediaUrl = `https://media.glomble.com/uploads/video_files/${id}.mp4`;
        csv += `${id},${videoUrl},${mediaUrl}\n`;
    });

    // Write to file using Bun's built-in file writing
    Bun.write(filename, csv);
    console.log(`\nSaved ${videoIds.length} video IDs to ${filename}`);
}

async function main() {
    console.log('Starting Glomble video scraper...\n');

    const startTime = Date.now();

    // Fetch max page
    const maxPage = await fetchMaxPage();
    console.log(`\nWill scrape ${maxPage} pages\n`);

    // Calculate expected videos (rough estimate: 40 videos per page)
    const expectedMin = maxPage * 35;
    const expectedMax = maxPage * 45;
    console.log(`Expected approximately ${expectedMin}-${expectedMax} videos\n`);

    // Scrape all pages
    const videoIds = await scrapeAllPages(maxPage);

    // Sort IDs for consistency
    videoIds.sort();

    // Save to CSV
    saveToCSV(videoIds);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const minutes = (duration / 60).toFixed(1);

    console.log(`\n${'='.repeat(50)}`);
    console.log(`SCRAPE COMPLETE`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Pages scraped: ${maxPage}`);
    console.log(`Total unique videos: ${videoIds.length}`);
    console.log(`Expected range: ${expectedMin}-${expectedMax}`);
    console.log(`Time taken: ${minutes} minutes (${duration} seconds)`);
    console.log(`Average: ${(videoIds.length / maxPage).toFixed(1)} videos per page`);

    if (videoIds.length < expectedMin) {
        console.log(`\n⚠️  WARNING: Found fewer videos than expected!`);
        console.log(`This might indicate some pages failed to scrape properly.`);
    } else {
        console.log(`\n✓ Video count looks good!`);
    }
    console.log(`${'='.repeat(50)}\n`);
}

// Run the scraper
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
