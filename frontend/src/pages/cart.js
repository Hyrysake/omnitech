// Кошик: вміст з localStorage, ціни й суми — від сервера (POST /api/v1/cart/preview)
import { apiRequest, isAbort } from '../api/client.js'
import { initPage } from '../layout/page.js'
import { getCart, MAX_QUANTITY, removeFromCart, removeMissing, setQuantity } from '../store/cart.js'
import { byId, el, icon, render } from '../ui/dom.js'
import { formatPrice, plural } from '../ui/format.js'
import { productImage } from '../ui/product-card.js'
import { renderEmpty, renderError, renderLineSkeletons, doneLoading } from '../ui/states.js'

initPage({ active: 'cart' })

const box = byId('cart')
const notice = byId('notice')
let controller = null

function showEmpty() {
  renderEmpty(box, {
    iconName: 'shopping-cart',
    title: 'Кошик порожній',
    text: 'Додайте товари з каталогу, і вони з’являться тут.',
    action: el('a', { href: '/catalog.html', class: 'btn btn-primary' }, 'До каталогу'),
  })
}

async function loadCart({ quiet = false } = {}) {
  const items = getCart()
  // Старий запит скасовуємо першим ділом: інакше його пізня відповідь намалювала б уже прибраний товар
  controller?.abort()
  // Порожній кошик серверу не надсилаємо: він відповів би 422 (потрібен хоча б один товар)
  if (items.length === 0) {
    showEmpty()
    return
  }
  controller = new AbortController()
  if (!quiet) renderLineSkeletons(box, items.length + 1)
  box.setAttribute('aria-busy', 'true')
  try {
    const preview = await apiRequest('/api/v1/cart/preview', { method: 'POST', body: { items }, signal: controller.signal })
    if (preview.missing.length > 0) {
      // Товар видалили з каталогу, поки він лежав у кошику: прибираємо його й пояснюємо чому
      removeMissing(preview.missing)
      render(notice, el('div', { class: 'alert alert-info', role: 'status' }, icon('info', 'mt-0.5 shrink-0 text-xl'),
        el('p', {}, `${preview.missing.length} ${plural(preview.missing.length, ['товар', 'товари', 'товарів'])} уже немає в продажу, тому їх прибрано з кошика.`)))
    }
    if (preview.lines.length === 0) {
      showEmpty()
      return
    }
    doneLoading(box)
    render(box, el('div', { class: 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14' },
      el('ul', { class: 'space-y-4', 'aria-label': 'Товари в кошику' }, preview.lines.map(cartLine)),
      summary(preview)))
  } catch (error) {
    if (isAbort(error)) return
    renderError(box, error, () => loadCart())
  }
}

function cartLine(line) {
  const { product } = line
  const quantity = el('input', {
    type: 'number', min: 1, max: MAX_QUANTITY, value: line.quantity, inputmode: 'numeric',
    class: 'input w-20 text-center tabular-nums', 'aria-label': `Кількість: ${product.name}`,
  })
  // change спрацьовує, коли поле втратило фокус або натиснули Enter — не на кожну цифру
  quantity.addEventListener('change', () => {
    const value = Math.trunc(Number(quantity.value))
    setQuantity(product.id, Number.isFinite(value) && value > 0 ? value : 1)
    loadCart({ quiet: true })
  })
  return el('li', { class: 'card row-card flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap sm:gap-6 sm:p-5' },
    el('a', { href: `/product.html?id=${product.id}`, class: 'w-28 shrink-0 overflow-hidden rounded-sm' }, productImage(product)),
    el('div', { class: 'min-w-0 flex-1' },
      el('a', { href: `/product.html?id=${product.id}`, class: 'font-semibold hover:underline' }, product.name),
      el('p', { class: 'muted mt-1 text-sm tabular-nums' }, `${formatPrice(product.price)} за шт.`)),
    el('div', { class: 'flex items-center gap-3' },
      quantity,
      el('p', { class: 'price w-32 text-right text-2xl' }, formatPrice(line.line_total)),
      el('button', {
        type: 'button',
        class: 'btn-icon text-red-700 dark:text-red-400',
        'aria-label': `Прибрати з кошика: ${product.name}`,
        onClick: () => {
          removeFromCart(product.id)
          loadCart({ quiet: true })
        },
      }, icon('trash', 'text-lg'))))
}

function summary(preview) {
  return el('aside', { class: 'card h-fit space-y-4 p-6 sm:p-8 lg:sticky lg:top-28', 'aria-label': 'Підсумок' },
    el('h2', { class: 'block-title' }, 'Разом'),
    el('p', { class: 'sum-line' },
      el('span', {}, `${preview.count} ${plural(preview.count, ['товар', 'товари', 'товарів'])}`),
      el('span', { class: 'tabular-nums' }, formatPrice(preview.total))),
    el('p', { class: 'sum-line' }, el('span', {}, 'Доставка'), el('span', {}, 'за тарифами перевізника')),
    el('p', { class: 'sum-total' },
      el('span', { class: 'text-sm font-semibold uppercase tracking-widest' }, 'До сплати'), el('span', { class: 'price' }, formatPrice(preview.total))),
    el('a', { href: '/checkout.html', class: 'btn btn-primary min-h-12 w-full' }, 'Оформити замовлення', icon('arrow-right')),
    el('a', { href: '/catalog.html', class: 'btn btn-secondary w-full' }, 'Продовжити покупки'))
}

loadCart()
