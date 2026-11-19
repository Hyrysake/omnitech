// Адмін-панель, «Товари»: список з пошуком і фільтрами, позначка «на головній», видалення
import { apiRequest, isAbort } from '../../api/client.js'
import { initAdminPage } from '../../layout/admin.js'
import { confirmDialog } from '../../ui/dialog.js'
import { byId, el, icon } from '../../ui/dom.js'
import { formatPrice } from '../../ui/format.js'
import { renderPagination } from '../../ui/pagination.js'
import { productImage } from '../../ui/product-card.js'
import { doneLoading, renderEmpty, renderError, renderLineSkeletons } from '../../ui/states.js'
import { dataTable } from '../../ui/table.js'
import { showToast } from '../../ui/toast.js'

const form = byId('filters')
const table = byId('table')
const pagination = byId('pagination')
const totalLabel = byId('total')

/** Фільтри з адреси сторінки (?q=&category=&featured=&page=), щоб після перезавантаження нічого не губилось. */
function readState() {
  const params = new URLSearchParams(location.search)
  return {
    q: (params.get('q') ?? '').trim().slice(0, 100),
    category: /^\d{1,8}$/.test(params.get('category') ?? '') ? params.get('category') : '',
    featured: ['true', 'false'].includes(params.get('featured')) ? params.get('featured') : '',
    page: Math.max(1, Number(params.get('page')) || 1),
  }
}

function writeState(state) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(state)) {
    if (value !== '' && !(key === 'page' && value === 1)) params.set(key, value)
  }
  history.replaceState(null, '', params.size ? `?${params}` : location.pathname)
}

async function loadCategories() {
  try {
    const categories = await apiRequest('/api/v1/categories')
    form.elements.category.append(...categories.map((c) => el('option', { value: c.id }, c.name)))
    form.elements.category.value = readState().category
  } catch {
    // Фільтр за категорією просто лишиться порожнім
  }
}

let controller = null

async function loadProducts() {
  const state = readState()
  controller?.abort()
  controller = new AbortController()
  renderLineSkeletons(table, 6)
  try {
    const data = await apiRequest('/api/v2/products', {
      query: { q: state.q, category_id: state.category, featured: state.featured, sort: 'newest', page: state.page, size: 20 },
      signal: controller.signal,
    })
    if (data.items.length === 0 && data.total > 0) {
      // Такої сторінки вже немає (видалили останній запис на ній або в адресі завеликий ?page): показуємо останню
      writeState({ ...readState(), page: data.pages })
      loadProducts()
      return
    }
    totalLabel.textContent = data.total
    renderPagination(pagination, data, (page) => {
      writeState({ ...readState(), page })
      return loadProducts()
    })
    if (data.items.length === 0) {
      renderEmpty(table, { title: 'Товарів не знайдено', text: 'Змініть умови пошуку або додайте новий товар.' })
      return
    }
    doneLoading(table)
    table.replaceChildren(dataTable(COLUMNS, data.items, 'Товари'))
  } catch (error) {
    if (isAbort(error)) return
    if (error.status !== 401) renderError(table, error, loadProducts)
  }
}

const COLUMNS = [
  {
    label: 'Товар',
    cell: (product) => el('a', { href: `/admin/product.html?id=${product.id}`, class: 'flex min-w-56 items-center gap-3 hover:underline' },
      el('span', { class: 'w-16 shrink-0 overflow-hidden rounded-lg' }, productImage(product)),
      el('span', { class: 'font-semibold' }, product.name)),
  },
  { label: 'Категорія', cell: (product) => product.category.name, class: 'whitespace-nowrap' },
  { label: 'Ціна', cell: (product) => formatPrice(product.price), class: 'whitespace-nowrap tabular-nums' },
  { label: 'На головній', cell: featuredToggle },
  {
    label: 'Дії',
    headClass: 'text-right',
    class: 'text-right whitespace-nowrap',
    cell: (product) => [
      el('a', { href: `/admin/product.html?id=${product.id}`, class: 'btn-icon inline-grid', 'aria-label': `Змінити: ${product.name}` },
        icon('pencil-simple', 'text-lg')),
      el('button', {
        type: 'button',
        class: 'btn-icon inline-grid text-red-700 dark:text-red-400',
        'aria-label': `Видалити: ${product.name}`,
        onClick: () => deleteProduct(product),
      }, icon('trash', 'text-lg')),
    ],
  },
]

/** Перемикач «на головній»: зміна одразу зберігається запитом PATCH лише з цим полем. */
function featuredToggle(product) {
  const box = el('input', {
    type: 'checkbox',
    class: 'size-5 cursor-pointer accent-gold',
    checked: product.is_featured,
    'aria-label': `Показувати на головній: ${product.name}`,
    onChange: async () => {
      box.disabled = true
      try {
        await apiRequest(`/api/v1/products/${product.id}`, { method: 'PATCH', auth: true, body: { is_featured: box.checked } })
        showToast(box.checked ? `«${product.name}» тепер на головній.` : `«${product.name}» прибрано з головної.`)
      } catch (error) {
        box.checked = !box.checked          // зміну не збережено — повертаємо, як було
        if (error.status !== 401) showToast(error.message, 'error')
      } finally {
        box.disabled = false
      }
    },
  })
  return box
}

async function deleteProduct(product) {
  const confirmed = await confirmDialog({
    title: `Видалити «${product.name}»?`,
    text: 'Товар зникне з каталогу, а разом з ним — відгуки про нього.',
    confirmLabel: 'Видалити',
  })
  if (!confirmed) return
  try {
    await apiRequest(`/api/v1/products/${product.id}`, { method: 'DELETE', auth: true })
    showToast(`Товар «${product.name}» видалено.`)
    loadProducts()
  } catch (error) {
    // 409: товар є в замовленнях — сервер пояснює, чому видалити не можна
    if (error.status !== 401) showToast(error.message, 'error')
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const data = new FormData(form)
  writeState({ q: data.get('q').trim(), category: data.get('category'), featured: data.get('featured'), page: 1 })
  loadProducts()
})
form.elements.category.addEventListener('change', () => form.requestSubmit())
form.elements.featured.addEventListener('change', () => form.requestSubmit())

if (initAdminPage('products')) {
  const state = readState()
  form.elements.q.value = state.q
  form.elements.featured.value = state.featured
  loadCategories()
  loadProducts()
}
