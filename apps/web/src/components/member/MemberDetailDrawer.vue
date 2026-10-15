<script setup lang="ts">
/** 成员详情抽屉。展示身份、联系方式、档案统计；统计数字全部来自真实查询。 */
import { computed, ref, watch } from 'vue';
import { memberApi, type MemberDetailVo } from '@/api/member';

const props = defineProps<{ modelValue: boolean; memberId: string | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const loading = ref(false);
const detail = ref<MemberDetailVo | null>(null);

watch(
  () => [props.modelValue, props.memberId],
  async () => {
    if (!props.modelValue || props.memberId === null) return;
    loading.value = true;
    try {
      detail.value = await memberApi.detail(props.memberId);
    } catch {
      detail.value = null;
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

const rows = computed(() => {
  const d = detail.value;
  if (d === null) return [];
  return [
    { label: '成员编号', value: d.memberNo ?? '—' },
    { label: '学号', value: d.studentNo ?? '—' },
    { label: '部门', value: d.deptName ?? '未分配' },
    { label: '职务', value: d.positionLabel },
    { label: '状态', value: d.statusLabel },
    { label: '核心成员', value: d.isCore ? '是' : '否' },
    { label: '年级', value: d.grade ?? '—' },
    { label: '专业', value: d.major ?? '—' },
    { label: '班级', value: d.className ?? '—' },
    { label: '手机号', value: d.phone ?? '—' },
    { label: '邮箱', value: d.email ?? '—' },
    { label: '加入日期', value: d.joinDateFull ?? d.joinDate ?? '—' },
  ];
});

const stats = computed(() => {
  const d = detail.value;
  if (d === null) return [];
  return [
    { label: '积分', value: d.totalPoints, hint: `${d.pointRecordCount} 条流水` },
    { label: '已缴会费', value: d.paidFeeCount, hint: '笔' },
    { label: '报名活动', value: d.registrationCount, hint: '次' },
  ];
});
</script>

<template>
  <el-drawer v-model="visible" size="480px" :title="detail?.realName ?? '成员详情'">
    <el-skeleton v-if="loading" :rows="8" animated />

    <div v-else-if="detail === null" class="empty">
      <el-empty description="没有取到该成员的资料" />
    </div>

    <div v-else class="body">
      <div class="head">
        <span class="avatar">{{ detail.realName.slice(0, 1) }}</span>
        <div>
          <div class="head__name">{{ detail.realName }}</div>
          <div class="head__meta">
            {{ detail.deptName ?? '未分配部门' }} · {{ detail.positionLabel }}
          </div>
          <div class="head__roles">
            <el-tag v-for="role in detail.roles" :key="role.id" size="small" effect="plain">
              {{ role.name }}
            </el-tag>
            <span v-if="detail.roles.length === 0" class="head__norole">未分配角色</span>
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

      <dl class="fields">
        <div v-for="row in rows" :key="row.label" class="fields__item">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>

      <div v-if="detail.leaveReason" class="leave">
        <div class="leave__title">离会信息</div>
        <div>{{ detail.leaveDate ?? '—' }} · {{ detail.leaveReason }}</div>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.head {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}

.avatar {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: var(--r-avatar);
  background: var(--c-accent-tint);
  color: var(--c-accent);
  font-size: 19px;
  font-weight: 600;
  flex: none;
}

.head__name {
  font-size: 16px;
  font-weight: 600;
}

.head__meta {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--c-text-2);
}

.head__roles {
  margin-top: var(--sp-2);
  display: flex;
  gap: var(--sp-1);
  flex-wrap: wrap;
}

.head__norole {
  font-size: 12px;
  color: var(--c-text-3);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--c-border);
  border-radius: var(--r-container);
  padding: var(--sp-4) 0;
}

.stat {
  padding: 0 var(--sp-4);
  border-left: 1px solid var(--c-border);
}

.stat:first-child {
  border-left: none;
}

.stat__value {
  font-size: 20px;
  font-weight: 700;
}

.stat__label {
  font-size: 12.5px;
  color: var(--c-text-2);
}

.stat__hint {
  font-size: 11.5px;
  color: var(--c-text-3);
}

.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-4) var(--sp-5);
  margin: 0;
}

.fields__item dt {
  font-size: 12px;
  color: var(--c-text-3);
}

.fields__item dd {
  margin: 2px 0 0;
  font-size: 13.5px;
}

.leave {
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--c-neutral-tint);
  font-size: 12.5px;
  color: var(--c-text-2);
}

.leave__title {
  font-weight: 600;
  margin-bottom: 2px;
}

.empty {
  padding: var(--sp-8) 0;
}
</style>
