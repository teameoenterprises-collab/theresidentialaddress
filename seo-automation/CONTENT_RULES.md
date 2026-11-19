# Content rules (the daily run must follow these)

**Format (what AI assistants cite)**
- Open with a 2-4 sentence direct answer in `<p class="answer"><strong>Short answer:</strong> ...</p>`.
- One question per page, answered fully. `<h2>` sections, short lists, concrete numbers, dates and fees.
- 3-5 FAQs in the spec's `faqs` (these become FAQPage schema). 600-1,200 words.
- Link to 2-4 related existing pages and, where relevant, one service page (llc-formation, itin-application,
  bank-assistance). One short, factual mention of the service at the end. No hype.
- Plain English, no em dashes, no exclamation points.

**Accuracy**
- Every fee, deadline, processing time or rule must be checked against a current source during the run
  (IRS, FinCEN, state Secretary of State, the bank's own help pages first). If unsure, leave it out.
- Bank and fintech policies change: describe them generally and tell readers to check the bank's eligibility page.
- Tax and legal topics end with: "This article is general information, not tax or legal advice."

**Off-limits (validate.py also blocks these phrases)**
- Never say or imply an address helps someone "pass" KYC, bank verification or identity checks, or that a
  founder should give a bank an address they do not live at as their personal residential address.
- No "IRS Certified", guaranteed approval, unsourced statistics, or invented testimonials.
- Nothing implying deceptive use of multiple LLCs or misleading banks, processors or government agencies.
- Do not copy competitors' text. Do not name competitors negatively.

**Never touch:** index.html, style.css, script.js, about.html, privacy.html, refer.html, vercel.json,
assets/, portal/, residentalPortal/, supabase/, api/. Only create or update pages through build_page.py.
