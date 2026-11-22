# SEO / AI-search automation

A scheduled task runs daily. Each run:

1. **Checks visibility.** Runs a web search for every query in `keywords.json`, records whether
   theresidentialaddress.com appears (and where) and who ranks instead, appending to `visibility-log.csv`.
2. **Picks one gap.** A tracked query with no page that answers it, or one of our pages that is outdated.
3. **Researches and writes.** Checks current facts against primary or reputable sources, then writes a spec in
   `content/<slug>.json` following `CONTENT_RULES.md`.
4. **Builds.** `python3 seo-automation/build_page.py seo-automation/content/<slug>.json` builds the page from the
   existing article template (header, footer and styles are copied unchanged), and adds it to the blog index,
   sitemap and llms.txt.
   Then run `python3 seo-automation/apply_chrome.py` so the page gets the shared header, footer,
   topic-matched call to action and its own social preview tags (safe to run any time; it only rewrites marked blocks).
5. **Validates.** `python3 seo-automation/validate.py origin/main` blocks the publish if the header, footer,
   styles or scripts changed, if locked files (homepage, CSS, portal...) changed, if JSON-LD is invalid, if a link is
   broken, or if a banned claim appears.
6. **Publishes or holds.** If validation passes it commits to `main` (Vercel deploys it). If not, it opens a
   pull request for review instead.

7. **Notifies search engines.** After the push and deploy, `python3 seo-automation/indexnow.py HEAD~1` sends
   the changed URLs to IndexNow (Bing, which feeds ChatGPT search and Copilot, plus Yandex, Naver and Seznam).
   The key file is the 32-character `<key>.txt` in the site root; do not delete it.

Edit `keywords.json` to change what is tracked. Edit `rules.json` / `CONTENT_RULES.md` to change content limits.