// Сторінки без даних з API (404, «Про нас», «Часті питання»): лише шапка й підвал.
// Який пункт меню підсвітити, сторінка каже атрибутом <body data-page="about">.
import { initPage } from '../layout/page.js'

initPage({ active: document.body.dataset.page })

// Фото зі стороннього сайту могло не завантажитись (немає інтернету): ховаємо «зламану» картинку
for (const image of document.querySelectorAll('main img')) {
  const hide = () => { image.hidden = true }
  if (image.complete && image.naturalWidth === 0) hide()
  else image.addEventListener('error', hide)
}
