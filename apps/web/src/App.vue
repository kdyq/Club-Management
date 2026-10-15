<script setup lang="ts">
/**
 * 阶段 0 的地基验证页。确认设计令牌与 Element Plus 主题覆盖都生效。
 * 阶段 1 会把这里换成真正的应用外壳（侧栏 + 路由出口）。
 * 注意：本文件不出现颜色字面值，全部走 tokens.css 的变量。
 */
import { ref } from 'vue';

const clicks = ref(0);
</script>

<template>
  <main class="probe">
    <header class="probe__head">
      <h1>社团管理系统</h1>
      <p class="probe__sub">阶段 0 地基验证 · 设计令牌与 Element Plus 主题</p>
    </header>

    <section class="panel">
      <h2 class="panel__title">Element Plus 主色</h2>
      <div class="row">
        <el-button type="primary">主按钮</el-button>
        <el-button>次按钮</el-button>
        <el-button type="success">成功</el-button>
        <el-button type="warning">警告</el-button>
        <el-button type="danger">危险</el-button>
        <el-button type="primary" plain>朴素主色</el-button>
        <el-button @click="clicks++">点击 {{ clicks }} 次</el-button>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel__title">标记与控件</h2>
      <div class="row">
        <el-tag type="primary">报名中</el-tag>
        <el-tag type="success">进行中</el-tag>
        <el-tag type="info">已结束</el-tag>
        <el-tag type="warning">待审批</el-tag>
        <el-tag type="danger">已驳回</el-tag>
      </div>
      <div class="row">
        <el-switch :model-value="true" />
        <el-checkbox :model-value="true">已选</el-checkbox>
        <el-radio :model-value="1" :value="1">单选</el-radio>
        <el-input placeholder="占位符文字也要达到 4.5:1" style="max-width: 240px" />
      </div>
    </section>

    <section class="panel">
      <h2 class="panel__title">语义色与文字层级</h2>
      <div class="row">
        <span class="chip chip--accent">强调</span>
        <span class="chip chip--ok">成功</span>
        <span class="chip chip--warn">警告</span>
        <span class="chip chip--danger">危险</span>
        <span class="chip chip--neutral">中性</span>
      </div>
      <p class="text-1">一级文字 --c-text，正文与标题用</p>
      <p class="text-2">二级文字 --c-text-2，表头与次级信息用</p>
      <p class="text-3">三级文字 --c-text-3，占位符与元信息用，同样达标</p>
    </section>

    <section class="panel">
      <h2 class="panel__title">数字等宽</h2>
      <div class="row">
        <span class="num metric">46 / 60</span>
        <span class="num metric">1,284.50</span>
        <span class="num metric">92%</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.probe {
  max-width: var(--layout-content-max);
  margin: 0 auto;
  padding: var(--sp-8) var(--sp-6) var(--sp-12);
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.probe__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.probe__head h1 {
  font-size: 22px;
}

.probe__sub {
  color: var(--c-text-2);
}

.panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-container);
  box-shadow: var(--shadow-panel);
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.panel__title {
  font-size: 14px;
  color: var(--c-text-2);
  font-weight: 500;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: center;
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 var(--sp-3);
  border-radius: var(--r-tag);
  font-size: 13px;
}

.chip--accent {
  background: var(--c-accent-tint);
  color: var(--c-accent);
}

.chip--ok {
  background: var(--c-ok-tint);
  color: var(--c-ok);
}

.chip--warn {
  background: var(--c-warn-tint);
  color: var(--c-warn);
}

.chip--danger {
  background: var(--c-danger-tint);
  color: var(--c-danger);
}

.chip--neutral {
  background: var(--c-neutral-tint);
  color: var(--c-neutral-text);
}

.text-1 {
  color: var(--c-text);
}

.text-2 {
  color: var(--c-text-2);
}

.text-3 {
  color: var(--c-text-3);
}

.metric {
  font-size: 18px;
  font-weight: 600;
}
</style>
