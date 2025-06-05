const puppeteer = require('puppeteer');
const fs = require('fs');
const readlineSync = require('readline-sync'); // For prompting user
const sharp = require('sharp');

const rootUrl = 'https://demo.vivavoce.live'; // FIX: Removed trailing slash
const domain = new URL(rootUrl).hostname;

// --- Configuration for Login ---
const loginUrl = 'https://demo.vivavoce.live/customer/login';
const USERNAME_SELECTOR = 'input#email';
const PASSWORD_SELECTOR = 'input#password';
const LOGIN_BUTTON_SELECTOR = 'button[type="submit"]';
const LOGIN_SUCCESS_SELECTOR = 'img[alt="Profile Image"]';


function sanitizeFilename(url) {
  let name = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  name = name.replace(/[^a-z0-9_.\-]/gi, '_').toLowerCase();
  return name.slice(0, 100);
}

async function autoScroll(page, currentUrl) {
  const isHomepage = currentUrl === rootUrl; // This comparison will now be correct
  const distance = 100;
  const delay = isHomepage ? 500 : 300;

  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(resolve => setTimeout(resolve, 500));

  let previousHeight = 0;
  let consecutiveStops = 0;

  while (true) {
    await page.evaluate((d) => window.scrollBy(0, d), distance);
    await new Promise(resolve => setTimeout(resolve, delay));

    const currentScrollY = await page.evaluate('window.scrollY');
    const currentHeight = await page.evaluate('window.scrollY + window.innerHeight');
    const totalHeight = await page.evaluate('document.body.scrollHeight');

    if (currentHeight >= totalHeight || currentScrollY === previousHeight) {
        if (currentScrollY === previousHeight) {
            consecutiveStops++;
        } else {
            consecutiveStops = 0;
        }
        if (consecutiveStops > 3 || currentHeight >= totalHeight) {
            break;
        }
    }
    previousHeight = currentScrollY;
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function takeScreenshotAndDiscoverLinks(page, url, from, linkText, screenshotsDir, logPath, isRootCall = false) {
  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.evaluate(() => {
      if (typeof window.IntersectionObserver === 'function') {
        const OriginalObserver = window.IntersectionObserver;
        window.IntersectionObserver = class {
          constructor(callback) { this.callback = callback; }
          observe(element) { this.callback([{ isIntersecting: true, target: element }], this); }
          unobserve() {}
          disconnect() {}
        };
      }
    });

    await autoScroll(page, url);
    await new Promise(resolve => setTimeout(resolve, 2500));

    await page.evaluate(() => {
      const stickyEls = [...document.querySelectorAll('*')].filter(el => {
        const s = getComputedStyle(el);
        return s.position === 'fixed' || s.position === 'sticky';
      });
      stickyEls.forEach(el => {
        el.style.position = 'static';
      });
      document.querySelectorAll('a, button').forEach(el => {
        const text = el.textContent?.toLowerCase();
        if (text?.includes('skip to main') || text?.includes('skip to content')) {
          el.style.display = 'none';
        }
      });
      const imgs = document.querySelectorAll('img');
      imgs.forEach(img => {
        if (img.loading === 'lazy') img.loading = 'eager';
      });
      document.querySelectorAll('*').forEach(el => {
        el.style.transitionDuration = '0s';
        el.style.animationDuration = '0s';
        el.style.opacity = '1';
      });
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    const safeName = sanitizeFilename(url);
    const screenshotPath = `${screenshotsDir}/${safeName}.png`;
    const maxWidth = 8192;
    const maxHeight = 4096;
    const fullScreenshotBuffer = await page.screenshot({ fullPage: true });

    await sharp(fullScreenshotBuffer)
      .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true })
      .toFile(screenshotPath);

    console.log(`✅ Screenshot saved for ${url} to ${screenshotPath}`);
    fs.appendFileSync(
      logPath,
      `"${from || (isRootCall ? 'ROOT' : '')}","${linkText || (isRootCall ? 'ROOT' : '')}","${url}","${screenshotPath}"\n`
    );

    return await page.$$eval('a[href]', anchors =>
      anchors.map(a => ({
        href: a.href,
        text: a.innerText.trim().replace(/\s+/g, ' ').slice(0, 100)
      }))
    );

  } catch (err) {
    console.log(`❌ Failed to capture or process ${url}: ${err.message}`);
    fs.appendFileSync(logPath, `"${from || (isRootCall ? 'ROOT' : '')}","${linkText || (isRootCall ? 'ROOT' : '')}","${url}","ERROR: ${err.message}"\n`);
    return [];
  }
}

async function crawlSite(page, startCrawlUrl, screenshotsDir, logPath, crawlDomain, initialRootUrl) {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  fs.writeFileSync(logPath, 'FROM,LINK TEXT,TO,SCREENSHOT FILE\n');

  const visited = new Set();
  const queue = [{ url: startCrawlUrl, from: null, linkText: 'INITIAL_VISIT' }];
  let isFirstInQueue = true;

  while (queue.length > 0) {
    const { url, from, linkText } = queue.shift();
    const normalizedUrl = url.split('#')[0].split('?')[0].replace(/\/$/, '');

    if (visited.has(normalizedUrl)) continue;

    // This condition should now work correctly for the root URL
    if (!normalizedUrl.startsWith(initialRootUrl)) {
        try {
            const currentUrlObj = new URL(normalizedUrl);
            if (currentUrlObj.hostname.includes(crawlDomain)) {
                 console.log(`Skipping ${normalizedUrl} as it's outside the initial root scope ('${initialRootUrl}') but on a related domain.`);
            } else {
                 console.log(`Skipping external link: ${normalizedUrl}`);
            }
        } catch (e) {
            console.log(`Skipping invalid or non-HTTP/S URL: ${normalizedUrl}`);
        }
        continue;
    }

    visited.add(normalizedUrl);
    const links = await takeScreenshotAndDiscoverLinks(page, normalizedUrl, from, linkText, screenshotsDir, logPath, isFirstInQueue);
    isFirstInQueue = false;

    for (const { href, text } of links) {
      try {
        const linkUrlObj = new URL(href); // Ensure href is a full URL before normalizing
        const normalizedLinkHref = linkUrlObj.href.split('#')[0].split('?')[0].replace(/\/$/, '');

        if (linkUrlObj.hostname === crawlDomain || linkUrlObj.hostname.endsWith('.' + crawlDomain)) {
          if (!visited.has(normalizedLinkHref)) {
            queue.push({ url: linkUrlObj.href, from: normalizedUrl, linkText: text || '(no text)' });
          }
        }
      } catch (e) {
        // console.log(`Invalid link found: ${href}`);
      }
    }
  }
}

async function loginToSite(page) {
  const username = readlineSync.question('Enter username: ');
  const password = readlineSync.question('Enter password: ', { hideEchoBack: true });

  try {
    console.log(`Navigating to login page: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    console.log('Entering credentials...');
    await page.waitForSelector(USERNAME_SELECTOR, { visible: true, timeout: 10000 });
    await page.type(USERNAME_SELECTOR, username);

    await page.waitForSelector(PASSWORD_SELECTOR, { visible: true, timeout: 5000 });
    await page.type(PASSWORD_SELECTOR, password);

    console.log('Submitting login form...');
    await page.click(LOGIN_BUTTON_SELECTOR);
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });

    await page.waitForSelector(LOGIN_SUCCESS_SELECTOR, { visible: true, timeout: 15000 });
    console.log('✅ Login successful!');
    return true;
  } catch (error) {
    console.error(`❌ Login failed: ${error.message}`);
    try {
        if (!fs.existsSync('./debug_screenshots')) fs.mkdirSync('./debug_screenshots');
        await page.screenshot({ path: './debug_screenshots/login_failure.png', fullPage: true });
        console.log('Screenshot of login failure saved to debug_screenshots/login_failure.png');
    } catch (ssError) {
        console.error(`Could not take failure screenshot: ${ssError.message}`);
    }
    return false;
  }
}

async function run() {
  const publicScreenshotsDir = './screenshots_public';
  const publicLogPath = './screenshot_log_public.csv';

  const authenticatedScreenshotsDir = './screenshots_authenticated';
  const authenticatedLogPath = './screenshot_log_authenticated.csv';

  const browser = await puppeteer.launch({
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    },
    headless: "new"
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36 MyCrawlerBot/1.0");

  console.log('\n--- Starting Public Crawl ---');
  await crawlSite(page, rootUrl, publicScreenshotsDir, publicLogPath, domain, rootUrl);
  console.log('--- Public Crawl Finished ---');

  console.log('\n--- Attempting Login ---');
  const loggedIn = await loginToSite(page);

  if (loggedIn) {
    const authenticatedStartUrl = rootUrl;
    console.log(`\n--- Starting Authenticated Crawl from ${authenticatedStartUrl} ---`);
    await crawlSite(page, authenticatedStartUrl, authenticatedScreenshotsDir, authenticatedLogPath, domain, rootUrl);
    console.log('--- Authenticated Crawl Finished ---');
  } else {
    console.log('Skipping authenticated crawl due to login failure.');
  }

  await browser.close();
  console.log('\nAll done!');
}

run();