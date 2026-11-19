// Шапка сайту: логотип «Omni / TECH», пункти меню на лініях сітки (широкий екран), кошик, тема, «Меню».
// Меню описане ОДИН раз у масиві NAV: новий пункт додається одним рядком і з'являється на всіх сторінках.
import { el, icon } from '../ui/dom.js'
import { clearSession, getUser } from '../auth/session.js'
import { loginUrl } from '../auth/guards.js'
import { setFlash } from '../ui/flash.js'
import { cartCount } from '../store/cart.js'
import { motionSwitch, roll } from './motion.js'

// Пункти головного меню: key — назва сторінки для підсвічування поточного пункту
export const NAV = [
  { key: 'home', href: '/', label: 'Головна' },
  { key: 'catalog', href: '/catalog.html', label: 'Каталог' },
  { key: 'about', href: '/about.html', label: 'Про нас' },
  { key: 'contacts', href: '/contacts.html', label: 'Контакти' },
  { key: 'faq', href: '/faq.html', label: 'Часті питання' },
]

// Пункти меню акаунта для того, хто ввійшов. adminOnly — лише для адміністратора
const ACCOUNT = [
  { key: 'profile', href: '/profile.html', label: 'Профіль', iconName: 'user' },
  { key: 'orders', href: '/orders.html', label: 'Мої замовлення', iconName: 'receipt' },
  { key: 'wishlist', href: '/wishlist.html', label: 'Список бажань', iconName: 'heart' },
  { key: 'admin', href: '/admin/', label: 'Адмін-панель', iconName: 'gauge', adminOnly: true },
]

/** Вихід: токен зберігається лише в браузері, тож вийти — означає просто забути його. */
function logout() {
  clearSession()
  setFlash('Ви вийшли з акаунта.', 'info')
  location.assign('/')
}

/** Велике посилання меню з номером: «01 ГОЛОВНА». Текст виїжджає вгору при наведенні. */
function menuLink(item, index, active) {
  return el('a', {
    href: item.href,
    class: 'menu-link',
    style: `--i: ${index}`,
    'aria-current': item.key === active ? 'page' : null,
  }, el('span', { class: 'num' }, String(index + 1).padStart(2, '0')), roll(item.label))
}

/** Пункти акаунта внизу меню: для гостя — «Увійти» і «Реєстрація», для користувача — його розділи. */
function accountLinks(user, active) {
  const item = 'pill pill-ghost'
  if (!user) {
    return [
      el('a', { href: loginUrl(), class: item }, icon('sign-in', 'text-lg'), roll('Увійти')),
      el('a', { href: '/register.html', class: 'pill pill-loud' }, roll('Реєстрація')),
    ]
  }
  const links = ACCOUNT
    .filter((entry) => !entry.adminOnly || user.role === 'admin')
    .map((entry) => el('a', {
      href: entry.href,
      class: item,
      'aria-current': entry.key === active ? 'page' : null,
    }, icon(entry.iconName, 'text-lg'), roll(entry.label)))
  links.push(el('button', { type: 'button', class: item, onClick: logout }, icon('sign-out', 'text-lg'), roll('Вийти')))
  return links
}

/** Кошик: іконка з кількістю штук. */
function cartLink(active) {
  const count = cartCount()
  return el('a', {
    href: '/cart.html',
    class: `btn-icon relative ${active === 'cart' ? 'bg-coal/5 dark:bg-white/10' : ''}`,
    'aria-label': count ? `Кошик: ${count} шт.` : 'Кошик',
    'aria-current': active === 'cart' ? 'page' : null,
  },
  icon('shopping-cart', 'text-xl'),
  count > 0 && el('span', {
    class: 'absolute right-0 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold-loud px-1 text-[11px] font-semibold leading-none text-ink tabular-nums',
  }, count > 99 ? '99+' : count))
}

/** Перемикач теми: місяць видно у світлій темі, сонце — у темній. */
function themeToggle() {
  const button = el('button', {
    type: 'button',
    class: 'btn-icon',
    'aria-label': 'Темна тема',
    'aria-pressed': String(document.documentElement.classList.contains('dark')),
    onClick: () => {
      const isDark = document.documentElement.classList.toggle('dark')
      button.setAttribute('aria-pressed', String(isDark))
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
    },
  }, icon('moon', 'text-xl dark:hidden'), icon('sun', 'hidden text-xl dark:inline-block'))
  return button
}

/** Логотип-«замок»: Omni (засічковий) над TECH (жирний). */
export function logo() {
  return el('a', { href: '/', class: 'lockup-logo', 'aria-label': 'OmniTech — на головну' },
    el('span', { class: 'l1', 'aria-hidden': 'true' }, 'Omni'),
    el('span', { class: 'l2', 'aria-hidden': 'true' }, 'TECH'))
}

/** Меню на весь екран: <dialog>. Esc, утримання фокуса й «неактивність» решти сторінки дає сам браузер. */
function menuOverlay(user, active) {
  const dialog = el('dialog', { class: 'menu-overlay', 'aria-label': 'Головне меню' },
    el('div', { class: 'flex h-full flex-col px-[var(--pad)] py-4' },
      el('div', { class: 'flex items-center justify-between' },
        el('span', { class: 'lockup-logo', 'aria-hidden': 'true' }, el('span', { class: 'l1' }, 'Omni'), el('span', { class: 'l2' }, 'TECH')),
        el('button', { type: 'button', class: 'pill pill-ghost', onClick: () => dialog.close() },
          roll('Закрити'), icon('x', 'text-lg'))),
      el('nav', { 'aria-label': 'Розділи сайту', class: 'my-auto space-y-1 py-8' },
        NAV.map((item, index) => menuLink(item, index, active))),
      el('div', { class: 'flex flex-wrap items-center gap-2 border-t border-[var(--hair)] pt-5' },
        user && el('p', { class: 'muted mr-2 max-w-full truncate text-sm' }, user.name),
        accountLinks(user, active),
        el('span', { class: 'ml-auto' }, motionSwitch()))))
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close() })
  // Ефекти (плавна прокрутка, тло) ставлять себе на паузу, поки меню відкрите
  dialog.addEventListener('close', () => window.dispatchEvent(new CustomEvent('omni:menu', { detail: { open: false } })))
  return dialog
}

let scrollWatch = false
/** Шапка ховається, коли гортаємо вниз, і повертається при гортанні вгору; після 10 px отримує фон. */
function watchScroll() {
  if (scrollWatch) return
  scrollWatch = true
  let lastY = scrollY
  let run = 0 // пройдено пікселів у поточному напрямку (знак = напрямок), скидається при зміні напрямку
  let queued = false
  const update = () => {
    queued = false
    const bar = document.querySelector('.site-header')
    if (!bar) return
    const y = scrollY
    bar.classList.toggle('is-solid', y > 10)
    // Ховаємо при гортанні вниз (далі 80 px від верху), показуємо при гортанні вгору; відкрите меню — завжди видно
    const menuOpen = Boolean(document.querySelector('dialog.menu-overlay[open]'))
    // Накопичуємо зсув у поточному напрямку — так спрацьовує і повільне гортання (по 1-3 px за кадр):
    // сховати після 24 px вниз, показати після 12 px вгору
    const dy = y - lastY
    if (dy !== 0) run = Math.sign(dy) === Math.sign(run) ? run + dy : dy
    if (y <= 80 || menuOpen) bar.classList.remove('is-hidden')
    else if (run >= 24) bar.classList.add('is-hidden')
    else if (run <= -12) bar.classList.remove('is-hidden')
    // Клас на <html> для інших частин сторінки (плаваючі фільтри піднімаються на місце шапки)
    document.documentElement.classList.toggle('header-hidden', bar.classList.contains('is-hidden'))
    lastY = y
  }
  addEventListener('scroll', () => {
    if (!queued) {
      queued = true
      requestAnimationFrame(update)
    }
  }, { passive: true })
  update()
}

/** Будує шапку в елементі #site-header. active — ключ поточної сторінки ('home', 'catalog'…). */
export function renderHeader(container, active) {
  const user = getUser()
  const overlay = menuOverlay(user, active)
  const wasHidden = container.querySelector('.site-header')?.classList.contains('is-hidden')

  container.replaceChildren(el('header', { class: `site-header ${wasHidden ? 'is-hidden' : ''}` },
    el('div', { class: 'header-row' },
      el('div', {}, logo()),
      el('nav', { class: 'header-nav', 'aria-label': 'Основні розділи' },
        NAV.slice(1).map((item) => el('a', { href: item.href, 'aria-current': item.key === active ? 'page' : null }, roll(item.label)))),
      el('div', { class: 'header-actions' },
        cartLink(active),
        themeToggle(),
        el('button', {
          type: 'button',
          class: 'pill pill-ink ml-1',
          'aria-haspopup': 'dialog',
          onClick: () => {
            overlay.classList.add('is-opening')
            setTimeout(() => overlay.classList.remove('is-opening'), 1400)
            overlay.showModal()
            window.dispatchEvent(new CustomEvent('omni:menu', { detail: { open: true } }))
          },
        }, roll('Меню'), icon('dots-six', 'text-lg')))),
  overlay))
  watchScroll()
}
