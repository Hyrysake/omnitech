// «Список бажань»: GET /api/v1/users/me/wishlist; прибрати — DELETE, у кошик — localStorage
import { apiRequest } from '../api/client.js'
import { requireUser } from '../auth/guards.js'
import { initPage } from '../layout/page.js'
import { addToCart } from '../store/cart.js'
import { setWishlist, toggleWishlist } from '../store/wishlist.js'
import { byId, el, icon } from '../ui/dom.js'
import { formatPrice } from '../ui/format.js'
import { productImage } from '../ui/product-card.js'
import { doneLoading, renderEmpty, renderError, renderLineSkeletons } from '../ui/states.js'
import { showToast } from '../ui/toast.js'

initPage({ active: 'wishlist' })
const list = byId('wishlist')

function showEmpty() {
  renderEmpty(list, {
    iconName: 'heart',
    title: 'Список бажань порожній',
    text: 'Натисніть на серце біля товару в каталозі, щоб зберегти його тут.',
    action: el('a', { href: '/catalog.html', class: 'btn btn-primary' }, 'До каталогу'),
  })
}

function item(product) {
  return el('article', { class: 'card row-card flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap sm:gap-6 sm:p-5', dataset: { product: product.id } },
    el('a', { href: `/product.html?id=${product.id}`, class: 'w-28 shrink-0 overflow-hidden rounded-sm' }, productImage(product)),
    el('div', { class: 'min-w-0 flex-1' },
      el('a', { href: `/product.html?id=${product.id}`, class: 'font-semibold hover:underline' }, product.name),
      el('p', { class: 'price mt-1 text-3xl' }, formatPrice(product.price))),
    el('div', { class: 'flex items-center gap-2' },
      el('button', {
        type: 'button',
        class: 'btn btn-primary',
        onClick: () => {
          addToCart(product.id, 1)
          showToast(`«${product.name}» додано в кошик.`)
        },
      }, icon('shopping-cart-simple'), 'У кошик'),
      el('button', {
        type: 'button',
        class: 'btn-icon text-red-700 dark:text-red-400',
        'aria-label': `Прибрати зі списку бажань: ${product.name}`,
        onClick: () => toggleWishlist(product),
      }, icon('x', 'text-lg'))))
}

async function load() {
  renderLineSkeletons(list, 3)
  try {
    const products = await apiRequest('/api/v1/users/me/wishlist', { auth: true })
    // setWishlist запам'ятовує, що в списку, — тоді кнопка «прибрати» знає, що це видалення (DELETE)
    setWishlist(products)
    if (products.length === 0) {
      showEmpty()
      return
    }
    doneLoading(list)
    list.replaceChildren(...products.map(item))
  } catch (error) {
    if (error.status !== 401) renderError(list, error, load)
  }
}

// Товар прибрали зі списку — прибираємо його рядок зі сторінки
window.addEventListener('wishlist:changed', ({ detail }) => {
  if (detail.saved) return
  list.querySelector(`[data-product="${detail.productId}"]`)?.remove()
  if (!list.querySelector('article')) showEmpty()
})

if (requireUser()) load()
