// Каталог: блок фільтрів більше не «прилипає». Він стоїть над товарами й відгортається разом зі сторінкою.
// Коли користувач пройшов його і гортає ВГОРУ, та сама форма стає компактною панеллю під шапкою:
// пошук, сортування і кнопка «Фільтри», що відкриває категорії й ціну. Гортання вниз — панель ховається.
// Це та сама <form> (один набір полів), тому пошук, адреса сторінки, чіпи й сторінки працюють як раніше.

import { scrollToNode } from '../layout/scroll-to.js'

export function initFloatingFilters(form, toggle, panel) {
  // Заглушка на місці форми, поки вона «плаває»: сторінка не стрибає
  const spot = document.createElement('div')
  spot.id = 'filters-spot'
  form.before(spot)
  let floating = false
  let lastY = scrollY
  let run = 0 // пройдено пікселів у поточному напрямку (як у шапці): повільне гортання теж спрацьовує
  let queued = false

  function setFloating(on) {
    if (on === floating) return
    floating = on
    spot.style.height = on ? `${form.offsetHeight}px` : ''
    form.classList.toggle('is-floating', on)
    if (!on) {
      form.classList.remove('is-shown')
      closePanel({ focus: false })
    }
  }
  function update() {
    queued = false
    const y = scrollY
    const formBottom = spot.getBoundingClientRect().top + y + (floating ? spot.offsetHeight : form.offsetHeight)
    if (y < formBottom - 40) {
      setFloating(false)
    } else {
      setFloating(true)
      // Гортаємо вгору — показуємо; вниз — ховаємо (але не тоді, коли фокус у формі або відкрита панель)
      // показати після 12 px угору, сховати після 24 px униз
      const dy = y - lastY
      if (dy !== 0) run = Math.sign(dy) === Math.sign(run) ? run + dy : dy
      if (run <= -12) form.classList.add('is-shown')
      else if (run >= 24 && !form.contains(document.activeElement) && !form.classList.contains('panel-open')) form.classList.remove('is-shown')
    }
    lastY = y
  }
  addEventListener('scroll', () => {
    if (!queued) {
      queued = true
      requestAnimationFrame(update)
    }
  }, { passive: true })

  // Відкрита панель поводиться як модальне вікно: усе поза формою — inert (не клікається, не фокусується,
  // не читається), Tab ходить по колу всередині форми, Esc або клік поза нею закриває й повертає фокус на кнопку.
  let inerted = []
  function setBackgroundInert(on) {
    if (!on) {
      inerted.forEach((node) => { node.inert = false })
      inerted = []
      return
    }
    for (let node = form; node && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || sibling.inert || sibling.matches('script, .cursor, svg.snake')) continue
        sibling.inert = true
        inerted.push(sibling)
      }
    }
  }
  const focusables = () => [...form.querySelectorAll('button, input:not([type="hidden"]), select, summary, a[href], [tabindex]:not([tabindex="-1"])')]
    // checkVisibility враховує й закриті <details> (їхні поля мають розміри, але Tab їх пропускає)
    .filter((node) => !node.disabled && (node.checkVisibility ? node.checkVisibility({ visibilityProperty: true }) : node.getClientRects().length > 0))
  function openPanel() {
    form.classList.add('panel-open')
    toggle.setAttribute('aria-expanded', 'true')
    // Модальною панель є лише тоді, коли «плаває» над сторінкою; на телефоні у звичайному місці вона просто розгортається
    if (floating) setBackgroundInert(true)
    // Перше поле, що може мати фокус (приховане поле категорії — ні)
    panel.querySelector('button, input:not([type="hidden"]), summary')?.focus()
  }
  function closePanel({ focus = true } = {}) {
    if (!form.classList.contains('panel-open')) return
    form.classList.remove('panel-open')
    toggle.setAttribute('aria-expanded', 'false')
    setBackgroundInert(false)
    if (focus) toggle.focus()
  }
  toggle.addEventListener('click', () => (form.classList.contains('panel-open') ? closePanel() : openPanel()))
  form.addEventListener('keydown', (event) => {
    if (!form.classList.contains('panel-open') || event.defaultPrevented) return
    if (event.key === 'Escape') {
      closePanel()
      return
    }
    if (event.key !== 'Tab' || !floating) return
    const list = focusables()
    if (!list.length) return
    const first = list[0]
    const last = list[list.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
  document.addEventListener('pointerdown', (event) => {
    if (floating && form.classList.contains('panel-open') && !form.contains(event.target)) closePanel()
  })
  update()
  // Перехід на іншу сторінку каталогу: прокручуємо до місця форми, а не до «плаваючої» панелі
  return () => scrollToNode(spot)
}
