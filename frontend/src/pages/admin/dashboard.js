// Адмін-панель, «Огляд»: лічильники з GET /api/v1/admin/stats
import { apiRequest } from '../../api/client.js'
import { initAdminPage } from '../../layout/admin.js'
import { byId, el, icon, render } from '../../ui/dom.js'
import { formatPrice } from '../../ui/format.js'
import { ORDER_STATUSES, statusBadge } from '../../ui/order-status.js'
import { renderError, renderLineSkeletons, doneLoading } from '../../ui/states.js'

const statsBox = byId('stats')
const statusesBox = byId('statuses')

// Картки огляду: що показати і куди веде клік (href: null — картка без посилання: розділу ще немає або в нього немає окремої сторінки)
const CARDS = [
  { key: 'products', label: 'Товарів', iconName: 'package', href: '/admin/products.html' },
  { key: 'categories', label: 'Категорій', iconName: 'tag', href: '/admin/categories.html' },
  { key: 'users', label: 'Користувачів', iconName: 'users', href: '/admin/users.html' },
  { key: 'orders', label: 'Замовлень', iconName: 'receipt', href: '/admin/orders.html' },
  { key: 'unread_feedback', label: 'Непрочитаних повідомлень', iconName: 'envelope-simple', href: '/admin/feedback.html?unread=true' },
  { key: 'reviews', label: 'Відгуків про товари', iconName: 'star', href: '/admin/reviews.html' },
]

function statCard({ label, iconName, href }, value) {
  const content = [
    el('span', { class: 'grid size-12 shrink-0 place-items-center rounded-full bg-gold/10 text-gold dark:bg-gold-bright/15 dark:text-gold-bright' },
      icon(iconName, 'text-2xl')),
    el('div', {},
      el('p', { class: 'text-3xl font-semibold tabular-nums' }, value),
      el('p', { class: 'muted text-sm' }, label)),
  ]
  const cardClass = 'card flex items-center gap-4 p-5'
  return href
    ? el('a', { href, class: `${cardClass} transition-shadow hover:shadow-lg` }, content)
    : el('div', { class: cardClass }, content)
}

async function loadStats() {
  renderLineSkeletons(statsBox, 3)
  try {
    const stats = await apiRequest('/api/v1/admin/stats', { auth: true })
    doneLoading(statsBox)
    render(statsBox,
      CARDS.map((card) => statCard(card, stats[card.key])),
      statCard({ label: 'Виручка (виконані замовлення)', iconName: 'coins', href: null }, formatPrice(stats.revenue)))
    render(statusesBox, Object.keys(ORDER_STATUSES).map((status) =>
      el('div', { class: 'card flex items-center gap-3 px-4 py-3' },
        statusBadge(status),
        el('span', { class: 'text-lg font-semibold tabular-nums' }, stats.orders_by_status[status] ?? 0))))
  } catch (error) {
    if (error.status !== 401) renderError(statsBox, error, loadStats)
  }
}

if (initAdminPage('dashboard')) loadStats()
