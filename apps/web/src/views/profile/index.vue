<script setup lang="ts">
/**
 * 我的档案。任何登录用户都能打开，展示自己的社团身份与档案统计——
 * 这正是普通成员（数据范围「仅本人」）能看到的内容。
 */
import { computed, onMounted, ref } from 'vue';
import { memberApi, type MemberDetailVo } from '@/api/member';

const loading = ref(true);
const error = ref<string | null>(null);
const detail = ref<MemberDetailVo | null>(null);

onMounted(async () => {
  try {
    const result = await memberApi.profile();
    detail.value = result;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载失败';
  } finally {
    loading.value = false;
  }
});

const stats = computed(() => {
  const d = detail.value;
  if (d === null) return [];
  return [
    { label: '当前积分', value: d.totalPoints, hint: `${d.pointRecordCount} 条流水` },
    { label: '报名活动', value: d.registrationCount, hint: '次' },
    { label: '已缴会费', value: d.paidFeeCount, hint: '笔' },
  ];
});

const fields = computed(() => {
  const d = detail.value;
  if (d === null) return [];
  return [
    { label: '成员编号', value: d.memberNo ?? '—' },
    { label: '学号', value: d.studentNo ?? '—' },
    { label: '部门', value: d.deptName ?? '未分配' },
    { label: '职务', value: d.positionLabel },
    { label: '状态', value: d.statusLabel },
    { label: '年级', value: d.grade ?? '—' },
    { label: '专业', value: d.major ?? '—' },
    { label: '班级', value: d.className ?? '—' },
    { label: '手机号', value: d.phone ?? '—' },
    { label: '邮箱', value: d.email ?? '—' },
    { label: '加入日期', value: d.joinDateFull ?? d.joinDate ?? '—' },
    { label: '核心成员', value: d.isCore ? '是' : '否' },
  ];
});
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">我的档案</h1>
        <p class="page__desc">这里是你自己的社团身份与记录，别人看到的内容取决于他的数据范围。</p>
      </div>
    </header>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">档案加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
    </section>

    <section v-else-if="loading" class="panel">
      <el-skeleton :rows="7" animated />
    </section>

    <template v-else-if="detail !== null">
      <section class="panel">
        <div class="head">
          <span class="avatar">{{ detail.realName.slice(0, 1) }}</span>
          <div>
            <div class="head__name">{{ detail.realName }}</div>
            <div class="head__meta">
              {{ detail.deptName ?? '未分配部门' }} · {{ detail.positionLabel }} ·
              {{ detail.roles.map((r) => r.name).join(' / ') || '未分配角色' }}
            </div>
          </div>
        </div>

        <div class="stats">
          <div v-for="item in stats" :key="item.label" class="stat">
            <div class="stat__value num">{{ item.value }}</div>
            <div class="stat__label">{{ item.label }}</div>
            <div class="stat__hint">{{ item.hint }}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel__title">基本信息</h2>
        <dl class="fields">
          <div v-for="row in fields" :key="row.label" class="fields__item">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
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

.head {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}

.avatar {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--r-avatar);
  background: var(--c-accent-tint);
  color: var(--c-accent);
  font-size: 20px;
  font-weight: 600;
  flex: none;
}

.head__name {
  font-size: 17px;
  font-weight: 600;
}

.head__meta {
  margin-top: 2px;
  font-size: 13px;
  color: var(--c-text-2);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: var(--sp-5);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-border);
}

.stat {
  padding: 0 var(--sp-5);
  border-left: 1px solid var(--c-border);
}

.stat:first-child {
  padding-left: 0;
  border-left: none;
}

.stat__value {
  font-size: 22px;
  font-weight: 700;
}

.stat__label {
  font-size: 13px;
  color: var(--c-text-2);
}

.stat__hint {
  font-size: 11.5px;
  color: var(--c-text-3);
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--sp-4) var(--sp-6);
  margin: 0;
}

.fields__item dt {
  font-size: 12px;
  color: var(--c-text-3);
}

.fields__item dd {
  margin: 2px 0 0;
  font-size: 14px;
}
</style>
