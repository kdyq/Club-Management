<script setup lang="ts">
/**
 * 场地预约。时段冲突由后端在事务里加锁判定——
 * 前端这里只是提前给个提示，真正的把关在后端。
 */
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { BookingStatus, type VenueBookingVo, type VenueVo } from '@club/shared';
import { venueApi } from '@/api/ops';
import { useUserStore } from '@/stores/user';

const user = useUserStore();
const activeTab = ref('bookings');

const venues = ref<VenueVo[]>([]);
const bookings = ref<VenueBookingVo[]>([]);
const loading = ref(false);
const venueDialog = ref(false);
const bookDialog = ref(false);
const submitting = ref(false);

const venueForm = ref({ name: '', location: '', capacity: 0, openTime: '08:00', closeTime: '22:00' });
const bookForm = ref({
  venueId: '',
  bookDate: new Date().toISOString().slice(0, 10),
  startTime: '19:00',
  endTime: '21:00',
  purpose: '',
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [v, b] = await Promise.all([
      venueApi.page(),
      venueApi.bookings({ page: 1, pageSize: 50 }),
    ]);
    venues.value = v.list;
    bookings.value = b.list;
  } catch {
    venues.value = [];
    bookings.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function onCreateVenue(): Promise<void> {
  if (venueForm.value.name.trim().length < 2) {
    ElMessage.warning('请填写场地名称');
    return;
  }
  submitting.value = true;
  try {
    await venueApi.create({ ...venueForm.value, name: venueForm.value.name.trim() });
    ElMessage.success('场地已添加');
    venueDialog.value = false;
    await load();
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

function openBook(venue: VenueVo): void {
  bookForm.value = {
    venueId: venue.id,
    bookDate: new Date().toISOString().slice(0, 10),
    startTime: '19:00',
    endTime: '21:00',
    purpose: '',
  };
  bookDialog.value = true;
}

async function onBook(): Promise<void> {
  if (bookForm.value.endTime <= bookForm.value.startTime) {
    ElMessage.warning('结束时间必须晚于开始时间');
    return;
  }
  submitting.value = true;
  try {
    await venueApi.book({
      venueId: bookForm.value.venueId,
      bookDate: bookForm.value.bookDate,
      startTime: bookForm.value.startTime,
      endTime: bookForm.value.endTime,
      purpose: bookForm.value.purpose.trim() || undefined,
    });
    ElMessage.success('预约已提交，等待审批');
    bookDialog.value = false;
    await load();
  } catch {
    // 时段冲突时后端会返回可读原因，拦截器已提示
  } finally {
    submitting.value = false;
  }
}

async function onAudit(row: VenueBookingVo, approved: boolean): Promise<void> {
  try {
    await venueApi.audit(row.id, approved);
    ElMessage.success(approved ? '已通过' : '已驳回');
    await load();
  } catch {
    // 期间被别人占用时后端会拦下来
  }
}

async function onCancel(row: VenueBookingVo): Promise<void> {
  try {
    await venueApi.cancel(row.id);
    ElMessage.success('已取消预约');
    await load();
  } catch {
    // 拦截器已提示
  }
}

const canAudit = user.hasPerm('venue:approve');
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">场地预约</h1>
        <p class="page__desc">
          时段冲突按区间重叠判定，并在事务里用行锁串行化——两个人同时约同一时段，只会有一个成功。
        </p>
      </div>
      <el-button v-perm="'venue:create'" type="primary" @click="venueDialog = true">
        <el-icon><Plus /></el-icon>
        添加场地
      </el-button>
    </header>

    <section class="panel panel--table">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="预约记录" name="bookings">
          <el-table v-loading="loading" :data="bookings">
            <el-table-column prop="venueName" label="场地" min-width="150" />
            <el-table-column label="日期" width="120">
              <template #default="{ row }"><span class="num">{{ row.bookDate }}</span></template>
            </el-table-column>
            <el-table-column label="时段" width="130">
              <template #default="{ row }"><span class="num">{{ row.startTime }} - {{ row.endTime }}</span></template>
            </el-table-column>
            <el-table-column prop="memberName" label="申请人" width="100" />
            <el-table-column label="用途" min-width="180">
              <template #default="{ row }">{{ row.purpose ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag
                  :type="row.status === BookingStatus.APPROVED ? 'success' : row.status === BookingStatus.PENDING ? 'warning' : row.status === BookingStatus.REJECTED ? 'danger' : 'info'"
                  effect="plain"
                  size="small"
                >
                  {{ row.statusLabel }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <template v-if="row.status === BookingStatus.PENDING">
                  <el-button v-if="canAudit" link type="primary" @click="onAudit(row, true)">通过</el-button>
                  <el-button v-if="canAudit" link type="danger" @click="onAudit(row, false)">驳回</el-button>
                  <el-button v-if="row.memberId === user.profile?.memberId" link @click="onCancel(row)">取消</el-button>
                </template>
                <span v-else class="muted">{{ row.approverName ? `审批人 ${row.approverName}` : '—' }}</span>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="!loading && bookings.length === 0" description="还没有预约记录" />
        </el-tab-pane>

        <el-tab-pane label="场地清单" name="venues">
          <el-table v-loading="loading" :data="venues">
            <el-table-column prop="name" label="场地" min-width="180" />
            <el-table-column prop="location" label="位置" min-width="180" />
            <el-table-column label="容纳" width="100" align="right">
              <template #default="{ row }"><span class="num">{{ row.capacity }} 人</span></template>
            </el-table-column>
            <el-table-column label="开放时段" width="150">
              <template #default="{ row }">
                <span class="num">{{ row.openTime ?? '—' }} - {{ row.closeTime ?? '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openBook(row)">预约</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="venueDialog" title="添加场地" width="480px">
      <el-form label-width="88px">
        <el-form-item label="名称" required>
          <el-input v-model="venueForm.name" maxlength="64" />
        </el-form-item>
        <el-form-item label="位置">
          <el-input v-model="venueForm.location" maxlength="128" />
        </el-form-item>
        <el-form-item label="容纳人数">
          <el-input-number v-model="venueForm.capacity" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="开放时间">
          <div class="time-row">
            <el-input v-model="venueForm.openTime" maxlength="8" style="width: 100px" />
            <span>至</span>
            <el-input v-model="venueForm.closeTime" maxlength="8" style="width: 100px" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="venueDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onCreateVenue">添加</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="bookDialog" title="预约场地" width="460px">
      <el-form label-width="88px">
        <el-form-item label="日期" required>
          <el-date-picker v-model="bookForm.bookDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="时段" required>
          <div class="time-row">
            <el-input v-model="bookForm.startTime" placeholder="19:00" style="width: 100px" />
            <span>至</span>
            <el-input v-model="bookForm.endTime" placeholder="21:00" style="width: 100px" />
          </div>
        </el-form-item>
        <el-form-item label="用途">
          <el-input v-model="bookForm.purpose" type="textarea" :rows="2" maxlength="255" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bookDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onBook">提交预约</el-button>
      </template>
    </el-dialog>
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

.panel--table {
  padding: var(--sp-3) var(--sp-3) var(--sp-4);
}

.muted {
  color: var(--c-text-3);
  font-size: 12.5px;
}

.time-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
</style>
