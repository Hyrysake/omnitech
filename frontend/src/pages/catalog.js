// Каталог: пошук, фільтри, сортування й сторінки. Усі дані — з API v2 (товар разом із категорією й рейтингом).
import { apiRequest, isAbort } from '../api/client.js'
import { initPage } from '../layout/page.js'
import { refreshEffects } from '../layout/effects.js'
import { enhanceSelect, syncSelect } from '../ui/select.js'
import { initFloatingFilters } from '../ui/floating-filters.js'
import { byId, el } from '../ui/dom.js'
import { custom, integer, length, showServerErrors, validateForm, clearErrors } from '../ui/forms.js'
import { renderPagination } from '../ui/pagination.js'
import { productCard } from '../ui/product-card.js'
import { renderCardSkeletons, renderEmpty, renderError, doneLoading } from '../ui/states.js'
import { loadWishlist } from '../store/wishlist.js'

initPage({ active: 'catalog' })

const form = byId('filters')
const list = byId('products')
const pagination = byId('pagination')
const totalLabel = byId('total')
const resetButton = byId('reset')
const PAGE_SIZE = 12
const SORTS = ['default', 'price_asc', 'price_desc', 'name', 'newest']

// ---------- Фільтри живуть в адресі сторінки: /catalog.html?q=ноутбук&category=1&page=2 ----------

/** Читає фільтри з адреси. Усе, що не схоже на правильне значення, відкидаємо (адресу міг змінити хто завгодно). */
function readFilters() {
  const params = new URLSearchParams(location.search)
  const number = (name) => (/^\d{1,8}$/.test(params.get(name) ?? '') ? params.get(name) : '')
  return {
    q: (params.get('q') ?? '').trim().slice(0, 100),
    category: number('category'),
    min: number('min'),
    max: number('max'),
    sort: SORTS.includes(params.get('sort')) ? params.get('sort') : 'default',
    page: Math.max(1, Number(number('page')) || 1),
  }
}

/** Записує фільтри в адресу (без перезавантаження сторінки) і додає крок в історію браузера для кнопки «Назад». */
function writeFilters(filters, replace = false) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    const isDefault = (key === 'sort' && value === 'default') || (key === 'page' && value === 1)
    if (value !== '' && !isDefault) params.set(key, value)
  }
  const query = params.toString()
  // replaceState підміняє поточний запис історії, pushState додає новий (кнопка «Назад» повертає на нього)
  history[replace ? 'replaceState' : 'pushState'](null, '', query ? `?${query}` : location.pathname)
}

/** Показує фільтри у формі (після переходу «Назад» форма має збігатися з адресою). */
function fillForm(filters) {
  for (const name of ['q', 'category', 'min', 'max', 'sort']) form.elements[name].value = filters[name]
  syncSelect(form.elements.sort)
  markChips()
}

const isFiltered = (filters) => Boolean(filters.q || filters.category || filters.min || filters.max)

// ---------- Завантаження ----------

const chips = byId('category-chips')

const CHIP = 'inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors duration-200'
const CHIP_OFF = `${CHIP} border-line hover:border-gold dark:border-line-dark dark:hover:border-gold-bright`
const CHIP_ON = `${CHIP} border-coal bg-coal text-paper dark:border-paper dark:bg-paper dark:text-ink`

/** Підсвічує чіп поточної категорії (aria-pressed читає й екранна читалка). */
function markChips() {
  const current = form.elements.category.value
  for (const item of chips.children) {
    const on = item.dataset.id === current
    item.setAttribute('aria-pressed', String(on))
    item.className = on ? CHIP_ON : CHIP_OFF
  }
}

function chip(id, label) {
  return el('button', {
    type: 'button',
    dataset: { id },
    class: CHIP_OFF,
    'aria-pressed': 'false',
    onClick: () => {
      form.elements.category.value = id
      applyForm()
    },
  }, label)
}

async function loadCategories() {
  chips.replaceChildren(chip('', 'Усі'))
  markChips()
  try {
    const categories = await apiRequest('/api/v1/categories')
    chips.append(...categories.map((category) => chip(String(category.id), `${category.name} (${category.product_count})`)))
    markChips()   // категорія з адреси, тепер коли чіпи вже є
  } catch {
    // Без списку категорій каталог однаково працює (лишиться чіп «Усі»),
    // а про недоступність сервера скаже блок товарів
  }
}

// AbortController дозволяє скасувати запит. Якщо користувач швидко змінив фільтр двічі, відповідь
// на перший (старий) запит не повинна «перемогти» другу, тому попередній запит скасовуємо
let controller = null
// Після зміни сторінки (кнопки або «Назад»/«Вперед») — до початку результатів, коли нові картки вже намальовані
let scrollAfterLoad = false
// Прокрутку після «Назад»/«Вперед» ставимо самі, після завантаження даних
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
// Список бажань (які серця зафарбовані) завантажуємо один раз, а не при кожній зміні фільтра
const wishlistReady = loadWishlist()

async function loadProducts() {
  const filters = readFilters()
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal

  // Тримаємо висоту списку, поки вантажаться дані: інакше сторінка на мить коротшає і браузер
  // «притискає» прокрутку до нового низу (після кліку на сторінку 2 користувач бачив би низ сторінки)
  if (list.offsetHeight) list.style.minHeight = `${list.offsetHeight}px`
  renderCardSkeletons(list, 4)
  totalLabel.textContent = '…'
  resetButton.hidden = !isFiltered(filters)
  try {
    const request = apiRequest('/api/v2/products', {
      query: {
        q: filters.q,
        category_id: filters.category,
        min_price: filters.min,
        max_price: filters.max,
        sort: filters.sort,
        page: filters.page,
        size: PAGE_SIZE,
      },
      signal,
    })
    const [data] = await Promise.all([request, wishlistReady])
    if (signal !== controller.signal) return   // поки чекали, почався новіший запит: його відповідь важливіша
    showProducts(data, filters)
    list.style.minHeight = ''
    if (scrollAfterLoad) scrollToFilters()
    scrollAfterLoad = false
  } catch (error) {
    list.style.minHeight = ''
    if (isAbort(error)) return               // цей запит скасували самі: уже йде новіший
    totalLabel.textContent = '0'
    pagination.replaceChildren()
    if (error.status === 400 || error.status === 422) {
      // Неправильні фільтри в адресі (наприклад, ціна «від» більша за «до»): показуємо біля полів
      showServerErrors(form, error, { min_price: 'min', max_price: 'max', category_id: 'category' })
      renderEmpty(list, { iconName: 'funnel', title: 'Перевірте фільтри', text: error.message })
    } else {
      renderError(list, error, loadProducts)
    }
  }
}

function showProducts(data, filters) {
  totalLabel.textContent = data.total
  renderPagination(pagination, data, goToPage, { scrollTarget: false })
  if (data.items.length > 0) {
    doneLoading(list)
    list.replaceChildren(...data.items.map(productCard))
    refreshEffects()
    return
  }
  if (data.total > 0) {
    // Номер сторінки більший, ніж їх є (наприклад, старе посилання ?page=9)
    renderEmpty(list, {
      title: 'Такої сторінки немає',
      text: `У результатах лише ${data.pages} стор.`,
      action: el('button', { type: 'button', class: 'btn btn-primary', onClick: () => goToPage(1) }, 'До першої сторінки'),
    })
  } else if (isFiltered(filters)) {
    renderEmpty(list, {
      iconName: 'magnifying-glass',
      title: 'За цим запитом нічого не знайдено',
      text: 'Спробуйте змінити слова пошуку, розширити діапазон ціни або обрати іншу категорію.',
      action: el('button', { type: 'button', class: 'btn btn-primary', onClick: resetFilters }, 'Скинути фільтри'),
    })
  } else {
    renderEmpty(list, { title: 'Каталог поки порожній', text: "Товари з'являться тут, щойно адміністратор додасть їх." })
  }
}

// ---------- Дії користувача ----------

const RULES = {
  q: [length(0, 100)],
  min: [integer(0, 10_000_000)],
  max: [
    integer(0, 10_000_000),
    custom((max, f) => max === '' || f.elements.min.value === '' || Number(max) >= Number(f.elements.min.value),
      'Ціна «до» не може бути меншою за ціну «від».'),
  ],
}

function applyForm({ replace = false } = {}) {
  if (!validateForm(form, RULES)) return
  const data = new FormData(form)
  // Нові фільтри — завжди з першої сторінки
  writeFilters({
    q: data.get('q').trim(),
    category: data.get('category'),
    min: data.get('min').trim(),
    max: data.get('max').trim(),
    sort: data.get('sort'),
    page: 1,
  }, replace)
  markChips()
  loadProducts()
  // Фільтр змінили в «плаваючій» панелі далеко внизу: результатів може стати менше, і вони опиняться
  // над екраном — повертаємо користувача до початку списку (як при переході на іншу сторінку)
  if (form.classList.contains('is-floating')) scrollToFilters()
}

function goToPage(page) {
  writeFilters({ ...readFilters(), page })
  scrollAfterLoad = true
  loadProducts()
}

function resetFilters() {
  history.pushState(null, '', location.pathname)
  clearErrors(form)
  fillForm(readFilters())
  loadProducts()
}

form.addEventListener('submit', (event) => {
  event.preventDefault()           // без цього браузер перезавантажив би сторінку
  applyForm()
})
// Сортування й ціна застосовуються одразу після зміни, без кнопки «Знайти»
form.elements.sort.addEventListener('change', () => applyForm())
form.elements.min.addEventListener('change', () => applyForm())
form.elements.max.addEventListener('change', () => applyForm())

// «Живий» пошук: результати оновлюються, коли користувач на мить перестав друкувати.
// Таймер скидається при кожній літері, тому запит іде один, а не після кожної літери
let typingTimer = null
form.elements.q.addEventListener('input', () => {
  clearTimeout(typingTimer)
  typingTimer = setTimeout(() => applyForm({ replace: true }), 350)
})
resetButton.addEventListener('click', resetFilters)

// Кнопки «Назад» / «Вперед» браузера змінюють адресу: повертаємо форму й список до неї
window.addEventListener('popstate', () => {
  clearErrors(form)
  fillForm(readFilters())
  // «Назад»/«Вперед» між сторінками каталогу: теж до початку результатів (не туди, де браузер лишив прокрутку)
  scrollAfterLoad = true
  loadProducts()
})

// Гарний випадний список замість стандартного (справжній <select> лишається у формі)
enhanceSelect(form.elements.sort)
// Блок фільтрів відгортається, а при гортанні вгору повертається компактною панеллю під шапкою
const scrollToFilters = initFloatingFilters(form, byId('filters-toggle'), byId('filters-extra'))
fillForm(readFilters())
loadCategories()
loadProducts()
