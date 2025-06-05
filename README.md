# 📸✨ Web Crawler & Screenshot Sentinel ✨📸

Welcome to the **Web Crawler & Screenshot Sentinel**! 👋 Ever wished you could magically get a picture of *every single page* on a website, even those super-secret ones hiding behind a login? Well, your wish is granted! 🧞‍♂️

This nifty Node.js script uses the power of Puppeteer 🤖 to bravely navigate the wilds of the web (or at least, a specific website you point it to 😉), taking beautiful, full-page screenshots along the way.

---

## 🌟 Features 🌟

* **🕵️‍♀️ Comprehensive Crawling:** Starts from a root URL and diligently follows internal links to discover pages.
* **📸 High-Resolution Screenshots:** Captures full-page screenshots. Thanks to Sharp ✂️, they're also neatly resized!
* **🚶‍♂️ Smart Auto-Scroll:** Scrolls down pages like a pro to trigger lazy-loaded content and let animations play out before snapping a pic.
* **🚪 Login Capability:** Got pages behind a login wall? No problem! The script will politely ask for your username and password to gain access.
* **🧹 Page Prep:** Tries to automagically hide annoying sticky headers/footers and "skip to content" links for cleaner screenshots.
* **📊 Dual CSV Logs:** Keeps a meticulous record of all crawled pages, the links between them, and the paths to their corresponding screenshots. Separate logs for public and authenticated areas!
* **📁 Organized Output:** Saves screenshots and logs into separate `_public` and `_authenticated` directories. Tidy!

---

## 🛠️ Tech Stack 🛠️

* 🟢 **Node.js:** The JavaScript runtime environment.
* 🤖 **Puppeteer:** For headless Chrome/Chromium browser automation.
* ✂️ **Sharp:** For high-performance image processing (resizing screenshots).
* ⌨️ **Readline-sync:** For interactively (and synchronously) getting your login credentials.

---

## 🚀 Getting Started 🚀

1.  **Clone the Magic (if it's in a repo):**
    ```bash
    # If you have this in a Git repository, clone it!
    # git clone [https://your-repo-url-here.com/project.git](https://your-repo-url-here.com/project.git)
    # cd project
    ```
    If it's just the `adv_crawler.js` file, make sure it's in a dedicated project folder!

2.  **Install Dependencies:** Open your terminal in the project folder and run:
    ```bash
    npm install puppeteer sharp readline-sync
    ```
    This will download all the necessary magic spells (packages). ✨

---

## ⚙️ Configuration ⚙️

Before you unleash the crawler, you'll need to tell it a few things. Open up `adv_crawler.js` in your favorite code editor:

* **`rootUrl`**:
    ```javascript
    const rootUrl = '[https://example.com](https://example.com)'; // 🏁 Change this to your target website!
    ```
    Make sure this URL *doesn't* have a trailing slash!

* **Login Details (Crucial! 🔑):**
    If your target site has a login, these constants are your keys to the kingdom:
    ```javascript
    const loginUrl = '[https://example.com/login](https://example.com/login)'; // 🚪 The exact login page URL
    const USERNAME_SELECTOR = 'input#username';     // 👤 CSS selector for the username field
    const PASSWORD_SELECTOR = 'input#password';     // 🤫 CSS selector for the password field
    const LOGIN_BUTTON_SELECTOR = 'button[type="submit"]'; // 👉 CSS selector for the login button
    const LOGIN_SUCCESS_SELECTOR = '.dashboard-welcome'; // ✅ CSS selector for an element that ONLY appears after a successful login
    ```
    **How to find CSS Selectors?**
    1.  Go to the login page in your browser.
    2.  Right-click on the username field (or password field, or login button).
    3.  Select "Inspect" or "Inspect Element."
    4.  The browser's developer tools will open, highlighting the HTML for that element.
    5.  Find a unique ID (like `id="username"`) or a combination of classes that uniquely identifies the element. IDs are best (`#your-id`). For classes, you can use `.your-class.another-class`.
    6.  Test your selectors in the DevTools console using `document.querySelector('YOUR_SELECTOR_HERE')`. If it highlights the correct element, you're golden! 🌟

---

## ▶️ Running the Sentinel ▶️

Once configured, it's showtime!

1.  Open your terminal in the project directory.
2.  Run the script:
    ```bash
    node adv_crawler.js
    ```
3.  Watch the console! The crawler will log its progress.
4.  If it needs to log in, it will pause and ask for your **username** and **password** directly in the terminal. Type them in and press Enter. (Password input will be hidden for privacy).

---

## 🎁 What You Get (Output) 🎁

After the crawler has done its work, you'll find these goodies in your project folder:

* 📁 `screenshots_public/`: All screenshots from pages accessible *before* login.
* 📁 `screenshots_authenticated/`: Screenshots from pages accessible *after* successful login.
* 📜 `screenshot_log_public.csv`: A CSV file detailing all publicly crawled pages, their source links, and screenshot paths.
* 📜 `screenshot_log_authenticated.csv`: Same as above, but for pages crawled after login.
* 📁 `debug_screenshots/` (if login fails): Contains a `login_failure.png` if the script couldn't log in, to help you see what went wrong.

---

## 🤯 Troubleshooting & Notes 🤯

* **Stuck at login prompt?** If `Ctrl+C` doesn't stop the script when it's asking for your username/password, try **`Ctrl+\`** (Control + Backslash). This usually does the trick!
* **Login Failing?**
    * Double, triple-check those CSS selectors in `adv_crawler.js`! They are the most common culprits.
    * Make sure `LOGIN_SUCCESS_SELECTOR` points to something that *reliably and uniquely* appears *only* after a successful login.
    * Check the `debug_screenshots/login_failure.png` image.
* **CAPTCHAs / 2FA / MFA:** This script is smart, but not *that* smart. It cannot automagically solve CAPTCHAs or handle multi-factor authentication. You'll need to handle those situations manually or explore more advanced solutions if needed. 🤖❓
* **Performance:** Crawling large sites can take time and resources. Be patient! ⏳
* **Website Terms of Service:** Always be respectful and ensure your crawling activities comply with the website's terms of service. Don't overload servers! 🙏

---

## 🌱 Future Ideas 🌱

* Read credentials from environment variables or a `.env` file for better security.
* Move configuration (selectors, URLs) to a separate JSON config file.
* Add command-line arguments (e.g., to specify `rootUrl`, run headless/headful).
* More sophisticated error handling and retry mechanisms.
* Option to specify viewport sizes.

---

Happy Crawling! 🌐🎉