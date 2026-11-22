/* Shared header behaviour: sticky shadow, Services menu, mobile menu, current page. */
(function () {
  "use strict";
  function init() {
    var hdr = document.getElementById("traHeader");
    if (!hdr) return;

    var onScroll = function () { hdr.classList.toggle("is-scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Services dropdown (click + keyboard; hover on desktop)
    [].forEach.call(hdr.querySelectorAll(".tra-dd"), function (dd) {
      var btn = dd.querySelector(".tra-dd__btn");
      var set = function (open) { dd.classList.toggle("is-open", open); btn.setAttribute("aria-expanded", String(open)); };
      var hoverable = window.matchMedia("(hover: hover)").matches, openedAt = 0;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        // on hover devices the menu is already open from mouseenter; a click right after keeps it open
        if (hoverable && Date.now() - openedAt < 600) return;
        set(!dd.classList.contains("is-open"));
      });
      if (window.matchMedia("(hover: hover)").matches) {
        dd.addEventListener("mouseenter", function () { if (!dd.classList.contains("is-open")) openedAt = Date.now(); set(true); });
        dd.addEventListener("mouseleave", function () { set(false); });
      }
      document.addEventListener("click", function (e) { if (!dd.contains(e.target)) set(false); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") { set(false); } });
    });

    // Mobile menu
    var burger = document.getElementById("traBurger");
    var panel = document.getElementById("traMobile");
    if (burger && panel) {
      var setM = function (open) {
        panel.classList.toggle("is-open", open);
        burger.setAttribute("aria-expanded", String(open));
        burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      };
      burger.addEventListener("click", function () { setM(!panel.classList.contains("is-open")); });
      [].forEach.call(panel.querySelectorAll("a"), function (a) { a.addEventListener("click", function () { setM(false); }); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") setM(false); });
    }

    // Mark the current page in the nav
    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    [].forEach.call(document.querySelectorAll(".tra-nav a, .tra-dd__item"), function (a) {
      var raw = a.getAttribute("href") || ""; if (raw.indexOf("#") !== -1) return;
      var href = raw.toLowerCase();
      if (href && href === here) a.setAttribute("aria-current", "page");
    });

    var y = document.getElementById("traYear");
    if (y) y.textContent = new Date().getFullYear();
  }
  /* ---------------- Topic-matched, informative call to action ---------------- */
  var WA = "https://wa.me/16474367072";
  var OFFERS = {
    address: {
      eyebrow: "US residential address",
      title: "A US residential address held under a signed lease",
      text: "For founders whose bank, payment processor or IRS paperwork needs a real US residential address rather than a mailbox service.",
      points: ["Residential unit address with a signed lease in your name", "Renter's insurance documentation", "Mail received, scanned and forwarded on request", "Not a PO box or a commercial mail receiving agency (CMRA)"],
      price: "$2,000", per: "/ year", meta: "Billed annually, no setup fee. Usually set up within 1 to 2 business days.",
      link: "us-address-for-banking.html", linkText: "How the address works for banking", wa: "Hi, I'd like a US residential address."
    },
    itin: {
      eyebrow: "ITIN application",
      title: "Get your ITIN without mailing your passport",
      text: "We prepare and review your Form W-7 and supporting documents, then file the application with the IRS for you.",
      points: ["Form W-7 prepared and reviewed for your situation", "Passport verified on a short video call, so it stays with you", "Application filed with the IRS and tracked until your ITIN arrives", "IRS processing usually takes 7 to 11 weeks"],
      price: "$700", per: "one-time", meta: "Covers preparation, review and filing.",
      link: "itin-application.html", linkText: "How the ITIN service works", wa: "Hi, I'd like help with my ITIN application."
    },
    llc: {
      eyebrow: "US LLC formation",
      title: "Form your US LLC with the paperwork banks ask for",
      text: "Wyoming or Delaware LLC formation for non-US founders, with the documents you need to apply for a US bank account.",
      points: ["Wyoming state filing fee and first-year registered agent", "Operating agreement and banking resolution", "EIN application with the IRS (no SSN needed)", "Wyoming filings usually done within 1 business day"],
      price: "$399", per: "one-time", meta: "Wyoming. Delaware quoted separately because of state fees.",
      link: "llc-formation.html", linkText: "See LLC formation details", wa: "Hi, I'd like to form a US LLC."
    },
    bank: {
      eyebrow: "US bank account help",
      title: "Prepare your US business bank application properly",
      text: "Most rejections come from mismatched documents or a flagged address. We review everything before you apply.",
      points: ["Review of your formation documents, EIN letter and passport", "Address and document consistency check before you submit", "Guidance on which banks and fintechs fit your situation", "Support until your account is open"],
      price: "$499", per: "one-time", meta: "Pairs with a US residential address if you need one.",
      link: "bank-assistance.html", linkText: "How bank assistance works", wa: "Hi, I'd like help opening a US business bank account."
    }
  };
  function pickOffer() {
    var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var by = { "itin-application.html": "itin", "llc-formation.html": "llc", "bank-assistance.html": "bank", "us-address-service.html": "address" };
    if (by[page]) return by[page];
    var rules = [["itin", /itin|w-7|w7/], ["address", /cmra|mailbox|po-box|virtual|address|mail/], ["bank", /bank|stripe|mercury|payment|paypal|wise/],
                 ["llc", /llc|ein|5472|boi|state|wyoming|delaware|founders|formation|registered-agent/]];
    for (var i = 0; i < rules.length; i++) if (rules[i][1].test(page)) return rules[i][0];
    var t = document.title.toLowerCase();
    for (var j = 0; j < rules.length; j++) if (rules[j][1].test(t)) return rules[j][0];
    return "address";
  }
  function ctaCard(key) {
    var o = OFFERS[key];
    var wa = WA + "?text=" + encodeURIComponent(o.wa);
    var el = document.createElement("aside");
    el.className = "tra-cta";
    el.setAttribute("aria-label", o.eyebrow);
    el.innerHTML =
      '<div><p class="tra-cta__eyebrow">' + o.eyebrow + "</p><h3>" + o.title + "</h3><p>" + o.text + "</p><ul>" +
      o.points.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul></div>" +
      '<div class="tra-cta__side">' +
      ('<div class="tra-cta__price">' + o.price + " <small>" + o.per + "</small></div>") +
      '<p class="tra-cta__meta">' + o.meta + "</p>" +
      '<a class="tra-btn tra-btn--gold" href="' + wa + '" target="_blank" rel="noopener">Chat on WhatsApp</a>' +
      '<a class="tra-btn tra-btn--onDark" href="' + o.link + '">' + o.linkText + "</a></div>";
    return el;
  }
  function placeCtas() {
    if (document.querySelector(".tra-cta")) return;
    var key = pickOffer();
    var art = document.querySelector(".blog-article");
    if (art) {
      var rel = art.querySelector("h2[data-related]");
      var faq = [].filter.call(art.querySelectorAll("h2"), function (h) { return /frequently asked/i.test(h.textContent); })[0];
      var anchor = rel || faq;
      if (anchor) art.insertBefore(ctaCard(key), anchor); else art.appendChild(ctaCard(key));
      return;
    }
    if (document.body.classList.contains("tra-service")) {
      var faqItem = document.querySelector(".faq-item");
      var sec = faqItem && faqItem.closest("section");
      var wrap = document.createElement("section");
      wrap.className = "section";
      wrap.innerHTML = '<div class="container" style="max-width:1000px"></div>';
      wrap.firstChild.appendChild(ctaCard(key));
      if (sec) sec.parentNode.insertBefore(wrap, sec);
    }
  }

  function boot() { init(); placeCtas(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
