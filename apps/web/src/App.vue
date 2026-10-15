<script setup lang="ts">
import { ref } from 'vue';

const clicks = ref(0);
</script>

<template>
  <main class="probe">
    <h1>社团管理系统</h1>
    <p>阶段 0 脚手架验证：前端已能渲染 Element Plus 组件。</p>
    <div class="row">
      <el-button type="primary">主按钮</el-button>
      <el-button>次按钮</el-button>
      <el-button @click="clicks++">点击 {{ clicks }} 次</el-button>
    </div>
  </main>
</template>

<style scoped>
.probe {
  padding: 48px;
  font-family: system-ui, sans-serif;
}

.row {
  display: flex;
  gap: 12px;
  align-items: center;
}
</style>
