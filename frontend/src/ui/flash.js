// Повідомлення «на наступну сторінку». Приклад: після входу переходимо на іншу сторінку,
// і вже там треба показати «Ви увійшли». Звичайний тост зник би разом зі старою сторінкою,
// тому текст кладемо в sessionStorage, а наступна сторінка показує його один раз і видаляє.
import { showToast } from './toast.js'

const KEY = 'omnitech.flash'

/** Запам'ятати повідомлення для наступної сторінки. type: 'success' | 'error' | 'info'. */
export function setFlash(message, type = 'success') {
  sessionStorage.setItem(KEY, JSON.stringify({ message, type }))
}

/** Показати збережене повідомлення (викликає initPage на кожній сторінці). */
export function showFlash() {
  const saved = sessionStorage.getItem(KEY)
  if (!saved) return
  sessionStorage.removeItem(KEY)
  try {
    const { message, type } = JSON.parse(saved)
    if (typeof message === 'string') showToast(message, type)
  } catch {
    // Пошкоджений запис просто ігноруємо
  }
}
