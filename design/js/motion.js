/* ==========================================================================
   motion.js — 三个方向共用的动效原语
   只做三件事：数字增长、首屏入场、滚动揭示。
   全部走 transform / opacity（见 --gsap-performance 约定），不使用
   window 滚动监听，统一用 ScrollTrigger.batch。
   ========================================================================== */

(function (global) {
  "use strict";

  var reduceQuery = global.matchMedia("(prefers-reduced-motion: reduce)");

  function isReduced() {
    return reduceQuery.matches;
  }

  /* 从 data-* 读取格式：data-to 目标值，data-decimals / data-prefix / data-suffix */
  function format(value, el) {
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    var fixed = value.toFixed(decimals);
    var parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return prefix + parts.join(".") + suffix;
  }

  function render(el, value) {
    el.textContent = format(value, el);
  }

  /* 数字增长：一次性的，用于把静态数字变成"刚刚算出来的"读数 */
  function countUp(targets, options) {
    var opts = options || {};
    var els = gsap.utils.toArray(targets);
    if (!els.length) return null;

    els.forEach(function (el) {
      var to = parseFloat(el.getAttribute("data-to"));
      if (isNaN(to)) return;
      el.textContent = format(0, el);
    });

    if (isReduced()) {
      els.forEach(function (el) {
        render(el, parseFloat(el.getAttribute("data-to")));
      });
      return null;
    }

    return els.map(function (el, i) {
      var to = parseFloat(el.getAttribute("data-to"));
      var proxy = { v: 0 };
      return gsap.to(proxy, {
        v: to,
        duration: opts.duration || 0.95,
        delay: (opts.delay || 0) + i * (opts.stagger || 0.07),
        ease: opts.ease || "power2.out",
        onUpdate: function () {
          render(el, proxy.v);
        },
        scrollTrigger: opts.scrollTrigger
          ? { trigger: el, start: "top 88%", once: true }
          : undefined,
      });
    });
  }

  /* 首屏入场：面板/表单按顺序浮现，用于把注意力引导到主任务上 */
  function entrance(targets, options) {
    var opts = options || {};
    var els = gsap.utils.toArray(targets);
    if (!els.length) return;

    if (isReduced()) {
      gsap.set(els, { autoAlpha: 1, y: 0, clearProps: "all" });
      return;
    }

    gsap.from(els, {
      autoAlpha: 0,
      y: opts.y === undefined ? 16 : opts.y,
      duration: opts.duration || 0.62,
      delay: opts.delay || 0,
      ease: opts.ease || "power2.out",
      stagger: opts.stagger === undefined ? 0.075 : opts.stagger,
      clearProps: "transform,visibility,opacity",
    });
  }

  /* 滚动揭示：批量触发，进入视口的元素成组出现，只播一次 */
  function revealBatch(selector, options) {
    var opts = options || {};
    var els = gsap.utils.toArray(selector);
    if (!els.length) return;

    if (isReduced()) {
      gsap.set(els, { autoAlpha: 1, y: 0 });
      return;
    }

    gsap.set(els, { autoAlpha: 0, y: opts.y === undefined ? 20 : opts.y });

    ScrollTrigger.batch(els, {
      start: opts.start || "top 88%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: opts.duration || 0.6,
          ease: "power2.out",
          stagger: opts.stagger === undefined ? 0.08 : opts.stagger,
          overwrite: true,
        });
      },
    });
  }

  /* 进度/趋势线绘制：用于图表进入视口时把线条"读"出来 */
  function drawLine(path, options) {
    var opts = options || {};
    var el = typeof path === "string" ? document.querySelector(path) : path;
    if (!el) return;

    var length = el.getTotalLength ? el.getTotalLength() : 0;
    if (!length) return;

    if (isReduced()) {
      gsap.set(el, { strokeDasharray: "none", strokeDashoffset: 0 });
      return;
    }

    gsap.set(el, { strokeDasharray: length, strokeDashoffset: length });

    gsap.to(el, {
      strokeDashoffset: 0,
      duration: opts.duration || 1.5,
      ease: "power2.inOut",
      delay: opts.delay || 0,
      scrollTrigger: opts.scrollTrigger
        ? { trigger: el.closest("svg") || el, start: "top 85%", once: true }
        : undefined,
    });
  }

  function refresh() {
    if (global.ScrollTrigger) ScrollTrigger.refresh();
  }

  global.ClubMotion = {
    isReduced: isReduced,
    countUp: countUp,
    entrance: entrance,
    revealBatch: revealBatch,
    drawLine: drawLine,
    refresh: refresh,
  };
})(window);
