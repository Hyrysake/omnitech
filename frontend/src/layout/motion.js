// Стан «руху» на сайті. Клас motion-on / motion-off на <html> ставить скрипт у <head> ще до малювання
// (вибір користувача в localStorage або системне «Зменшити рух»). Тут — читання стану, перемикач і дрібні помічники.
import { el } from '../ui/dom.js'

const root = document.documentElement

/** Чи дозволений рух зараз (перемикач або системне налаштування). */
export function motionOn() {
  return root.classList.contains('motion-on')
}

/** Режим сторінки: 'full' (публічні), 'calm' (кошик, форми, кабінет) або 'admin'. Його теж ставить скрипт у <head>. */
export function pageMode() {
  return root.dataset.mode || 'full'
}

/** Пристрій із мишею і великим екраном (для курсора й важких ефектів). */
export function isDesktopPointer() {
  return matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches
}

// Усі кнопки «Рух» на сторінці (у меню й у підвалі): при зміні оновлюємо всі одразу
const switches = new Set()

/** Вмикає або вимикає рух, запам'ятовує вибір і повідомляє ефекти подією omni:motion. */
export function setMotion(on) {
  // Кнопку, яку щойно натиснули, лишаємо на тому самому місці екрана: зміна руху може змінити висоту
  // блоків вище (закріплена розповідь, лінії), і без цього сторінка «відстрибнула» б від підвалу
  const anchor = document.activeElement?.closest?.('button') ?? null
  const before = anchor ? anchor.getBoundingClientRect().top : 0
  localStorage.setItem('motion', on ? 'on' : 'off')
  // Закріплення розповіді вирішується при завантаженні сторінки; вимкнули рух — прибираємо його розкладку
  if (!on) root.classList.remove('pin-story')
  root.classList.toggle('motion-on', on)
  root.classList.toggle('motion-off', !on)
  for (const button of switches) syncSwitch(button)
  window.dispatchEvent(new CustomEvent('omni:motion', { detail: { on } }))
  if (anchor?.isConnected) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const delta = anchor.getBoundingClientRect().top - before
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' })
    }))
  }
}

function syncSwitch(button) {
  const on = motionOn()
  button.setAttribute('aria-pressed', String(on))
  button.querySelector('.state').textContent = on ? 'увімк.' : 'вимк.'
}

/**
 * Перемикач «Рух: увімк./вимк.». Назва кнопки для читалки — «Рух», а стан повідомляє aria-pressed,
 * тому видимий текст стану прихований від читалки (інакше прозвучало б двічі).
 */
export function motionSwitch(extraClass = '') {
  const button = el('button', {
    type: 'button',
    class: `motion-switch ${extraClass}`.trim(),
    onClick: () => setMotion(!motionOn()),
  },
  el('span', { class: 'track', 'aria-hidden': 'true' }),
  el('span', {}, 'Рух', el('span', { 'aria-hidden': 'true' }, ': ', el('span', { class: 'state' }, ''))))
  syncSwitch(button)
  switches.add(button)
  return button
}

/**
 * Напис, що «виїжджає» вгору при наведенні (дві копії тексту). Друга копія прихована від читалки
 * (aria-hidden), тому текст читається один раз. Увесь ефект зроблено в CSS (.roll).
 */
export function roll(text) {
  return el('span', { class: 'roll' }, el('span', {}, text), el('span', { 'aria-hidden': 'true' }, text))
}
