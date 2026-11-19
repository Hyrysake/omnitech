// Вхід: POST /api/v1/auth/token. Стандарт OAuth2 вимагає надсилати поля як дані HTML-форми
// (username і password), а не JSON, тому тут form, а не body. У полі username — пошта.
import { apiRequest } from '../api/client.js'
import { nextFromUrl, redirectIfLoggedIn } from '../auth/guards.js'
import { saveSession } from '../auth/session.js'
import { initPage } from '../layout/page.js'
import { byId } from '../ui/dom.js'
import { email, fieldValue, required, setBusy, showServerErrors, validateForm } from '../ui/forms.js'
import { setFlash } from '../ui/flash.js'

if (!redirectIfLoggedIn()) {
  initPage({ active: 'login' })

  const form = byId('login-form')
  // Посилання на реєстрацію зберігає ?next=, щоб після реєстрації теж повернутися куди треба
  byId('register-link').search = location.search

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const valid = validateForm(form, {
      email: [required('Вкажіть пошту.'), email()],
      password: [required('Вкажіть пароль.')],
    })
    if (!valid) return

    const done = setBusy(form.querySelector('button[type=submit]'), 'Входимо…')
    try {
      const session = await apiRequest('/api/v1/auth/token', {
        method: 'POST',
        form: { username: fieldValue(form, 'email'), password: form.elements.password.value },
      })
      saveSession(session)
      setFlash(`Вітаємо, ${session.user.name}!`)
      location.replace(nextFromUrl())
    } catch (error) {
      done()
      // 401 — неправильна пошта чи пароль (сервер навмисно не каже, що саме, щоб не підказувати зловмиснику)
      showServerErrors(form, error, { username: 'email' })
    }
  })
}
