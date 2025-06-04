const puppeteer = require('puppeteer');
const fs = require('fs');

const screenshotsDir = './screenshots';
const logPath = './screenshot_log.csv';
const rootUrl = 'https://demo.vivavoce.live/';
const domain = new URL(rootUrl).hostname;

const visited = new Set();
const queue = [{ url: rootUrl, from: null, linkText: 'ROOT' }];

function sanitizeFilename(url) {
  return url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function autoScroll(page, url) {
  const isHomepage = url === rootUrl;
  const distance = 100;
  const delay = isHomepage ? 500 : 300;

  await page.evaluate(() => window.scrollTo(0, 0));

  let previousHeight = await page.evaluate('document.body.scrollHeight');
  while (true) {
    await page.evaluate(`window.scrollBy(0, ${distance})`);
    await new Promise(resolve => setTimeout(resolve, delay));

    const currentHeight = await page.evaluate('window.scrollY + window.innerHeight');
    const totalHeight = await page.evaluate('document.body.scrollHeight');

    if (currentHeight >= totalHeight) break;
    previousHeight = totalHeight;
  }

  // One last nudge
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(resolve => setTimeout(resolve, 2000)); // Extra settling time
}

async function run() {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  fs.writeFileSync(logPath, 'FROM,LINK TEXT,TO,SCREENSHOT FILE\n');

  const browser = await puppeteer.launch({
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2,
    }
  });

  const page = await browser.newPage();

  while (queue.length > 0) {
    const { url, from, linkText } = queue.shift();
    const normalizedUrl = url.split('#')[0].split('?')[0];

    if (visited.has(normalizedUrl) || !normalizedUrl.startsWith(rootUrl)) continue;
    visited.add(normalizedUrl);

    try {
      await page.goto(normalizedUrl, { waitUntil: 'networkidle2' });

      // Force-trigger IntersectionObserver
      await page.evaluate(() => {
        const OriginalObserver = window.IntersectionObserver;
        window.IntersectionObserver = class {
          constructor(callback) {
            this.callback = callback;
          }
          observe(element) {
            this.callback([{ isIntersecting: true, target: element }], this);
          }
          unobserve() {}
          disconnect() {}
        };
      });

      await autoScroll(page, normalizedUrl);

      // Final delay after scroll for animations, images, and transitions
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Clean up sticky navs and accessibility links
      await page.evaluate(() => {
        // Remove sticky or fixed elements
        const stickyEls = [...document.querySelectorAll('*')].filter(el => {
          const s = getComputedStyle(el);
          return s.position === 'fixed' || s.position === 'sticky';
        });
        stickyEls.forEach(el => {
          el.style.position = 'static';
          el.style.top = 'unset';
          el.style.bottom = 'unset';
        });

        // Remove accessibility "skip" links
        document.querySelectorAll('a, button').forEach(el => {
          const text = el.textContent?.toLowerCase();
          if (text?.includes('skip to main')) {
            el.style.display = 'none';
          }
        });

        // Force lazy images to render and disable fades
        const imgs = document.querySelectorAll('img');
        imgs.forEach(img => {
          if (img.loading === 'lazy') img.loading = 'eager';
        });

        document.querySelectorAll('*').forEach(el => {
          el.style.transitionDuration = '0s';
          el.style.opacity = '1';
        });
      });

      const safeName = sanitizeFilename(normalizedUrl);
      const screenshotPath = `${screenshotsDir}/${safeName}.png`;

      const maxWidth = 8192;
      const maxHeight = 4096;

      const fullScreenshot = await page.screenshot({ fullPage: true });

      const sharp = require('sharp');
      await sharp(fullScreenshot)
        .resize({ width: maxWidth, height: maxHeight, fit: 'inside' })
        .toFile(screenshotPath);

      console.log(`✅ Screenshot saved for ${normalizedUrl}`);

      fs.appendFileSync(
        logPath,
        `"${from || ''}","${linkText}","${normalizedUrl}","${screenshotPath}"\n`
      );

      const links = await page.$$eval('a[href]', anchors =>
        anchors.map(a => ({
          href: a.href,
          text: a.innerText.trim().slice(0, 100)
        }))
      );

      for (const { href, text } of links) {
        try {
          const linkUrl = new URL(href);
          if (linkUrl.hostname === domain) {
            queue.push({ url: linkUrl.href, from: normalizedUrl, linkText: text || '(no text)' });
          }
        } catch {}
      }

    } catch (err) {
      console.log(`❌ Failed to capture ${normalizedUrl}: ${err.message}`);
    }
  }

  await browser.close();
}

run();
