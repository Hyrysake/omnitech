// Гарний випадний список замість стандартного <select> (його вигляд браузер майже не дає змінити).
// Справжній <select> лишається у формі (прихований), тому форма, адреса сторінки й обробники 'change'
// працюють як раніше; без JavaScript показується звичайний <select>.
//
// Доступність за зразком WAI-ARIA «Select-Only Combobox»: кнопка з role="combobox" і aria-expanded,
// список role="listbox" з role="option" і aria-selected, поточний варіант — через aria-activedescendant.
// Клавіші: стрілки, Home/End, Enter/Пробіл, Esc, перші літери назви (type-ahead), Tab закриває список.
import { el } from './dom.js'

let counter = 0
const instances = new WeakMap()

/** Перетворює <select> на гарний список. Повертає функцію sync() — показати значення, змінене кодом. */
export function enhanceSelect(select) {
  if (instances.has(select)) return instances.get(select)
  const id = `fs-${++counter}`
  const options = [...select.options]
  const labelEl = document.querySelector(`label[for="${select.id}"]`)
  const label = labelEl?.textContent.trim() || select.name

  const value = el('span', { class: 'fs-value' })
  const button = el('button', {
    type: 'button',
    class: 'fs-button',
    role: 'combobox',
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
    'aria-controls': `${id}-list`,
    'aria-label': label,
  }, value, el('span', { class: 'fs-chevron', 'aria-hidden': 'true' }))
  const list = el('ul', { id: `${id}-list`, class: 'fs-list', role: 'listbox', 'aria-label': label, tabindex: '-1' },
    options.map((option, index) => el('li', {
      id: `${id}-o${index}`,
      role: 'option',
      class: 'fs-option',
      dataset: { value: option.value },
      'aria-selected': 'false',
    }, option.textContent)))
  const wrap = el('div', { class: 'fs' }, button, list)
  // Список показуємо у «верхньому шарі» браузера (Popover API): він над усім — картками, лініями, шапкою,
  // незалежно від того, які контексти накладання (backdrop-filter, transform, z-index) мають батьківські блоки.
  // Елемент лишається на своєму місці в DOM (стилі, форма, «клік поза списком» працюють як раніше).
  // Старий браузер без Popover API: переносимо список у кінець <body> з position: fixed.
  const topLayer = typeof list.showPopover === 'function'
  if (topLayer) list.popover = 'manual'

  // Справжній список ховаємо (лишається у формі), а замість нього ставимо наш
  select.classList.add('fs-native')
  select.tabIndex = -1
  select.setAttribute('aria-hidden', 'true')
  select.after(wrap)
  button.id = `${id}-btn`
  labelEl?.setAttribute('for', button.id)

  let active = 0
  let typed = ''
  let typedTimer = 0
  const items = [...list.children]

  function sync() {
    const index = Math.max(0, options.findIndex((option) => option.value === select.value))
    // Коротка назва (data-short) для вузьких екранів; повна лишається в DOM (для читалок і широких екранів)
    const full = options[index]?.textContent ?? ''
    const short = options[index]?.dataset.short
    value.replaceChildren(...[el('span', { class: 'fs-full' }, full), short && el('span', { class: 'fs-short', 'aria-hidden': 'true' }, short)].filter(Boolean))
    items.forEach((item, i) => item.setAttribute('aria-selected', String(i === index)))
    setActive(index)
  }
  function setActive(index) {
    active = Math.max(0, Math.min(items.length - 1, index))
    items.forEach((item, i) => item.classList.toggle('is-active', i === active))
    button.setAttribute('aria-activedescendant', items[active].id)
    items[active].scrollIntoView?.({ block: 'nearest' })
  }
  // Розташування: під кнопкою, праві краї збігаються; якщо знизу бракує місця — над кнопкою
  function place() {
    const box = button.getBoundingClientRect()
    // Кнопка пішла з екрана (прокрутили) — закриваємо
    if (box.bottom < 0 || box.top > innerHeight) {
      close({ focus: false })
      return
    }
    list.style.minWidth = `${box.width}px`
    const width = list.offsetWidth
    const height = list.offsetHeight
    const gap = 8
    const left = Math.max(gap, Math.min(innerWidth - width - gap, box.right - width))
    const below = box.bottom + gap
    const flip = below + height > innerHeight - gap && box.top - gap - height > gap
    list.style.left = `${left}px`
    list.style.top = `${flip ? box.top - gap - height : below}px`
    list.classList.toggle('is-up', flip)
  }
  let placing = 0
  const onViewport = () => {
    cancelAnimationFrame(placing)
    placing = requestAnimationFrame(place)
  }
  function open() {
    if (wrap.classList.contains('is-open')) return
    if (topLayer) list.showPopover()
    else if (list.parentNode !== document.body) {
      list.classList.add('fs-portal')
      document.body.append(list)
    }
    wrap.classList.add('is-open')
    list.classList.add('is-open')
    button.setAttribute('aria-expanded', 'true')
    sync()
    place()
    document.addEventListener('pointerdown', outside, true)
    addEventListener('scroll', onViewport, { capture: true, passive: true })
    addEventListener('resize', onViewport)
    document.dispatchEvent(new CustomEvent('omni:toplayer'))
  }
  function close({ focus = true } = {}) {
    if (!wrap.classList.contains('is-open')) return
    wrap.classList.remove('is-open')
    list.classList.remove('is-open')
    if (topLayer && list.matches(':popover-open')) list.hidePopover()
    button.setAttribute('aria-expanded', 'false')
    button.removeAttribute('aria-activedescendant')
    document.removeEventListener('pointerdown', outside, true)
    removeEventListener('scroll', onViewport, { capture: true })
    removeEventListener('resize', onViewport)
    document.dispatchEvent(new CustomEvent('omni:toplayer'))
    if (focus) button.focus()
  }
  function choose(index) {
    const next = options[index].value
    close()
    if (select.value === next) return
    select.value = next
    // Та сама подія, що й від звичайного <select>: код сторінки нічого не помічає
    select.dispatchEvent(new Event('change', { bubbles: true }))
    sync()
  }
  function outside(event) {
    if (!wrap.contains(event.target) && !list.contains(event.target)) close({ focus: false })
  }
  // Друк перших літер: переходимо до варіанта, що з них починається
  function typeAhead(key) {
    clearTimeout(typedTimer)
    typed += key.toLowerCase()
    typedTimer = setTimeout(() => { typed = '' }, 600)
    const found = options.findIndex((option) => option.textContent.toLowerCase().startsWith(typed))
    if (found >= 0) setActive(found)
  }

  button.addEventListener('click', () => (wrap.classList.contains('is-open') ? close() : open()))
  button.addEventListener('keydown', (event) => {
    const isOpen = wrap.classList.contains('is-open')
    const keys = {
      ArrowDown: () => (isOpen ? setActive(active + 1) : open()),
      ArrowUp: () => (isOpen ? setActive(active - 1) : open()),
      Home: () => { open(); setActive(0) },
      End: () => { open(); setActive(items.length - 1) },
      Enter: () => (isOpen ? choose(active) : open()),
      ' ': () => (isOpen ? choose(active) : open()),
      Escape: () => close(),
    }
    if (keys[event.key]) {
      if (event.key === 'Escape' && !isOpen) return
      event.preventDefault()
      keys[event.key]()
    } else if (event.key === 'Tab') {
      close({ focus: false })
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      open()
      typeAhead(event.key)
    }
  })
  list.addEventListener('click', (event) => {
    const item = event.target.closest('[role="option"]')
    if (item) choose(items.indexOf(item))
  })
  list.addEventListener('pointermove', (event) => {
    const item = event.target.closest('[role="option"]')
    if (item) setActive(items.indexOf(item))
  })

  sync()
  instances.set(select, sync)
  return sync
}

/** Показати значення, яке код записав у <select> напряму (наприклад, після «Назад» у браузері). */
export function syncSelect(select) {
  instances.get(select)?.()
}
