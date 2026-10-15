/**
 * 动效组合式函数（开发文档 8.6 节）。
 *
 * 全站只允许三处动效，每个都要能一句话说明动机：
 * 1. 数字指标进入视口时数字增长 —— 让读数像刚算出来，而不是静态贴图
 * 2. 面板容器首次渲染时错峰淡入 —— 建立阅读顺序，引导视线
 * 3. 经费趋势线滚入视口时按路径绘制 —— 叙事：把这段时间的支出读出来
 *
 * 硬性约束：只动 transform 与 opacity；不用 window.addEventListener('scroll')，
 * 滚动相关一律用 ScrollTrigger；命中 prefers-reduced-motion 时全部折叠为静态。
 */
import { onMounted, onUnmounted, type Ref } from 'vue';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 面板错峰淡入。动机：一屏上有多块面板时，按顺序出现能让视线有落点，
 * 一次性全部出现反而看不出主次。
 */
export function useStaggeredPanels(selector = '.panel'): void {
  let ctx: gsap.Context | null = null;

  onMounted(() => {
    if (prefersReducedMotion()) return;
    const targets = gsap.utils.toArray<HTMLElement>(selector);
    if (targets.length === 0) return;

    ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y: 8,
        duration: 0.36,
        ease: 'power2.out',
        stagger: 0.07,
        clearProps: 'transform',
      });
    });
  });

  onUnmounted(() => {
    ctx?.revert();
  });
}

/**
 * 数字增长。动机：指标刚被算出来时有个短促的增长过程，
 * 读起来是「数据」而不是「图片」。命中 reduced-motion 时直接显示终值。
 */
export function useCountUp(
  elementRef: Ref<HTMLElement | null>,
  value: Ref<number>,
  options: { duration?: number; decimals?: number } = {},
): void {
  const duration = options.duration ?? 0.8;
  const decimals = options.decimals ?? 0;
  let tween: gsap.core.Tween | null = null;

  const render = (current: number): void => {
    const el = elementRef.value;
    if (el === null) return;
    el.textContent = current.toFixed(decimals);
  };

  const animate = (target: number): void => {
    const el = elementRef.value;
    if (el === null) return;
    if (prefersReducedMotion()) {
      render(target);
      return;
    }
    tween?.kill();
    const proxy = { value: 0 };
    tween = gsap.to(proxy, {
      value: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => render(proxy.value),
    });
  };

  onMounted(() => {
    const el = elementRef.value;
    if (el === null) return;
    if (prefersReducedMotion()) {
      render(value.value);
      return;
    }
    // 进入视口才开始增长，避免数字在用户没看到时就跑完了
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => animate(value.value),
    });
    render(0);
  });

  onUnmounted(() => {
    tween?.kill();
  });
}

export { gsap, ScrollTrigger };
