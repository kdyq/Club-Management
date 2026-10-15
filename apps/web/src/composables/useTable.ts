/**
 * 表格页的统一形态（开发文档 8.5 节）。
 *
 * 项目中大量页面是「筛选 + 表格 + 分页」，把加载态、分页、筛选、刷新抽到这里，
 * 避免每个页面各写一遍。
 *
 *   const { list, total, loading, query, reload, reset } = useTable(memberApi.page, {
 *     defaultQuery: { page: 1, pageSize: 20 },
 *   });
 *
 * 列表数据放组件内、不进 Pinia——放进 store 会导致状态不同步、
 * 返回页面时看到别人的数据（开发文档 8.2 节）。
 */
import { computed, onMounted, ref, watch, type Ref } from 'vue';
import type { PageQuery, PageResult } from '@club/shared';

/** 这些字段不算「筛选条件」，只看它们判断不出一页是不是被筛空的 */
const PAGING_KEYS = new Set(['page', 'pageSize', 'sortBy', 'sortOrder']);

export interface UseTableOptions<Q extends PageQuery> {
  defaultQuery: Q;
  /** 是否在 onMounted 时立即加载，默认 true */
  immediate?: boolean;
}

export interface UseTableResult<T, Q extends PageQuery> {
  list: Ref<T[]>;
  total: Ref<number>;
  loading: Ref<boolean>;
  /** 加载失败的原因，用于列表页的「错误态」面板 */
  error: Ref<string | null>;
  query: Ref<Q>;
  /** 是否有筛选条件生效，用于区分「确实没数据」与「筛选后没有结果」 */
  hasFilter: Ref<boolean>;
  load: () => Promise<void>;
  /** 回到第一页并重新加载 */
  reload: () => Promise<void>;
  /** 清空筛选条件并重新加载 */
  reset: () => Promise<void>;
  onPageChange: (page: number) => Promise<void>;
  onPageSizeChange: (size: number) => Promise<void>;
}

export function useTable<T, Q extends PageQuery>(
  fetcher: (query: Q) => Promise<PageResult<T>>,
  options: UseTableOptions<Q>,
): UseTableResult<T, Q> {
  const list = ref([]) as Ref<T[]>;
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const query = ref({ ...options.defaultQuery }) as Ref<Q>;

  const hasFilter = computed(() =>
    Object.entries(query.value).some(([key, value]) => {
      if (PAGING_KEYS.has(key)) return false;
      if (value === undefined || value === null || value === '') return false;
      return value !== (options.defaultQuery as Record<string, unknown>)[key];
    }),
  );

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetcher(query.value);
      list.value = result.list;
      total.value = result.total;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '加载失败，请稍后重试';
      list.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  }

  async function reload(): Promise<void> {
    query.value.page = 1;
    await load();
  }

  async function reset(): Promise<void> {
    query.value = { ...options.defaultQuery };
    await load();
  }

  async function onPageChange(page: number): Promise<void> {
    query.value.page = page;
    await load();
  }

  async function onPageSizeChange(size: number): Promise<void> {
    query.value.page = 1;
    query.value.pageSize = size;
    await load();
  }

  if (options.immediate !== false) {
    onMounted(load);
  }

  // 筛选条件变化时自动回第一页重查，省掉每个页面手写 watch
  watch(
    () => JSON.stringify(query.value),
    (next, previous) => {
      if (previous === undefined) return;
      if (next === previous) return;
      const currentPage = query.value.page ?? 1;
      if (currentPage !== 1) {
        query.value.page = 1;
      }
      void load();
    },
  );

  return {
    list,
    total,
    loading,
    error,
    query,
    hasFilter,
    load,
    reload,
    reset,
    onPageChange,
    onPageSizeChange,
  };
}
