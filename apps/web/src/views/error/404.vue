<script setup lang="ts">
/** 404 页。地址打错或不存在的资源。 */
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="err">
    <div class="err__card">
      <div class="err__code">404</div>
      <h1 class="err__title">页面不存在</h1>
      <p class="err__desc">你访问的地址没有对应的页面，可能是链接过期或输入有误。</p>
      <div class="err__actions">
        <el-button type="primary" @click="router.push('/dashboard')">回到工作台</el-button>
        <el-button @click="router.back()">返回上一页</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.err {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--sp-6);
}

.err__card {
  max-width: 420px;
  padding: var(--sp-8);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-container);
  box-shadow: var(--shadow-panel);
  text-align: center;
}

.err__code {
  font-size: 40px;
  font-weight: 700;
  color: var(--c-text-3);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.err__title {
  margin-top: var(--sp-4);
  font-size: 18px;
}

.err__desc {
  margin-top: var(--sp-3);
  color: var(--c-text-2);
  font-size: 13.5px;
  line-height: 1.7;
}

.err__actions {
  display: flex;
  justify-content: center;
  gap: var(--sp-3);
  margin-top: var(--sp-6);
}
</style>
