/* =========================================================================
   THE RESIDENTIAL ADDRESS — SITE SCRIPT
   Sticky header · mobile nav · smooth scroll · scroll reveal ·
   FAQ accordion · newsletter form · footer year
   ========================================================================= */

(function () {
  "use strict";

  var qs = function (sel, root) { return (root || document).querySelector(sel); };
  var qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var reduceMotion = function () {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  var debounce = function (fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      var ctx = this, args = arguments;
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  };

  var header = qs("#siteHeader");
  var announcementBar = qs("#announcementBar");
  var root = document.documentElement;

  /* -----------------------------------------------------------------------
     Scroll offset — keeps CSS `scroll-margin-top` in sync with the real
     header (+ announcement bar) height, so anchor links and native
     scroll-into-view land below the sticky header with no manual math.
     ----------------------------------------------------------------------- */
  function syncScrollOffset() {
    var barHeight = announcementBar && announcementBar.style.display !== "none" ? announcementBar.offsetHeight : 0;
    var headerHeight = header ? header.offsetHeight : 0;
    root.style.setProperty("--scroll-offset", headerHeight + barHeight + 16 + "px");
  }

  /* -----------------------------------------------------------------------
     Announcement bar
     ----------------------------------------------------------------------- */
  function initAnnouncementBar() {
    var closeBtn = qs("#announcementClose");
    if (!announcementBar || !closeBtn) return;
    closeBtn.addEventListener("click", function () {
      announcementBar.style.display = "none";
      syncScrollOffset();
    });
  }

  /* -----------------------------------------------------------------------
     Sticky header — rAF-throttled scroll listener
     ----------------------------------------------------------------------- */
  function initStickyHeader() {
    var progress = qs("#scrollProgress");
    if (!header && !progress) return;
    var ticking = false;
    function update() {
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
      if (progress) {
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        var pct = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
        progress.style.width = Math.min(100, Math.max(0, pct)) + "%";
      }
      ticking = false;
    }
    update();
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener("resize", debounce(update, 150));
  }

  /* -----------------------------------------------------------------------
     Mobile navigation
     ----------------------------------------------------------------------- */
  function initMobileNav() {
    var toggle = qs("#navToggle");
    var panel = qs("#mobileNav");
    var iconMenu = qs("#navToggleIconMenu");
    var iconClose = qs("#navToggleIconClose");
    if (!toggle || !panel) return;

    function setOpen(open) {
      panel.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      iconMenu && iconMenu.classList.toggle("visually-hidden", open);
      iconClose && iconClose.classList.toggle("visually-hidden", !open);
      document.body.style.overflow = open ? "hidden" : "";
    }

    toggle.addEventListener("click", function () {
      setOpen(!panel.classList.contains("is-open"));
    });

    qsa("a", panel).forEach(function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    window.addEventListener("resize", debounce(function () {
      if (window.innerWidth >= 1024) setOpen(false);
    }, 150));
  }

  /* -----------------------------------------------------------------------
     Smooth scroll — relies on CSS `scroll-margin-top` (see syncScrollOffset)
     so this just needs to hand off to the native smooth scroller.
     ----------------------------------------------------------------------- */
  function initSmoothScroll() {
    document.addEventListener("click", function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute("href");
      var target = id && id !== "#" ? qs(id) : null;
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" });
      history.pushState(null, "", id);
    });
  }

  /* -----------------------------------------------------------------------
     Scroll reveal — fires each [data-reveal] element once via
     IntersectionObserver; [data-reveal-delay] sets the stagger (ms).
     ----------------------------------------------------------------------- */
  function initScrollReveal() {
    var els = qsa("[data-reveal]");
    if (!els.length) return;

    if (!("IntersectionObserver" in window) || reduceMotion()) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    els.forEach(function (el) {
      var delay = el.getAttribute("data-reveal-delay");
      if (delay) el.style.setProperty("--reveal-delay", delay + "ms");
    });

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    els.forEach(function (el) { observer.observe(el); });
  }

  /* -----------------------------------------------------------------------
     Count-up — animates [data-count-to] numbers once their container
     scrolls into view. Falls back to the static final value if reduced
     motion is on or IntersectionObserver is unavailable.
     ----------------------------------------------------------------------- */
  function initCountUp() {
    var els = qsa("[data-count-to]");
    if (!els.length) return;

    if (!("IntersectionObserver" in window) || reduceMotion()) return;

    function animate(el) {
      var end = parseFloat(el.getAttribute("data-count-to"));
      var suffix = el.getAttribute("data-count-suffix") || "";
      var duration = 1400;
      var start = null;

      function step(ts) {
        if (start === null) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * end) + suffix;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = end + suffix;
      }
      requestAnimationFrame(step);
    }

    els.forEach(function (el) { el.textContent = "0"; });

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    els.forEach(function (el) { observer.observe(el); });
  }

  /* -----------------------------------------------------------------------
     FAQ accordion — single-open. Refs are cached once per item at init
     instead of re-queried on every click.
     ----------------------------------------------------------------------- */
  function initFaqAccordion() {
    var items = qsa(".faq-item").map(function (item) {
      return {
        trigger: qs(".faq-item__trigger", item),
        chevron: qs(".faq-item__chevron", item),
        panel: qs(".faq-item__panel", item),
      };
    });
    if (!items.length) return;

    function setOpen(item, open) {
      item.trigger.setAttribute("aria-expanded", String(open));
      item.chevron.classList.toggle("is-open", open);
      item.panel.classList.toggle("is-open", open);
    }

    items.forEach(function (item) {
      item.trigger.addEventListener("click", function () {
        var willOpen = item.trigger.getAttribute("aria-expanded") !== "true";
        items.forEach(function (other) { if (other !== item) setOpen(other, false); });
        setOpen(item, willOpen);
      });
    });
  }

  /* -----------------------------------------------------------------------
     Newsletter form (footer) — client-side validation only.
     ----------------------------------------------------------------------- */
  function initNewsletterForm() {
    var form = qs("#newsletterForm");
    var feedback = qs("#newsletterFeedback");
    if (!form) return;

    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = qs("#newsletterEmail", form);
      var valid = emailPattern.test((input.value || "").trim());

      feedback.textContent = valid ? "Thanks — you're on the list." : "Enter a valid email address.";
      feedback.classList.toggle("form-feedback--success", valid);
      feedback.classList.toggle("form-feedback--error", !valid);

      if (valid) form.reset(); else input.focus();
    });
  }

  /* -----------------------------------------------------------------------
     Init
     ----------------------------------------------------------------------- */
  function init() {
    initAnnouncementBar();
    initStickyHeader();
    initMobileNav();
    initSmoothScroll();
    initScrollReveal();
    initCountUp();
    initFaqAccordion();
    initNewsletterForm();

    syncScrollOffset();
    window.addEventListener("resize", debounce(syncScrollOffset, 150));

    var yearEl = qs("#currentYear");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
