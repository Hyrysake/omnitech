// Форма відгуку на сторінці товару.
// Гість бачить запрошення увійти. Покупець, який ще не писав відгук, — форму «Написати відгук» (POST).
// Хто вже писав — свій відгук у формі редагування (PATCH) з кнопкою «Видалити» (DELETE).
// Сервер дозволяє лише один відгук від людини на товар (інакше відповідає 409 Conflict).
import { apiRequest } from '../api/client.js'
import { loginUrl } from '../auth/guards.js'
import { confirmDialog } from './dialog.js'
import { el, icon, render } from './dom.js'
import { clearErrors, fieldValue, length, required, setBusy, showServerErrors, validateForm } from './forms.js'
import { showToast } from './toast.js'

const RULES = {
  rating: [required('Оберіть оцінку від 1 до 5 зірок.')],
  text: [required('Напишіть кілька слів про товар.'), length(5, 1000)],
}
const RATING_WORDS = ['', 'Погано', 'Так собі', 'Нормально', 'Добре', 'Чудово']

/** Шукає відгук цього користувача серед усіх сторінок відгуків товару (по 50 на сторінку). */
async function findMyReview(productId, userId) {
  for (let page = 1; ; page += 1) {
    const data = await apiRequest(`/api/v1/products/${productId}/reviews`, { query: { page, size: 50 } })
    const mine = data.items.find((review) => review.user_id === userId)
    if (mine || page >= data.pages) return mine ?? null
  }
}

/** Вибір оцінки: п'ять перемикачів (radio), підписаних зірками. Клавіатурою — стрілками ← →. */
function ratingPicker(current) {
  const caption = el('span', { class: 'muted ml-3 text-sm', 'aria-hidden': 'true' }, RATING_WORDS[current] ?? '')
  const stars = []
  const paint = (value) => {
    stars.forEach((star, index) => {
      star.className = `${index < value ? 'ph-fill' : 'ph opacity-40'} ph-star text-3xl text-gold dark:text-gold-bright`
    })
    caption.textContent = RATING_WORDS[value] ?? ''
  }
  const options = [1, 2, 3, 4, 5].map((value) => {
    const star = el('i', { 'aria-hidden': 'true' })
    stars.push(star)
    return el('label', { class: 'cursor-pointer rounded-lg p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold' },
      el('input', {
        type: 'radio', name: 'rating', value, class: 'sr-only', checked: value === current,
        onChange: () => paint(value),
      }),
      el('span', { class: 'sr-only' }, `${value} з 5`),
      star)
  })
  paint(current ?? 0)
  return el('fieldset', { 'aria-describedby': 'rating-error' },
    el('legend', { class: 'label' }, 'Оцінка'),
    el('div', { class: 'flex items-center' }, options, caption),
    el('p', { id: 'rating-error', class: 'field-error', hidden: true }))
}

export function initReviewForm(box, { productId, user, onChange }) {
  function renderGuest() {
    render(box, el('div', { class: 'card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between' },
      el('p', { class: 'muted' }, 'Купували цей товар? Поділіться враженнями з іншими покупцями.'),
      el('a', { href: loginUrl(), class: 'btn btn-primary shrink-0' }, icon('sign-in'), 'Увійдіть, щоб залишити відгук')))
  }

  function renderForm(mine) {
    const textId = 'review-text'
    const form = el('form', { novalidate: true, class: 'card space-y-5 p-6 sm:p-8', 'aria-labelledby': 'review-form-title' },
      el('h3', { id: 'review-form-title', class: 'block-title' }, mine ? 'Ваш відгук' : 'Написати відгук'),
      ratingPicker(mine?.rating),
      el('div', {},
        el('label', { for: textId, class: 'label' }, 'Текст відгуку'),
        el('textarea', {
          id: textId, name: 'text', rows: 4, maxlength: 1000, class: 'input',
          placeholder: 'Що сподобалось, а що ні? Від 5 до 1000 символів.', 'aria-describedby': `${textId}-error`,
        }, mine?.text ?? ''),
        el('p', { id: `${textId}-error`, class: 'field-error', hidden: true })),
      el('div', { 'data-form-error': '', class: 'alert alert-error', role: 'alert', hidden: true }),
      el('div', { class: 'flex flex-wrap gap-3' },
        el('button', { type: 'submit', class: 'btn btn-primary' }, mine ? 'Зберегти зміни' : 'Надіслати відгук'),
        mine && el('button', { type: 'button', class: 'btn btn-danger', onClick: () => remove(mine) }, icon('trash'), 'Видалити відгук')))

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (!validateForm(form, RULES)) return
      const data = { rating: Number(fieldValue(form, 'rating')), text: fieldValue(form, 'text') }
      const done = setBusy(form.querySelector('button[type=submit]'), 'Зберігаємо…')
      try {
        if (mine) {
          await apiRequest(`/api/v1/reviews/${mine.id}`, { method: 'PATCH', auth: true, body: data })
          showToast('Відгук оновлено.')
        } else {
          await apiRequest(`/api/v1/products/${productId}/reviews`, { method: 'POST', auth: true, body: data })
          showToast('Дякуємо за відгук!')
        }
        await onChange()
        await refresh()
      } catch (error) {
        done()
        if (error.status === 409) {
          // Відгук уже є (наприклад, написаний в іншій вкладці): відкриваємо його для редагування
          showToast('Ви вже залишили відгук про цей товар — його можна змінити.', 'info')
          await refresh()
          box.querySelector('textarea')?.focus()   // форму намальовано заново: повертаємо фокус у поле тексту
        } else {
          showServerErrors(form, error)
        }
      }
    })
    render(box, form)
    clearErrors(form)
  }

  async function remove(mine) {
    if (!await confirmDialog({ title: 'Видалити ваш відгук?', confirmLabel: 'Видалити' })) return
    try {
      await apiRequest(`/api/v1/reviews/${mine.id}`, { method: 'DELETE', auth: true })
      showToast('Відгук видалено.')
      await onChange()
      await refresh()
    } catch (error) {
      if (error.status !== 401) showToast(error.message, 'error')
    }
  }

  async function refresh() {
    if (!user) {
      renderGuest()
      return
    }
    try {
      renderForm(await findMyReview(productId, user.id))
    } catch (error) {
      render(box, el('p', { class: 'alert alert-error', role: 'alert' }, error.message))
    }
  }

  return { refresh }
}
