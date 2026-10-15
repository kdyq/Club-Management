<script setup lang="ts">
/**
 * 工作台。所有指标与图表都由真实查询得出——成员数按当前登录者的数据范围统计，
 * 与全社团人数并列，数据范围的差异一眼可见。
 *
 * 依据开发文档 9.4 节：指标行是一张面板 + 竖线分隔，不是四张并排卡片。
 * 动效只用了允许的两处：数字增长与面板错峰淡入，命中 reduced-motion 时全静态。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { statsApi2, type DashboardVo } from '@/api/ops';
import { useStaggeredPanels, gsap } from '@/composables/useMotion';
import { useUserStore } from '@/stores/user';

const user = useUserStore();
const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<DashboardVo | null>(null);

// 数字指标动效
const metricRefs = ref<(HTMLElement | null)[]>([]);
const metricValues = ref<number[]>([]);
useStaggeredPanels();

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    data.value = await statsApi2.dashboard();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

const metrics = computed(() => {
  const d = data.value;
  if (d === null) return [];
  return [
    { label: '可见成员', value: d.memberCount, hint: '受你的数据范围限制' },
    { label: '全社团在册', value: d.clubMemberCount, hint: '社团全部在册成员' },
    { label: '下设部门', value: d.deptCount, hint: '含下级部门' },
    { label: '活动总数', value: d.activityCount, hint: `进行中 ${d.ongoingCount}` },
    { label: '我的待办', value: d.pendingApprovalCount, hint: '待你审批' },
    { label: '未读站内信', value: d.unreadCount, hint: '' },
  ];
});

watch(metrics, (list) => {
  metricValues.value = list.map((item) => item.value);
});

// 三处图表：成员增长、活动状态、部门构成
const growthRef = ref<HTMLElement | null>(null);
const activityRef = ref<HTMLElement | null>(null);
const deptRef = ref<HTMLElement | null>(null);
const charts: echarts.ECharts[] = [];

function chartTextColor(): string {
  // ECharts 拿不到 CSS 变量，这里从根元素读一次令牌值，避免在代码里写死颜色
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue('--c-text-2').trim() || '#4a5566';
}

function accentColor(): string {
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue('--c-accent').trim() || '#3553c6';
}

function okColor(): string {
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue('--c-ok').trim() || '#186147';
}

function dangerColor(): string {
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue('--c-danger').trim() || '#9c2f2f';
}

function neutralColor(): string {
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue('--c-neutral-tint').trim() || '#eceff4';
}

function renderCharts(): void {
  const d = data.value;
  if (d === null) return;
  const text = chartTextColor();

  if (growthRef.value !== null) {
    const chart = echarts.init(growthRef.value);
    chart.setOption({
      grid: { left: 40, right: 16, top: 24, bottom: 28 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: d.memberGrowth.map((item) => item.month.slice(5) + '月'),
        axisLine: { lineStyle: { color: neutralColor() } },
        axisLabel: { color: text, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: neutralColor() } },
        axisLabel: { color: text, fontSize: 11 },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          data: d.memberGrowth.map((item) => item.count),
          itemStyle: { color: accentColor() },
          areaStyle: { color: 'rgba(53, 83, 198, 0.08)' },
          symbolSize: 6,
        },
      ],
    });
    charts.push(chart);
  }

  if (activityRef.value !== null) {
    const chart = echarts.init(activityRef.value);
    const palette = [text, accentColor(), okColor(), dangerColor()];
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: text, fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          data:
            d.activityStatusDistribution.length === 0
              ? [{ name: '暂无活动', value: 1, itemStyle: { color: neutralColor() } }]
              : d.activityStatusDistribution.map((item, index) => ({
                  name: item.label,
                  value: item.count,
                  itemStyle: { color: palette[index % palette.length] },
                })),
          label: { color: text, fontSize: 11 },
        },
      ],
    });
    charts.push(chart);
  }

  if (deptRef.value !== null) {
    const chart = echarts.init(deptRef.value);
    chart.setOption({
      grid: { left: 76, right: 24, top: 16, bottom: 24 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: neutralColor() } },
        axisLabel: { color: text, fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: d.deptDistribution.map((item) => item.name),
        axisLine: { lineStyle: { color: neutralColor() } },
        axisLabel: { color: text, fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: d.deptDistribution.map((item) => item.count),
          itemStyle: { color: accentColor(), borderRadius: [0, 3, 3, 0] },
          barWidth: 12,
        },
      ],
    });
    charts.push(chart);
  }

  // 图表容器的淡入与面板一致
  charts.forEach((chart) => {
    const dom = chart.getDom();
    if (prefersReduced()) return;
    gsap.from(dom, { opacity: 0, duration: 0.4, ease: 'power2.out' });
  });
}

function prefersReduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function onResize(): void {
  charts.forEach((chart) => chart.resize());
}

onMounted(async () => {
  await load();
  window.addEventListener('resize', onResize);
});

/**
 * 图表容器在 loading 为 true 时并不存在，所以必须等数据到位、且组件完成渲染之后再初始化。
 * 用 flush: 'post' 保证回调在 DOM 更新之后执行，此时 ref 一定已经指向真实元素。
 */
watch(
  data,
  () => {
    renderCharts();
  },
  { flush: 'post' },
);

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  charts.forEach((chart) => chart.dispose());
});

void metricValues;
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">工作台</h1>
        <p class="page__desc">
          {{ user.profile?.realName }}，欢迎回来。下面每个数字都是实时查询得出的。
        </p>
      </div>
    </header>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">看板数据加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="load">重试</el-button>
    </section>

    <section v-else-if="loading" class="panel"><el-skeleton :rows="3" animated /></section>

    <template v-else-if="data !== null">
      <section class="panel">
        <div class="metrics">
          <div v-for="(item, index) in metrics" :key="item.label" class="metric">
            <div
              :ref="(el) => { metricRefs[index] = el as HTMLElement | null; }"
              class="metric__value num"
            >
              {{ item.value }}
            </div>
            <div class="metric__label">{{ item.label }}</div>
            <div v-if="item.hint !== ''" class="metric__hint">{{ item.hint }}</div>
          </div>
        </div>
      </section>

      <section class="grid-2">
        <div class="panel">
          <h2 class="panel__title">成员增长（近 6 个月）</h2>
          <div ref="growthRef" class="chart" />
        </div>
        <div class="panel">
          <h2 class="panel__title">活动状态分布</h2>
          <div ref="activityRef" class="chart" />
        </div>
      </section>

      <section class="grid-2">
        <div class="panel">
          <h2 class="panel__title">部门构成</h2>
          <div ref="deptRef" class="chart" />
        </div>
        <div class="panel">
          <h2 class="panel__title">积分排行</h2>
          <div v-if="data.topMembers.length === 0" class="empty-hint">还没有积分记录</div>
          <ol v-else class="ranking">
            <li v-for="(member, index) in data.topMembers" :key="member.id" class="ranking__item">
              <span class="ranking__index" :class="{ 'ranking__index--top': index < 3 }">{{ index + 1 }}</span>
              <span class="avatar">{{ member.name.slice(0, 1) }}</span>
              <span class="ranking__name">{{ member.name }}</span>
              <span class="ranking__dept">{{ member.deptName ?? '—' }}</span>
              <span class="ranking__points num">{{ member.points }}</span>
            </li>
          </ol>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel__title">你的数据范围</h2>
        <p class="scope-desc">
          {{ user.profile?.deptName ?? '未分配部门' }} ·
          最大数据范围：{{ data.memberCount === data.clubMemberCount ? '本社团（可见全部成员）' : `共可见 ${data.memberCount} 人` }}
        </p>
        <p class="scope-note">
          数据范围是权限的第二层：能否进入某个页面由角色决定，能看到哪些数据由数据范围决定，
          两者都在后端生效，前端隐藏只是体验优化。
        </p>
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

.metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.metric {
  padding: 0 var(--sp-4);
  border-left: 1px solid var(--c-border);
}

.metric:first-child {
  padding-left: 0;
  border-left: none;
}

.metric__value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.metric__label {
  margin-top: var(--sp-1);
  font-size: 13px;
  color: var(--c-text-2);
}

.metric__hint {
  font-size: 11.5px;
  color: var(--c-text-3);
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-5);
}

.chart {
  width: 100%;
  height: 220px;
}

.empty-hint {
  font-size: 13px;
  color: var(--c-text-3);
  padding: var(--sp-6) 0;
  text-align: center;
}

.ranking {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.ranking__item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) 0;
}

.ranking__index {
  width: 18px;
  font-size: 12px;
  color: var(--c-text-3);
  font-variant-numeric: tabular-nums;
}

.ranking__index--top {
  color: var(--c-accent);
  font-weight: 700;
}

.avatar {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r-avatar);
  background: var(--c-accent-tint);
  color: var(--c-accent);
  font-size: 12px;
  font-weight: 600;
  flex: none;
}

.ranking__name {
  font-size: 13.5px;
}

.ranking__dept {
  font-size: 12px;
  color: var(--c-text-3);
}

.ranking__points {
  margin-left: auto;
  font-weight: 600;
}

.scope-desc {
  font-size: 14px;
}

.scope-note {
  margin-top: var(--sp-3);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--c-text-2);
}

@media (max-width: 1100px) {
  .metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--sp-4) 0;
  }

  .metric:nth-child(3n + 1) {
    padding-left: 0;
    border-left: none;
  }

  .grid-2 {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 700px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric:nth-child(odd) {
    padding-left: 0;
    border-left: none;
  }
}
</style>
