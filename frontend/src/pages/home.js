// Головна сторінка: категорії та популярні товари з API
import { apiRequest } from '../api/client.js'
import { initPage } from '../layout/page.js'
import { refreshEffects, riseIn } from '../layout/effects.js'
import { byId, el, icon } from '../ui/dom.js'
import { productCard } from '../ui/product-card.js'
import { artSvg, kindForCategory } from '../ui/illustrations.js'
import { renderLineSkeletons, renderCardSkeletons, renderEmpty, renderError, doneLoading } from '../ui/states.js'
import { loadWishlist } from '../store/wishlist.js'

initPage({ active: 'home' })

const categoryList = byId('category-list')
const list = byId('popular-list')

/** Рядок категорії: номер, назва великими літерами, кількість товарів, ілюстрація і стрілка. Клік веде в каталог з фільтром. */
function categoryRow(category, index) {
  return el('a', { href: `/catalog.html?category=${category.id}`, class: 'cat-row' },
    el('span', { class: 'n' }, String(index + 1).padStart(2, '0')),
    el('span', { class: 'name' }, category.name),
    el('span', { class: 'meta' },
      el('span', { class: 'art' }, artSvg(kindForCategory(category.name))),
      `${category.product_count} шт.`,
      icon('arrow-up-right', 'text-xl')))
}

async function loadCategories() {
  renderLineSkeletons(categoryList, 4)
  try {
    const categories = await apiRequest('/api/v1/categories')
    if (categories.length === 0) {
      renderEmpty(categoryList, { title: 'Категорій поки немає', text: 'Вони з’являться, щойно адміністратор їх додасть.' })
      return
    }
    doneLoading(categoryList)
    categoryList.replaceChildren(...categories.map(categoryRow))
    riseIn(categoryList)
  } catch (error) {
    renderError(categoryList, error, loadCategories)
  }
  refreshEffects()
}

// async-функція: усередині можна писати await — «зачекай відповіді сервера, а тоді продовжуй»
async function loadPopular() {
  renderCardSkeletons(list, 4)
  try {
    // featured=true — лише товари, які адміністратор позначив «на головній».
    // Promise.all запускає обидва запити одночасно й чекає, поки завершаться обидва
    const [page] = await Promise.all([
      apiRequest('/api/v2/products', { query: { featured: true, size: 8 } }),
      loadWishlist(),
    ])
    if (page.items.length === 0) {
      renderEmpty(list, {
        title: 'Популярних товарів поки немає',
        text: 'Скоро тут з’являться товари, які ми радимо найчастіше.',
      })
      return
    }
    doneLoading(list)
    list.replaceChildren(...page.items.map(productCard))
    riseIn(list)
  } catch (error) {
    renderError(list, error, loadPopular)
  }
  refreshEffects()
}

loadCategories()
loadPopular()
