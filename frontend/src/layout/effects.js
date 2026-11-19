// Візуальні ефекти сайту. Усе це прикраси: сторінка працює й читається без них.
// Режими сторінки (ставить скрипт у <head>, див. html[data-mode]):
//   full  — публічні сторінки: заставка, живе тло, сітка, смужка прокручування, курсор, стрічки, плавна прокрутка;
//   calm  — кошик, оформлення, вхід, кабінет: лише тло, поява тексту й шторка між сторінками;
//   admin — нічого зайвого (таблиці мають бути швидкими).
// Рух вимикається перемикачем «Рух» або системним «Зменшити рух»: тоді все показується одразу і нерухомо.
// Перемикач змінює лише те, що буде далі: нічого не програється повторно.
//
// Легкі частини виконуються одразу, а WebGL-тло та GSAP + Lenis завантажуються окремими файлами пізніше.
import { el } from '../ui/dom.js'
import { motionOn, pageMode, isDesktopPointer } from './motion.js'
import { holdRevealsUntil, revealIn, revealAllNow, riseIn } from './reveal.js'
import { runIntro } from './intro.js'
import { initSnakes } from './snake.js'

const root = document.documentElement
const isSmall = () => matchMedia('(max-width: 767px)').matches
let contours = null
let scrollFx = null
let mode = 'full'
let revealReady = Promise.resolve()

/** Сітка з 5 тонких вертикальних ліній (santalarch). */
function initGridLines() {
  const grid = el('div', { class: 'grid-lines', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'), el('i'), el('i'))
  document.body.append(grid)
  return grid
}

/** Смужка прокручування справа (lusion): з'являється лише під час прокрутки, бігунок = 20 % доріжки. */
function initRail() {
  const thumb = el('i')
  const rail = el('div', { class: 'rail', 'aria-hidden': 'true' }, thumb)
  document.body.append(rail)
  let hideTimer = 0
  let queued = false
  let lastY = scrollY
  const update = () => {
    queued = false
    const max = document.documentElement.scrollHeight - innerHeight
    rail.style.setProperty('--p', max > 0 ? Math.min(1, Math.max(0, scrollY / max)).toFixed(4) : 0)
    const middle = innerHeight / 2
    const over = [...document.querySelectorAll('[data-tone="invert"]')].some((node) => {
      const box = node.getBoundingClientRect()
      return box.top <= middle && box.bottom >= middle
    })
    rail.classList.toggle('over-invert', over)
    if (Math.abs(scrollY - lastY) > 0.5) {
      rail.classList.add('is-on')
      clearTimeout(hideTimer)
      hideTimer = setTimeout(() => rail.classList.remove('is-on'), 700)
    }
    lastY = scrollY
  }
  addEventListener('scroll', () => {
    if (!queued) {
      queued = true
      requestAnimationFrame(update)
    }
  }, { passive: true })
  update()
}

// ---------- Курсор-крапка: замінює системну стрілку (лише миша, великий екран, рух увімкнено) ----------
let cursorDot = null
const INTERACTIVE = 'a, button, [role="button"], summary, label, input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"]'
const FIELDS = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="range"]), textarea, select, [contenteditable="true"]'
const cursorAllowed = () => mode === 'full' && motionOn() && isDesktopPointer()

function initCursor() {
  if (!cursorAllowed()) return
  root.classList.add('dot-cursor')
  if (cursorDot) return
  cursorDot = el('div', { class: 'cursor', 'aria-hidden': 'true' }, el('i'))
  document.body.append(cursorDot)
  addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return
    cursorDot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`
    cursorDot.classList.add('is-on')
  }, { passive: true })
  document.addEventListener('pointerover', (event) => {
    const target = event.target
    // У текстовому полі — системний курсор, крапка ховається
    cursorDot.classList.toggle('is-field', Boolean(target.closest?.(FIELDS)))
    cursorDot.classList.toggle('is-big', Boolean(target.closest?.(INTERACTIVE)))
  })
  root.addEventListener('pointerleave', () => cursorDot.classList.remove('is-on'))
  // Модальні вікна (<dialog>, меню) показуються в «верхньому шарі» над усією сторінкою.
  // Щоб крапку було видно й над ними, переносимо її всередину відкритого вікна, а після закриття — назад
  const follow = () => {
    let layers = [...document.querySelectorAll('dialog[open]')]
    // Відкритий випадний список (popover) теж у верхньому шарі — крапка має бути над ним
    try { layers = layers.concat([...document.querySelectorAll(':popover-open')]) } catch { /* старий браузер */ }
    const open = layers.at(-1) ?? document.body
    if (cursorDot.parentNode !== open) open.append(cursorDot)
  }
  document.addEventListener('omni:toplayer', follow)
  if ('MutationObserver' in window) new MutationObserver(follow).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
}

/** Екран став ширшим/вужчим або з'явилась/зникла миша: вмикаємо або прибираємо крапку. */
function watchCursorMedia() {
  matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').addEventListener?.('change', (event) => {
    if (event.matches && motionOn()) initCursor()
    else root.classList.remove('dot-cursor')
  })
}

/**
 * Каталог (ідея santalarch, але за часом, а не прокруткою): коли сітка з'являється в екрані й після кожного
 * пошуку чи фільтра картки «заходять» колонками — кожна колонка з власного зсуву й трохи пізніше за попередню.
 * Web Animations API з fill: 'backwards': якщо анімація не запуститься, картки просто видно.
 */
function initCatalogEntrance() {
  // Без IntersectionObserver / MutationObserver — картки просто видно, без входу
  if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) return
  const OFFSETS = [48, 120, 80, 150]
  for (const grid of document.querySelectorAll('[data-stagger-grid]')) {
    let pending = true
    const play = () => {
      const cards = [...grid.children].filter((card) => card.matches('article'))
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
      cards.forEach((card, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        card.animate?.([
          { transform: `translateY(${OFFSETS[column % OFFSETS.length]}px)`, opacity: 0 },
          { transform: 'none', opacity: 1 },
        ], { duration: 950, delay: column * 90 + row * 70, easing: 'cubic-bezier(.25, 1, .5, 1)', fill: 'backwards' })
      })
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || !pending || !motionOn()) return
      if (!grid.querySelector(':scope > article')) return
      pending = false
      revealReady.then(play)
    }, { threshold: 0.02 })
    observer.observe(grid)
    // Нові картки (пошук, фільтр, сторінка) — знову чекаємо видимості й граємо вхід
    new MutationObserver(() => {
      pending = true
      observer.unobserve(grid)
      observer.observe(grid)
    }).observe(grid, { childList: true })
  }
}

/** Запасне тло без WebGL: SVG-плитка з контурами (повільно пливе, лише коли рух увімкнено). */
function svgBackground() {
  if (document.querySelector('.contours-svg')) return
  document.body.prepend(el('div', { class: 'contours-svg', 'aria-hidden': 'true' }))
}

/** Обирає тло: шейдер на нормальних пристроях, SVG на слабких, при економії трафіку, без WebGL2 і на спокійних сторінках. */
async function initBackground(reveal) {
  const weak = navigator.connection?.saveData
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)
    || (navigator.deviceMemory && navigator.deviceMemory <= 2)
  if (weak || mode === 'calm') return svgBackground()
  const gl = await import('./gl-contours.js')
  try {
    contours = gl.startContours({ small: isSmall(), live: motionOn(), onLost: svgBackground })
  } catch {
    contours = null
  }
  if (!contours) return svgBackground()
  if (motionOn() && reveal) reveal.then(() => contours.reveal())
  else contours.revealNow()
  window.addEventListener('omni:menu', (event) => contours?.pause(event.detail.open))
  if (scrollFx && motionOn()) scrollFx.startScrollFx({ contours })
}

async function initScrollFx() {
  scrollFx ??= await import('./scroll-fx.js')
  if (motionOn()) scrollFx.startScrollFx({ contours })
}

/** Виконати, коли браузер вільний (або щонайпізніше через timeout мс). */
function whenIdle(task, timeout = 1200) {
  if ('requestIdleCallback' in window) requestIdleCallback(task, { timeout })
  else setTimeout(task, 200)
}

/**
 * GSAP + Lenis (50 КБ) потрібні одразу лише там, де є закріплена розповідь.
 * На інших сторінках завантажуємо їх з першою дією користувача (прокрутка, клавіша, дотик) — перший показ швидший.
 */
function scheduleScrollFx() {
  // Lenis потребує ResizeObserver; без нього — звичайна прокрутка, без закріпленої розповіді
  if (!('ResizeObserver' in window)) return
  if (document.querySelector('[data-story]')) {
    whenIdle(initScrollFx, 1500)
    return
  }
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll']
  const start = () => {
    for (const name of events) removeEventListener(name, start)
    initScrollFx()
  }
  for (const name of events) addEventListener(name, start, { passive: true, once: true })
}

/** Ілюстрації з data-draw «малюються», коли потрапляють в екран. */
function initDrawings() {
  const items = document.querySelectorAll('[data-draw]')
  if (!items.length) return
  if (!motionOn() || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-in'))
    return
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      observer.unobserve(entry.target)
      revealReady.then(() => entry.target.classList.add('is-in'))
    }
  }, { threshold: 0.25 })
  items.forEach((item) => observer.observe(item))
}

/**
 * Перемикач «Рух» змінив стан. Лише вмикаємо/вимикаємо те, що працює далі (тло, курсор, плавна прокрутка);
 * нічого не програємо повторно: текст, що ще не з'явився, просто показуємо одразу.
 */
function onMotionChange(event) {
  const on = event.detail.on
  contours?.setLive(on)
  if (on) {
    initCursor()
    // Плавна прокрутка й закріплена розповідь вмикаються з наступним завантаженням сторінки:
    // увімкнення посеред сторінки не перебудовує її під користувачем (і не ховає вже показаний текст)
  } else {
    root.classList.remove('dot-cursor')
    scrollFx?.stopScrollFx()
  }
  // В обох напрямках: усе, що чекало на появу, показується одразу (без повторних анімацій)
  revealAllNow()
  document.querySelectorAll('[data-draw]').forEach((item) => item.classList.add('is-in'))
}

/** Вмикає ефекти для сторінки. mode — 'full', 'calm' або 'admin' (за замовчуванням береться з <html data-mode>). */
export function initEffects({ mode: forced } = {}) {
  mode = forced || pageMode()
  if (mode === 'admin') return

  // Заставка — лише при першому заході (клас intro ставить <head>)
  let reveal = null
  if (mode === 'full' && root.classList.contains('intro') && motionOn()) {
    reveal = new Promise((resolve) => {
      runIntro({ short: isSmall(), onWindow: resolve, onDone: () => {} })
    })
    holdRevealsUntil(reveal)
    revealReady = reveal
  }

  if (mode === 'full') {
    const grid = initGridLines()
    const show = () => requestAnimationFrame(() => grid.classList.add('is-in'))
    if (reveal) reveal.then(show)
    else show()
    initRail()
    initCursor()
    watchCursorMedia()
    initCatalogEntrance()
    initSnakes()
  }

  revealIn(document)
  initDrawings()
  window.addEventListener('omni:motion', onMotionChange)

  if (reveal) initBackground(reveal)
  else whenIdle(() => initBackground(null))
  if (mode === 'full' && motionOn()) scheduleScrollFx()
}

// Для сторінок: підключити нові елементи після відповіді API
export { revealIn, riseIn }

/** Після того як сторінка домалювала дані з API, позиції тригерів прокрутки треба перерахувати. */
export function refreshEffects() {
  scrollFx?.refreshScroll()
  contours?.refreshBands()
}
