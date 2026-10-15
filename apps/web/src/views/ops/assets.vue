<script setup lang="ts">
/**
 * 物资与借还。可借数量是缓存字段，借出/归还都会动它，也能被对账重算。
 * 这里没有「删除物资」按钮：已借出的器材不能被删，只能停用。
 */
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { AssetBorrowStatus, type AssetBorrowVo, type AssetVo } from '@club/shared';
import { assetApi } from '@/api/ops';
import { memberApi } from '@/api/member';
import { useUserStore } from '@/stores/user';

const user = useUserStore();
const activeTab = ref('assets');

// ---------- 物资 ----------
const assets = ref<AssetVo[]>([]);
const assetLoading = ref(false);
const assetKeyword = ref('');
const assetDialog = ref(false);
const submitting = ref(false);
const assetForm = ref({
  name: '',
  code: '',
  category: '',
  spec: '',
  unit: '个',
  totalQty: 1,
  location: '',
});

async function loadAssets(): Promise<void> {
  assetLoading.value = true;
  try {
    const result = await assetApi.page({ keyword: assetKeyword.value || undefined });
    assets.value = result.list;
  } catch {
    assets.value = [];
  } finally {
    assetLoading.value = false;
  }
}

// ---------- 借还 ----------
const borrows = ref<AssetBorrowVo[]>([]);
const borrowLoading = ref(false);
const borrowDialog = ref(false);
const borrowForm = ref({ assetId: '', qty: 1, expectReturnTime: '', remark: '' });

async function loadBorrows(): Promise<void> {
  borrowLoading.value = true;
  try {
    const result = await assetApi.borrows({ page: 1, pageSize: 50 });
    borrows.value = result.list;
  } catch {
    borrows.value = [];
  } finally {
    borrowLoading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadAssets(), loadBorrows()]);
});

async function onCreateAsset(): Promise<void> {
  if (assetForm.value.name.trim().length < 2) {
    ElMessage.warning('请填写物资名称');
    return;
  }
  submitting.value = true;
  try {
    await assetApi.create({
      name: assetForm.value.name.trim(),
      code: assetForm.value.code.trim() || undefined,
      category: assetForm.value.category.trim() || undefined,
      spec: assetForm.value.spec.trim() || undefined,
      unit: assetForm.value.unit.trim() || undefined,
      totalQty: assetForm.value.totalQty,
      location: assetForm.value.location.trim() || undefined,
    });
    ElMessage.success('物资已入库');
    assetDialog.value = false;
    await loadAssets();
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

function openBorrow(asset: AssetVo): void {
  if (asset.availableQty <= 0) {
    ElMessage.warning(`「${asset.name}」当前没有可借的了`);
    return;
  }
  borrowForm.value = {
    assetId: asset.id,
    qty: 1,
    expectReturnTime: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
    remark: '',
  };
  borrowDialog.value = true;
}

async function onBorrow(): Promise<void> {
  submitting.value = true;
  try {
    await assetApi.borrow({
      assetId: borrowForm.value.assetId,
      qty: borrowForm.value.qty,
      expectReturnTime: borrowForm.value.expectReturnTime || undefined,
      remark: borrowForm.value.remark.trim() || undefined,
    });
    ElMessage.success('借出成功，请按时归还');
    borrowDialog.value = false;
    await Promise.all([loadAssets(), loadBorrows()]);
  } catch {
    // 拦截器已提示（库存不足等）
  } finally {
    submitting.value = false;
  }
}

async function onReturn(row: AssetBorrowVo): Promise<void> {
  try {
    await assetApi.returnAsset(row.id);
    ElMessage.success(`已归还「${row.assetName}」`);
    await Promise.all([loadAssets(), loadBorrows()]);
  } catch {
    // 拦截器已提示
  }
}

const borrowedAssetName = ref('');
void borrowedAssetName;
void memberApi;
void user;
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">物资管理</h1>
        <p class="page__desc">
          可借数量由借还记录驱动，不是手工填的；发现对不上可以在「数据对账」里按借还表重算。
        </p>
      </div>
      <el-button v-perm="'asset:create'" type="primary" @click="assetDialog = true">
        <el-icon><Plus /></el-icon>
        物资入库
      </el-button>
    </header>

    <section class="panel panel--table">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="物资清单" name="assets">
          <div class="tab-head">
            <el-input v-model="assetKeyword" class="filter" placeholder="搜索物资" clearable @keyup.enter="loadAssets" @clear="loadAssets" />
            <el-button @click="loadAssets">查询</el-button>
          </div>

          <el-table v-loading="assetLoading" :data="assets">
            <el-table-column label="物资" min-width="220">
              <template #default="{ row }">
                <div class="cell-title">{{ row.name }}</div>
                <div class="cell-sub">
                  {{ [row.code, row.category, row.spec].filter(Boolean).join(' · ') || '—' }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="总数" width="90" align="right">
              <template #default="{ row }">
                <span class="num">{{ row.totalQty }}{{ row.unit ?? '' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="可借" width="90" align="right">
              <template #default="{ row }">
                <span class="num" :class="{ 'qty--zero': row.availableQty === 0 }">
                  {{ row.availableQty }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="在借" width="90" align="right">
              <template #default="{ row }"><span class="num">{{ row.borrowedQty }}</span></template>
            </el-table-column>
            <el-table-column label="存放位置" min-width="140">
              <template #default="{ row }">{{ row.location ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  :disabled="row.availableQty <= 0"
                  @click="openBorrow(row)"
                >
                  借用
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="!assetLoading && assets.length === 0" description="还没有登记物资" />
        </el-tab-pane>

        <el-tab-pane label="借还记录" name="borrows">
          <el-table v-loading="borrowLoading" :data="borrows">
            <el-table-column prop="assetName" label="物资" min-width="180" />
            <el-table-column prop="memberName" label="借用人" width="110" />
            <el-table-column label="数量" width="80" align="right">
              <template #default="{ row }"><span class="num">{{ row.qty }}</span></template>
            </el-table-column>
            <el-table-column label="借出时间" width="170">
              <template #default="{ row }"><span class="num">{{ new Date(row.borrowTime).toLocaleString('zh-CN') }}</span></template>
            </el-table-column>
            <el-table-column label="应归还" width="120">
              <template #default="{ row }">
                <span class="num">{{ row.expectReturnTime ? new Date(row.expectReturnTime).toLocaleDateString('zh-CN') : '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag
                  :type="row.status === AssetBorrowStatus.RETURNED ? 'success' : row.status === AssetBorrowStatus.OVERDUE ? 'danger' : 'warning'"
                  effect="plain"
                  size="small"
                >
                  {{ row.statusLabel }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.status !== AssetBorrowStatus.RETURNED"
                  link
                  type="primary"
                  @click="onReturn(row)"
                >
                  归还
                </el-button>
                <span v-else class="muted">已归还</span>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="!borrowLoading && borrows.length === 0" description="还没有借还记录" />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="assetDialog" title="物资入库" width="520px">
      <el-form label-width="88px">
        <el-form-item label="名称" required>
          <el-input v-model="assetForm.name" maxlength="64" placeholder="如：星特朗 130EQ 天文望远镜" />
        </el-form-item>
        <el-form-item label="编号">
          <el-input v-model="assetForm.code" maxlength="32" placeholder="如：XYAS-EQ-006" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="assetForm.category" maxlength="32" placeholder="如：观测器材" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="assetForm.spec" maxlength="64" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="assetForm.unit" maxlength="16" style="width: 120px" />
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="assetForm.totalQty" :min="1" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="存放位置">
          <el-input v-model="assetForm.location" maxlength="64" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assetDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onCreateAsset">入库</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="borrowDialog" title="借用物资" width="460px">
      <el-form label-width="88px">
        <el-form-item label="数量" required>
          <el-input-number v-model="borrowForm.qty" :min="1" :max="99" controls-position="right" />
        </el-form-item>
        <el-form-item label="预计归还">
          <el-date-picker v-model="borrowForm.expectReturnTime" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="borrowForm.remark" type="textarea" :rows="2" maxlength="255" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="borrowDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onBorrow">确认借用</el-button>
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

.tab-head {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  padding: var(--sp-2) var(--sp-2) var(--sp-3);
}

.filter {
  width: 240px;
}

.cell-title {
  font-weight: 500;
}

.cell-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--c-text-3);
}

.qty--zero {
  color: var(--c-danger);
  font-weight: 600;
}

.muted {
  color: var(--c-text-3);
  font-size: 12.5px;
}
</style>
