// Зірки оцінки: stars(4.4) малює 4 заповнені й 1 бліду зірку (дробове значення округлюється)
import { el, icon } from './dom.js'

export function stars(value, size = 'text-base') {
  const filled = Math.round(value ?? 0)
  // role="img" + aria-label: екранна читалка прочитає «Оцінка: 4 з 5», а не п'ять значків
  return el('span', {
    class: `inline-flex items-center gap-0.5 text-gold dark:text-gold-bright ${size}`,
    role: 'img',
    'aria-label': `Оцінка: ${filled} з 5`,
  }, [1, 2, 3, 4, 5].map((n) => (n <= filled ? icon('star', '', 'ph-fill') : icon('star', 'opacity-40'))))
}
