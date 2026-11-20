/* Clean reading layout for articles and the blog index (see article.css).
   Pure progressive enhancement: if this script fails, pages still read fine. */
(function () {
  "use strict";

  function slug(t) {
    return t.toLowerCase().replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  /* ---------------- Article pages ---------------- */
  function article() {
    var body = document.querySelector(".blog-article");
    if (!body) return;
    var header = document.querySelector(".article-header");
    var titleEl = (header && header.querySelector("h1")) || document.querySelector("main h1");
    var title = titleEl ? titleEl.textContent.trim() : document.title;

    // Breadcrumb
    if (header) {
      var short = title.length > 70 ? title.slice(0, 67).trim() + "…" : title;
      header.insertBefore(el("nav", "rd-crumbs",
        '<a href="index.html">Home</a><span>/</span><a href="blog.html">Blog</a><span>/</span>' + esc(short)), header.firstChild);
    }

    // Meta row: category pill · updated date · read time
    var words = (body.textContent || "").trim().split(/\s+/).length;
    var mins = Math.max(2, Math.round(words / 230));
    var upd = body.querySelector(".article-updated");
    var updated = upd ? upd.textContent.replace(/^\s*Last updated\s*/i, "").trim() : "";
    if (upd) upd.remove();
    var metaEl = header && header.querySelector(".article-meta");
    if (metaEl && titleEl) {
      var cat = metaEl.textContent.replace(/^\s*Blog\s*[•·|-]\s*/i, "").trim();
      metaEl.innerHTML = (cat ? '<span class="rd-pill">' + esc(cat) + "</span>" : "") +
        (updated ? "<span>Updated " + esc(updated) + "</span>" : "") +
        "<span>" + mins + " min read</span>";
      titleEl.insertAdjacentElement("afterend", metaEl);
    }

    // Headings for the table of contents
    var heads = [].slice.call(body.querySelectorAll("h2, h3")).filter(function (h) {
      return !h.hasAttribute("data-related") && h.textContent.trim();
    });
    var h2s = heads.filter(function (h) { return h.tagName === "H2"; });
    var useSubs = heads.length <= 28;
    var items = useSubs ? heads : h2s;
    var seen = {};
    items.forEach(function (h) {
      if (!h.id) {
        var id = slug(h.textContent) || "section";
        while (seen[id] || document.getElementById(id)) id += "-2";
        h.id = id;
      }
      seen[h.id] = 1;
    });

    // Layout wrapper
    var layout = el("div", "rd-layout");
    body.parentNode.insertBefore(layout, body);
    layout.appendChild(body);

    if (h2s.length >= 3) {
      var list = items.map(function (h) {
        return '<li class="' + (h.tagName === "H3" ? "is-sub" : "") + '"><a href="#' + h.id + '">' + esc(h.textContent.trim()) + "</a></li>";
      }).join("");
      var aside = el("aside", "rd-toc", '<div class="rd-toc__title">On this page</div><ol>' + list + "</ol>");
      aside.setAttribute("aria-label", "On this page");
      layout.appendChild(aside);

      var mob = el("details", "rd-toc-mobile",
        "<summary>On this page</summary><ol>" + h2s.map(function (h) {
          return '<li><a href="#' + h.id + '">' + esc(h.textContent.trim()) + "</a></li>";
        }).join("") + "</ol>");
      var first = body.querySelector(".answer");
      if (first && first.nextSibling) body.insertBefore(mob, first.nextSibling); else body.insertBefore(mob, body.firstChild);

      // Highlight the section being read
      var links = {};
      [].forEach.call(aside.querySelectorAll("a"), function (a) { links[a.getAttribute("href").slice(1)] = a; });
      if ("IntersectionObserver" in window) {
        var current = null;
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              if (current) current.classList.remove("is-active");
              current = links[e.target.id];
              if (current) current.classList.add("is-active");
            }
          });
        }, { rootMargin: "-90px 0px -70% 0px" });
        items.forEach(function (h) { io.observe(h); });
      }
    }

    // Closing call to action (before "Related guides" when present)
    var cta = el("div", "rd-cta",
      "<p><strong>Setting up the US side of your business?</strong> Ask us about a US residential address under a signed lease, LLC formation or your ITIN application.</p>" +
      '<a href="https://wa.me/16474367072">Chat on WhatsApp</a>');
    var rel = body.querySelector("h2[data-related]");
    if (rel) body.insertBefore(cta, rel); else body.appendChild(cta);
  }

  /* ---------------- Blog index ---------------- */
  function blogIndex() {
    var grid = document.querySelector(".blog-grid");
    if (!grid || document.querySelector(".blog-article")) return;
    var cards = [].slice.call(grid.querySelectorAll(".blog-card"));
    if (!cards.length) return;
    cards[0].classList.add("is-featured");

    var cats = [];
    cards.forEach(function (c) {
      var k = c.querySelector(".blog-category");
      var name = k ? k.textContent.trim() : "";
      c.setAttribute("data-cat", name);
      if (name && cats.indexOf(name) < 0) cats.push(name);
    });

    var search = el("input", "rd-search");
    search.type = "search";
    search.placeholder = "Search " + cards.length + " guides…";
    search.setAttribute("aria-label", "Search guides");
    var bar = el("div", "rd-filters");
    ["All"].concat(cats).forEach(function (c, i) {
      var b = el("button", i ? "" : "is-active", esc(c));
      b.type = "button";
      b.setAttribute("data-cat", i ? c : "");
      bar.appendChild(b);
    });
    grid.parentNode.insertBefore(search, grid);
    grid.parentNode.insertBefore(bar, grid);

    var active = "";
    function apply() {
      var q = search.value.trim().toLowerCase();
      cards.forEach(function (c) {
        var okCat = !active || c.getAttribute("data-cat") === active;
        var okQ = !q || c.textContent.toLowerCase().indexOf(q) >= 0;
        c.hidden = !(okCat && okQ);
      });
      cards[0].classList.toggle("is-featured", !active && !q);
    }
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      [].forEach.call(bar.children, function (x) { x.classList.remove("is-active"); });
      b.classList.add("is-active");
      active = b.getAttribute("data-cat");
      apply();
    });
    search.addEventListener("input", apply);
  }

  function init() { article(); blogIndex(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
