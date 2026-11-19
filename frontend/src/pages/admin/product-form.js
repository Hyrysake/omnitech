// Адмін-панель: форма товару. Без ?id= — новий товар (POST), з ?id=5 — редагування (PATCH) і фото товару.
import { apiRequest } from '../../api/client.js'
import { initAdminPage } from '../../layout/admin.js'
import { confirmDialog } from '../../ui/dialog.js'
import { byId, el, render } from '../../ui/dom.js'
import { setFlash } from '../../ui/flash.js'
import {
  clearErrors, custom, fieldValue, integer, length, required, setBusy, showFieldError, showServerErrors, validateForm,
} from '../../ui/forms.js'
import { productImage } from '../../ui/product-card.js'
import { renderError, renderNotFound } from '../../ui/states.js'
import { showToast } from '../../ui/toast.js'

const form = byId('product-form')
const imageBox = byId('image-box')
const imageForm = byId('image-form')
const imagePreview = byId('image-preview')
const deleteImageButton = byId('delete-image')
const deleteProductButton = byId('delete-product')

const MAX_FILE_MB = 5
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const rawId = new URLSearchParams(location.search).get('id')
const productId = rawId === null ? null : (/^\d{1,10}$/.test(rawId) && Number(rawId) > 0 ? Number(rawId) : NaN)
let product = null            // товар, як він зараз збережений на сервері (для редагування)

// Правила — як у схемах ProductCreate/ProductUpdate на сервері
const RULES = {
  name: [required('Вкажіть назву товару.'), length(3, 200)],
  category_id: [required('Оберіть категорію.')],
  price: [required('Вкажіть ціну.'), integer(1, 10_000_000)],
  description: [length(0, 1000)],
  image_url: [
    length(0, 500),
    custom((value) => value === '' || /^https?:\/\/\S+$/.test(value) || value === product?.image_url,
      'Адреса має починатися з http:// або https://.'),
  ],
}

/** Дані форми у форматі API: ціна й категорія — числа, «на головній» — true/false. */
function formData() {
  return {
    name: fieldValue(form, 'name'),
    category_id: Number(form.elements.category_id.value),
    price: Number(fieldValue(form, 'price')),
    description: fieldValue(form, 'description'),
    image_url: fieldValue(form, 'image_url'),
    is_featured: form.elements.is_featured.checked,
  }
}

function fillForm(data) {
  form.elements.name.value = data.name
  form.elements.category_id.value = data.category_id
  form.elements.price.value = data.price
  form.elements.description.value = data.description
  form.elements.image_url.value = data.image_url
  form.elements.is_featured.checked = data.is_featured
}

function showImage() {
  render(imagePreview, productImage(product))
  deleteImageButton.hidden = product.image_url === ''
}

async function load() {
  try {
    // Promise.all: категорії й товар завантажуються одночасно
    const [categories, loaded] = await Promise.all([
      apiRequest('/api/v1/categories'),
      productId === null ? null : apiRequest(`/api/v1/products/${productId}`),
    ])
    form.elements.category_id.append(...categories.map((c) => el('option', { value: c.id }, c.name)))
    if (loaded) {
      product = loaded
      document.title = `${product.name} — адмін-панель | OmniTech`
      byId('form-title').textContent = 'Редагування товару'
      fillForm(product)
      imageBox.hidden = false
      deleteProductButton.hidden = false
      showImage()
    }
  } catch (error) {
    if (error.status === 404) showMissing()
    else if (error.status !== 401) renderError(byId('form-root'), error, () => location.reload())
  }
}

function showMissing() {
  byId('form-title').textContent = 'Товар не знайдено'
  renderNotFound(byId('form-root'), {
    title: 'Такого товару немає',
    text: 'Можливо, його вже видалили.',
    action: el('a', { href: '/admin/products.html', class: 'btn btn-primary' }, 'До списку товарів'),
  })
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!validateForm(form, RULES)) return
  const data = formData()
  const done = setBusy(form.querySelector('button[type=submit]'), 'Зберігаємо…')
  try {
    if (product === null) {
      // Новий товар: POST повертає 201 Created і створений товар разом з його номером
      const created = await apiRequest('/api/v1/products', { method: 'POST', auth: true, body: data })
      setFlash(`Товар «${created.name}» створено. Тепер можна завантажити його фото.`)
      location.replace(`/admin/product.html?id=${created.id}`)
      return
    }
    // Редагування: PATCH надсилає лише поля, які справді змінились
    const changes = Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== product[key]))
    if (Object.keys(changes).length === 0) {
      showToast('Змін немає — зберігати нічого.', 'info')
    } else {
      product = await apiRequest(`/api/v1/products/${product.id}`, { method: 'PATCH', auth: true, body: changes })
      fillForm(product)
      showImage()
      showToast('Зміни збережено.')
    }
  } catch (error) {
    if (error.status === 404) showMissing()
    else showServerErrors(form, error)
  } finally {
    done()
  }
})

imageForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  clearErrors(imageForm)
  const file = imageForm.elements.file.files[0]
  // Тип і розмір перевіряємо ще до відправки: навіщо передавати 50 МБ, щоб почути «завеликий»
  if (!file) return showFieldError(imageForm, 'file', 'Оберіть файл.')
  if (!FILE_TYPES.includes(file.type)) return showFieldError(imageForm, 'file', 'Дозволено лише JPEG, PNG або WebP.')
  if (file.size > MAX_FILE_MB * 1024 * 1024) return showFieldError(imageForm, 'file', `Файл завеликий: не більше ${MAX_FILE_MB} МБ.`)

  // FormData — дані у форматі multipart/form-data, у якому браузер надсилає файли. Поле має називатися file
  const body = new FormData()
  body.append('file', file)
  const done = setBusy(imageForm.querySelector('button[type=submit]'), 'Завантажуємо…')
  try {
    product = await apiRequest(`/api/v1/products/${product.id}/image`, { method: 'POST', auth: true, formData: body })
    // Лише поле адреси фото: незбережені зміни назви чи ціни у формі мають лишитися
    form.elements.image_url.value = product.image_url
    showImage()
    imageForm.reset()
    showToast('Фото завантажено.')
  } catch (error) {
    // 413 завеликий, 415 не картинка (наприклад, текстовий файл з розширенням .png) — текст пояснення від сервера
    if (error.status === 413 || error.status === 415) showFieldError(imageForm, 'file', error.message)
    else showServerErrors(imageForm, error)
  } finally {
    done()
  }
})

deleteImageButton.addEventListener('click', async () => {
  if (!await confirmDialog({ title: 'Прибрати фото товару?', confirmLabel: 'Прибрати' })) return
  const done = setBusy(deleteImageButton, 'Прибираємо…')
  try {
    await apiRequest(`/api/v1/products/${product.id}/image`, { method: 'DELETE', auth: true })
    product = { ...product, image_url: '' }
    form.elements.image_url.value = ''
    showImage()
    showToast('Фото прибрано.')
  } catch (error) {
    if (error.status !== 401) showToast(error.message, 'error')
  } finally {
    done()
    deleteImageButton.hidden = product.image_url === ''
  }
})

deleteProductButton.addEventListener('click', async () => {
  const confirmed = await confirmDialog({
    title: `Видалити «${product.name}»?`,
    text: 'Товар зникне з каталогу, а разом з ним — відгуки про нього.',
    confirmLabel: 'Видалити',
  })
  if (!confirmed) return
  try {
    await apiRequest(`/api/v1/products/${product.id}`, { method: 'DELETE', auth: true })
    setFlash(`Товар «${product.name}» видалено.`)
    location.replace('/admin/products.html')
  } catch (error) {
    if (error.status !== 401) showToast(error.message, 'error')
  }
})

if (initAdminPage('products')) {
  if (Number.isNaN(productId)) showMissing()
  else load()
}
