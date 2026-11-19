// Оформлення замовлення: POST /api/v1/orders. Гість може замовити без входу; якщо покупець увійшов,
// токен надсилається (auth: 'optional') і замовлення потрапляє в його історію.
import { apiRequest } from '../api/client.js'
import { loginUrl } from '../auth/guards.js'
import { initPage } from '../layout/page.js'
import { clearCart, getCart, removeMissing } from '../store/cart.js'
import { byId, el, render } from '../ui/dom.js'
import { formatPrice } from '../ui/format.js'
import {
  custom, email, fieldValue, length, required, setBusy, showFormError, showServerErrors, validateForm,
} from '../ui/forms.js'
import { renderError } from '../ui/states.js'

const user = initPage({ active: 'cart' })
const form = byId('checkout-form')
const summaryBox = byId('summary')

// Телефон: 10–13 цифр, дозволені ще пробіли, дужки, плюс і дефіс (як check_phone на сервері)
const phone = () => custom((value) => {
  const digits = value.replace(/\D/g, '').length          // \D — будь-що, крім цифри
  return value === '' || (/^[\d\s()+-]+$/.test(value) && digits >= 10 && digits <= 13)
}, 'Вкажіть коректний номер телефону, наприклад +380501234567.')

const RULES = {
  customer_name: [required("Вкажіть ім'я."), length(2, 100)],
  phone: [required('Вкажіть телефон.'), phone()],
  email: [required('Вкажіть пошту.'), email(), length(3, 254)],
  address: [required('Вкажіть адресу доставки.'), length(5, 300)],
}

/** Короткий підсумок праворуч: товари й сума за актуальними цінами з сервера. */
async function loadSummary() {
  const items = getCart()
  if (items.length === 0) {
    location.replace('/cart.html')        // оформлювати нічого: повертаємо в (порожній) кошик
    return
  }
  try {
    const preview = await apiRequest('/api/v1/cart/preview', { method: 'POST', body: { items } })
    removeMissing(preview.missing)
    if (preview.lines.length === 0) {
      location.replace('/cart.html')
      return
    }
    render(summaryBox,
      el('h2', { class: 'block-title' }, 'Ваше замовлення'),
      el('ul', { class: 'mt-4' }, preview.lines.map((line) =>
        el('li', { class: 'sum-line text-sm' },
          el('span', {}, `${line.product.name} × ${line.quantity}`),
          el('span', { class: 'shrink-0 font-semibold tabular-nums text-[var(--fg)]' }, formatPrice(line.line_total))))),
      el('p', { class: 'sum-total' },
        el('span', { class: 'text-sm font-semibold uppercase tracking-widest' }, 'До сплати'), el('span', { class: 'price' }, formatPrice(preview.total))))
  } catch (error) {
    renderError(summaryBox, error, loadSummary)
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!validateForm(form, RULES)) return

  // Кнопка неактивна, поки йде запит: подвійний клік не створить два однакові замовлення
  const done = setBusy(form.querySelector('button[type=submit]'), 'Оформлюємо…')
  try {
    const order = await apiRequest('/api/v1/orders', {
      method: 'POST',
      auth: 'optional',
      body: {
        customer_name: fieldValue(form, 'customer_name'),
        phone: fieldValue(form, 'phone'),
        email: fieldValue(form, 'email'),
        address: fieldValue(form, 'address'),
        items: getCart(),           // лише номери й кількість: ціни сервер бере з бази
      },
    })
    // Сторінка «Дякуємо» покаже замовлення навіть гостю (у гостя немає доступу до історії замовлень)
    sessionStorage.setItem('omnitech.lastOrder', JSON.stringify(order))
    clearCart()
    location.replace(`/order-done.html?id=${order.id}`)
  } catch (error) {
    done()
    if (error.status === 404) {
      // Товар видалили з каталогу, поки покупець заповнював форму
      showFormError(form, `${error.message} Поверніться до кошика: його буде оновлено.`)
    } else {
      showServerErrors(form, error)
    }
  }
})

if (user) {
  form.elements.customer_name.value = user.name
  form.elements.email.value = user.email
} else {
  byId('guest-note').hidden = false
  byId('login-link').href = loginUrl()
}
loadSummary()
