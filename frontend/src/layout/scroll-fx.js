// «Важкі» ефекти прокручування. Файл завантажується окремо (import() після першого малювання),
// тому перший показ сторінки від нього не залежить.
// - Lenis: легка плавна прокрутка (lerp 0.1). Під нею звичайна прокрутка браузера, тож клавіатура,
//   якорі й пошук на сторінці працюють як завжди. Коли фокус у полі форми — Lenis вимикається.
// - Закріплена розповідь у 4 кроки (ідея santalarch): одна шкала GSAP, прокрутка керує нею.
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { splitWords } from './reveal.js'
import { setLenis } from './scroll-to.js'

gsap.registerPlugin(ScrollTrigger)

let lenis = null
let ctx = null
let media = null
let contoursRef = null
const FIELD = 'input, select, textarea, [contenteditable="true"]'

// GSAP має власний таймер (ticker, ~60 разів на секунду). Lenis рахує плавну прокрутку в ньому ж,
// тому прокрутка й анімації ScrollTrigger оновлюються в одному кадрі і не «розʼїжджаються».
function lenisTick(time) {
  lenis?.raf(time * 1000)
}

function createLenis() {
  if (lenis) return
  lenis = new Lenis({ lerp: 0.1, autoRaf: false, smoothWheel: true, syncTouch: false })
  lenis.on('scroll', ScrollTrigger.update)
  setLenis(lenis)
}
function destroyLenis() {
  if (!lenis) return
  lenis.destroy()
  lenis = null
  setLenis(null)
}

// Фокус у полі форми (пошук у каталозі тощо): звичайна прокрутка без згладжування
function onFocusIn(event) {
  if (event.target.matches?.(FIELD)) destroyLenis()
}
function onFocusOut(event) {
  if (event.target.matches?.(FIELD)) setTimeout(() => {
    if (!document.activeElement?.matches?.(FIELD) && ctx) createLenis()
  }, 0)
}
// Меню на весь екран відкрите — сторінка під ним не повинна прокручуватись
function onMenu(event) {
  if (!lenis) return
  if (event.detail.open) lenis.stop()
  else lenis.start()
}

/** Закріплена розповідь: 4 кроки на ~4 екрани прокрутки. Висота секції = тривалість шкали × висота екрана. */
function story() {
  const section = document.querySelector('[data-story]')
  if (!section) return
  media = gsap.matchMedia()
  media.add('(min-width: 768px)', () => {
    const steps = [...section.querySelectorAll('.story-step')]
    const counter = section.querySelector('[data-story-count]')
    const bar = section.querySelector('.story-bar i')
    section.classList.add('is-pinned')
    contoursRef?.refreshBands()
    let active = -1
    const setActive = (index) => {
      if (index === active) return
      const previous = steps[active]
      if (previous) {
        previous.classList.add('is-out')
        previous.classList.remove('is-in')
        const old = previous
        setTimeout(() => { if (steps[active] !== old) old.classList.remove('is-active', 'is-out') }, 300)
      }
      active = index
      const step = steps[index]
      step.classList.remove('is-out')
      step.classList.add('is-active')
      requestAnimationFrame(() => requestAnimationFrame(() => step.classList.add('is-in')))
      counter.textContent = String(index + 1).padStart(2, '0')
    }
    // Слова кроків ділимо один раз і не повертаємо (вони з'являються щоразу при зміні кроку)
    for (const node of section.querySelectorAll('.story-step [data-reveal]')) splitWords(node)
    // Обриси «малюються»: довжина штриха = довжина фігури, зсув штриха від повного до нуля
    const timeline = gsap.timeline({ defaults: { ease: 'none' } })
    steps.forEach((step, index) => {
      const shapes = [...step.querySelectorAll('.story-art > *')]
      for (const shape of shapes) {
        const length = shape.getTotalLength()
        gsap.set(shape, { strokeDasharray: length, strokeDashoffset: length })
      }
      timeline.to(shapes, { strokeDashoffset: 0, duration: 0.7, stagger: 0.6 / Math.max(1, shapes.length) }, index + 0.05)
    })
    timeline.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 4 }, 0)
    setActive(0)
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${innerHeight * timeline.duration()}`,
      pin: true,
      // Закріплення зсувом (transform), а не position: fixed: перемикання fixed <-> звичайне Chrome рахує як
      // зсув макета (CLS ~0,66 на кожному вході й виході). Lenis і ScrollTrigger оновлюються в одному кадрі, тож без тремтіння
      pinType: 'transform',
      scrub: 0.4,
      animation: timeline,
      invalidateOnRefresh: true,
      onUpdate: (self) => setActive(Math.min(steps.length - 1, Math.floor(self.progress * steps.length * 0.999))),
    })
    return () => {
      trigger.kill()
      section.classList.remove('is-pinned')
      for (const step of steps) step.classList.remove('is-active', 'is-in', 'is-out')
      contoursRef?.refreshBands()
    }
  })
}

/** Запуск (рух увімкнено). contours — пульт фонового шейдера (може бути null). */
export function startScrollFx({ contours = null, smooth = true } = {}) {
  if (ctx) return
  contoursRef = contours
  ctx = gsap.context(() => {
    story()
  })
  gsap.ticker.lagSmoothing(0)
  gsap.ticker.add(lenisTick)
  // Фон малюємо в тому самому кадрі після Lenis, тоді межі смуг не відстають від прокрутки
  contours?.useTicker((fn) => gsap.ticker.add(fn), (fn) => gsap.ticker.remove(fn))
  if (smooth && !document.activeElement?.matches?.(FIELD)) createLenis()
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  window.addEventListener('omni:menu', onMenu)
  // Шрифти й дані з API змінюють висоту сторінки: перераховуємо позиції тригерів
  document.fonts?.ready.then(() => ScrollTrigger.refresh())
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true })
}

/** Зупинка (рух вимкнули перемикачем): усе повертається до звичайного вигляду. */
export function stopScrollFx() {
  if (!ctx) return
  destroyLenis()
  media?.revert()
  media = null
  ctx.revert()
  ctx = null
  gsap.ticker.remove(lenisTick)
  contoursRef?.useTicker(null, (fn) => gsap.ticker.remove(fn))
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('focusout', onFocusOut)
  window.removeEventListener('omni:menu', onMenu)
}

/** Перерахувати позиції (наприклад, після завантаження даних з API). */
export function refreshScroll() {
  ScrollTrigger.refresh()
}
