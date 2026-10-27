/* Alper Kocaman portfolio: language, navigation, lightbox, hero radar simulation */
(function () {
  "use strict";

  /* ---------- language ---------- */
  var root = document.documentElement;
  var STORE = "ak-lang";

  function getStored() {
    try { return localStorage.getItem(STORE); } catch (e) { return null; }
  }
  function store(v) {
    try { localStorage.setItem(STORE, v); } catch (e) { /* storage unavailable */ }
  }

  function setLang(lang) {
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    var t = document.querySelector('meta[name="title-' + lang + '"]');
    if (t) document.title = t.getAttribute("content");
    document.querySelectorAll(".lang-toggle button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.set === lang ? "true" : "false");
    });
    document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }

  var initial = getStored();
  if (initial !== "tr" && initial !== "en") initial = "tr";
  setLang(initial);

  document.querySelectorAll(".lang-toggle button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.set); store(b.dataset.set); });
  });

  /* ---------- mobile menu ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var nav = document.querySelector(".nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- table of contents highlight ---------- */
  var tocLinks = document.querySelectorAll(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          tocLinks.forEach(function (a) { a.classList.remove("active"); });
          var a = map[en.target.id];
          if (a) a.classList.add("active");
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    Object.keys(map).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) obs.observe(s);
    });
  }

  /* ---------- lightbox ---------- */
  var zooms = document.querySelectorAll("a.zoom");
  if (zooms.length) {
    var lb = document.createElement("div");
    lb.className = "lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.tabIndex = -1;
    var lbImg = document.createElement("img");
    lbImg.alt = "";
    lb.appendChild(lbImg);
    document.body.appendChild(lb);
    var lastFocus = null;
    function close() { lb.classList.remove("open"); lbImg.src = ""; if (lastFocus) lastFocus.focus(); }
    zooms.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        lastFocus = a;
        lbImg.src = a.getAttribute("href");
        var inner = a.querySelector("img");
        lbImg.alt = inner ? inner.alt : "";
        lb.classList.add("open");
        lb.focus();
      });
    });
    lb.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && lb.classList.contains("open")) close(); });
  }

  /* ---------- code: full-file viewers and highlighting ---------- */
  function highlight(el) { if (window.Prism) window.Prism.highlightElement(el); }
  document.querySelectorAll("details.code-full").forEach(function (d) {
    var loaded = false;
    d.addEventListener("toggle", function () {
      if (!d.open || loaded) return;
      loaded = true;
      var code = d.querySelector("pre code");
      var tr = root.getAttribute("data-lang") === "tr";
      code.textContent = tr ? "Yükleniyor..." : "Loading...";
      fetch(d.dataset.src).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      }).then(function (txt) {
        code.textContent = txt.replace(/\s+$/, "");
        highlight(code);
      }).catch(function () {
        loaded = false;
        code.textContent = tr ? "Dosya yüklenemedi. Üstteki indirme bağlantısını kullanın." : "Could not load the file. Use the download link above.";
      });
    });
  });
  window.addEventListener("load", function () {
    if (window.Prism) document.querySelectorAll(".code-block pre code").forEach(highlight);
  });

  /* =======================================================================
     Hero: simulated 24 GHz Doppler radar watching a breathing chest.
     x(t) chest displacement -> phase = 4*pi*x/lambda -> I/Q on the unit circle.
     The breathing rate shown is estimated from the simulated phase with a
     Hann-windowed DFT + parabolic interpolation, not copied from the slider.
     ======================================================================= */
  var scope = document.getElementById("scope");
  if (!scope) return;

  var cIQ = document.getElementById("cv-iq");
  var cPh = document.getElementById("cv-phase");
  var cSp = document.getElementById("cv-spec");
  var slider = document.getElementById("bpm");
  var out = document.getElementById("bpm-out");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var LAMBDA = 12.5;          // mm at 24 GHz
  var FS = 25;                // simulation sample rate, S/s
  var WIN = 20;               // seconds kept in the buffer
  var N = FS * WIN;
  var A_BR = 1.5;             // breathing displacement amplitude, mm
  var A_HR = 0.1;             // heartbeat displacement amplitude, mm
  var F_HR = 1.17;            // ~70 BPM
  var PHI0 = 0.7;

  var I = new Float32Array(N), Q = new Float32Array(N), P = new Float32Array(N);
  var head = 0, filled = 0;
  var thetaBr = 0, thetaHr = 0, drift = 0;
  var fBr = parseFloat(slider.value) / 60;
  var est = { f: fBr, spec: null, fmin: 0.05, fmax: 1.0 };

  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.8; }

  function step() {
    thetaBr += 2 * Math.PI * fBr / FS;
    thetaHr += 2 * Math.PI * F_HR / FS;
    drift += gauss() * 0.004;
    drift *= 0.999;
    var x = A_BR * Math.sin(thetaBr) + A_HR * Math.sin(thetaHr) + drift;
    var phi = 4 * Math.PI * x / LAMBDA;
    var amp = 0.82 + 0.03 * Math.sin(thetaBr * 0.5);
    I[head] = amp * Math.cos(phi + PHI0) + gauss() * 0.025;
    Q[head] = amp * Math.sin(phi + PHI0) + gauss() * 0.025;
    P[head] = phi;
    head = (head + 1) % N;
    if (filled < N) filled++;
  }

  function at(arr, k) { // k = 0 oldest .. filled-1 newest
    return arr[(head - filled + k + N) % N];
  }

  function estimate() {
    var n = filled;
    if (n < FS * 6) return;
    var mean = 0, k;
    for (k = 0; k < n; k++) mean += at(P, k);
    mean /= n;
    var xs = new Float32Array(n);
    for (k = 0; k < n; k++) xs[k] = (at(P, k) - mean) * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / (n - 1)));
    var df = 0.005, bins = Math.round((est.fmax - est.fmin) / df) + 1;
    var spec = new Float32Array(bins), best = 0, bi = 0, b;
    for (b = 0; b < bins; b++) {
      var f = est.fmin + b * df, w = 2 * Math.PI * f / FS, re = 0, im = 0;
      for (k = 0; k < n; k++) { re += xs[k] * Math.cos(w * k); im -= xs[k] * Math.sin(w * k); }
      var m = Math.sqrt(re * re + im * im);
      spec[b] = m;
      if (m > best && f >= 0.1 && f <= 0.8) { best = m; bi = b; }
    }
    var fpk = est.fmin + bi * df;
    if (bi > 0 && bi < bins - 1) {
      var a = spec[bi - 1], c = spec[bi + 1], d = a - 2 * best + c;
      if (d !== 0) fpk += 0.5 * (a - c) / d * df;
    }
    est.f = fpk;
    est.spec = spec;
    est.peak = best;
  }

  function fmt(v, dec) {
    var s = v.toFixed(dec);
    return root.getAttribute("data-lang") === "tr" ? s.replace(".", ",") : s;
  }
  function updateReadout() {
    var lang = root.getAttribute("data-lang");
    var perMin = lang === "tr" ? " /dk" : " /min";
    out.value = fmt(est.f * 60, 1) + perMin + "  (" + fmt(est.f, 3) + " Hz)";
  }

  /* ---------- drawing ---------- */
  var COL = { grid: "#1d2935", axis: "#2a3a4a", i: "#3fc6de", q: "#ff8a52", text: "#8796a6", dot: "#e4e9ee" };

  function fit(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = cv.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: r.width, h: r.height };
  }

  function drawIQ() {
    var g = fit(cIQ), ctx = g.ctx, w = g.w, h = g.h;
    ctx.clearRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h) * 0.36;
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = COL.axis;
    ctx.beginPath(); ctx.moveTo(cx - R * 1.2, cy); ctx.lineTo(cx + R * 1.2, cy);
    ctx.moveTo(cx, cy - R * 1.2); ctx.lineTo(cx, cy + R * 1.2); ctx.stroke();
    ctx.fillStyle = COL.text; ctx.font = "11px Archivo, sans-serif";
    ctx.fillText("I", cx + R * 1.2 - 6, cy - 6);
    ctx.fillText("Q", cx + 6, cy - R * 1.2 + 10);

    var trail = Math.min(filled, FS * 8);
    for (var k = filled - trail; k < filled; k++) {
      var a = (k - (filled - trail)) / trail;
      ctx.fillStyle = "rgba(63,198,222," + (0.08 + a * 0.6).toFixed(3) + ")";
      ctx.fillRect(cx + at(I, k) / 0.82 * R - 1, cy - at(Q, k) / 0.82 * R - 1, 2, 2);
    }
    if (filled) {
      var xi = cx + at(I, filled - 1) / 0.82 * R, yq = cy - at(Q, filled - 1) / 0.82 * R;
      ctx.strokeStyle = "rgba(228,233,238,0.35)";
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(xi, yq); ctx.stroke();
      ctx.fillStyle = COL.dot;
      ctx.beginPath(); ctx.arc(xi, yq, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPhase() {
    var g = fit(cPh), ctx = g.ctx, w = g.w, h = g.h;
    ctx.clearRect(0, 0, w, h);
    var top = 22, bot = h - 8, mid = (top + bot) / 2, amp = (bot - top) / 2;
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    for (var s = 0; s <= WIN; s += 5) {
      var gx = w - (s / WIN) * w;
      ctx.beginPath(); ctx.moveTo(gx, top); ctx.lineTo(gx, bot); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    if (!filled) return;
    var scale = 4 * Math.PI * (A_BR + 0.6) / LAMBDA;
    // Q channel, faint
    ctx.strokeStyle = "rgba(255,138,82,0.55)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var k = 0; k < filled; k++) {
      var x = w - ((filled - 1 - k) / (N - 1)) * w, y = mid - at(Q, k) * amp * 0.9;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    // phase, bright
    ctx.strokeStyle = COL.i; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (k = 0; k < filled; k++) {
      x = w - ((filled - 1 - k) / (N - 1)) * w; y = mid - (at(P, k) / scale) * amp;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  function drawSpec() {
    var g = fit(cSp), ctx = g.ctx, w = g.w, h = g.h;
    ctx.clearRect(0, 0, w, h);
    var top = 30, bot = h - 18, left = 4, right = w - 4;
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.fillStyle = COL.text; ctx.font = "10px Archivo, sans-serif";
    for (var f = 0.2; f <= 0.8001; f += 0.2) {
      var gx = left + (f - est.fmin) / (est.fmax - est.fmin) * (right - left);
      ctx.beginPath(); ctx.moveTo(gx, top); ctx.lineTo(gx, bot); ctx.stroke();
      ctx.fillText(fmt(f, 1), gx - 7, h - 5);
    }
    ctx.beginPath(); ctx.moveTo(left, bot); ctx.lineTo(right, bot); ctx.stroke();
    if (!est.spec) return;
    var sp = est.spec, n = sp.length, mx = est.peak || 1;
    ctx.beginPath(); ctx.moveTo(left, bot);
    for (var b = 0; b < n; b++) {
      var x = left + b / (n - 1) * (right - left), y = bot - Math.min(1, sp[b] / mx) * (bot - top);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(right, bot); ctx.closePath();
    ctx.fillStyle = "rgba(255,138,82,0.18)"; ctx.fill();
    ctx.strokeStyle = COL.q; ctx.lineWidth = 1.4; ctx.stroke();
    var px = left + (est.f - est.fmin) / (est.fmax - est.fmin) * (right - left);
    ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.dot; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bot); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = COL.dot; ctx.font = "600 11px Archivo, sans-serif";
    var label = fmt(est.f, 3) + " Hz";
    var tw = ctx.measureText(label).width;
    ctx.fillText(label, Math.min(px + 6, right - tw), top + 12);
  }

  function drawAll() { drawIQ(); drawPhase(); drawSpec(); }

  function prefill() {
    for (var k = 0; k < N; k++) step();
    estimate();
  }

  slider.addEventListener("input", function () {
    fBr = parseFloat(slider.value) / 60;
    if (reduce) { prefill(); updateReadout(); drawAll(); }
  });
  document.addEventListener("langchange", function () { updateReadout(); drawSpec(); });
  window.addEventListener("resize", drawAll);

  prefill();
  updateReadout();
  drawAll();
  if (reduce) return;

  var visible = true, last = performance.now(), acc = 0, sinceEst = 0, raf = 0;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt; sinceEst += dt;
    while (acc >= 1 / FS) { step(); acc -= 1 / FS; }
    if (sinceEst > 0.5) { estimate(); updateReadout(); sinceEst = 0; }
    drawAll();
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; visible ? start() : stop(); }).observe(scope);
  }
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  start();
})();
