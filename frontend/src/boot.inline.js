// ЄДИНИЙ вхідний скрипт усіх 25 сторінок. Vite вставляє його в <head> замість маркера boot у коментарі HTML (див. vite.config.js),
// тому правити його потрібно лише тут, а не у кожному HTML-файлі.
// Запускається ще ДО малювання сторінки, тому немає «спалаху» не тієї теми.
// 1) Тема: вибір користувача або тема операційної системи.
// 2) Рух: перемикач «Рух» у підвалі (localStorage 'motion'), інакше системне «Зменшити рух».
// 3) Заставка-лічильник: лише при першому заході за сесію.
(function () {
  var root = document.documentElement
  var theme = localStorage.getItem('theme')
  if (theme === 'dark' || (theme === null && matchMedia('(prefers-color-scheme: dark)').matches)) root.classList.add('dark')
  var motion = localStorage.getItem('motion')
  var motionOn = motion ? motion === 'on' : !matchMedia('(prefers-reduced-motion: reduce)').matches
  var path = location.pathname
  var admin = path.indexOf('/admin') === 0
  var calm = /(cart|checkout|login|register|profile|orders?|order-done|wishlist)\.html$/.test(path)
  root.classList.add('js', motionOn ? 'motion-on' : 'motion-off')
  root.dataset.mode = admin ? 'admin' : calm ? 'calm' : 'full'
  // Розповідь на головній буде закріплена (scroll-fx.js): розкладку й місце під неї ставимо одразу, до першого кадру,
  // інакше при підключенні ефектів усе нижче «стрибнуло» б на 4 екрани (зсув макета, CLS)
  if (motionOn && (path === '/' || path === '/index.html') && 'ResizeObserver' in window && matchMedia('(min-width: 768px)').matches) root.classList.add('pin-story')
  // заставка лише коли сесія починається з головної: хто прийшов посиланням у каталог, одразу бачить товари
  if (motionOn && (path === '/' || path === '/index.html') && !sessionStorage.getItem('omni-intro')) root.classList.add('intro')
  // Золота «шторка» між сторінками (View Transitions): без руху й в адмін-панелі її немає
  var skip = function (event) { if (event.viewTransition && (!root.classList.contains('motion-on') || admin)) event.viewTransition.skipTransition() }
  addEventListener('pageswap', function (event) {
    var next = event.activation && event.activation.entry && event.activation.entry.url
    if (next && next.indexOf(location.origin + '/admin') === 0 && event.viewTransition) event.viewTransition.skipTransition()
    else skip(event)
  })
  addEventListener('pagereveal', function (event) {
    skip(event)
    if (event.viewTransition) root.classList.add('vt-arrived')
  })
})()
