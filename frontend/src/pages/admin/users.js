// Адмін-панель, «Користувачі»: GET /api/v1/admin/users?q=&page=
import { apiRequest, isAbort } from '../../api/client.js'
import { initAdminPage } from '../../layout/admin.js'
import { byId, el } from '../../ui/dom.js'
import { formatDate } from '../../ui/format.js'
import { pageFromUrl, rememberPage, renderPagination } from '../../ui/pagination.js'
import { doneLoading, renderEmpty, renderError, renderLineSkeletons } from '../../ui/states.js'
import { dataTable } from '../../ui/table.js'

const form = byId('filters')
const table = byId('table')
const pagination = byId('pagination')
const totalLabel = byId('total')
let query = ''
let controller = null

const COLUMNS = [
  { label: "Ім'я", cell: (user) => el('span', { class: 'font-semibold' }, user.name) },
  { label: 'Пошта', cell: (user) => user.email, class: 'break-all' },
  {
    label: 'Роль',
    cell: (user) => el('span', {
      class: user.role === 'admin'
        ? 'rounded-full bg-coal px-3 py-1 text-xs font-semibold text-paper dark:bg-paper dark:text-ink'
        : 'rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800 dark:bg-stone-800 dark:text-stone-200',
    }, user.role === 'admin' ? 'Адміністратор' : 'Покупець'),
  },
  { label: 'Зареєстрований', cell: (user) => formatDate(user.created_at), class: 'whitespace-nowrap' },
]

async function loadUsers(page = 1) {
  rememberPage(page)
  controller?.abort()
  controller = new AbortController()
  renderLineSkeletons(table, 5)
  try {
    const data = await apiRequest('/api/v1/admin/users', { auth: true, query: { q: query, page, size: 20 }, signal: controller.signal })
    if (data.items.length === 0 && data.total > 0) {
      // Такої сторінки вже немає (видалили останній запис на ній або в адресі завеликий ?page): показуємо останню
      loadUsers(data.pages)
      return
    }
    totalLabel.textContent = data.total
    renderPagination(pagination, data, loadUsers)
    if (data.items.length === 0) {
      renderEmpty(table, { iconName: 'users', title: 'Нікого не знайдено', text: 'Спробуйте інше ім’я або частину пошти.' })
      return
    }
    doneLoading(table)
    table.replaceChildren(dataTable(COLUMNS, data.items, 'Користувачі'))
  } catch (error) {
    if (isAbort(error)) return
    if (error.status !== 401) renderError(table, error, () => loadUsers(page))
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  query = form.elements.q.value.trim().slice(0, 100)
  loadUsers(1)
})

if (initAdminPage('users')) loadUsers(pageFromUrl())
