// Спільний старт кожної сторінки: шапка, підвал, повідомлення з попередньої сторінки.
// Кожен файл src/pages/*.js починається з виклику initPage().
import { renderFooter } from './footer.js'
import { renderHeader } from './header.js'
import { initEffects } from './effects.js'
import { initTransitions } from './transition.js'
import { byId } from '../ui/dom.js'
import { showFlash } from '../ui/flash.js'
import { getUser, SESSION_KEY } from '../auth/session.js'
import { CART_KEY } from '../store/cart.js'

// Ключ поточної сторінки: потрібен, щоб перемалювати шапку з тим самим підсвіченим пунктом
let activePage = ''

/** Фокус на <h1> сторінки (або на <main>), без прокрутки. */
function focusHeading() {
  const target = document.querySelector('main h1') ?? document.getElementById('main')
  if (!target) return
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.style.outline = 'none'
  target.focus({ preventScroll: true })
}

/** Перемальовує шапку (наприклад, змінилось ім'я користувача). */
export function refreshHeader() {
  renderHeader(byId('site-header'), activePage)
}

/**
 * active — ключ сторінки для підсвічування пункту меню ('home', 'catalog'…).
 * Повертає користувача, що ввійшов (або null для гостя).
 */
export function initPage({ active = '' } = {}) {
  activePage = active
  refreshHeader()
  renderFooter(byId('site-footer'))
  showFlash()
  // Прикраси (тло, заставка, поява тексту…). Режим сторінки (full / calm / admin) ставить скрипт у <head>
  initEffects()
  if (document.documentElement.dataset.mode !== 'admin') initTransitions()
  // Прийшли сюди золотою «шторкою» (View Transitions): фокус на заголовок нової сторінки,
  // щоб читалка екрана й клавіатура почали з її змісту. Подія pagereveal може прийти до або після цього коду
  if (document.documentElement.classList.contains('vt-arrived')) focusHeading()
  else window.addEventListener('pagereveal', (event) => { if (event.viewTransition) focusHeading() }, { once: true })

  // Кошик змінився на цій сторінці (подія від store/cart.js) — оновлюємо число біля іконки
  window.addEventListener('cart:changed', refreshHeader)

  // Подія storage приходить, коли localStorage змінила ІНША вкладка цього сайту:
  // там увійшли чи вийшли — перезавантажуємо сторінку, щоб тут теж було видно актуальний стан
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_KEY) location.reload()
    if (event.key === CART_KEY) refreshHeader()
  })
  return getUser()
}
