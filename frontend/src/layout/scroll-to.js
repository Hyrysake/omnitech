// Спільна прокрутка «до початку результатів» (каталог, замовлення, списки адмінки).
// Якщо працює плавна прокрутка Lenis, прокручуємо ЧЕРЕЗ неї: звичайний window.scrollTo вона перезаписала б
// своїм значенням у наступному кадрі (саме так після кліку на «2» сторінка лишалася внизу).
// Без руху (перемикач «Рух» або налаштування системи) — миттєво, з рухом — плавно.
import { motionOn } from './motion.js'

let lenis = null
/** scroll-fx.js повідомляє, коли Lenis створено або знищено. */
export function setLenis(instance) {
  lenis = instance
}

/** Висота шапки: при прокрутці вгору вона повертається, тож місце під неї треба лишити. */
function headerOffset() {
  const bar = document.querySelector('.site-header')
  return (bar ? bar.offsetHeight : 64) + 12
}

/** Прокрутити так, щоб node опинився під шапкою. */
export function scrollToNode(node) {
  if (!node) return
  const y = Math.max(0, Math.round(node.getBoundingClientRect().top + scrollY - headerOffset()))
  const smooth = motionOn()
  if (lenis) {
    lenis.scrollTo(y, { immediate: !smooth, force: true, lock: smooth, duration: 0.9 })
  } else {
    window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'instant' })
  }
}
