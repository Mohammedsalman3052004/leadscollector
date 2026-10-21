/*! Leadscollector tracker v1.0.0 - https://leadscollector (no cookies, no dependencies)
 *  Captures form submissions with honest confidence levels:
 *    attempted -> probable -> confirmed
 *  Privacy: only text-like fields are read; passwords, hidden inputs, files, tokens and card-like values are never sent.
 */
(function () {
  'use strict';
  try {
    var script = document.currentScript || document.querySelector('script[data-site-id]');
    if (!script || window.__lcLoaded) return;
    var SITE = script.getAttribute('data-site-id');
    if (!SITE) return;
    window.__lcLoaded = true;

    var BASE = '';
    try { BASE = new URL(script.src).origin; } catch (e) { return; }
    var ENDPOINT = BASE + '/api/ingest';
    var CONFIG_URL = BASE + '/api/tracker-config?site=' + encodeURIComponent(SITE);

    var nativeFetch = window.fetch;
    var cfg = { excluded: [], successUrl: '', successSelector: '', consent: false, disabled: false };
    try {
      var cached = JSON.parse(sessionStorage.getItem('lc_cfg_' + SITE) || 'null');
      if (cached && Date.now() - cached.t < 600000) cfg = Object.assign(cfg, cached.v);
    } catch (e) {}

    // ---------------------------------------------------------------- helpers
    var SENSITIVE = /(pass(word|wd|phrase)?|pwd|card.?(num|number|no)?|ccnum|cc[-_ ]?(num|number|exp|csc|cvc)|cvv|cvc|csrf|xsrf|token|otp|one[-_ ]?time|ssn|social[-_ ]?security|aadhaa?r|pan[-_ ]?(no|number|card)|secret|api[-_ ]?key|nonce|captcha|honeypot|gotcha|iban|routing[-_ ]?number|account[-_ ]?number|_wp)/i;
    var SKIP_TYPES = { password: 1, hidden: 1, file: 1, submit: 1, button: 1, reset: 1, image: 1 };
    var BUILTIN_SUCCESS = ['.wpcf7-mail-sent-ok', '.wpcf7 form.sent', '.w-form-done', '.elementor-message-success', '.gform_confirmation_message', '.wpforms-confirmation-container', '.wpforms-confirmation-container-full', '.submitted-message'];
    var MAX_FIELDS = 60, MAX_VALUE = 5000;

    function uuid() {
      try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
      });
    }
    function hash(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }
    function luhn(d) { var s = 0, alt = false; for (var i = d.length - 1; i >= 0; i--) { var n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return s % 10 === 0; }
    function clean(v) {
      v = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, MAX_VALUE);
      return v.replace(/\b\d(?:[ -]?\d){12,18}\b/g, function (m) { var d = m.replace(/\D/g, ''); return d.length >= 13 && d.length <= 19 && luhn(d) ? '[redacted]' : m; });
    }
    function excluded(key) { var k = key.toLowerCase(); for (var i = 0; i < cfg.excluded.length; i++) if (String(cfg.excluded[i]).toLowerCase() === k) return true; return false; }
    function consented() {
      if (!cfg.consent) return true;
      try { return window.leadscollector.consented === true || localStorage.getItem('lc_consent') === '1'; } catch (e) { return false; }
    }
    function utm() {
      var out = {};
      try {
        var saved = JSON.parse(sessionStorage.getItem('lc_utm') || 'null');
        if (saved) out = saved;
        var q = new URLSearchParams(location.search);
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach(function (k) { if (q.get(k)) out[k] = q.get(k).slice(0, 200); });
        if (Object.keys(out).length) sessionStorage.setItem('lc_utm', JSON.stringify(out));
      } catch (e) {}
      return out;
    }
    function labelFor(el) {
      var key = el.name || el.id || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
      if (!key && el.id) { var l = document.querySelector('label[for="' + el.id + '"]'); if (l) key = l.textContent; }
      return String(key).trim().slice(0, 100);
    }

    function collect(form) {
      var fields = {}, count = 0, turnstile = '', hp = '';
      var els = form.elements;
      for (var i = 0; i < els.length && count < MAX_FIELDS; i++) {
        var el = els[i];
        if (!el.tagName) continue;
        var tag = el.tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') continue;
        var type = (el.type || '').toLowerCase();
        if (el.name === 'cf-turnstile-response') { turnstile = el.value || ''; continue; }
        if (SKIP_TYPES[type]) continue;
        if (el.closest && el.closest('[data-lc-ignore]')) continue;
        var key = labelFor(el);
        if (!key) continue;
        var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
        if (/^cc-|password/.test(ac)) continue;
        if (/honeypot|gotcha|_hp$|^hp_/i.test(key)) { if (el.value) hp = String(el.value).slice(0, 100); continue; }
        if (SENSITIVE.test(key) || SENSITIVE.test(el.id || '') || excluded(key)) continue;
        var val;
        if (type === 'checkbox') {
          if (!el.checked) continue;
          val = (el.value && el.value !== 'on') ? el.value : 'yes';
        } else if (type === 'radio') {
          if (!el.checked) continue; val = el.value;
        } else if (tag === 'select' && el.multiple) {
          val = []; for (var j = 0; j < el.options.length; j++) if (el.options[j].selected) val.push(clean(el.options[j].value));
        } else { val = el.value; }
        if (Array.isArray(val)) { if (!val.length) continue; }
        else { val = clean(val); if (!val) continue; }
        if (fields[key] !== undefined) {
          if (!Array.isArray(fields[key])) fields[key] = [fields[key]];
          fields[key] = fields[key].concat(val);
        } else { fields[key] = val; count++; }
      }
      return { fields: fields, turnstile: turnstile, hp: hp };
    }

    function formName(form) {
      var n = form.getAttribute('data-lc-name') || form.getAttribute('name') || form.id || form.getAttribute('aria-label');
      if (!n) { var h = form.closest('section,div') && form.closest('section,div').querySelector('h1,h2,h3'); if (h) n = h.textContent; }
      return String(n || 'Form').trim().slice(0, 100);
    }
    function fingerprint(form, fields) {
      return 'f' + hash((form.getAttribute('action') || '') + '|' + (form.id || '') + '|' + Object.keys(fields).sort().join(','));
    }

    function send(payload) {
      if (cfg.disabled) return;
      var body = JSON.stringify(payload);
      try {
        if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
      } catch (e) {}
      try { nativeFetch.call(window, ENDPOINT, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' }, credentials: 'omit' }); } catch (e) {}
    }

    // ------------------------------------------------------------ submissions
    var subs = [];
    function newSub(form, collected) {
      return {
        id: uuid(), t: Date.now(), form: form, fields: collected.fields, turnstile: collected.turnstile, hp: collected.hp,
        name: formName(form), fp: fingerprint(form, collected.fields), sent: {}, rank: 0
      };
    }
    var RANK = { attempted: 1, probable: 2, confirmed: 3 };
    function emit(sub, event, signal, promoteOnly) {
      if (!consented()) return;
      if ((RANK[event] || 0) <= sub.rank) return;
      sub.rank = RANK[event];
      var p = {
        site: SITE, event: event, signal: signal, submission_id: sub.id,
        form: { name: sub.name, fingerprint: sub.fp },
        page_url: location.href.slice(0, 2000), referrer: (document.referrer || '').slice(0, 2000), utm: utm()
      };
      if (promoteOnly) p.promote = true; else { p.fields = sub.fields; p.turnstile = sub.turnstile || undefined; p.hp = sub.hp || undefined; }
      send(p);
    }
    function activeSub(maxAge) {
      var now = Date.now();
      for (var i = subs.length - 1; i >= 0; i--) if (now - subs[i].t < (maxAge || 6000) && subs[i].rank < 3) return subs[i];
      return null;
    }
    function confirm(sub, signal) { if (sub) emit(sub, 'confirmed', signal); }

    // submit attempt (capture phase so we see it before page scripts stop propagation)
    document.addEventListener('submit', function (e) {
      try {
        var form = e.target;
        if (!form || form.tagName !== 'FORM') return;
        if (form.hasAttribute('data-lc-ignore') || (form.closest && form.closest('[data-lc-ignore]'))) return;
        var collected = collect(form);
        if (!Object.keys(collected.fields).length) return;
        var sub = newSub(form, collected);
        subs.push(sub); if (subs.length > 20) subs.shift();
        emit(sub, 'attempted', 'submit');
        watchSelectors(sub);
        setTimeout(function () {
          if (!e.defaultPrevented) { // native navigation: remember to promote on the next page
            try { sessionStorage.setItem('lc_pending_' + SITE, JSON.stringify({ id: sub.id, name: sub.name, fp: sub.fp, t: Date.now() })); } catch (x) {}
          }
        }, 0);
      } catch (err) {}
    }, true);

    // next page after a native (navigating) submit
    function resumePending() {
      try {
        var raw = sessionStorage.getItem('lc_pending_' + SITE); if (!raw) return;
        sessionStorage.removeItem('lc_pending_' + SITE);
        var p = JSON.parse(raw); if (!p || Date.now() - p.t > 45000) return;
        var sub = { id: p.id, name: p.name, fp: p.fp, fields: {}, sent: {}, rank: 1 };
        var ok = cfg.successUrl && matchUrl(cfg.successUrl);
        emit(sub, ok ? 'confirmed' : 'probable', ok ? 'url' : 'navigation', true);
      } catch (e) {}
    }
    function matchUrl(rule) {
      try { return location.href.indexOf(rule) !== -1 || new RegExp(rule).test(location.href); } catch (e) { return false; }
    }

    // ---------------------------------------------- network confirmation
    function bodyText(body) {
      try {
        if (typeof body === 'string') return body;
        if (typeof FormData !== 'undefined' && body instanceof FormData) { var s = ''; body.forEach(function (v) { if (typeof v === 'string') s += v + '\n'; }); return s; }
        if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body.toString();
      } catch (e) {}
      return '';
    }
    function matches(sub, url, body) {
      try {
        var action = new URL(sub.form.getAttribute('action') || location.href, location.href).href.split('#')[0];
        if (new URL(url, location.href).href.split('#')[0] === action) return true;
      } catch (e) {}
      var text = bodyText(body); if (!text) return false;
      var dec = text; try { dec = decodeURIComponent(text.replace(/\+/g, ' ')); } catch (e) {}
      var keys = Object.keys(sub.fields);
      for (var i = 0; i < keys.length; i++) {
        var v = sub.fields[keys[i]]; v = Array.isArray(v) ? v.join(' ') : String(v);
        if (v.length >= 3 && (text.indexOf(v) !== -1 || dec.indexOf(v) !== -1)) return true;
      }
      return false;
    }
    function looksFailed(json) {
      if (!json || typeof json !== 'object') return false;
      return json.success === false || json.ok === false || json.status === 'error' || json.status === 'fail' || json.status === 'failed' || json.status === 'validation_failed' || json.status === 'mail_failed' || (json.error && json.success !== true);
    }
    function ours(url) { return String(url).indexOf(BASE) === 0; }

    if (nativeFetch) {
      window.fetch = function (input, init) {
        var p = nativeFetch.apply(this, arguments);
        try {
          var sub = activeSub();
          if (sub) {
            var url = typeof input === 'string' ? input : (input && input.url) || String(input);
            var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
            if (method === 'POST' && !ours(url) && matches(sub, url, init && init.body)) {
              p.then(function (res) {
                if (!res || !res.ok) return;
                var ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
                if (ct.indexOf('json') !== -1) {
                  res.clone().json().then(function (j) { if (!looksFailed(j)) confirm(sub, 'network_2xx'); }, function () { confirm(sub, 'network_2xx'); });
                } else confirm(sub, 'network_2xx');
              }, function () {});
            }
          }
        } catch (e) {}
        return p;
      };
    }
    var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__lc = { m: String(m).toUpperCase(), u: u }; return xo.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function (body) {
      try {
        var sub = activeSub(), meta = this.__lc;
        if (sub && meta && meta.m === 'POST' && !ours(meta.u) && matches(sub, meta.u, body)) {
          this.addEventListener('load', function () {
            if (this.status < 200 || this.status > 299) return;
            var failed = false;
            try { if (looksFailed(JSON.parse(this.responseText))) failed = true; } catch (e) {}
            if (!failed) confirm(sub, 'network_2xx');
          });
        }
      } catch (e) {}
      return xs.apply(this, arguments);
    };

    // ------------------------------------------ visible success messages
    function visible(el) { return !!(el && (el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length))); }
    function visibleNodes(selectors) {
      var out = [];
      selectors.forEach(function (s) { try { document.querySelectorAll(s).forEach(function (n) { if (visible(n)) out.push(n); }); } catch (e) {} });
      return out;
    }
    function watchSelectors(sub) {
      var sels = BUILTIN_SUCCESS.slice(); if (cfg.successSelector) sels.unshift(cfg.successSelector);
      var baseline = visibleNodes(sels);
      var mo = new MutationObserver(function () {
        var now = visibleNodes(sels);
        for (var i = 0; i < now.length; i++) if (baseline.indexOf(now[i]) === -1) { confirm(sub, 'selector'); mo.disconnect(); return; }
      });
      mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
      setTimeout(function () { mo.disconnect(); }, 15000);
    }

    // ------------------------------------------------------ library adapters
    document.addEventListener('wpcf7mailsent', function () { confirm(activeSub(15000), 'adapter'); });
    window.addEventListener('leadscollector:success', function () { confirm(activeSub(30000), 'event'); });
    function bindJq() {
      var jq = window.jQuery; if (!jq || bindJq.done) return; bindJq.done = true;
      jq(document).on('submit_success gform_confirmation_loaded wpformsAjaxSubmitSuccess', function () { confirm(activeSub(15000), 'adapter'); });
    }
    window.addEventListener('message', function (e) {
      try {
        var d = e.data; if (!d || typeof d !== 'object') return;
        if (d.type === 'hsFormCallback' && d.eventName === 'onFormSubmitted') { // HubSpot embedded form
          var sub = activeSub(15000);
          if (!sub && d.data && d.data.submissionValues) {
            var f = {}; Object.keys(d.data.submissionValues).forEach(function (k) { if (!SENSITIVE.test(k) && !excluded(k)) { var v = clean(d.data.submissionValues[k]); if (v) f[k] = v; } });
            if (Object.keys(f).length) { sub = { id: uuid(), t: Date.now(), form: document.body, fields: f, name: 'HubSpot form ' + (d.id || ''), fp: 'hs' + hash(String(d.id || '')), sent: {}, rank: 0 }; subs.push(sub); }
          }
          confirm(sub, 'adapter');
        }
      } catch (err) {}
    });
    document.addEventListener('DOMContentLoaded', bindJq); window.addEventListener('load', bindJq);

    // ------------------------------------------------------------ public API
    window.leadscollector = {
      version: '1.0.0',
      consented: window.leadscollector && window.leadscollector.consented,
      consent: function (v) { try { v ? localStorage.setItem('lc_consent', '1') : localStorage.removeItem('lc_consent'); } catch (e) {} this.consented = !!v; },
      track: function (fields, opts) {
        try {
          opts = opts || {}; var f = {}, n = 0;
          Object.keys(fields || {}).forEach(function (k) {
            if (n >= MAX_FIELDS || SENSITIVE.test(k) || excluded(k)) return;
            var v = fields[k]; v = Array.isArray(v) ? v.map(clean) : clean(v);
            if (v && v.length !== 0) { f[String(k).slice(0, 100)] = v; n++; }
          });
          if (!Object.keys(f).length) return;
          var sub = { id: opts.id || uuid(), t: Date.now(), form: document.body, fields: f, name: String(opts.form || 'Custom form').slice(0, 100), fp: 'api' + hash(String(opts.form || 'custom')), sent: {}, rank: 0 };
          subs.push(sub);
          emit(sub, opts.status === 'attempted' ? 'attempted' : 'confirmed', 'api');
          return sub.id;
        } catch (e) {}
      }
    };

    // ---------------------------------------------------------------- config
    if (nativeFetch) {
      nativeFetch.call(window, CONFIG_URL, { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (c) {
        cfg = Object.assign(cfg, c || {});
        try { sessionStorage.setItem('lc_cfg_' + SITE, JSON.stringify({ t: Date.now(), v: c })); } catch (e) {}
      }).catch(function () {});
    }
    resumePending();
  } catch (err) { /* never break the host page */ }
})();
