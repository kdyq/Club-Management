/* ==========================================================================
   shell.js — 管理台外壳逻辑（三个方向共用）
   负责：屏幕/视图切换、侧栏高亮、成员表的加载态与筛选、登录表单校验、
         以及把"本次切换到哪个界面"交给各方向的动效模块处理。
   动效入口由传入的 animate(target, played) 提供。
   ========================================================================== */

window.BootShell = function (options) {
  "use strict";

  var opts = options || {};
  var played = Object.create(null);
  var crumbs = opts.crumbs || {};
  var screens = ["login", "dashboard", "members", "todo"];

  /* ------------------------------------------------------------------
     视图切换
     ------------------------------------------------------------------ */
  function show(target) {
    if (screens.indexOf(target) === -1) target = "login";

    var screen = target === "login" ? "login" : "app";
    var view = target === "login" ? "dashboard" : target;

    document.querySelectorAll(".screen").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-screen") === screen);
    });

    document.querySelectorAll(".view").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-view") === view);
    });

    /* 导航高亮：只认 data-nav（已实现的模块），未实现项不抢高亮。
       用通用选择器，侧栏导航与顶部导航都能被覆盖。 */
    document.querySelectorAll("[data-nav]").forEach(function (el) {
      el.setAttribute("aria-current", el.getAttribute("data-nav") === view ? "true" : "false");
    });

    document.querySelectorAll(".proto-bar__btn").forEach(function (el) {
      el.setAttribute("aria-current", el.getAttribute("data-goto") === target ? "true" : "false");
    });

    var crumb = document.querySelector(".topbar__crumb");
    if (crumb) crumb.textContent = crumbs[view] || crumbs.todo || "";

    if (screen === "app" && view === "members") loadMembers();

    if (typeof opts.animate === "function") opts.animate(target, played);
  }

  /* ------------------------------------------------------------------
     成员管理：加载态、筛选、空状态
     ------------------------------------------------------------------ */
  var skeleton = document.getElementById("member-skeleton");
  var tableWrap = document.getElementById("member-table-wrap");
  var foot = document.getElementById("member-foot");
  var emptyState = document.getElementById("member-empty");
  var rowsBox = document.getElementById("member-rows");
  var searchInput = document.getElementById("member-search");
  var deptSelect = document.getElementById("member-dept");
  var statusSelect = document.getElementById("member-status");
  var rangeLabel = document.getElementById("member-range");
  var loaded = false;

  function loadMembers() {
    if (loaded || !skeleton) return;
    loaded = true;

    if (ClubMotion.isReduced()) {
      skeleton.hidden = true;
      return;
    }

    /* 骨架屏与最终表格同形，加载完成时不会发生布局跳动 */
    skeleton.hidden = false;
    tableWrap.hidden = true;
    foot.hidden = true;

    window.setTimeout(function () {
      skeleton.hidden = true;
      tableWrap.hidden = false;
      foot.hidden = false;
      /* 加载期间用户可能已经输入了筛选条件，加载完成后重新套用一次 */
      applyFilter();
      if (typeof opts.onRowsLoad === "function") opts.onRowsLoad();
    }, 420);
  }

  function applyFilter() {
    if (!rowsBox) return;

    var q = (searchInput.value || "").trim().toLowerCase();
    var dept = deptSelect.value;
    var status = statusSelect.value;
    var rows = Array.prototype.slice.call(rowsBox.querySelectorAll("tr"));
    var shown = 0;

    rows.forEach(function (tr) {
      var haystack = (
        tr.getAttribute("data-name") +
        " " +
        tr.getAttribute("data-no") +
        " " +
        tr.getAttribute("data-phone")
      ).toLowerCase();

      var match =
        (!q || haystack.indexOf(q) !== -1) &&
        (!dept || tr.getAttribute("data-dept") === dept) &&
        (!status || tr.getAttribute("data-status") === status);

      tr.hidden = !match;
      if (match) shown += 1;
    });

    var empty = shown === 0;
    emptyState.hidden = !empty;
    tableWrap.hidden = empty;
    foot.hidden = empty;

    if (!empty && rangeLabel) rangeLabel.textContent = "1-" + shown;
  }

  function resetFilter() {
    searchInput.value = "";
    deptSelect.value = "";
    statusSelect.value = "";
    applyFilter();
    searchInput.focus();
  }

  /* ------------------------------------------------------------------
     登录表单：空值走行内错误，填写后进入后台
     ------------------------------------------------------------------ */
  var form = document.getElementById("login-form");
  var error = document.getElementById("login-error");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var account = document.getElementById("login-account");
      var password = document.getElementById("login-password");

      if (!account.value.trim() || !password.value.trim()) {
        error.hidden = false;
        (!account.value.trim() ? account : password).focus();
        return;
      }

      error.hidden = true;
      show("dashboard");
    });
  }

  /* ------------------------------------------------------------------
     启动
     ------------------------------------------------------------------ */
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-goto]");
    if (trigger) {
      e.preventDefault();
      show(trigger.getAttribute("data-goto"));
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
    deptSelect.addEventListener("change", applyFilter);
    statusSelect.addEventListener("change", applyFilter);
    var resetBtn = document.getElementById("member-reset");
    if (resetBtn) resetBtn.addEventListener("click", resetFilter);
  }

  window.addEventListener("hashchange", function () {
    show((window.location.hash || "").replace("#", ""));
  });

  /* 支持 #login / #dashboard / #members 直接打开某个界面，便于评审时分享链接 */
  show((window.location.hash || "").replace("#", ""));

  return { show: show, filter: applyFilter };
};
