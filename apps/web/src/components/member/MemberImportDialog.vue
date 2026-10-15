<script setup lang="ts">
/**
 * 成员 Excel 导入。
 * 逐行结果都要展示出来——一行失败不能让整批看起来"成功"，也不能只报一个总数。
 */
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UploadRequestOptions } from 'element-plus';
import { memberApi, type ImportResult } from '@/api/member';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  imported: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const uploading = ref(false);
const result = ref<ImportResult | null>(null);
const downloading = ref(false);

async function onDownloadTemplate(): Promise<void> {
  downloading.value = true;
  try {
    await memberApi.downloadTemplate();
  } finally {
    downloading.value = false;
  }
}

/** 用自定义上传：走我们自己的 axios 实例，才能带上 Authorization 与统一错误处理 */
async function onUpload(options: UploadRequestOptions): Promise<void> {
  uploading.value = true;
  result.value = null;
  try {
    const data = await memberApi.import(options.file as File);
    result.value = data;
    if (data.failed === 0) {
      ElMessage.success(`全部 ${data.success} 条导入成功`);
    } else {
      ElMessage.warning(`成功 ${data.success} 条，失败 ${data.failed} 条`);
    }
    emit('imported');
  } catch {
    // 全局拦截器已提示
  } finally {
    uploading.value = false;
  }
}

function onClose(): void {
  visible.value = false;
  result.value = null;
}
</script>

<template>
  <el-dialog v-model="visible" title="导入成员" width="640px" :close-on-click-modal="false">
    <el-alert type="info" :closable="false" class="tip">
      <template #title>导入规则</template>
      <ul class="rules">
        <li>先下载模板，按表头填写；<b>姓名与学号为必填</b>。</li>
        <li>部门需与系统中的部门名一致，角色可填角色编码或角色名。</li>
        <li>学号已存在的会复用原账号，不会重复建档；同一届次重复导入会被跳过并在结果里说明。</li>
        <li>单行出错不影响其它行，导入完成后逐行列出原因。</li>
      </ul>
    </el-alert>

    <div class="actions">
      <el-button :loading="downloading" @click="onDownloadTemplate">
        <el-icon><Download /></el-icon>
        下载导入模板
      </el-button>
      <el-upload
        :show-file-list="false"
        :auto-upload="true"
        accept=".xlsx,.xlsm"
        :http-request="onUpload"
        :disabled="uploading"
      >
        <el-button type="primary" :loading="uploading">
          <el-icon><Upload /></el-icon>
          选择 Excel 文件
        </el-button>
      </el-upload>
    </div>

    <div v-if="result !== null" class="result">
      <div class="result__summary">
        共读取 <b>{{ result.total }}</b> 行 ·
        <span class="ok">成功 {{ result.success }}</span> ·
        <span :class="{ bad: result.failed > 0 }">失败 {{ result.failed }}</span>
      </div>

      <div v-if="result.initialPassword !== null" class="result__pwd">
        新建账号的初始密码：<b>{{ result.initialPassword }}</b>（复用已有账号的成员不在此列）
      </div>

      <el-table v-if="result.errors.length > 0" :data="result.errors" size="small" max-height="240">
        <el-table-column prop="row" label="行号" width="70" />
        <el-table-column prop="realName" label="姓名" width="120" />
        <el-table-column prop="reason" label="失败原因" min-width="220" />
      </el-table>
    </div>

    <template #footer>
      <el-button @click="onClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.tip {
  margin-bottom: var(--sp-4);
}

.rules {
  margin: 0;
  padding-left: 1.1em;
  font-size: 12.5px;
  line-height: 1.8;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.result {
  margin-top: var(--sp-5);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-border);
}

.result__summary {
  font-size: 13.5px;
}

.result__summary b {
  font-variant-numeric: tabular-nums;
}

.ok {
  color: var(--c-ok);
}

.bad {
  color: var(--c-danger);
}

.result__pwd {
  margin: var(--sp-3) 0;
  padding: var(--sp-3);
  border-radius: var(--r-control);
  background: var(--c-accent-tint);
  color: var(--c-accent);
  font-size: 12.5px;
}

.result__pwd b {
  font-family: var(--font-mono);
}
</style>
