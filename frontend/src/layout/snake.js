// Золота «змійка» за вмістом сторінки (ідея lusion.co): кілька довгих товстих ліній з петлями,
// які малюються разом із прокруткою і так само «змотуються» назад, коли гортаємо вгору.
//
// Як це працює:
// - кожна лінія займає «ділянку» сторінки: від верху одного блоку до низу іншого (наприклад, від категорій до товарів);
// - форма лінії задана в частках ширини й висоти ділянки (0..1), тож на будь-якому екрані це та сама форма;
//   x < 0 або x > 1 означає, що лінія заходить з-за краю екрана;
// - прогрес малювання = наскільки низ екрана пройшов ділянку: 0 — ділянка тільки з'являється внизу,
//   1 — низ ділянки дійшов до низу екрана (формула як у lusion: saturate((низ екрана − верх) / висота));
// - показаний прогрес плавно «наздоганяє» цільовий (м'яке, а не миттєве малювання);
// - малюємо через stroke-dasharray/stroke-dashoffset при pathLength = 1 (довжина всієї лінії = 1),
//   на кінчику — кругла «головка пера».
// Позиції рахуються щоразу з реального розташування блоків (getBoundingClientRect), а при зміні висоти сторінки
// (закріплена розповідь, шрифти, дані з API) лінії перебудовуються — тому вони не «спішать» і не відстають.
import { motionOn } from './motion.js'

const SVG = 'http://www.w3.org/2000/svg'

// Форми ліній (від руки): петлі й довгі S-подібні вигини
const SHAPES = {
  hero: 'M-.06 .30 C .18 .16 .40 .32 .42 .60 C .44 .90 .14 .98 .12 .76 C .10 .56 .42 .50 .62 .68 C .80 .84 .92 .62 1.06 .54',
  products: 'M1.06 .04 C .78 .00 .60 .16 .68 .32 C .76 .48 .98 .44 .94 .26 C .90 .10 .56 .18 .44 .42 C .32 .66 .04 .58 .08 .78 C .12 .98 .56 .90 .72 .97 C .84 1.02 .96 .96 1.06 .93',
  features: 'M-.06 .06 C .30 .00 .52 .18 .44 .36 C .36 .54 .12 .46 .18 .30 C .24 .14 .58 .30 .70 .52 C .82 .74 .60 .90 .80 .95 C .92 .98 1.0 .90 1.06 .86',
  about: 'M-.06 .18 C .20 .04 .55 .10 .60 .44 C .65 .80 .30 .96 .25 .70 C .20 .46 .70 .40 1.06 .76',
  catalog: 'M-.06 .72 C .24 .98 .44 .18 .70 .36 C .86 .46 .94 .10 1.06 .22',
}

// Ділянки на сторінках: від якого блоку до якого і яка форма
const PAGES = {
  '/': [['.hero', '.hero', 'hero'], ['#categories', '#popular', 'products'], ['#features', '.cta', 'features']],
  '/index.html': [['.hero', '.hero', 'hero'], ['#categories', '#popular', 'products'], ['#features', '.cta', 'features']],
  '/about.html': [['.workshop', '.workshop', 'about']],
  '/catalog.html': [['main > header', 'main > header', 'catalog']],
}

const toPixels = (shape, width, height) =>
  shape.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (_, x, y) => `${(x * width).toFixed(1)} ${(y * height).toFixed(1)}`)

// Точки вздовж лінії приблизно кожні 8 px — прямо з формули кривих Безьє (без getPointAtLength: це в десятки разів дешевше)
function samplePoints(shape, width, height) {
  const n = shape.match(/-?\d*\.?\d+/g).map(Number)
  const pts = []
  let x0 = n[0] * width
  let y0 = n[1] * height
  for (let i = 2; i + 5 < n.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = [n[i] * width, n[i + 1] * height, n[i + 2] * width, n[i + 3] * height, n[i + 4] * width, n[i + 5] * height]
    const span = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2)
    const steps = Math.max(4, Math.ceil(span / 8))
    for (let k = 0; k <= steps; k++) {
      const t = k / steps
      const u = 1 - t
      pts.push({
        x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      })
    }
    x0 = x3
    y0 = y3
  }
  return pts
}

export function initSnakes() {
  const regions = PAGES[location.pathname]
  if (!regions) return
  const lines = []
  let holeTimer = 0
  regions.forEach(([fromSel, toSel, shapeName], index) => {
    const from = document.querySelector(fromSel)
    const to = document.querySelector(toSel)
    if (!from || !to) return
    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('class', 'snake')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')
    // Градієнт уздовж лінії: від світлого золота на початку до глибшого на кінчику
    const id = `snake-grad-${index}`
    const defs = document.createElementNS(SVG, 'defs')
    const grad = document.createElementNS(SVG, 'linearGradient')
    grad.setAttribute('id', id)
    grad.setAttribute('gradientUnits', 'userSpaceOnUse')
    for (const [offset, color] of [['0', '#F2C96B'], ['0.55', '#E0AC3D'], ['1', '#B8821F']]) {
      const stop = document.createElementNS(SVG, 'stop')
      stop.setAttribute('offset', offset)
      stop.setAttribute('stop-color', color)
      grad.append(stop)
    }
    // Маска з «отворами» під текстом: там, де лінія перетинає рядки тексту, вона м'яко зникає (проходить «під» текстом),
    // тож контраст тексту лишається таким самим, як на звичайному тлі сторінки (вимога WCAG 4,5:1 / 3:1)
    const blur = document.createElementNS(SVG, 'filter')
    blur.setAttribute('id', `snake-soft-${index}`)
    blur.setAttribute('x', '-10%')
    blur.setAttribute('y', '-10%')
    blur.setAttribute('width', '120%')
    blur.setAttribute('height', '120%')
    const gauss = document.createElementNS(SVG, 'feGaussianBlur')
    gauss.setAttribute('stdDeviation', '7')
    blur.append(gauss)
    const mask = document.createElementNS(SVG, 'mask')
    mask.setAttribute('id', `snake-mask-${index}`)
    mask.setAttribute('maskUnits', 'userSpaceOnUse')
    const maskBase = document.createElementNS(SVG, 'rect')
    maskBase.setAttribute('fill', '#fff')
    const holes = document.createElementNS(SVG, 'g')
    holes.setAttribute('fill', '#000')
    holes.setAttribute('filter', `url(#snake-soft-${index})`)
    mask.append(maskBase, holes)
    defs.append(grad, blur, mask)
    const group = document.createElementNS(SVG, 'g')
    group.setAttribute('mask', `url(#snake-mask-${index})`)
    const path = document.createElementNS(SVG, 'path')
    path.setAttribute('pathLength', '1')
    path.setAttribute('stroke', `url(#${id})`)
    const tip = document.createElementNS(SVG, 'circle')
    group.append(path, tip)
    svg.append(defs, group)
    document.body.append(svg)
    lines.push({ from, to, shape: SHAPES[shapeName], svg, path, tip, grad, maskBase, holes, top: 0, height: 1, length: 1, shown: 0, target: 0 })
  })
  if (!lines.length) return

  // Перебудова: розмір і положення кожної ділянки в координатах документа
  function layout() {
    const width = document.documentElement.clientWidth
    const stroke = width < 768 ? 14 : 28
    for (const line of lines) {
      const top = line.from.getBoundingClientRect().top + scrollY
      const bottom = line.to.getBoundingClientRect().bottom + scrollY
      line.top = top
      line.firstScreen = top < innerHeight
      line.svg.dataset.mode = line.firstScreen ? 'scroll' : 'viewport'
      line.height = Math.max(1, bottom - top)
      line.svg.style.top = `${top}px`
      line.svg.style.height = `${line.height}px`
      line.svg.setAttribute('viewBox', `0 0 ${width} ${line.height}`)
      line.path.setAttribute('d', toPixels(line.shape, width, line.height))
      line.path.style.strokeWidth = `${stroke}px`
      line.tip.setAttribute('r', String(stroke * 0.62))
      line.grad.setAttribute('x1', '0')
      line.grad.setAttribute('y1', '0')
      line.grad.setAttribute('x2', String(width))
      line.grad.setAttribute('y2', String(line.height))
      line.length = line.path.getTotalLength()
      line.buckets = null
      line.maskBase.setAttribute('width', String(width))
      line.maskBase.setAttribute('height', String(line.height))
    }
    measure()
    draw(true)
    // Отвори під текстом — коли браузер вільний (і після того, як текст став на місце)
    reHole()
  }

  // Рядки тексту (прямоугольники рядків через Range), які перетинає лінія, — у маску як чорні «отвори»
  function cutHoles(line, width, stroke) {
    line.maskBase.setAttribute('width', String(width))
    line.maskBase.setAttribute('height', String(line.height))
    // Точки вздовж лінії кожні 6 px — рахуються раз на перебудову (layout) і розкладені по смугах висотою 64 px,
    // тож для кожного рядка тексту перевіряємо лише кілька сусідніх точок, а не всю лінію
    if (!line.buckets) {
      line.buckets = new Map()
      for (const pt of samplePoints(line.shape, width, line.height)) {
        const key = Math.floor(pt.y / 64)
        if (!line.buckets.has(key)) line.buckets.set(key, [])
        line.buckets.get(key).push(pt)
      }
    }
    const near = (y0, y1) => {
      const found = []
      for (let key = Math.floor(y0 / 64); key <= Math.floor(y1 / 64); key++) {
        const list = line.buckets.get(key)
        if (list) found.push(...list)
      }
      return found
    }
    const reach = stroke * 0.65 + 4
    const svgTop = line.svg.getBoundingClientRect().top // фактичне положення лінії на екрані
    const range = document.createRange()
    const rects = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.data.trim() || node.parentElement.closest('svg, .sr-only, #site-header, script, style, noscript')) continue
      range.selectNodeContents(node)
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue
        const box = { x: r.left, y: r.top - svgTop, w: r.width, h: r.height }
        if (box.y + box.h < -reach || box.y > line.height + reach) continue
        const hit = near(box.y - reach, box.y + box.h + reach).some((pt) => pt.x > box.x - reach && pt.x < box.x + box.w + reach && pt.y > box.y - reach && pt.y < box.y + box.h + reach)
        if (hit) rects.push(box)
      }
    }
    // Іконки (шрифтові <i class="ph">, маленькі svg у посиланнях і кнопках) — теж «текст»: лінія не має їх перетинати
    for (const icon of document.querySelectorAll('main i.ph, main i[class*="ph-"], main a svg, main button svg, #site-footer a svg')) {
      if (icon.closest('svg.snake')) continue
      const r = icon.getBoundingClientRect()
      if (r.width < 1 || r.width > 64 || r.height > 64) continue
      const box = { x: r.left, y: r.top - svgTop, w: r.width, h: r.height }
      if (box.y + box.h < -reach || box.y > line.height + reach) continue
      if (near(box.y - reach, box.y + box.h + reach).some((pt) => pt.x > box.x - reach && pt.x < box.x + box.w + reach && pt.y > box.y - reach && pt.y < box.y + box.h + reach)) rects.push(box)
    }
    const pad = 20 // більше за розмиття країв (2 x 7 px) з запасом, щоб у самих рядках лінії не було зовсім
    line.holes.replaceChildren(...rects.map((box) => {
      const hole = document.createElementNS(SVG, 'rect')
      hole.setAttribute('x', (box.x - pad).toFixed(1))
      hole.setAttribute('y', (box.y - pad).toFixed(1))
      hole.setAttribute('width', (box.w + pad * 2).toFixed(1))
      hole.setAttribute('height', (box.h + pad * 2).toFixed(1))
      hole.setAttribute('rx', '16')
      return hole
    }))
    line.svg.dataset.holes = String(rects.length)
  }

  // Цільовий прогрес: наскільки низ екрана пройшов ділянку.
  // Ділянка, видна вже на першому екрані (герой, шапка каталогу), інакше була б майже домальована одразу —
  // для неї рахуємо від прокрутки: 6 % «натяк» на старті, повна лінія після 75 % її висоти.
  function measure() {
    const viewportBottom = scrollY + innerHeight
    for (const line of lines) {
      // Без руху лінії статичні й повні (маска з отворами під текстом діє так само)
      if (!motionOn()) {
        line.target = 1
        continue
      }
      const raw = line.firstScreen
        ? 0.06 + 0.94 * (scrollY / (line.height * 0.75))
        : (viewportBottom - line.top) / line.height
      line.target = Math.min(1, Math.max(0, raw))
    }
  }

  let raf = 0
  let last = performance.now()
  function draw(instant = false) {
    const now = performance.now()
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    let moving = false
    for (const line of lines) {
      // Плавне наздоганяння (за ~0,3 с), не залежить від частоти кадрів
      line.shown = instant ? line.target : line.shown + (line.target - line.shown) * (1 - Math.exp(-dt * 9))
      if (Math.abs(line.target - line.shown) > 0.0005) moving = true
      else line.shown = line.target
      const p = line.shown
      line.path.style.strokeDasharray = '1 1'
      line.path.style.strokeDashoffset = String(1 - p)
      const point = line.path.getPointAtLength(p * line.length)
      line.tip.setAttribute('cx', point.x.toFixed(1))
      line.tip.setAttribute('cy', point.y.toFixed(1))
      line.tip.style.opacity = p > 0.001 && p < 0.999 ? '1' : '0'
      line.svg.dataset.progress = p.toFixed(4)
    }
    raf = moving ? requestAnimationFrame(() => draw()) : 0
  }
  function onScroll() {
    if (!motionOn()) return
    measure()
    if (!raf) {
      last = performance.now()
      raf = requestAnimationFrame(() => draw())
    }
  }

  layout()
  addEventListener('scroll', onScroll, { passive: true })
  // Висота сторінки змінилась (закріплена розповідь, шрифти, картки з API, зміна ширини) — перебудовуємо
  let queued = 0
  const relayout = () => {
    cancelAnimationFrame(queued)
    queued = requestAnimationFrame(layout)
  }
  // Без ResizeObserver — перебудова лише при зміні розміру вікна й після завантаження
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(document.body)
  else {
    addEventListener('resize', relayout)
    addEventListener('load', relayout)
  }
  // Отвори під текстом рахуємо, коли текст уже «став на місце»: після змін тексту (дані з API) і після
  // завершення анімацій появи (слова, картки рухаються — їхні прямокутники під час руху інші)
  const host = document.querySelector('main') || document.body
  // Лише події, що справді зсувають текст: поява слів і блоків [data-reveal] (не наведення на кнопки тощо)
  const onSettle = (event) => {
    if (event.target.closest?.('[data-reveal], [data-rise]')) reHole()
  }
  function reHole() {
    clearTimeout(holeTimer)
    holeTimer = setTimeout(() => {
      const run = () => {
        const width = document.documentElement.clientWidth
        const stroke = width < 768 ? 14 : 28
        for (const line of lines) cutHoles(line, width, stroke)
      }
      if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 150 })
      else run()
    }, 60)
  }
  if ('MutationObserver' in window) {
    new MutationObserver(reHole).observe(host, { childList: true, subtree: true, characterData: true })
  }
  host.addEventListener('transitionend', onSettle)
  // Запобіжник: коли прокрутка зупинилась (нові блоки щойно з'явились і стали на місце) — ще раз вирізаємо отвори
  let scrollStop = 0
  addEventListener('scroll', () => {
    clearTimeout(scrollStop)
    scrollStop = setTimeout(reHole, 150)
  }, { passive: true })
  host.addEventListener('animationend', onSettle)
  document.fonts?.ready.then(relayout)
  // Рух увімкнули/вимкнули: перебудова (вимкнено — повні статичні лінії, увімкнено — малювання від прокрутки)
  window.addEventListener('omni:motion', layout)
}
