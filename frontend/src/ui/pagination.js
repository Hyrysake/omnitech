// Перемикач сторінок списку: «‹ 1 … 4 5 6 … 12 ›».
// Кожна кнопка — справжнє посилання ?page=N (його можна відкрити в новій вкладці),
// але звичайний клік перехоплює JavaScript і просто довантажує потрібну сторінку.
import { el, icon, render } from './dom.js'
import { scrollToNode } from '../layout/scroll-to.js'

/** Номери, які показуємо: перша, остання, поточна й по одній сусідній; між ними — «…». */
function pageNumbers(page, pages) {
  const wanted = new Set([1, pages, page - 1, page, page + 1])
  const numbers = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  const result = []
  numbers.forEach((n, index) => {
    if (index > 0 && n - numbers[index - 1] > 1) result.push('…')
    result.push(n)
  })
  return result
}

/** Адреса поточної сторінки з іншим номером: /catalog.html?q=x&page=3 */
function hrefFor(n) {
  const url = new URL(location.href)
  if (n === 1) url.searchParams.delete('page')
  else url.searchParams.set('page', n)
  return url.pathname + url.search
}

/** Номер сторінки з адреси (?page=3). Будь-що інше — перша сторінка. */
export function pageFromUrl() {
  const n = Number(new URLSearchParams(location.search).get('page'))
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** Записує номер сторінки в адресу без нового кроку в історії: після оновлення список відкриється там само. */
export function rememberPage(n) {
  history.replaceState(null, '', hrefFor(n))
}

/**
 * Малює перемикач у container. data — відповідь API зі списком ({page, pages}).
 * onPage(n) викликається, коли користувач обрав сторінку n (може повернути Promise — завантаження).
 * Після завантаження прокручуємо до початку списку (елемент перед перемикачем), щоб видно було перший рядок нової сторінки.
 * options.scrollTarget: CSS-селектор цілі або false, якщо сторінка прокручує сама (каталог).
 */
export function renderPagination(container, { page, pages }, onPage, { scrollTarget } = {}) {
  if (pages <= 1) {
    container.replaceChildren()
    return
  }
  const base = 'grid h-11 min-w-11 place-items-center rounded-full px-3 text-sm font-semibold tabular-nums transition-colors'
  const link = (n, label, content) => el('a', {
    href: hrefFor(n),
    class: `${base} ${n === page ? 'bg-coal text-paper dark:bg-paper dark:text-ink' : 'hover:bg-coal/5 dark:hover:bg-white/10'}`,
    'aria-label': label,
    'aria-current': n === page ? 'page' : null,
    onClick: (event) => {
      // Ctrl+клік чи середня кнопка миші відкривають нову вкладку — це не перехоплюємо
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return
      event.preventDefault()
      if (n === page) return
      const loading = onPage(n)
      if (scrollTarget === false) return
      const target = () => (scrollTarget ? document.querySelector(scrollTarget) : container.previousElementSibling || container.parentElement)
      Promise.resolve(loading).then(() => scrollToNode(target()))
    },
  }, content)

  render(container, el('ul', { class: 'flex flex-wrap items-center justify-center gap-1' },
    page > 1 && el('li', {}, link(page - 1, 'Попередня сторінка', icon('caret-left'))),
    pageNumbers(page, pages).map((n) => el('li', {},
      n === '…' ? el('span', { class: `${base} muted`, 'aria-hidden': 'true' }, '…') : link(n, `Сторінка ${n}`, n))),
    page < pages && el('li', {}, link(page + 1, 'Наступна сторінка', icon('caret-right')))))
}
