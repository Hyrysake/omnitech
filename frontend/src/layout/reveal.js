// Поява тексту слово за словом (ідея santalarch): слова піднімаються на 20 px і «вирівнюються» з нахилу 3°,
// кожне наступне на 30 мс пізніше. Сам рух описаний у CSS (.rw), тут лише ділимо текст і ставимо класи.
//
// Доступність: видимі слова мають aria-hidden, а читалка екрана отримує звичайну приховану копію тексту (sr-only).
// Після появи текст повертається до початкового вигляду, тож пошук на сторінці й перенос рядків працюють як завжди.
import { motionOn } from './motion.js'

let ready = Promise.resolve()
/** Поки йде заставка, поява чекає (інакше текст «з'явився б» під чорним екраном). */
export function holdRevealsUntil(promise) {
  ready = promise
}

/** Ділить текст елемента на слова-спани. Повертає кількість слів. */
export function splitWords(node) {
  if (node.classList.contains('is-split')) return node.querySelectorAll('.rw').length
  const text = node.textContent.replace(/\s+/g, ' ').trim()
  const visual = document.createElement('span')
  visual.className = 'rw-visual'
  visual.setAttribute('aria-hidden', 'true')
  visual.append(...node.childNodes)
  // Обходимо всі текстові вузли (усередині можуть бути <span class="line"> тощо)
  const walker = document.createTreeWalker(visual, NodeFilter.SHOW_TEXT)
  const texts = []
  while (walker.nextNode()) texts.push(walker.currentNode)
  const step = node.dataset.stagger ? `${Number(node.dataset.stagger)}ms` : null
  let index = 0
  for (const textNode of texts) {
    const parts = textNode.textContent.split(/(\s+)/)
    const pieces = parts.filter((part) => part !== '').map((part) => {
      if (/^\s+$/.test(part)) return document.createTextNode(' ')
      const word = document.createElement('span')
      word.className = 'rw'
      word.textContent = part
      word.style.setProperty('--wi', index++)
      if (step) word.style.setProperty('--ws', step)
      return word
    })
    textNode.replaceWith(...pieces)
  }
  const copy = document.createElement('span')
  copy.className = 'sr-only'
  copy.textContent = text
  node.replaceChildren(copy, visual)
  node.classList.add('is-split')
  return index
}

/** Повертає звичайний текст (без спанів), зберігаючи внутрішню розмітку (наприклад, рядки заголовка). */
export function unsplit(node) {
  const visual = node.querySelector(':scope > .rw-visual')
  if (!visual) return
  for (const word of visual.querySelectorAll('.rw')) word.replaceWith(word.textContent)
  visual.normalize()
  node.replaceChildren(...visual.childNodes)
  node.classList.remove('is-split', 'is-in')
  node.classList.add('is-done')
}

let observer = null
function getObserver() {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      observer.unobserve(entry.target)
      play(entry.target)
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 })
  return observer
}

async function play(node) {
  await ready
  const words = node.querySelectorAll('.rw').length
  // Подвійний кадр: браузер має спершу намалювати «прихований» стан, тоді перехід спрацює
  requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('is-in')))
  if (node.dataset.reveal === 'keep') return
  const step = Number(node.dataset.stagger || 30)
  setTimeout(() => unsplit(node), 1300 + words * step + 100)
}

/** Готує всі [data-reveal] у контейнері. Без руху текст просто лишається як є. */
export function revealIn(container = document) {
  const nodes = container.querySelectorAll('[data-reveal]:not(.is-split):not(.is-done)')
  // Кроки закріпленої розповіді на широкому екрані показує scroll-fx.js, тут їх пропускаємо
  // (лише якщо scroll-fx справді запуститься: йому потрібен ResizeObserver)
  const pinnedStory = motionOn() && 'ResizeObserver' in window && matchMedia('(min-width: 768px)').matches
  for (const node of nodes) {
    if (pinnedStory && node.closest('[data-story]')) continue
    // Без руху або без IntersectionObserver (старий браузер) — текст просто видно
    if (!motionOn() || !('IntersectionObserver' in window)) {
      node.classList.add('is-done')
      continue
    }
    splitWords(node)
    getObserver().observe(node)
  }
}

/** Вимкнули рух — показуємо все одразу. */
export function revealAllNow() {
  for (const node of document.querySelectorAll('[data-reveal].is-split')) unsplit(node)
  for (const node of document.querySelectorAll('[data-rise]')) node.classList.add('is-in')
}

let riseObserver = null
/**
 * Картки «підіймаються» пачкою, коли потрапляють у видиму частину екрана (IntersectionObserver).
 * Атрибут data-rise ставимо лише тут, тож картки на інших сторінках ніколи не лишаться прихованими.
 */
export function riseIn(container) {
  const items = [...container.children].filter((item) => !item.classList.contains('col-span-full'))
  if (!motionOn() || !('IntersectionObserver' in window)) return
  riseObserver ??= new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting)
    visible.forEach((entry, order) => {
      entry.target.style.setProperty('--ri', order)
      riseObserver.unobserve(entry.target)
      ready.then(() => requestAnimationFrame(() => entry.target.classList.add('is-in')))
    })
  }, { rootMargin: '0px 0px -5% 0px' })
  for (const item of items) {
    item.setAttribute('data-rise', '')
    riseObserver.observe(item)
  }
}
