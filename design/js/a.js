/* ==========================================================================
   方向 A · 动效配置
   MOTION 3：克制的动态。只在视图首次打开时播一次入场与数字增长，
   反复切换标签不再重播，避免日常使用时被动画干扰。
   本方向不使用滚动动画：仪表盘内容短，滚动叙事没有动机。
   ========================================================================== */

(function () {
  "use strict";

  function staggerRows() {
    ClubMotion.entrance("#member-rows tr", {
      y: 8,
      stagger: 0.035,
      duration: 0.45,
      delay: 0.12
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
        /* 表单与左侧文案依次浮现，把注意力引到主任务上 */
        ClubMotion.entrance(".login__main > *", { y: 18, stagger: 0, duration: 0.6 });
        ClubMotion.entrance(".login__aside-copy > *", { y: 14, stagger: 0.08, duration: 0.7, delay: 0.1 });
        ClubMotion.entrance(".login__brand", { y: -10, stagger: 0, duration: 0.5, delay: 0.25 });
        ClubMotion.entrance(".login__stats > *", { y: 14, stagger: 0.08, duration: 0.6, delay: 0.35 });
        return;
      }

      if (target === "dashboard") {
        ClubMotion.countUp(".view[data-view='dashboard'] .js-countup", {
          duration: 0.95,
          stagger: 0.07
        });
        ClubMotion.entrance(".view[data-view='dashboard'] .page-head", { y: 12, stagger: 0 });
        ClubMotion.entrance(".view[data-view='dashboard'] .metric", { y: 10, stagger: 0.05, duration: 0.5 });
        ClubMotion.entrance(".view[data-view='dashboard'] .panel", { y: 16, stagger: 0.09, delay: 0.06 });
        return;
      }

      if (target === "members") {
        ClubMotion.entrance(".view[data-view='members'] .page-head", { y: 12, stagger: 0 });
        ClubMotion.entrance(".view[data-view='members'] .toolbar > *", {
          y: 10,
          stagger: 0.04,
          duration: 0.5
        });
        ClubMotion.entrance(".view[data-view='members'] .panel", { y: 16, stagger: 0, delay: 0.1 });
        staggerRows();
        return;
      }

      ClubMotion.entrance(".view[data-view='todo'] .placeholder", { y: 14, stagger: 0 });
    }
  });
})();
