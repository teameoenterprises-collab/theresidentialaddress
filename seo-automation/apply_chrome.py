#!/usr/bin/env python3
"""Apply the shared header, footer, site.css and site.js to every public page.
Idempotent: the blocks are wrapped in <!-- tra:header --> / <!-- tra:footer --> markers and
replaced on every run. Old headers/footers are removed. Run from anywhere:
    python3 seo-automation/apply_chrome.py
"""
import glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
WA = "https://wa.me/16474367072"
SKIP = {"refer.html"}
SERVICE_PAGES = {"llc-formation.html", "itin-application.html", "bank-assistance.html", "us-address-service.html"}  # standalone referral landing page (noindex)

PIN = ('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
       'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>'
       '<circle cx="12" cy="10" r="3"/></svg>')
CHEV = ('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '
        'aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>')
MENU = ('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        'aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>')
CHAT = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        'aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>')

SERVICES = [
    ("index.html#pricing", "US Residential Address", "$2,000/yr", "A residential address held under a signed lease, with mail handling"),
    ("llc-formation.html", "LLC Formation", "", "Wyoming or Delaware LLC for non-US founders"),
    ("itin-application.html", "ITIN Application", "$700", "Form W-7 preparation, review and filing"),
    ("bank-assistance.html", "Bank Account Assistance", "", "Help preparing US business bank applications"),
]

def header():
    items = "".join(
        f'<a class="tra-dd__item" href="{h}"><strong>{t}{f"<em>{p}</em>" if p else ""}</strong><span>{d}</span></a>'
        for h, t, p, d in SERVICES)
    mob = "".join(f'<a href="{h}">{t}<small>{d}</small></a>' for h, t, p, d in SERVICES)
    return f'''<!-- tra:header -->
<header class="tra-hdr" id="traHeader">
  <div class="tra-hdr__in">
    <a class="tra-brand" href="index.html" aria-label="The Residential Address home"><span class="tra-brand__mark">{PIN}</span><span class="tra-brand__name">The Residential Address</span></a>
    <nav class="tra-nav" aria-label="Primary">
      <div class="tra-dd"><button class="tra-nav__link tra-dd__btn" type="button" aria-expanded="false" aria-haspopup="true">Services {CHEV}</button>
        <div class="tra-dd__menu">{items}<a class="tra-dd__all" href="us-llc-guides-by-state-and-country.html">US LLC guides by state and country &rarr;</a></div>
      </div>
      <a class="tra-nav__link" href="blog.html">Guides</a>
      <a class="tra-nav__link" href="index.html#pricing">Pricing</a>
      <a class="tra-nav__link" href="faq.html">FAQ</a>
      <a class="tra-nav__link" href="about.html">About</a>
    </nav>
    <a class="tra-btn tra-btn--dark" href="{WA}" target="_blank" rel="noopener">{CHAT} Chat on WhatsApp</a>
    <button class="tra-burger" id="traBurger" type="button" aria-controls="traMobile" aria-expanded="false" aria-label="Open menu">{MENU}</button>
  </div>
  <div class="tra-mobile" id="traMobile">
    <div class="tra-mobile__label">Services</div>{mob}
    <div class="tra-mobile__label">Learn</div>
    <a href="blog.html">All guides</a><a href="us-llc-guides-by-state-and-country.html">Guides by state and country</a><a href="faq.html">FAQ</a><a href="index.html#pricing">Pricing</a><a href="about.html">About us</a>
    <a class="tra-btn tra-btn--dark" href="{WA}" target="_blank" rel="noopener">{CHAT} Chat on WhatsApp</a>
  </div>
</header>
<!-- /tra:header -->'''

def footer():
    return f'''<!-- tra:footer -->
<footer class="tra-ftr">
  <div class="tra-ftr__in">
    <div class="tra-ftr__grid">
      <div class="tra-ftr__brandcol">
        <a class="tra-brand" href="index.html"><span class="tra-brand__mark">{PIN}</span><span class="tra-brand__name">The Residential Address</span></a>
        <p class="tra-ftr__desc">The US side of your business, set up properly: a residential address under a signed lease, US LLC formation, ITIN applications and bank account guidance for founders in 40+ countries.</p>
        <a class="tra-btn tra-btn--gold" href="{WA}" target="_blank" rel="noopener">{CHAT} Chat on WhatsApp</a>
      </div>
      <div><h4>Services</h4><ul>
        <li><a href="index.html#pricing">US residential address</a></li>
        <li><a href="llc-formation.html">LLC formation</a></li>
        <li><a href="itin-application.html">ITIN application</a></li>
        <li><a href="bank-assistance.html">Bank account assistance</a></li>
      </ul></div>
      <div><h4>Popular guides</h4><ul>
        <li><a href="us-llc-guides-by-state-and-country.html">LLC guides by state and country</a></li>
        <li><a href="how-to-get-ein-without-ssn.html">EIN without an SSN</a></li>
        <li><a href="how-to-open-us-business-bank-account-non-resident.html">US bank account as a non-resident</a></li>
        <li><a href="form-5472-foreign-owned-llc.html">Form 5472 explained</a></li>
        <li><a href="what-is-a-cmra-address.html">What is a CMRA address</a></li>
      </ul></div>
      <div><h4>Company</h4><ul>
        <li><a href="about.html">About us</a></li>
        <li><a href="blog.html">All guides</a></li>
        <li><a href="faq.html">FAQ</a></li>
        <li><a href="index.html#pricing">Pricing</a></li>
        <li><a href="privacy.html">Privacy policy</a></li>
      </ul></div>
      <div><h4>Contact</h4><ul>
        <li><a href="mailto:support@theresidentialaddress.com">support@theresidentialaddress.com</a></li>
        <li><a href="{WA}" target="_blank" rel="noopener">WhatsApp +1 647 436 7072</a></li>
        <li>Signed residential lease</li>
        <li>Money-back guarantee</li>
      </ul></div>
    </div>
    <div class="tra-ftr__bottom">
      <span>&copy; <span id="traYear">2026</span> The Residential Address (Everest Ventures Group LLC). Registered in Florida, USA.</span>
      <span>General information only, not tax or legal advice.</span>
    </div>
  </div>
</footer>
<!-- /tra:footer -->'''


BASE = "https://www.theresidentialaddress.com/"
OG_IMAGE = BASE + "assets/og-image.png"
DESCS = {
    "llc-formation.html": "US LLC formation for non-US founders: a Wyoming LLC for $399 with state filing fee, first-year registered agent, operating agreement and EIN application.",
    "itin-application.html": "ITIN application service for non-residents: Form W-7 prepared, reviewed and filed with the IRS for $700, with passport verification by video call.",
    "bank-assistance.html": "US business bank account help for non-US founders: we review your LLC documents, EIN letter and passport before you apply. $499 one-time.",
    "us-address-service.html": "A US residential address held under a signed lease, with renter's insurance documents and mail scanning and forwarding, for non-US founders.",
}

def esc_attr(t):
    import html as _h
    return _h.escape(_h.unescape(t), quote=True)

def social(s, f):
    """Meta description (if missing) + Open Graph / Twitter tags built from the page's own title,
    description and canonical URL. Rebuilt on every run so it always matches the page."""
    s = re.sub(r"\s*<!-- tra:social -->.*?<!-- /tra:social -->", "", s, flags=re.S)
    if f in DESCS and not re.search(r'<meta\s+name="description"', s):
        s = s.replace("</title>", '</title>\n  <meta name="description" content="' + esc_attr(DESCS[f]) + '">', 1)
    t = re.search(r"<title>(.*?)</title>", s, re.S)
    d = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', s)
    c = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    if not t: return s
    title = esc_attr(re.sub(r"\s+", " ", t.group(1)).strip())
    desc = esc_attr(d.group(1)) if d else ""
    url = c.group(1) if c else BASE + ("" if f == "index.html" else f)
    kind = "website" if f in ("index.html", "blog.html", "about.html") else "article" if 'class="blog-article"' in s else "website"
    block = (f'\n  <!-- tra:social -->\n'
             f'  <meta property="og:type" content="{kind}">\n'
             f'  <meta property="og:site_name" content="The Residential Address">\n'
             f'  <meta property="og:title" content="{title}">\n'
             f'  <meta property="og:description" content="{desc}">\n'
             f'  <meta property="og:url" content="{url}">\n'
             f'  <meta property="og:image" content="{OG_IMAGE}">\n'
             f'  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">\n'
             f'  <meta name="twitter:card" content="summary_large_image">\n'
             f'  <meta name="twitter:title" content="{title}">\n'
             f'  <meta name="twitter:description" content="{desc}">\n'
             f'  <meta name="twitter:image" content="{OG_IMAGE}">\n'
             f'  <!-- /tra:social -->')
    # drop any older hand-written og/twitter tags so there is one set
    s = re.sub(r'\n\s*<meta (?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>', "", s)
    return s.replace("</head>", block + "\n</head>", 1)

HEAD_TAGS = '  <link rel="stylesheet" href="site.css">\n'
JS_TAG = '  <script src="site.js" defer></script>\n'

def apply(f):
    s = open(f, encoding="utf-8").read()
    o = s
    # 1. remove previous shared blocks, then old headers/footers
    s = re.sub(r"<!-- tra:header -->.*?<!-- /tra:header -->\s*", "", s, flags=re.S)
    s = re.sub(r"\n?<!-- tra:footer -->.*?<!-- /tra:footer -->", "", s, flags=re.S)
    s = re.sub(r'<header id="header">.*?</header>\n?', "", s, count=1, flags=re.S)
    s = re.sub(r'<header class="navbar" id="siteHeader">.*?</header>\n?', "", s, count=1, flags=re.S)
    s = re.sub(r'<footer class="site-footer">.*?</footer>\n?', "", s, count=1, flags=re.S)
    s = re.sub(r'<footer class="footer" id="contact">.*?</footer>\n?', "", s, count=1, flags=re.S)
    # old inline sticky-header script that referenced #header
    s = re.sub(r'<script>\s*var h=document\.getElementById\("header"\);.*?</script>\n?', "", s, count=1, flags=re.S)
    # 2. header right after <body ...> (after the announcement bar if present)
    mi = s.find("<main")
    if mi != -1:  # right before <main>, i.e. after any announcement bar / sprite / skip link
        s = s[:mi] + header() + "\n  " + s[mi:]
    else:
        s = re.sub(r"(<body[^>]*>\n?)", lambda mm: mm.group(1) + header() + "\n", s, count=1)
    # 3. footer before the first script after </main>, else before </body>
    i = s.find("</main>")
    j = s.find("</body>")
    if i != -1:
        k = i + len("</main>")
        s = s[:k] + "\n" + footer() + s[k:]
    else:
        s = s[:j] + footer() + "\n" + s[j:]
    # 4. stylesheet + script
    if 'href="site.css"' not in s:
        art = s.find('<link rel="stylesheet" href="article.css">')
        if art != -1:  # site.css must load before article.css
            s = s[:art] + '<link rel="stylesheet" href="site.css">\n  ' + s[art:]
        else:
            h = s.find("</head>")
            s = s[:h] + HEAD_TAGS + s[h:]
    if f in SERVICE_PAGES:
        s = re.sub(r'<body(?![^>]*tra-service)([^>]*)>', lambda mm: '<body class="tra-service"' + mm.group(1) + '>' if 'class=' not in mm.group(1) else mm.group(0), s, count=1)
        s = s.replace("const header = document.getElementById('header');",
                      "const header = document.getElementById('header') || document.createElement('div');")
    if 'src="site.js"' not in s:
        s = s.replace("</body>", JS_TAG + "</body>", 1)
    s = social(s, f)
    if s != o:
        open(f, "w", encoding="utf-8").write(s)
        return True
    return False

if __name__ == "__main__":
    pages = [f for f in sorted(glob.glob("*.html")) if f not in SKIP]
    changed = [f for f in pages if apply(f)]
    print(f"updated {len(changed)} of {len(pages)} pages")
