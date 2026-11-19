// Профіль: GET/PATCH/DELETE /api/v1/users/me і POST /api/v1/users/me/password
import { apiRequest } from '../api/client.js'
import { requireUser } from '../auth/guards.js'
import { clearSession, updateUser } from '../auth/session.js'
import { initPage, refreshHeader } from '../layout/page.js'
import { confirmDialog } from '../ui/dialog.js'
import { byId } from '../ui/dom.js'
import { setFlash } from '../ui/flash.js'
import { formatDate } from '../ui/format.js'
import {
  custom, email, fieldValue, length, required, setBusy, showServerErrors, showFieldError, validateForm, clearErrors,
} from '../ui/forms.js'
import { showToast } from '../ui/toast.js'

const profileForm = byId('profile-form')
const passwordForm = byId('password-form')

function showUser(user) {
  profileForm.elements.name.value = user.name
  profileForm.elements.email.value = user.email
  const role = user.role === 'admin' ? 'адміністратор' : 'покупець'
  byId('profile-meta').textContent = `${role[0].toUpperCase()}${role.slice(1)} · з нами з ${formatDate(user.created_at)}`
}

async function loadProfile() {
  try {
    // Дані з localStorage могли застаріти (наприклад, змінили в іншому браузері): беремо свіжі з сервера
    const user = await apiRequest('/api/v1/users/me', { auth: true })
    updateUser(user)
    showUser(user)
    refreshHeader()
  } catch (error) {
    if (error.status !== 401) showToast(error.message, 'error')
  }
}

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const valid = validateForm(profileForm, {
    name: [required("Вкажіть ім'я."), length(2, 100)],
    email: [required('Вкажіть пошту.'), email(), length(3, 254)],
  })
  if (!valid) return

  const done = setBusy(profileForm.querySelector('button[type=submit]'), 'Зберігаємо…')
  try {
    // PATCH змінює лише передані поля
    const user = await apiRequest('/api/v1/users/me', {
      method: 'PATCH',
      auth: true,
      body: { name: fieldValue(profileForm, 'name'), email: fieldValue(profileForm, 'email') },
    })
    updateUser(user)
    showUser(user)
    refreshHeader()                    // нове ім'я одразу видно в меню
    showToast('Зміни збережено.')
  } catch (error) {
    if (error.status === 409) showFieldError(profileForm, 'email', error.message)
    else showServerErrors(profileForm, error)
  } finally {
    done()
  }
})

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const valid = validateForm(passwordForm, {
    current_password: [required('Вкажіть поточний пароль.')],
    new_password: [
      required('Придумайте новий пароль.'),
      length(6, 128),
      custom((value, form) => value !== form.elements.current_password.value, 'Новий пароль має відрізнятися від поточного.'),
    ],
    new_password_confirm: [
      required('Повторіть новий пароль.'),
      custom((value, form) => value === form.elements.new_password.value, 'Паролі не збігаються.'),
    ],
  })
  if (!valid) return

  const done = setBusy(passwordForm.querySelector('button[type=submit]'), 'Змінюємо…')
  try {
    await apiRequest('/api/v1/users/me/password', {
      method: 'POST',
      auth: true,
      body: {
        current_password: passwordForm.elements.current_password.value,
        new_password: passwordForm.elements.new_password.value,
      },
    })
    passwordForm.reset()
    clearErrors(passwordForm)
    showToast('Пароль змінено.')
  } catch (error) {
    // 400 «Поточний пароль неправильний» приходить з field = current_password і стане під цим полем
    showServerErrors(passwordForm, error)
  } finally {
    done()
  }
})

const deleteButton = byId('delete-account')
deleteButton.addEventListener('click', async () => {
  const confirmed = await confirmDialog({
    title: 'Видалити акаунт?',
    text: 'Цю дію не можна скасувати. Відгуки й замовлення залишаться, але без прив’язки до вашого акаунта.',
    confirmLabel: 'Так, видалити',
  })
  if (!confirmed) return

  const done = setBusy(deleteButton, 'Видаляємо…')
  try {
    await apiRequest('/api/v1/users/me', { method: 'DELETE', auth: true })
    clearSession()
    setFlash('Акаунт видалено. Дякуємо, що були з нами.', 'info')
    location.replace('/')
  } catch (error) {
    done()
    // 409: адміністратор не може видалити власний акаунт
    showToast(error.message, 'error')
  }
})

initPage({ active: 'profile' })
const user = requireUser()       // гостя переводимо на сторінку входу
if (user) {
  showUser(user)
  loadProfile()
}
