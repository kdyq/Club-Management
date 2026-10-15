/**
 * @club/shared —— 前后端共享层
 *
 * 这里的东西只写一份，后端用它做校验与赋值，前端用它做渲染与中文映射。
 * 状态字段在数据库里是 Int，取值的唯一真相就在本包（开发文档 6.2 与 10 章）。
 *
 * 注意：本包是 ESM，相对导入必须带 .js 扩展名。
 */

export * from './enums/index.js';
export * from './constants/index.js';
export * from './types/index.js';

export const SHARED_VERSION = '0.1.0';
