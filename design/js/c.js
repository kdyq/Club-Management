/* ==========================================================================
   方向 C · 动效配置
   MOTION 5：比方向 A 明显、比方向 B 克制。逐格浮现是本方向的主要叙事动作。
   每一处动画都有明确动机：
     1. 登录页文案与表单分批浮现   → 引导视线到主任务
     2. 指标数字增长               → 让读数像"刚算出来"
     3. bento 格子缩放错峰浮现     → 叙事：版面是一格一格拼起来的
     4. 下半屏随滚动揭示           → 叙事：内容按阅读顺序依次到位
     5. 格子悬停抬起               → 反馈：可点击（由 CSS 负责，非 GSAP）
   ========================================================================== */

(function () {
  "use strict";

  function staggerRows() {
    ClubMotion.entrance("#member-rows tr", {
      y: 10,
      stagger: 0.04,
      duration: 0.5,
      delay: 0.1
    });
  }

  /* 首屏之外的格子：滚到时成组浮现。
     用 js-below 明确标记，避免与首屏的 js-above 抢同一个元素。 */
  function revealLowerSections() {
    ClubMotion.revealBatch(".view[data-view='dashboard'] .js-below", {
      y: 24,
      stagger: 0.09,
      start: "top 92%"
    });
  }

  window.BootShell({
    crumbs: {
      dashboard: "概览",
      members: "成员管理",
      todo: "模块占位"
    },

    onRowsLoad: staggerRows,

    animate: function (target, played) {
      if (played[target]) return;
      played[target] = true;

      if (target === "login") {
        ClubMotion.entrance(".login-quiet__brand", { y: -10, stagger: 0, duration: 0.5 });
        ClubMotion.entrance(".login-quiet__title", { y: 16, stagger: 0, duration: 0.65, delay: 0.06 });
        ClubMotion.entrance(".login-quiet__subtitle", { y: 14, stagger: 0, duration: 0.6, delay: 0.14 });
        ClubMotion.entrance(".login-quiet__fields > *", {
          y: 14,
          stagger: 0.07,
          duration: 0.55,
          delay: 0.22
        });
        ClubMotion.entrance(".login-quiet__submit", { y: 12, stagger: 0, duration: 0.55, delay: 0.42 });
        ClubMotion.entrance(".login-quiet__aside", { y: 20, stagger: 0, duration: 0.75, delay: 0.1 });
        ClubMotion.entrance(".login-quiet__quote", { y: 16, stagger: 0, duration: 0.7, delay: 0.34 });
        return;
      }

      if (target === "dashboard") {
        /* 首屏几格：缩放错峰，像把版面一格格拼起来 */
        ClubMotion.entrance(".view[data-view='dashboard'] .js-above", {
          y: 18,
          stagger: 0.07,
          duration: 0.6
        });

        ClubMotion.entrance(".view[data-view='dashboard'] .chead", { y: 14, stagger: 0, duration: 0.6 });
        ClubMotion.countUp(".view[data-view='dashboard'] .js-countup", {
          duration: 1,
          stagger: 0.08
        });
        revealLowerSections();
        return;
      }

      if (target === "members") {
        ClubMotion.entrance(".view[data-view='members'] .chead", { y: 14, stagger: 0, duration: 0.6 });
        ClubMotion.entrance(".view[data-view='members'] .toolbar > *", {
          y: 12,
          stagger: 0.05,
          duration: 0.5
        });
        ClubMotion.entrance(".view[data-view='members'] .panel", { y: 20, stagger: 0, delay: 0.1 });
        staggerRows();
        return;
      }

      ClubMotion.entrance(".view[data-view='todo'] .panel", { y: 16, stagger: 0 });
    }
  });
})();
