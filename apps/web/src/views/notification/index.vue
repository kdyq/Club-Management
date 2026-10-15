<script setup lang="ts">
/** 站内信收件箱。本项目只做站内信，不接邮件与群机器人。 */
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { NOTIFICATION_TYPE_LABEL, type NotificationType } from '@club/shared';
import { noticeApi } from '@/api/ops';

const loading = ref(true);
const list = ref<{ id: string; title: string; content: string; type: number; isRead: boolean; createdAt: string }[]>([]);
const unread = ref(0);
const total = ref(0);
const onlyUnread = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await noticeApi.inbox({ onlyUnread: onlyUnread.value, page: 1, pageSize: 50 });
    list.value = result.list;
    unread.value = result.unread;
    total.value = result.total;
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function onRead(id: string): Promise<void> {
  await noticeApi.markRead(id);
  await load();
}

async function onReadAll(): Promise<void> {
  const result = await noticeApi.markAllRead();
  ElMessage.success(`已把 ${result.count} 条标记为已读`);
  await load();
}
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">站内信</h1>
        <p class="page__desc">
          共 {{ total }} 条，未读 {{ unread }} 条。通知只走站内信渠道，活动提醒、审批结果、催缴都会落到这里。
        </p>
      </div>
      <div class="page__actions">
        <el-checkbox v-model="onlyUnread" @change="load">只看未读</el-checkbox>
        <el-button v-if="unread > 0" @click="onReadAll">全部已读</el-button>
      </div>
    </header>

    <section v-if="loading" class="panel"><el-skeleton :rows="5" animated /></section>

    <section v-else-if="list.length === 0" class="panel panel--empty">
      <el-empty :description="onlyUnread ? '没有未读的站内信' : '收件箱是空的'" />
    </section>

    <section v-else class="panel panel--list">
      <article
        v-for="item in list"
        :key="item.id"
        class="item"
        :class="{ 'item--unread': !item.isRead }"
      >
        <div class="item__head">
          <span class="item__dot" />
          <span class="item__title">{{ item.title }}</span>
          <el-tag size="small" effect="plain">{{ NOTIFICATION_TYPE_LABEL[item.type as NotificationType] ?? '系统' }}</el-tag>
          <span class="item__time num">{{ new Date(item.createdAt).toLocaleString('zh-CN') }}</span>
        </div>
        <p class="item__content">{{ item.content }}</p>
        <div v-if="!item.isRead" class="item__actions">
          <el-button link type="primary" @click="onRead(item.id)">标记已读</el-button>
        </div>
      </article>
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

.page__actions {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  flex: none;
}

.panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-container);
  box-shadow: var(--shadow-panel);
  padding: var(--sp-5);
}

.panel--empty {
  padding: var(--sp-8);
}

.panel--list {
  padding: var(--sp-2) var(--sp-5);
}

.item {
  padding: var(--sp-4) 0;
  border-bottom: 1px solid var(--c-border);
}

.item:last-child {
  border-bottom: none;
}

.item__head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.item__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
  flex: none;
}

.item--unread .item__dot {
  background: var(--c-accent);
}

.item__title {
  font-size: 14px;
  font-weight: 500;
}

.item--unread .item__title {
  font-weight: 600;
}

.item__time {
  margin-left: auto;
  font-size: 12px;
  color: var(--c-text-3);
}

.item__content {
  margin-top: var(--sp-2);
  padding-left: calc(6px + var(--sp-3));
  font-size: 13px;
  line-height: 1.7;
  color: var(--c-text-2);
}

.item__actions {
  padding-left: calc(6px + var(--sp-3));
  margin-top: var(--sp-1);
}
</style>
