<script setup lang="ts">
/**
 * 工作台。阶段 1 的版本聚焦一件事：把「数据范围」这个概念在界面上讲清楚。
 * 指标行的成员数按当前账号的数据范围统计，与全社团人数并列显示，差异一眼可见。
 *
 * 依据开发文档 9.4 节：指标行是一张面板 + 竖线分隔，不是四张并排卡片。
 */
import { computed, onMounted, ref } from 'vue';
import { statsApi, type OverviewVo } from '@/api/stats';
import { useUserStore } from '@/stores/user';

const user = useUserStore();
const overview = ref<OverviewVo | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const metrics = computed(() => {
  const o = overview.value;
  return [
    { label: '可见成员', value: o?.memberCount ?? 0, hint: '受你的数据范围限制' },
    { label: '全社团在册', value: o?.clubMemberCount ?? 0, hint: '社团全部在册成员' },
    { label: '下设部门', value: o?.deptCount ?? 0, hint: '含下级部门' },
    { label: '系统角色', value: o?.roleCount ?? 0, hint: '' },
    { label: '我的权限', value: o?.permissionCount ?? 0, hint: '个权限码' },
  ];
});

const identity = computed(() => {
  const p = user.profile;
  if (p === null) return [];
  return [
    { label: '社团', value: p.clubName },
    { label: '届次', value: p.termName },
    { label: '部门', value: p.deptName ?? '未分配' },
    { label: '职务', value: p.positionLabel },
    { label: '成员编号', value: p.memberNo ?? '—' },
    { label: '角色', value: p.roles.map((r) => r.name).join(' / ') || '—' },
  ];
});

onMounted(async () => {
  try {
    overview.value = await statsApi.overview();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '数据加载失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">工作台</h1>
        <p class="page__desc">
          {{ user.profile?.realName }}，欢迎回来。下面是与你权限范围相关的概览。
        </p>
      </div>
    </header>

    <el-alert
      v-if="error !== null"
      class="gap"
      type="error"
      :title="error"
      :closable="false"
      show-icon
    />

    <section v-else class="panel">
      <el-skeleton v-if="loading" :rows="2" animated />
      <div v-else class="metrics">
        <div v-for="item in metrics" :key="item.label" class="metric">
          <div class="metric__value num">{{ item.value }}</div>
          <div class="metric__label">{{ item.label }}</div>
          <div v-if="item.hint !== ''" class="metric__hint">{{ item.hint }}</div>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel__title">我的身份</h2>
      <dl class="identity">
        <div v-for="item in identity" :key="item.label" class="identity__item">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="panel">
      <h2 class="panel__title">你的数据范围</h2>
      <p class="scope-desc">
        {{ overview?.scopeDescription ?? '正在读取…' }}
        <span v-if="overview" class="scope-tag">{{ overview.maxDataScopeLabel }}</span>
      </p>
      <p class="scope-note">
        数据范围是权限的第二层。是否有权进入某个页面由角色决定，能看到哪些数据由数据范围决定，
        两者都在后端生效，前端隐藏只是体验优化。
      </p>
    </section>
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
}

.panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-container);
  box-shadow: var(--shadow-panel);
  padding: var(--sp-5);
}

.panel__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text-2);
  margin-bottom: var(--sp-4);
}

/* 指标行：一张面板 + 竖线分隔 */
.metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.metric {
  padding: 0 var(--sp-5);
  border-left: 1px solid var(--c-border);
}

.metric:first-child {
  padding-left: 0;
  border-left: none;
}

.metric__value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
}

.metric__label {
  margin-top: var(--sp-1);
  font-size: 13px;
  color: var(--c-text-2);
}

.metric__hint {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--c-text-3);
}

.identity {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--sp-4) var(--sp-6);
  margin: 0;
}

.identity__item dt {
  font-size: 12px;
  color: var(--c-text-3);
}

.identity__item dd {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 500;
}

.scope-desc {
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.scope-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 var(--sp-2);
  border-radius: var(--r-tag);
  background: var(--c-accent-tint);
  color: var(--c-accent);
  font-size: 12px;
  font-weight: 600;
}

.scope-note {
  margin-top: var(--sp-3);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--c-text-2);
}

@media (max-width: 900px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sp-4) 0;
  }

  .metric {
    padding-left: var(--sp-4);
  }

  .metric:nth-child(odd) {
    padding-left: 0;
    border-left: none;
  }
}
</style>
