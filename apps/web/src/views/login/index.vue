<script setup lang="ts">
/**
 * 登录页。按 design/direction-a.html 的登录页实现：
 * 左侧实景照片 + 压暗层 + 品牌/文案/规模数字，右侧表单。
 *
 * 左侧的规模数字是真实查询出来的（/api/stats/public），不是写死的展示值。
 * 照片目前用原型里的占位图，换成社团自己的照片只需替换 public/img/panel-calm.jpg。
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AxiosError } from 'axios';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/http';
import { statsApi, type PublicOverviewVo } from '@/api/stats';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const route = useRoute();
const user = useUserStore();

const form = ref({ username: '', password: '', captchaCode: '' });
const captcha = ref<{ id: string; enabled: boolean }>({ id: '', enabled: false });
const remember = ref(true);
const submitting = ref(false);
const errorText = ref('');
const overview = ref<PublicOverviewVo | null>(null);

/** 图形走独立图片接口，字符不会进入页面 DOM；换一张即换 captchaId，src 随之变化 */
const captchaImageUrl = computed(() =>
  captcha.value.id === '' ? '' : `/api/auth/captcha/${captcha.value.id}/image`,
);

const stats = computed(() => {
  const o = overview.value;
  return [
    { value: o?.memberCount ?? 0, label: '在册成员' },
    { value: o?.deptCount ?? 0, label: '下设部门' },
    { value: o?.foundedYear !== null && o?.foundedYear !== undefined ? o.foundedYear : '—', label: '成立年份' },
  ];
});

async function loadCaptcha(): Promise<void> {
  try {
    const result = await authApi.captcha();
    captcha.value = { id: result.captchaId, enabled: result.enabled };
    form.value.captchaCode = '';
  } catch {
    // 验证码拿不到时留空，提交时后端会给出明确提示
  }
}

onMounted(async () => {
  await Promise.all([
    loadCaptcha(),
    statsApi.public().then((data) => {
      overview.value = data;
    }).catch(() => undefined),
  ]);
});

async function onSubmit(): Promise<void> {
  errorText.value = '';

  if (form.value.username.trim() === '' || form.value.password === '') {
    errorText.value = '账号和密码不能为空。';
    return;
  }
  if (captcha.value.enabled && form.value.captchaCode.trim() === '') {
    errorText.value = '请输入图形验证码。';
    return;
  }

  submitting.value = true;
  try {
    await user.login({
      username: form.value.username.trim(),
      password: form.value.password,
      captchaId: captcha.value.id,
      captchaCode: form.value.captchaCode.trim(),
    });

    const redirect = route.query.redirect;
    await router.replace(typeof redirect === 'string' && redirect !== '' ? redirect : '/dashboard');
  } catch (error) {
    // 登录失败的原因要留在表单里，不要弹全局 toast——用户正准备改输入
    if (error instanceof ApiError || error instanceof AxiosError) {
      errorText.value = (error as ApiError).message ?? '登录失败，请稍后重试。';
    } else {
      errorText.value = '登录失败，请稍后重试。';
    }
    await loadCaptcha();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login">
    <div class="login__aside">
      <img class="login__photo" src="/img/panel-calm.jpg" alt="" fetchpriority="high" />
      <div class="login__scrim"></div>
      <div class="login__aside-inner">
        <div class="login__brand">
          <span class="login__brand-mark">星</span>
          <span>{{ overview?.clubName ?? '星野天文社' }}</span>
        </div>

        <div class="login__aside-copy">
          <h2 class="login__aside-title">成员、活动、经费，一处管理。</h2>
          <p class="login__aside-desc">
            面向社团干部的日常工作台，覆盖成员档案、活动报名、签到与财务流水。
          </p>
        </div>

        <div class="login__stats">
          <div v-for="item in stats" :key="item.label">
            <div class="login__stat-value num">{{ item.value }}</div>
            <div class="login__stat-label">{{ item.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="login__main">
      <form class="login__form" novalidate @submit.prevent="onSubmit">
        <h1 class="login__title">登录</h1>
        <p class="login__subtitle">使用学号进入管理后台</p>

        <div class="login__fields">
          <label class="field">
            <span class="field__label">账号</span>
            <input
              v-model="form.username"
              class="input"
              type="text"
              placeholder="请输入学号"
              autocomplete="username"
            />
          </label>

          <label class="field">
            <span class="field__label">密码</span>
            <input
              v-model="form.password"
              class="input"
              type="password"
              placeholder="请输入登录密码"
              autocomplete="current-password"
            />
          </label>

          <label v-if="captcha.enabled" class="field">
            <span class="field__label">验证码</span>
            <span class="captcha">
              <input
                v-model="form.captchaCode"
                class="input captcha__input"
                type="text"
                placeholder="图中字符"
                maxlength="8"
                autocomplete="off"
              />
              <button
                class="captcha__img"
                type="button"
                title="点击换一张"
                aria-label="点击换一张验证码"
                @click="loadCaptcha"
              >
                <img v-if="captchaImageUrl !== ''" :src="captchaImageUrl" alt="" />
              </button>
            </span>
          </label>
        </div>

        <p v-if="errorText !== ''" class="login__error">
          <el-icon><WarningFilled /></el-icon>
          <span>{{ errorText }}</span>
        </p>

        <div class="login__row">
          <label class="check">
            <input v-model="remember" type="checkbox" />
            <span>保持登录状态</span>
          </label>
          <span class="login__forgot">忘记密码请联系社长</span>
        </div>

        <button class="btn-primary login__submit" type="submit" :disabled="submitting">
          {{ submitting ? '登录中…' : '登录' }}
        </button>

        <p class="login__hint">还没有账号？联系社长在成员管理中开通。</p>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(420px, 0.85fr);
  min-height: 100dvh;
}

/* ---------- 左侧照片区 ---------- */
.login__aside {
  position: relative;
  overflow: hidden;
  background: var(--c-photo-fallback);
}

.login__photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 压暗层：保证白字在浅色照片上也有 4.5:1 以上对比 */
.login__scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim-photo);
}

.login__aside-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: var(--sp-12) var(--sp-8);
  color: var(--c-on-photo);
}

.login__brand {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  font-size: 14px;
  font-weight: 600;
}

.login__brand-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--r-control);
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-size: 13px;
  font-weight: 700;
}

.login__aside-copy {
  max-width: 22em;
}

.login__aside-title {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.28;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.login__aside-desc {
  margin-top: var(--sp-3);
  font-size: 14px;
  line-height: 1.7;
  color: var(--c-on-photo-soft);
}

.login__stats {
  display: flex;
  gap: var(--sp-8);
  padding-top: var(--sp-6);
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}

.login__stat-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.login__stat-label {
  margin-top: 2px;
  font-size: 12px;
  color: var(--c-on-photo-faint);
}

/* ---------- 右侧表单区 ---------- */
.login__main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--sp-12) var(--sp-8);
  background: var(--c-surface);
}

.login__form {
  width: 100%;
  max-width: 372px;
  margin: 0 auto;
}

.login__title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.login__subtitle {
  margin-top: var(--sp-2);
  margin-bottom: var(--sp-8);
  font-size: 13px;
  color: var(--c-text-2);
}

.login__fields {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.field__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--c-text-2);
}

.input {
  height: 38px;
  padding: 0 var(--sp-3);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--r-control);
  background: var(--c-surface);
  color: var(--c-text);
  font-family: var(--font-ui);
  font-size: 14px;
  outline: none;
}

.input::placeholder {
  color: var(--c-text-3);
}

.input:focus-visible {
  border-color: var(--c-accent);
  outline: 2px solid var(--c-accent-ring);
  outline-offset: 1px;
}

.captcha {
  display: flex;
  gap: var(--sp-2);
  align-items: stretch;
}

.captcha__input {
  flex: 1;
  min-width: 0;
}

.captcha__img {
  display: grid;
  place-items: center;
  width: 120px;
  padding: 0;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--r-control);
  background: var(--c-surface-sunken);
  cursor: pointer;
  overflow: hidden;
}

.captcha__img img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-text-2);
  cursor: pointer;
}

.check input {
  width: 15px;
  height: 15px;
  accent-color: var(--c-accent);
  cursor: pointer;
}

.login__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--sp-5);
  font-size: 13px;
}

.login__forgot {
  color: var(--c-text-3);
  font-size: 12.5px;
}

.login__error {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-start;
  margin-top: var(--sp-4);
  padding: var(--sp-3);
  border-radius: var(--r-control);
  background: var(--c-danger-tint);
  color: var(--c-danger);
  font-size: 12.5px;
  line-height: 1.55;
}

.btn-primary {
  width: 100%;
  height: 42px;
  margin-top: var(--sp-6);
  border: none;
  border-radius: var(--r-control);
  background: var(--c-accent);
  color: var(--c-on-accent);
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--c-accent-hover);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login__hint {
  margin-top: var(--sp-5);
  font-size: 12.5px;
  color: var(--c-text-2);
  text-align: center;
}

/* ---------- 响应式：窄屏只留表单 ---------- */
@media (max-width: 900px) {
  .login {
    grid-template-columns: minmax(0, 1fr);
  }

  .login__aside {
    display: none;
  }

  .login__main {
    padding: var(--sp-8) var(--sp-5);
  }
}
</style>
