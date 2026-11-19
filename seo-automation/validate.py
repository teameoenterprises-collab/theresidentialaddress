#!/usr/bin/env python3
"""Safety checks before anything is published. Exit code 1 = do not publish.
Usage: python3 seo-automation/validate.py [BASE_REF]   (default: origin/main)
- Header, footer, <style>/<link rel=stylesheet>/<script src> of every changed page
  must be identical to before (new pages: identical to the article template).
- index.html, style.css, script.js and the portal must not change at all.
- JSON-LD must parse; internal links must resolve; banned claims must not appear.
"""
import re, sys, json, subprocess, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
BASE_REF = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
TEMPLATE = "wyoming-llc-address-requirements.html"
LOCKED = ["index.html", "style.css", "script.js", "vercel.json", "about.html", "privacy.html", "refer.html"]
LOCKED_DIRS = ["portal/", "residentalPortal/", "supabase/", "api/", "assets/"]
rules = json.load(open("seo-automation/rules.json", encoding="utf-8"))
errors = []

def git_show(path):
    r = subprocess.run(["git", "show", f"{BASE_REF}:{path}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None

def chrome(s):
    parts = []
    for pat in [r"<header\b.*?</header>", r"<footer\b.*?</footer>", r"<style\b.*?</style>",
                r'<link[^>]+rel="stylesheet"[^>]*>', r"<script\b[^>]*\bsrc=[^>]*>", r"<body[^>]*>"]:
        parts += re.findall(pat, s, flags=re.S)
    tail = s[s.find("</main>"):] if "</main>" in s else ""
    return parts + [tail]

changed = subprocess.run(["git", "diff", "--name-only", BASE_REF, "--"], capture_output=True, text=True).stdout.split()
changed += subprocess.run(["git", "ls-files", "--others", "--exclude-standard"], capture_output=True, text=True).stdout.split()
changed = sorted(set(changed))
renames = {}
for line in subprocess.run(["git", "diff", "-M", "--name-status", BASE_REF, "--"], capture_output=True, text=True).stdout.splitlines():
    bits = line.split("\t")
    if bits[0].startswith("R") and len(bits) == 3: renames[bits[2]] = bits[1]
def main_text(s):
    m = re.search(r"<main\b.*?</main>", s or "", re.S)
    return re.sub(r"<[^>]+>", " ", m.group(0)).lower() if m else ""
for f in changed:
    if f in LOCKED or any(f.startswith(d) for d in LOCKED_DIRS):
        errors.append(f"{f}: locked file changed")
tpl_chrome = chrome(open(TEMPLATE, encoding="utf-8").read())
for f in [c for c in changed if c.endswith(".html") and os.path.exists(c) and "/" not in c]:
    new = open(f, encoding="utf-8").read(); old = git_show(renames.get(f, f))
    ref = chrome(old) if old is not None else tpl_chrome
    if chrome(new) != ref:
        errors.append(f"{f}: header/footer/styles/scripts differ from the original design")
    for m in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', new, re.S):
        try: json.loads(m)
        except Exception as e: errors.append(f"{f}: invalid JSON-LD ({e})")
    text = main_text(new)
    old_text = main_text(old)
    for phrase in rules["banned_phrases"]:
        if phrase.lower() in text and phrase.lower() not in old_text:
            errors.append(f"{f}: banned phrase '{phrase}'")
    for href in re.findall(r'href="([a-z0-9\-]+\.html)(?:#[^"]*)?"', new):
        if not os.path.exists(href): errors.append(f"{f}: broken link {href}")
if errors:
    print("VALIDATION FAILED"); [print(" -", e) for e in errors]; sys.exit(1)
print(f"OK: {len(changed)} changed files passed")
