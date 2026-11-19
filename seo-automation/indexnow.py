#!/usr/bin/env python3
"""Notify IndexNow (Bing, Copilot, ChatGPT search, Yandex, ...) about changed pages.
Usage: python3 seo-automation/indexnow.py [BASE_REF]      (default: HEAD~1)
       python3 seo-automation/indexnow.py --all           (every URL in sitemap.xml)
Sends the live URLs of .html/.txt/.xml files changed since BASE_REF. Run it AFTER the push,
once Vercel has deployed. Never fails the run: prints the result and exits 0.
"""
import glob, json, os, re, subprocess, sys, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
HOST = "www.theresidentialaddress.com"
keys = [f[:-4] for f in glob.glob("*.txt") if re.fullmatch(r"[0-9a-f]{32}", f[:-4])]
if not keys: print("IndexNow: no key file found, skipped"); sys.exit(0)
key = keys[0]
arg = sys.argv[1] if len(sys.argv) > 1 else "HEAD~1"
if arg == "--all":
    urls = re.findall(r"<loc>([^<]+)</loc>", open("sitemap.xml", encoding="utf-8").read())
else:
    out = subprocess.run(["git", "diff", "--name-only", "--diff-filter=AMR", arg, "HEAD", "--"],
                         capture_output=True, text=True).stdout.split()
    files = [f for f in out if "/" not in f and f.endswith((".html", ".xml")) or f == "llms.txt"]
    urls = [f"https://{HOST}/" + ("" if f == "index.html" else f) for f in files]
if not urls: print("IndexNow: nothing to submit"); sys.exit(0)
body = json.dumps({"host": HOST, "key": key, "keyLocation": f"https://{HOST}/{key}.txt", "urlList": urls[:10000]}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body,
                             headers={"Content-Type": "application/json; charset=utf-8"})
try:
    with urllib.request.urlopen(req, timeout=30) as r: print(f"IndexNow: HTTP {r.status} for {len(urls)} URLs")
except Exception as e:
    print(f"IndexNow: failed ({e}) for {len(urls)} URLs")
