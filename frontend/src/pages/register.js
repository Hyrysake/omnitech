// Реєстрація: POST /api/v1/auth/register (201 Created), потім одразу вхід, щоб не вводити пошту й пароль удруге
import { apiRequest } from '../api/client.js'
import { nextFromUrl, redirectIfLoggedIn } from '../auth/guards.js'
import { saveSession } from '../auth/session.js'
import { initPage } from '../layout/page.js'
import { byId } from '../ui/dom.js'
import { custom, email, fieldValue, length, required, setBusy, showFieldError, showServerErrors, validateForm } from '../ui/forms.js'
import { setFlash } from '../ui/flash.js'

// Ті самі правила, що в backend/app/core/validators.py
const RULES = {
  name: [required("Вкажіть ім'я."), length(2, 100)],
  email: [required('Вкажіть пошту.'), email(), length(3, 254)],
  password: [required('Придумайте пароль.'), length(6, 128)],
  password_confirm: [
    required('Повторіть пароль.'),
    custom((value, form) => value === form.elements.password.value, 'Паролі не збігаються.'),
  ],
}

if (!redirectIfLoggedIn()) {
  initPage({ active: 'register' })

  const form = byId('register-form')
  byId('login-link').search = location.search

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!validateForm(form, RULES)) return

    const done = setBusy(form.querySelector('button[type=submit]'), 'Створюємо акаунт…')
    const credentials = { email: fieldValue(form, 'email'), password: form.elements.password.value }
    try {
      await apiRequest('/api/v1/auth/register', {
        method: 'POST',
        body: {
          name: fieldValue(form, 'name'),
          ...credentials,
          password_confirm: form.elements.password_confirm.value,
        },
      })
    } catch (error) {
      done()
      // 409 Conflict: пошта вже зайнята — показуємо біля поля пошти
      if (error.status === 409) showFieldError(form, 'email', error.message)
      else showServerErrors(form, error)
      return
    }

    try {
      const session = await apiRequest('/api/v1/auth/token', {
        method: 'POST',
        form: { username: credentials.email, password: credentials.password },
      })
      saveSession(session)
      setFlash(`Акаунт створено. Вітаємо, ${session.user.name}!`)
      location.replace(nextFromUrl())
    } catch {
      // Акаунт уже створено, не вдалося лише увійти автоматично (наприклад, зник зв'язок): просимо увійти вручну
      setFlash('Акаунт створено. Увійдіть з новими даними.')
      location.replace(`/login.html${location.search}`)
    }
  })
}
