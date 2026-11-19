#!/usr/bin/env python3
"""Build or update an article page from a JSON spec, using an existing article as the
template. Only the <title>, meta description, SEO block and the article body inside
<main> change. Header, footer, styles and scripts are copied byte-for-byte.

Usage: python3 seo-automation/build_page.py seo-automation/content/<slug>.json [...]
Spec keys: slug, title, h1, description, category, emoji, card_category, body_html,
           faqs [[q, a], ...], date (YYYY-MM-DD, optional), llms_summary (optional)
"""
import json, re, sys, html, datetime, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://www.theresidentialaddress.com"
TEMPLATE = "wyoming-llc-address-requirements.html"
ORG = {"@type": "Organization", "@id": BASE + "/#organization", "name": "The Residential Address"}

def p(*a): return os.path.join(ROOT, *a)
def esc(s): return html.escape(s, quote=True)

def seo_block(spec, url):
    graph = [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": BASE + "/blog.html"},
            {"@type": "ListItem", "position": 3, "name": spec["h1"], "item": url}]},
        {"@type": "BlogPosting", "headline": spec["h1"][:110], "description": spec["description"],
         "url": url, "mainEntityOfPage": url, "inLanguage": "en",
         "datePublished": spec["date"], "dateModified": spec["modified"],
         "author": ORG, "publisher": ORG}]
    if spec.get("faqs"):
        graph.append({"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in spec["faqs"]]})
    return (f'\n  <link rel="canonical" href="{url}" data-seo="tra" />\n'
            f'  <script type="application/ld+json" data-seo="tra">\n'
            f'{json.dumps({"@context": "https://schema.org", "@graph": graph}, indent=2, ensure_ascii=False)}\n  </script>\n')

def build(spec_path):
    spec = json.load(open(spec_path, encoding="utf-8"))
    today = datetime.date.today().isoformat()
    slug = spec["slug"]; fname = slug + ".html"; url = f"{BASE}/{fname}"
    existing = os.path.exists(p(fname))
    spec.setdefault("date", today); spec["modified"] = today
    if existing:  # keep original publish date
        m = re.search(r'"datePublished": "([\d-]+)"', open(p(fname), encoding="utf-8").read())
        if m: spec["date"] = m.group(1)
    tpl = open(p(TEMPLATE), encoding="utf-8").read()
    tpl = re.sub(r'\n\s*<link rel="canonical"[^>]*data-seo="tra"[^>]*/>\s*<script type="application/ld\+json" data-seo="tra">.*?</script>\n', "\n", tpl, flags=re.S)
    s = re.sub(r"<title>.*?</title>", f"<title>{esc(spec['title'])} | The Residential Address</title>", tpl, count=1, flags=re.S)
    s = re.sub(r'<meta name="description" content=".*?">', f'<meta name="description" content="{esc(spec["description"])}">', s, count=1, flags=re.S)
    s = s.replace("</head>", seo_block(spec, url) + "</head>", 1)
    faq_html = ""
    if spec.get("faqs"):
        faq_html = "\n  <h2>Frequently Asked Questions</h2>\n" + "".join(
            f"  <h3>{esc(q)}</h3>\n  <p>{esc(a)}</p>\n" for q, a in spec["faqs"])
    updated = datetime.date.fromisoformat(spec["modified"]).strftime("%B %Y")
    body = (f'<section class="container">\n<div class="article-header">\n'
            f'  <div class="article-meta">{esc(spec["category"])}</div>\n'
            f'  <h1 class="article-title">{esc(spec["h1"])}</h1>\n'
            f'  <div class="article-image">{spec.get("emoji", "")}</div>\n</div>\n'
            f'<div class="blog-article">\n  <p class="article-updated" style="font-size:.9rem;opacity:.75">Last updated {updated}</p>\n'
            f'{spec["body_html"].strip()}\n{faq_html}</div>\n</section>\n')
    s, n = re.subn(r"(<main>\n?).*?(</main>)", lambda m: m.group(1) + body + m.group(2), s, count=1, flags=re.S)
    assert n == 1, "template <main> not found"
    open(p(fname), "w", encoding="utf-8").write(s)
    if not existing:
        add_to_blog(spec, fname); add_to_sitemap(url, spec["date"]); add_to_llms(spec, url)
    else:
        bump_sitemap(url, today)
    print(("updated " if existing else "created ") + fname)

def add_to_blog(spec, fname):
    b = open(p("blog.html"), encoding="utf-8").read()
    if f'href="{fname}"' in b: return
    d = datetime.date.fromisoformat(spec["date"]).strftime("%b %-d, %Y")
    card = (f'<a class="blog-card fade-up" href="{fname}"><div class="blog-meta"><span class="blog-category">'
            f'{esc(spec.get("card_category", "US Business"))}</span><span class="blog-date">{d}</span></div>'
            f'<h3>{esc(spec["h1"])}</h3><p>{esc(spec["description"])}</p><div class="read-more">Read More <span>→</span></div></a>')
    b = b.replace('<div class="blog-grid">', '<div class="blog-grid">' + card, 1)
    open(p("blog.html"), "w", encoding="utf-8").write(b)

def add_to_sitemap(url, date):
    s = open(p("sitemap.xml"), encoding="utf-8").read()
    if f"<loc>{url}</loc>" in s: return
    s = s.replace("</urlset>", f"  <url><loc>{url}</loc><lastmod>{date}</lastmod></url>\n</urlset>")
    open(p("sitemap.xml"), "w", encoding="utf-8").write(s)

def bump_sitemap(url, date):
    s = open(p("sitemap.xml"), encoding="utf-8").read()
    s = re.sub(rf"(<loc>{re.escape(url)}</loc><lastmod>)[\d-]+", rf"\g<1>{date}", s)
    open(p("sitemap.xml"), "w", encoding="utf-8").write(s)

def add_to_llms(spec, url):
    s = open(p("llms.txt"), encoding="utf-8").read()
    if url in s: return
    line = f"- [{spec['h1']}]({url}): {spec.get('llms_summary', spec['description'])}\n"
    s = s.replace("## Key guides\n\n", "## Key guides\n\n" + line, 1)
    open(p("llms.txt"), "w", encoding="utf-8").write(s)

if __name__ == "__main__":
    for a in sys.argv[1:]: build(a)
