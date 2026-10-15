<script setup lang="ts">
/** 公告管理。发布时会给全体在册成员各发一条站内信。 */
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { AnnouncementStatus, type AnnouncementVo } from '@club/shared';
import { announcementApi } from '@/api/ops';
import { useTable } from '@/composables/useTable';

const {
  list,
  total,
  loading,
  error,
  query,
  hasFilter,
  reload,
  reset,
  onPageChange,
} = useTable<AnnouncementVo, Record<string, unknown>>(
  (params) => announcementApi.page(params),
  { defaultQuery: { page: 1, pageSize: 20 } },
);

const dialogVisible = ref(false);
const submitting = ref(false);
const detailVisible = ref(false);
const detail = ref<AnnouncementVo | null>(null);
const form = ref({
  title: '',
  content: '',
  type: 2,
  isTop: false,
  publishNow: true,
});

onMounted(() => {
  void reload();
});

async function onCreate(): Promise<void> {
  if (form.value.title.trim().length < 2) {
    ElMessage.warning('请填写标题');
    return;
  }
  if (form.value.content.trim().length < 5) {
    ElMessage.warning('正文太短了');
    return;
  }
  submitting.value = true;
  try {
    await announcementApi.create({
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      type: form.value.type,
      isTop: form.value.isTop,
      publishNow: form.value.publishNow,
    });
    ElMessage.success(form.value.publishNow ? '已发布，并给全体成员发了站内信' : '已存为草稿');
    dialogVisible.value = false;
    await reload();
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

async function onView(row: AnnouncementVo): Promise<void> {
  try {
    detail.value = await announcementApi.detail(row.id);
    detailVisible.value = true;
    await reload();
  } catch {
    // 拦截器已提示
  }
}

async function onPublish(row: AnnouncementVo): Promise<void> {
  try {
    await announcementApi.publish(row.id);
    ElMessage.success('已发布');
    await reload();
  } catch {
    // 拦截器已提示
  }
}

async function onOffline(row: AnnouncementVo): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定下架「${row.title}」吗？`, '下架公告', {
      confirmButtonText: '下架',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await announcementApi.offline(row.id);
    ElMessage.success('已下架');
    await reload();
  } catch {
    // 拦截器已提示
  }
}
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">公告管理</h1>
        <p class="page__desc">共 {{ total }} 条。发布时会自动给全体在册成员发一条站内信，重复发布不会重复推送。</p>
      </div>
      <el-button v-perm="'announcement:create'" type="primary" @click="dialogVisible = true">
        <el-icon><Plus /></el-icon>
        发公告
      </el-button>
    </header>

    <section class="panel panel--filters">
      <el-input v-model="query.keyword" class="filter" placeholder="搜索标题" clearable @keyup.enter="reload" @clear="reload" />
      <el-select v-model="query.publishStatus" class="filter--sm" placeholder="状态" clearable>
        <el-option label="草稿" :value="1" />
        <el-option label="已发布" :value="2" />
        <el-option label="已下架" :value="3" />
      </el-select>
      <el-button v-if="hasFilter" @click="reset">清空筛选</el-button>
    </section>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">公告加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="reload">重试</el-button>
    </section>

    <section v-else-if="loading && list.length === 0" class="panel"><el-skeleton :rows="5" animated /></section>

    <section v-else-if="list.length === 0" class="panel panel--empty">
      <el-empty :description="hasFilter ? '没有符合条件的公告' : '还没有公告'">
        <el-button v-if="hasFilter" type="primary" @click="reset">清空筛选</el-button>
      </el-empty>
    </section>

    <section v-else class="panel panel--table">
      <el-table v-loading="loading" :data="list" style="width: 100%">
        <el-table-column label="标题" min-width="240">
          <template #default="{ row }">
            <span class="cell-title">
              <el-tag v-if="row.isTop" size="small" type="danger" effect="plain">置顶</el-tag>
              {{ row.title }}
            </span>
            <div class="cell-sub">{{ row.typeLabel }} · {{ row.publisherName ?? '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.publishStatus === AnnouncementStatus.PUBLISHED ? 'success' : row.publishStatus === AnnouncementStatus.DRAFT ? 'warning' : 'info'"
              effect="plain"
              size="small"
            >
              {{ row.publishStatusLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="浏览" width="80" align="right">
          <template #default="{ row }"><span class="num">{{ row.viewCount }}</span></template>
        </el-table-column>
        <el-table-column label="发布时间" width="170">
          <template #default="{ row }">
            <span class="num">{{ row.publishAt ? new Date(row.publishAt).toLocaleString('zh-CN') : '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="onView(row)">查看</el-button>
            <el-button
              v-if="row.publishStatus !== AnnouncementStatus.PUBLISHED"
              v-perm="'announcement:update'"
              link
              type="primary"
              @click="onPublish(row)"
            >
              发布
            </el-button>
            <el-button
              v-else
              v-perm="'announcement:update'"
              link
              type="danger"
              @click="onOffline(row)"
            >
              下架
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          :current-page="query.page"
          :page-size="query.pageSize"
          :total="total"
          layout="total, prev, pager, next"
          background
          @current-change="onPageChange"
        />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" title="发布公告" width="600px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="128" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio :value="1">通知</el-radio>
            <el-radio :value="2">公告</el-radio>
            <el-radio :value="3">新闻</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="正文" required>
          <el-input v-model="form.content" type="textarea" :rows="6" maxlength="20000" show-word-limit />
        </el-form-item>
        <el-form-item label="置顶">
          <el-switch v-model="form.isTop" />
        </el-form-item>
        <el-form-item label="立即发布">
          <el-switch v-model="form.publishNow" />
          <span class="hint">关闭则存为草稿，之后可手动发布</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onCreate">
          {{ form.publishNow ? '发布' : '存草稿' }}
        </el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" size="520px" :title="detail?.title ?? '公告'">
      <template v-if="detail">
        <div class="detail-meta">
          <el-tag size="small" effect="plain">{{ detail.typeLabel }}</el-tag>
          <span class="muted">{{ detail.publisherName ?? '—' }} · {{ detail.publishAt ? new Date(detail.publishAt).toLocaleString('zh-CN') : '未发布' }}</span>
        </div>
        <p class="detail-content">{{ detail.content }}</p>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
}

.page__title {
  font-size: 20px;
}

.page__desc {
  margin-top: var(--sp-1);
  color: var(--c-text-2);
  font-size: 13.5px;
  max-width: 72ch;
}

.panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-container);
  box-shadow: var(--shadow-panel);
  padding: var(--sp-5);
}

.panel--filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: center;
}

.filter {
  width: 240px;
}

.filter--sm {
  width: 130px;
}

.panel--table {
  padding: var(--sp-2) var(--sp-2) var(--sp-4);
}

.panel--empty {
  padding: var(--sp-8);
}

.panel--error {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  border-color: var(--c-danger-tint);
  background: var(--c-danger-tint);
}

.panel--error__icon {
  font-size: 22px;
  color: var(--c-danger);
}

.panel--error__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-danger);
}

.panel--error__desc {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--c-text-2);
}

.cell-title {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-weight: 500;
}

.cell-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--c-text-3);
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: var(--sp-4) var(--sp-4) 0;
}

.hint {
  margin-left: var(--sp-2);
  font-size: 12px;
  color: var(--c-text-3);
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding-bottom: var(--sp-4);
  border-bottom: 1px solid var(--c-border);
}

.detail-content {
  margin-top: var(--sp-4);
  font-size: 14px;
  line-height: 1.9;
  white-space: pre-wrap;
}

.muted {
  font-size: 12.5px;
  color: var(--c-text-3);
}
</style>
