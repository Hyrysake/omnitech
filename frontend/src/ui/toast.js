// Спливаючі повідомлення («тости») у правому нижньому куті: «Товар додано», «Сервер недоступний»…
import { el, icon } from './dom.js'

const STYLES = {
  success: { icon: 'check-circle', class: 'border-emerald-600 text-emerald-900 dark:text-emerald-100' },
  error: { icon: 'warning-circle', class: 'border-red-600 text-red-900 dark:text-red-100' },
  info: { icon: 'info', class: 'border-gold text-ink dark:border-gold-bright dark:text-paper' },
}

/** Контейнер для повідомлень; створюється один раз на сторінку. */
function region() {
  let box = document.getElementById('toasts')
  if (!box) {
    // Кожне повідомлення має role="status" (або "alert" для помилки) — екранна читалка прочитає його сама.
    // aria-live на контейнері не ставимо: інакше той самий текст прозвучав би двічі
    box = el('div', {
      id: 'toasts',
      class: 'pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4',
    })
    document.body.append(box)
  }
  return box
}

/**
 * Показує повідомлення. type: 'success' | 'error' | 'info'.
 * Помилка висить довше (8 с), ніж успіх (5 с), бо її треба встигнути прочитати й зрозуміти.
 */
export function showToast(message, type = 'success') {
  const style = STYLES[type] ?? STYLES.info
  const toast = el('div', {
    class: `animate-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border-l-4 bg-card px-4 py-3 shadow-xl dark:bg-coal ${style.class}`,
    role: type === 'error' ? 'alert' : 'status',
  },
  icon(style.icon, 'mt-0.5 shrink-0 text-xl'),
  el('p', { class: 'flex-1 text-sm' }, message),
  el('button', {
    type: 'button',
    class: '-m-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg opacity-70 hover:opacity-100',
    'aria-label': 'Закрити повідомлення',
    onClick: () => toast.remove(),
  }, icon('x')))

  region().append(toast)
  setTimeout(() => toast.remove(), type === 'error' ? 8000 : 5000)
}
