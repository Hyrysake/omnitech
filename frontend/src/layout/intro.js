// Заставка при першому заході за сесію (ідея lusion): чорний екран, золота смужка заповнюється,
// великий лічильник 0 → 100 «прокручується» як одометр, потім смужка складається у знак «+»,
// який повертається й росте, вирізаючи діагональне «вікно» у сторінку.
//
// Це лише прикраса: сторінка під заставкою вже намальована, нічого не чекаємо й не блокуємо.
// Шар прихований від читалок (aria-hidden), без фокусу, а через 0,4 с пропускає кліки (pointer-events: none).
import { el } from '../ui/dom.js'

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const expoInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2)
const cubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const quartOut = (t) => 1 - (1 - t) ** 4

// «Нерівне завантаження»: лічильник то біжить, то застигає (як справжнє завантаження у lusion)
const CURVE = [[0, 0], [0.16, 0.06], [0.3, 0.09], [0.52, 0.57], [0.64, 0.63], [0.82, 0.91], [0.9, 0.93], [1, 1]]
function progressAt(t) {
  for (let i = 1; i < CURVE.length; i++) {
    const [t1, v1] = CURVE[i]
    const [t0, v0] = CURVE[i - 1]
    if (t <= t1) return v0 + (v1 - v0) * cubicInOut((t - t0) / (t1 - t0))
  }
  return 1
}

/** Колонка цифр одометра: 0…9 і ще раз 0 (щоб 9 → 0 «перекочувалось» далі, а не назад). */
function digitColumn(count) {
  return el('span', { class: 'col' }, Array.from({ length: count }, (_, digit) => el('span', {}, digit % 10)))
}

// Вікно в чорному шарі робимо через clip-path: polygon(evenodd, ...): спершу контур усього екрана,
// потім контур «+». Правило evenodd вирізає внутрішню фігуру, тож крізь неї видно сторінку.
/** Точки знака «+» (12 кутів) з центром (cx, cy), півтовщиною a, півдовжиною l, поворотом angle і масштабом s. */
function plusPoints(cx, cy, a, l, angle, s) {
  const local = [[-a, -l], [a, -l], [a, -a], [l, -a], [l, a], [a, a], [a, l], [-a, l], [-a, a], [-l, a], [-l, -a], [-a, -a]]
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return local.map(([x, y]) => [cx + (x * cos - y * sin) * s, cy + (x * sin + y * cos) * s])
}

/**
 * Запускає заставку. onWindow — момент, коли починає відкриватися «вікно» (час запускати появу тексту),
 * onDone — заставку прибрано. Повертає нічого: усе відбувається само.
 */
export function runIntro({ short = false, onWindow, onDone }) {
  sessionStorage.setItem('omni-intro', '1')
  const root = document.documentElement
  const fill = el('i')
  const bar = el('div', { class: 'intro-bar' }, fill)
  const armH = el('i')
  const armV = el('i')
  const plus = el('div', { class: 'intro-plus' }, armH, armV)
  const columns = [digitColumn(2), digitColumn(11), digitColumn(11)]
  const count = el('div', { class: 'intro-count' }, columns)
  const label = el('p', { class: 'intro-label' }, 'OmniTech · Луцьк')
  const overlay = el('div', { class: 'intro-overlay', 'aria-hidden': 'true' }, bar, plus, count, label)
  document.body.append(overlay)
  root.classList.add('intro-live')
  setTimeout(() => overlay.classList.add('is-through'), 400)

  // Тривалості фаз, мс
  const COUNT = short ? 850 : 1400
  const FOLD = short ? 260 : 380
  const WINDOW = short ? 650 : 820
  const t0 = performance.now()
  // Відмітки часу для перевірок (tools/loader_frames.py) — лише в режимі розробки, у збірку не потрапляють
  if (import.meta.env.DEV) window.__omniIntro = { start: t0 }
  const positions = [0, 0, 0]
  let last = t0
  let windowStarted = false
  let barWidth = 0
  let centre = [0, 0]

  function measure() {
    const box = bar.getBoundingClientRect()
    barWidth = box.width
    centre = [box.left + box.width / 2, box.top + box.height / 2]
  }
  measure()

  function setCounter(value, dt) {
    const targets = [Math.floor(value / 100), Math.floor(value / 10), value]
    targets.forEach((target, i) => {
      // Плавне «наздоганяння» цифри (експоненційне згладжування, не залежить від частоти кадрів).
      // Колонка цифр — стовпчик 0…9 (і ще 0), зсуваємо його вгору на «значення × висоту цифри» (1em)
      positions[i] += (target - positions[i]) * (1 - Math.exp(-14 * dt))
      if (Math.abs(target - positions[i]) < 0.001) positions[i] = target
      const shown = i === 0 ? positions[i] : positions[i] % 10
      columns[i].style.transform = `translateY(${-shown}em)`
    })
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const t = now - t0
    // 1) Лічильник і смужка
    const p = progressAt(clamp(t / COUNT))
    fill.style.transform = `scaleX(${p})`
    setCounter(Math.round(p * 100), dt)

    // 2) Смужка складається в «+»: стискається до короткої риски, потім виростає вертикальна риска
    const f = clamp((t - COUNT) / FOLD)
    if (f > 0) {
      const e = expoInOut(f)
      const arm = 26
      const thick = 6
      const width = barWidth + (arm * 2 - barWidth) * e
      bar.style.background = 'transparent'
      fill.style.transform = `translateX(${(barWidth - width) / 2}px) scaleX(${width / barWidth}) scaleY(${1 + (thick / 2 - 1) * e})`
      armH.style.cssText = 'display:none'
      if (f > 0.55) {
        const g = quartOut((f - 0.55) / 0.45)
        bar.style.visibility = 'hidden'
        armH.style.cssText = `left:${-arm}px;top:${-thick / 2}px;width:${arm * 2}px;height:${thick}px`
        armV.style.cssText = `left:${-thick / 2}px;top:${-arm}px;width:${thick}px;height:${arm * 2}px;transform:scaleY(${g})`
        plus.style.cssText = `left:${centre[0]}px;top:${centre[1]}px;margin:0;transform:rotate(${g * 45}deg)`
      }
    }

    // 3) «Вікно»: знак «+» росте й обертається, вирізаючи в чорному шарі отвір до сторінки
    const w = clamp((t - COUNT - FOLD) / WINDOW)
    if (w > 0) {
      if (!windowStarted) {
        windowStarted = true
        onWindow?.()
      }
      const e = expoInOut(w)
      const vw = innerWidth
      const vh = innerHeight
      const angle = Math.PI / 4 + e * 1.05
      const scale = 1 + e * (Math.hypot(vw, vh) / 3) * 1.15
      const hole = plusPoints(centre[0], centre[1], 3, 26, angle, scale)
      const outer = `0 0, ${vw}px 0, ${vw}px ${vh}px, 0 ${vh}px, 0 0`
      const inner = hole.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')
      overlay.style.clipPath = `polygon(evenodd, ${outer}, ${inner}, ${hole[0][0].toFixed(1)}px ${hole[0][1].toFixed(1)}px, 0 0)`
      plus.style.opacity = String(1 - clamp(w * 6))
      count.style.transform = `translateY(${e * 110}%)`
      label.style.opacity = String(1 - clamp(w * 3))
    }

    if (w < 1) {
      requestAnimationFrame(frame)
    } else {
      if (import.meta.env.DEV) window.__omniIntro.end = performance.now()
      overlay.remove()
      root.classList.remove('intro', 'intro-live')
      onDone?.()
    }
  }
  requestAnimationFrame(frame)
}
