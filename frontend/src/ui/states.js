// Стани блоку з даними: «завантажується», «порожньо», «помилка». Кожен список на сайті
// проходить через них, тому користувач ніколи не бачить порожнього місця без пояснення.
import { el, icon, render } from './dom.js'

/** Сірі картки-заготовки на час завантаження (кількість — як очікуваних карток). */
export function renderCardSkeletons(container, count = 4) {
  container.setAttribute('aria-busy', 'true')
  render(container, Array.from({ length: count }, () =>
    el('div', { class: 'card overflow-hidden', 'aria-hidden': 'true' },
      el('div', { class: 'skeleton aspect-[4/3] rounded-none' }),
      el('div', { class: 'space-y-3 p-5' },
        el('div', { class: 'skeleton h-3 w-1/3' }),
        el('div', { class: 'skeleton h-4 w-4/5' }),
        el('div', { class: 'skeleton h-6 w-1/2' })))))
}

/** Сірі рядки-заготовки (для таблиць і списків). */
export function renderLineSkeletons(container, count = 5) {
  container.setAttribute('aria-busy', 'true')
  render(container, el('div', { class: 'space-y-3 p-4', 'aria-hidden': 'true' },
    Array.from({ length: count }, () => el('div', { class: 'skeleton h-10 w-full' }))))
}

/** Завантаження закінчилось (успішно чи ні): прибираємо aria-busy. */
export function doneLoading(container) {
  container.removeAttribute('aria-busy')
}

/** Картка-повідомлення по центру: значок, заголовок, текст і (за бажанням) кнопка чи посилання. */
function messageCard({ iconName, title, text, action, tone = 'gold' }) {
  const iconClass = tone === 'red'
    ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
    : 'bg-gold/10 text-gold dark:bg-gold-bright/15 dark:text-gold-bright'
  return el('div', { class: 'card col-span-full flex flex-col items-center px-6 py-14 text-center' },
    el('span', { class: `grid size-16 place-items-center rounded-full ${iconClass}` }, icon(iconName, 'text-3xl')),
    el('h2', { class: 'mt-6 font-display text-3xl font-semibold' }, title),
    text && el('p', { class: 'muted mt-3 max-w-md' }, text),
    action && el('div', { class: 'mt-8' }, action))
}

/**
 * Порожній список. action — готовий елемент (посилання чи кнопка), наприклад:
 * el('a', { href: '/catalog.html', class: 'btn btn-primary' }, 'До каталогу')
 */
export function renderEmpty(container, { iconName = 'package', title, text, action } = {}) {
  doneLoading(container)
  render(container, messageCard({ iconName, title, text, action }))
}

/**
 * Помилка завантаження з кнопкою «Спробувати ще». error — ApiError з client.js:
 * у ньому вже є зрозумілий текст (сервер недоступний, не відповідає, відповів помилкою).
 */
export function renderError(container, error, onRetry) {
  doneLoading(container)
  const retry = onRetry && el('button', { type: 'button', class: 'btn btn-primary', onClick: onRetry },
    icon('arrow-clockwise'), 'Спробувати ще')
  render(container, el('div', { class: 'col-span-full', role: 'alert' }, messageCard({
    iconName: error?.kind === 'http' ? 'warning-circle' : 'wifi-slash',
    title: 'Не вдалося завантажити дані',
    text: error?.message ?? 'Невідома помилка.',
    action: retry,
    tone: 'red',
  })))
}

/** Запис не знайдено (товар видалено або в адресі неправильний номер). */
export function renderNotFound(container, { title = 'Не знайдено', text, action } = {}) {
  doneLoading(container)
  render(container, messageCard({ iconName: 'magnifying-glass', title, text, action }))
}

/** Сторінка лише для адміністратора, а зайшов звичайний користувач (403). */
export function renderForbidden(container) {
  doneLoading(container)
  render(container, messageCard({
    iconName: 'lock-key',
    title: 'Доступ заборонено',
    text: 'Ця сторінка доступна лише адміністратору магазину.',
    action: el('a', { href: '/', class: 'btn btn-primary' }, 'На головну'),
    tone: 'red',
  }))
}
