/* ==========================================================================
   方向 B · 动效配置
   MOTION 6：入场编排更明显，并加入唯一的滚动驱动动效。
   每一处动画都有明确动机：
     1. 登录面板分段浮现       → 引导视线到表单
     2. 指标数字增长           → 让读数像"刚算出来"而非贴图
     3. 面板错峰入场           → 建立阅读顺序
     4. 趋势线随滚动绘制       → 叙事：把这段时间的支出读出来
     5. 实时指示点脉冲         → 反馈：该活动此刻正在接收报名（唯一的循环动效）
   ========================================================================== */

(function () {
  "use strict";

  var sparkDrawn = false;

  function staggerRows() {
    ClubMotion.entrance("#member-rows tr", {
      y: 10,
      stagger: 0.04,
      duration: 0.45,
      delay: 0.1
    });
  }

  /* 趋势线只在滚动到视口时绘制一次 */
  function drawSpark() {
    if (sparkDrawn) return;
    sparkDrawn = true;
    ClubMotion.drawLine("#spark-line", { duration: 1.5, scrollTrigger: true });
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
        ClubMotion.entrance(".login-full__brand", { y: -12, stagger: 0, duration: 0.5 });
        ClubMotion.entrance(".login-card", { y: 22, stagger: 0, duration: 0.7, delay: 0.08 });
        ClubMotion.entrance(".login-card__fields > *", {
          y: 12,
          stagger: 0.07,
          duration: 0.5,
          delay: 0.3
        });
        ClubMotion.entrance(".login-full__foot", { y: 8, stagger: 0, duration: 0.5, delay: 0.45 });
        return;
      }

      if (target === "dashboard") {
        ClubMotion.countUp(".view[data-view='dashboard'] .js-countup", {
          duration: 1.1,
          stagger: 0.08
        });
        ClubMotion.entrance(".view[data-view='dashboard'] .page-head", { y: 14, stagger: 0 });
        ClubMotion.entrance(".view[data-view='dashboard'] .metric", {
          y: 12,
          stagger: 0.06,
          duration: 0.5
        });
        ClubMotion.entrance(".view[data-view='dashboard'] .panel", {
          y: 20,
          stagger: 0.1,
          duration: 0.6,
          delay: 0.08
        });
        drawSpark();
        return;
      }

      if (target === "members") {
        ClubMotion.entrance(".view[data-view='members'] .page-head", { y: 14, stagger: 0 });
        ClubMotion.entrance(".view[data-view='members'] .toolbar > *", {
          y: 12,
          stagger: 0.05,
          duration: 0.5
        });
        ClubMotion.entrance(".view[data-view='members'] .panel", { y: 18, stagger: 0, delay: 0.1 });
        staggerRows();
        return;
      }

      ClubMotion.entrance(".view[data-view='todo'] .placeholder", { y: 16, stagger: 0 });
    }
  });
})();
