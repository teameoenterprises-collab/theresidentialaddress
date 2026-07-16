// =========================================================
// Shared script — used by index.html and all /banking/*.html pages
// =========================================================

// =========================================================
// Shared script — used by index.html and all /banking/*.html pages
// Requires config.js to be loaded first (defines window.SITE_CONFIG)
// =========================================================

function applySiteConfig() {
  if (!window.SITE_CONFIG) return;
  var whatsappNumber = SITE_CONFIG.whatsappNumber || '[WHATSAPP_NUMBER]';

  var tokens = {
    '[COMPANY_NAME]': SITE_CONFIG.companyName,
    '[WHATSAPP_NUMBER]': whatsappNumber,
    '[WHATSAPP_LINK]': 'https://wa.me/' + whatsappNumber,
    '[EMAIL_ADDRESS]': SITE_CONFIG.email,
    '[COMPANY_ADDRESS]': SITE_CONFIG.address,
    '[LOGO_URL]': SITE_CONFIG.logoUrl,
    '[SERVICE_PRICE]': SITE_CONFIG.servicePrice,
    '[PRIVACY_POLICY_URL]': SITE_CONFIG.privacyUrl,
    '[TERMS_URL]': SITE_CONFIG.termsUrl,
    '[REFUND_POLICY_URL]': SITE_CONFIG.refundUrl,
    '[CANONICAL_URL]': SITE_CONFIG.canonicalBase
  };

  function replaceTokens(str) {
    Object.keys(tokens).forEach(function (key) {
      var val = tokens[key];
      if (val && str.indexOf(key) !== -1) {
        str = str.split(key).join(val);
      }
    });
    return str;
  }

  // <title>
  document.title = replaceTokens(document.title);

  // Attributes that commonly carry placeholder tokens
  document.querySelectorAll('meta[content], link[href], a[href], img[src]').forEach(function (el) {
    ['content', 'href', 'src'].forEach(function (attr) {
      if (el.hasAttribute(attr)) {
        var val = el.getAttribute(attr);
        var replaced = replaceTokens(val);
        if (replaced !== val) el.setAttribute(attr, replaced);
      }
    });
  });

  // JSON-LD structured data
  document.querySelectorAll('script[type="application/ld+json"]').forEach(function (el) {
    var replaced = replaceTokens(el.textContent);
    if (replaced !== el.textContent) el.textContent = replaced;
  });

  // Visible text nodes in the body
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  var node;
  while ((node = walker.nextNode())) {
    var replaced = replaceTokens(node.nodeValue);
    if (replaced !== node.nodeValue) node.nodeValue = replaced;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // Fill in shared company/contact/pricing info from config.js first
  applySiteConfig();

  // Footer year
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav toggle
  var navToggle = document.getElementById('nav-toggle');
  var navPanel = document.getElementById('nav-mobile-panel');
  if (navToggle && navPanel) {
    navToggle.addEventListener('click', function () {
      var isOpen = navPanel.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // Scroll-reveal animations
  (function () {
    var targets = document.querySelectorAll('.reveal, .reveal-stagger');
    if (!('IntersectionObserver' in window) || !targets.length) {
      targets.forEach(function (t) { t.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (t) { observer.observe(t); });
  })();

  // WhatsApp CTA click tracking — event: whatsapp_cta_click, dimension: location
  document.querySelectorAll('[data-wa]').forEach(function (el) {
    el.addEventListener('click', function () {
      var location = el.getAttribute('data-wa');
      var page = document.body.getAttribute('data-page') || 'unknown';
      if (window.gtag) {
        gtag('event', 'whatsapp_cta_click', { location: location, page: page });
      } else if (window.dataLayer) {
        window.dataLayer.push({ event: 'whatsapp_cta_click', location: location, page: page });
      } else {
        console.log('whatsapp_cta_click', { location: location, page: page });
      }
    });
  });
});
