/** 统一响应体与分页类型，前后端共用（开发文档 7.2 / 8.3 节）。 */

/** 成功响应。业务代码里不要手动拼这一层，全局拦截器会包。 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
}

/** 分页响应体里的 data 部分 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 分页请求的公共参数 */
export interface PageQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
/** 单页上限，防止前端传个 100000 把库拖死 */
export const MAX_PAGE_SIZE = 200;

/** 把可能缺省的分页参数补成确定值，并夹住上限 */
export function normalizePage(query: PageQuery): Required<Pick<PageQuery, 'page' | 'pageSize'>> {
  const page = Math.max(DEFAULT_PAGE, Math.trunc(query.page ?? DEFAULT_PAGE));
  const rawSize = Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { page, pageSize };
}

/** 生成跳过多少行，配合 take 使用 */
export function skipOf(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** 异步任务的通用状态，长任务（导入、导出）用 */
export interface AsyncTaskResult {
  taskId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  message?: string;
}
