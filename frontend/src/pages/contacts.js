// «Контакти»: форма зворотного зв'язку, POST /api/v1/feedback (відповідь 201 Created)
import { apiRequest } from '../api/client.js'
import { initPage } from '../layout/page.js'
import { byId, el } from '../ui/dom.js'
import { clearErrors, email, fieldValue, length, required, setBusy, showServerErrors, validateForm } from '../ui/forms.js'
import { showToast } from '../ui/toast.js'

const user = initPage({ active: 'contacts' })

// Карта: справжній iframe з'являється лише після натискання (адреса стала, не з даних користувача)
const MAP_URL = 'https://www.openstreetmap.org/export/embed.html?bbox=25.3215%2C50.7454%2C25.3315%2C50.7494&layer=mapnik&marker=50.7474%2C25.3265'
byId('map-load').addEventListener('click', (event) => {
  const frame = el('iframe', {
    src: MAP_URL,
    title: 'Карта: розташування магазину OmniTech',
    class: 'block h-full min-h-[24rem] w-full grayscale contrast-105 dark:invert-92 dark:contrast-90',
  })
  event.currentTarget.replaceWith(frame)
  frame.focus()
})
const form = byId('feedback-form')
const counter = byId('message-count')

// Хто ввійшов, тому не треба вводити ім'я й пошту — підставляємо їх (змінити все одно можна)
if (user) {
  form.elements.name.value = user.name
  form.elements.email.value = user.email
}

// Лічильник символів оновлюється під час введення
form.elements.message.addEventListener('input', () => {
  counter.textContent = form.elements.message.value.length
})

// Ті самі межі, що в схемі FeedbackIn на сервері
const RULES = {
  name: [required("Вкажіть ім'я."), length(2, 100)],
  email: [required('Вкажіть пошту, щоб ми могли відповісти.'), email(), length(3, 254)],
  message: [required('Напишіть повідомлення.'), length(10, 2000)],
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!validateForm(form, RULES)) return

  const done = setBusy(form.querySelector('button[type=submit]'), 'Надсилаємо…')
  try {
    await apiRequest('/api/v1/feedback', {
      method: 'POST',
      body: { name: fieldValue(form, 'name'), email: fieldValue(form, 'email'), message: fieldValue(form, 'message') },
    })
    form.elements.message.value = ''
    counter.textContent = '0'
    clearErrors(form)
    showToast('Дякуємо! Повідомлення надіслано, ми відповімо на вашу пошту.')
  } catch (error) {
    showServerErrors(form, error)
  } finally {
    done()
  }
})
