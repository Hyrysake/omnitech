// Адмін-панель, «Замовлення»: GET /api/v1/admin/orders?status=&page=, видалення
import { apiRequest, isAbort } from '../../api/client.js'
import { initAdminPage } from '../../layout/admin.js'
import { confirmDialog } from '../../ui/dialog.js'
import { byId, el, icon } from '../../ui/dom.js'
import { formatDateTime, formatPrice } from '../../ui/format.js'
import { ORDER_STATUSES, statusBadge } from '../../ui/order-status.js'
import { pageFromUrl, rememberPage, renderPagination } from '../../ui/pagination.js'
import { doneLoading, renderEmpty, renderError, renderLineSkeletons } from '../../ui/states.js'
import { dataTable } from '../../ui/table.js'
import { showToast } from '../../ui/toast.js'

const statusSelect = byId('status')
const table = byId('table')
const pagination = byId('pagination')
const totalLabel = byId('total')
let currentPage = pageFromUrl()
let controller = null

const COLUMNS = [
  { label: '№', cell: (order) => el('a', { href: `/admin/order.html?id=${order.id}`, class: 'link' }, `№${order.id}`) },
  { label: 'Дата', cell: (order) => formatDateTime(order.created_at), class: 'whitespace-nowrap' },
  {
    label: 'Покупець',
    cell: (order) => [el('p', { class: 'font-semibold' }, order.customer_name), el('p', { class: 'muted text-xs' }, order.phone)],
  },
  { label: 'Сума', cell: (order) => formatPrice(order.total), class: 'whitespace-nowrap tabular-nums' },
  { label: 'Статус', cell: (order) => statusBadge(order.status) },
  {
    label: 'Дії',
    headClass: 'text-right',
    class: 'text-right whitespace-nowrap',
    cell: (order) => [
      el('a', { href: `/admin/order.html?id=${order.id}`, class: 'btn-icon inline-grid', 'aria-label': `Відкрити замовлення №${order.id}` },
        icon('eye', 'text-lg')),
      el('button', {
        type: 'button',
        class: 'btn-icon inline-grid text-red-700 dark:text-red-400',
        'aria-label': `Видалити замовлення №${order.id}`,
        onClick: () => deleteOrder(order),
      }, icon('trash', 'text-lg')),
    ],
  },
]

async function loadOrders(page = currentPage) {
  currentPage = page
  rememberPage(page)
  controller?.abort()
  controller = new AbortController()
  renderLineSkeletons(table, 6)
  try {
    const data = await apiRequest('/api/v1/admin/orders', {
      auth: true, query: { status: statusSelect.value, page, size: 20 }, signal: controller.signal,
    })
    if (data.items.length === 0 && data.total > 0) {
      // Такої сторінки вже немає (видалили останній запис на ній або в адресі завеликий ?page): показуємо останню
      loadOrders(data.pages)
      return
    }
    totalLabel.textContent = data.total
    renderPagination(pagination, data, loadOrders)
    if (data.items.length === 0) {
      renderEmpty(table, { iconName: 'receipt', title: 'Замовлень не знайдено', text: 'Спробуйте інший статус.' })
      return
    }
    doneLoading(table)
    table.replaceChildren(dataTable(COLUMNS, data.items, 'Замовлення'))
  } catch (error) {
    if (isAbort(error)) return
    if (error.status !== 401) renderError(table, error, () => loadOrders(page))
  }
}

async function deleteOrder(order) {
  const confirmed = await confirmDialog({
    title: `Видалити замовлення №${order.id}?`,
    text: 'Замовлення зникне і з історії покупця. Скасоване замовлення краще залишити зі статусом «Скасовано».',
    confirmLabel: 'Видалити',
  })
  if (!confirmed) return
  try {
    await apiRequest(`/api/v1/admin/orders/${order.id}`, { method: 'DELETE', auth: true })
    showToast(`Замовлення №${order.id} видалено.`)
    loadOrders()
  } catch (error) {
    if (error.status !== 401) showToast(error.message, 'error')
  }
}

statusSelect.append(...Object.entries(ORDER_STATUSES).map(([value, info]) => el('option', { value }, info.label)))
statusSelect.addEventListener('change', () => loadOrders(1))

if (initAdminPage('orders')) loadOrders()
