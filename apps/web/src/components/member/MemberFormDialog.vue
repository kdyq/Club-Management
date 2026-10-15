<script setup lang="ts">
/**
 * 成员新增 / 编辑表单。
 * 学号只在新增时可填：它是 user 表上的唯一键，改动会影响登录账号，编辑时不允许改。
 */
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  GENDER_LABEL,
  MemberPosition,
  MEMBER_POSITION_LABEL,
  MemberStatus,
  MEMBER_STATUS_LABEL,
} from '@club/shared';
import { memberApi, type CreateMemberResult, type MemberDetailVo } from '@/api/member';

const props = defineProps<{
  modelValue: boolean;
  mode: 'create' | 'edit';
  member?: MemberDetailVo | null;
  deptOptions: { id: string; name: string }[];
  roleOptions: { id: string; name: string; code: string }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const submitting = ref(false);
const initialPassword = ref<string | null>(null);

const form = ref({
  realName: '',
  studentNo: '',
  gender: 0,
  grade: '',
  major: '',
  className: '',
  phone: '',
  email: '',
  deptId: null as string | null,
  position: MemberPosition.MEMBER as number,
  status: MemberStatus.ACTIVE as number,
  isCore: false,
  roleIds: [] as string[],
});

const genderOptions = Object.entries(GENDER_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}));
const positionOptions = Object.entries(MEMBER_POSITION_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}));
const statusOptions = Object.entries(MEMBER_STATUS_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}));

const title = computed(() => (props.mode === 'create' ? '新增成员' : `编辑成员 · ${props.member?.realName ?? ''}`));

function resetForm(): void {
  initialPassword.value = null;
  const member = props.member;
  if (props.mode === 'edit' && member !== null && member !== undefined) {
    form.value = {
      realName: member.realName,
      studentNo: member.studentNo ?? '',
      gender: member.gender,
      grade: member.grade ?? '',
      major: member.major ?? '',
      className: member.className ?? '',
      phone: member.phone ?? '',
      email: member.email ?? '',
      deptId: member.deptId,
      position: member.position,
      status: member.status,
      isCore: member.isCore,
      roleIds: member.roles.map((role) => role.id),
    };
    return;
  }
  form.value = {
    realName: '',
    studentNo: '',
    gender: 0,
    grade: '',
    major: '',
    className: '',
    phone: '',
    email: '',
    deptId: null,
    position: MemberPosition.MEMBER,
    status: MemberStatus.ACTIVE,
    isCore: false,
    roleIds: [],
  };
}

watch(
  () => [props.modelValue, props.member],
  () => {
    if (props.modelValue) resetForm();
  },
  { immediate: true },
);

async function onSubmit(): Promise<void> {
  if (form.value.realName.trim() === '') {
    ElMessage.warning('请填写姓名');
    return;
  }
  if (props.mode === 'create' && form.value.studentNo.trim().length < 4) {
    ElMessage.warning('请填写学号（至少 4 位）');
    return;
  }

  submitting.value = true;
  try {
    if (props.mode === 'create') {
      const result: CreateMemberResult = await memberApi.create({
        realName: form.value.realName.trim(),
        studentNo: form.value.studentNo.trim(),
        gender: form.value.gender,
        grade: form.value.grade.trim() || undefined,
        major: form.value.major.trim() || undefined,
        className: form.value.className.trim() || undefined,
        phone: form.value.phone.trim() || undefined,
        email: form.value.email.trim() || undefined,
        deptId: form.value.deptId,
        position: form.value.position,
        isCore: form.value.isCore,
        roleIds: form.value.roleIds,
      });
      // 新建账号时把初始密码留在对话框里，方便直接转告成员
      if (result.initialPassword !== null) {
        initialPassword.value = result.initialPassword;
        emit('saved');
        return;
      }
      ElMessage.success(`已新增成员「${result.member.realName}」（复用已有账号）`);
    } else if (props.member != null) {
      await memberApi.update(props.member.id, {
        realName: form.value.realName.trim(),
        gender: form.value.gender,
        grade: form.value.grade.trim() || undefined,
        major: form.value.major.trim() || undefined,
        className: form.value.className.trim() || undefined,
        phone: form.value.phone.trim() || undefined,
        email: form.value.email.trim() || undefined,
        deptId: form.value.deptId,
        position: form.value.position,
        status: form.value.status,
        isCore: form.value.isCore,
        roleIds: form.value.roleIds,
      });
      ElMessage.success('成员信息已更新');
    }
    visible.value = false;
    emit('saved');
  } catch {
    // 全局拦截器已提示
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="620px" :close-on-click-modal="false">
    <el-form label-width="80px">
      <div class="grid">
        <el-form-item label="姓名" required>
          <el-input v-model="form.realName" maxlength="32" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="学号" :required="mode === 'create'">
          <el-input
            v-model="form.studentNo"
            maxlength="32"
            :disabled="mode === 'edit'"
            placeholder="学号即登录账号"
          />
        </el-form-item>
        <el-form-item label="性别">
          <el-select v-model="form.gender" style="width: 100%">
            <el-option v-for="opt in genderOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="年级">
          <el-input v-model="form.grade" maxlength="8" placeholder="如 2026" />
        </el-form-item>
        <el-form-item label="专业">
          <el-input v-model="form.major" maxlength="64" />
        </el-form-item>
        <el-form-item label="班级">
          <el-input v-model="form.className" maxlength="32" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" maxlength="20" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" maxlength="64" />
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="form.deptId" clearable placeholder="未分配" style="width: 100%">
            <el-option v-for="d in deptOptions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="职务">
          <el-select v-model="form.position" style="width: 100%">
            <el-option v-for="opt in positionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="mode === 'edit'" label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="核心成员">
          <el-switch v-model="form.isCore" />
        </el-form-item>
      </div>

      <el-form-item label="角色">
        <el-select v-model="form.roleIds" multiple clearable placeholder="可多选" style="width: 100%">
          <el-option v-for="r in roleOptions" :key="r.id" :label="`${r.name}（${r.code}）`" :value="r.id" />
        </el-select>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="initialPassword !== null"
      class="pwd"
      type="success"
      :closable="false"
      show-icon
      title="账号已创建"
    >
      <div>初始密码：<b class="pwd__code">{{ initialPassword }}</b></div>
      <div class="pwd__hint">请转告该成员，登录后建议尽快修改。</div>
    </el-alert>

    <template #footer>
      <el-button @click="visible = false">{{ initialPassword !== null ? '关闭' : '取消' }}</el-button>
      <el-button v-if="initialPassword === null" type="primary" :loading="submitting" @click="onSubmit">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--sp-5);
}

.pwd {
  margin-top: var(--sp-2);
}

.pwd__code {
  font-family: var(--font-mono);
  font-size: 14px;
  letter-spacing: 0.04em;
}

.pwd__hint {
  margin-top: var(--sp-1);
  font-size: 12px;
  color: var(--c-text-2);
}
</style>
