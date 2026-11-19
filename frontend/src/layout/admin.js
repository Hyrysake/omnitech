// Спільний каркас сторінок адмін-панелі: перевірка ролі й бічне меню розділів.
import { initPage } from './page.js'
import { goToLogin } from '../auth/guards.js'
import { byId, el, icon, render } from '../ui/dom.js'
import { renderForbidden } from '../ui/states.js'

// Розділи адмін-панелі. key — назва розділу, яку передає сторінка, щоб підсвітити свій пункт
const TABS = [
  { key: 'dashboard', href: '/admin/', label: 'Огляд', iconName: 'squares-four' },
  { key: 'products', href: '/admin/products.html', label: 'Товари', iconName: 'package' },
  { key: 'categories', href: '/admin/categories.html', label: 'Категорії', iconName: 'tag' },
  { key: 'orders', href: '/admin/orders.html', label: 'Замовлення', iconName: 'receipt' },
  { key: 'feedback', href: '/admin/feedback.html', label: 'Повідомлення', iconName: 'chat-circle-text' },
  { key: 'reviews', href: '/admin/reviews.html', label: 'Відгуки про товари', iconName: 'star' },
  { key: 'users', href: '/admin/users.html', label: 'Користувачі', iconName: 'users' },
]

/**
 * Старт сторінки адмінки. Гість іде на сторінку входу, звичайний покупець бачить «Доступ заборонено».
 * Повертає адміністратора або null (тоді сторінка нічого більше не робить).
 * Справжній захист — на сервері: без ролі admin кожен запит отримає 403, хоч би що показав браузер.
 */
export function initAdminPage(active) {
  const user = initPage({ active: 'admin' })
  if (!user) {
    goToLogin('Увійдіть як адміністратор, щоб відкрити адмін-панель.')
    return null
  }
  if (user.role !== 'admin') {
    renderForbidden(byId('admin-root'))
    return null
  }
  render(byId('admin-nav'),
    el('p', { class: 'muted px-4 text-xs font-semibold uppercase tracking-wider' }, 'Адмін-панель'),
    el('div', { class: 'mt-3 flex flex-wrap gap-1 lg:flex-col' },
      TABS.map((tab) => el('a', {
        href: tab.href,
        'aria-current': tab.key === active ? 'page' : null,
        class: `flex min-h-11 items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${tab.key === active
          ? 'bg-coal text-paper dark:bg-paper dark:text-ink'
          : 'text-graphite hover:bg-coal/5 dark:text-stone-300 dark:hover:bg-white/10'}`,
      }, icon(tab.iconName, 'text-xl'), tab.label))))
  return user
}
