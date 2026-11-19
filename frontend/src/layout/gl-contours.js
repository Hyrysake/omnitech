// Живе тло з контурних ліній, як на топографічній карті (ідея landonorris).
// Один WebGL2-шейдер на весь екран: шум (simplex) повільно «дихає» в часі, через кожен рівень висоти
// проходить тонка золота лінія (кожна п'ята — трохи сильніша, як на справжній карті).
// Поле лише повільно «пливе» в часі (як рідина); на курсор воно не реагує.
// Чорні/кремові смуги (блоки .tone-invert) шейдер малює сам, тому лінії переходять крізь них іншим кольором.
//
// Економія: малюємо в зменшеній роздільності (0,75 або 0,5 від CSS-пікселів), не частіше ~50 кадрів/с,
// зупиняємося у фоновій вкладці, а без руху малюємо лише ОДИН нерухомий кадр.

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

// ---------------------------------------------------------------------------------------------
// Функції mod289 / permute / taylorInvSqrt / snoise нижче — СТОРОННІЙ код (не наш):
//   «webgl-noise», Ashima Arts і Stefan Gustavson, https://github.com/ashima/webgl-noise
// Ліцензія MIT (текст ліцензії потрібно зберігати разом із кодом, тому наводимо його повністю):
//
//   Copyright (C) 2011 Ashima Arts. All rights reserved.
//   Copyright (C) 2011-2016 Stefan Gustavson. All rights reserved.
//
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
//   associated documentation files (the "Software"), to deal in the Software without restriction,
//   including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
//   and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
//   subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in all copies or substantial
//   portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
//   LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
//   WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// Що робить цей код (для захисту лабораторної):
// - snoise(точка в 3D) повертає плавне «випадкове» число від -1 до 1 (шум simplex). Сусідні точки мають
//   близькі значення, тому це схоже на рельєф: пагорби й западини. Третя координата — час, тож рельєф повільно змінюється.
// - У main() ми беремо цей рельєф як «висоту» і малюємо лінію там, де висота проходить через ціле число
//   (як горизонталі на топографічній карті): fract(v) — дробова частина, відстань до найближчого цілого
//   ділимо на fwidth(v) (наскільки v змінюється між сусідніми пікселями) і отримуємо відстань до лінії в пікселях.
//   Тому лінія завжди однакової товщини і згладжена, незалежно від того, крутий «схил» чи пологий.
// - warp: координати трохи зсуваються іншим шумом, щоб лінії були органічні, а не круглі.
// ---------------------------------------------------------------------------------------------
const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime, uScale, uScroll, uReveal;
uniform vec3 uBg, uLine, uBg2, uLine2;
uniform vec2 uAlpha;
uniform vec4 uBand;
out vec4 outColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float unit = 2.0 / max(uRes.x, uRes.y);
  vec2 uv = (fc - 0.5 * uRes) * unit;
  uv.y -= uScroll * unit;                       // поле трохи «пливе» разом зі сторінкою (паралакс)

  float t = uTime * 0.045;
  vec2 q = uv * 1.05;
  vec2 warp = vec2(snoise(vec3(q * 0.65, t * 0.6)), snoise(vec3(q * 0.65 + vec2(5.2, 1.3), t * 0.6)));
  float f = snoise(vec3(q + warp * 0.55, t)) + 0.32 * snoise(vec3(q * 2.2 + warp * 0.35 + 3.1, t * 1.35));
  float v = f * 3.8;

  // Відстань до найближчої ізолінії в пікселях: fwidth дає згладжену лінію однакової товщини
  float fw = max(fwidth(v), 1e-4);
  float d = abs(fract(v - 0.5) - 0.5) / fw;
  float k = uScale / 0.75;                      // при меншій роздільності лінія тонша в пікселях полотна
  float line = 1.0 - smoothstep(0.15 * k, 0.95 * k, d);
  float vi = v / 5.0;
  float di = abs(fract(vi - 0.5) - 0.5) / max(fwidth(vi), 1e-5);
  float index = 1.0 - smoothstep(0.4 * k, 1.4 * k, di);
  float strength = max(line, index * 1.5);

  // Поява після заставки: лінії розходяться колом від центру
  float r = length((fc - 0.5 * uRes) * unit);
  strength *= smoothstep(r - 0.35, r, uReveal * 1.9);

  // Інверсні смуги (у CSS-пікселях від верху екрана)
  float yc = (uRes.y - fc.y) / uScale;
  float inBand = clamp((step(uBand.x, yc) - step(uBand.y, yc)) + (step(uBand.z, yc) - step(uBand.w, yc)), 0.0, 1.0);
  vec3 bg = mix(uBg, uBg2, inBand);
  vec3 lc = mix(uLine, uLine2, inBand);
  float alpha = mix(uAlpha.x, uAlpha.y, inBand);
  outColor = vec4(mix(bg, lc, clamp(strength * alpha, 0.0, 1.0)), 1.0);
}`

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
// Кольори (ті самі, що токени в main.css). Прозорість ліній не більше 0,35, щоб текст лишався контрастним
const PALETTE = {
  light: { bg: hex('#FAF7F0'), line: hex('#A87A1E'), alpha: 0.2, bg2: hex('#0E0C0A'), line2: hex('#E2AD3A'), alpha2: 0.2 },
  dark: { bg: hex('#0C0A09'), line: hex('#E2AD3A'), alpha: 0.17, bg2: hex('#EFE7D6'), line2: hex('#A16207'), alpha2: 0.26 },
}

/**
 * Створює полотно і повертає «пульт»: setLive(true/false) — живий рух або один нерухомий кадр,
 * useTicker(add, remove) — малювати з чужого таймера (GSAP), щоб смуги не відставали від Lenis,
 * setBands(true/false) — малювати інверсні смуги, revealNow()/reveal() — поява ліній.
 */
export function startContours({ small = false, live = true, onLost } = {}) {
  const canvas = document.createElement('canvas')
  canvas.className = 'contours-gl'
  canvas.setAttribute('aria-hidden', 'true')
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false })
  if (!gl) return null
  // Програмний рендер (SwiftShader, llvmpipe) надто повільний для живого тла — тоді SVG-запасний варіант.
  // Перевіряємо на тому ж контексті, щоб не створювати другий (це зайвий час на старті)
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return null

  const compile = (type, source) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
    return shader
  }
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
  gl.useProgram(program)
  gl.bindVertexArray(gl.createVertexArray())
  const u = {}
  for (const name of ['uRes', 'uTime', 'uScale', 'uScroll', 'uReveal', 'uBg', 'uLine', 'uBg2', 'uLine2', 'uAlpha', 'uBand']) {
    u[name] = gl.getUniformLocation(program, name)
  }
  document.body.prepend(canvas)

  const SCALE = small ? 0.5 : 0.75          // частка CSS-пікселя
  const MIN_FRAME = 1000 / (small ? 30 : 50)
  let width = 0
  let height = 0
  const resize = () => {
    width = Math.round(innerWidth * SCALE)
    height = Math.round(innerHeight * SCALE)
    canvas.width = width
    canvas.height = height
    gl.viewport(0, 0, width, height)
  }
  resize()

  // Кольори з плавним переходом при зміні теми
  const themeKey = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  const colors = structuredClone(PALETTE[themeKey()])
  let target = PALETTE[themeKey()]
  const mix = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k)

  let bandsOn = false
  const bandEls = () => [...document.querySelectorAll('[data-tone="invert"]')]
  let bandList = bandEls()

  let time = 0
  let reveal = 0
  let revealing = false
  let liveMode = live
  let rafId = 0
  let externalTick = null
  let lastFrame = 0
  let lastNow = performance.now()

  function draw(now) {
    const dt = Math.min(0.1, (now - lastNow) / 1000)
    lastNow = now
    if (liveMode) time += dt
    if (revealing) reveal = Math.min(1, reveal + dt / 1.6)
    const c = 1 - Math.exp(-dt * 5)
    for (const key of ['bg', 'line', 'bg2', 'line2']) colors[key] = mix(colors[key], target[key], liveMode ? c : 1)
    colors.alpha += (target.alpha - colors.alpha) * (liveMode ? c : 1)
    colors.alpha2 += (target.alpha2 - colors.alpha2) * (liveMode ? c : 1)

    // Межі інверсних смуг у CSS-пікселях; поза екраном — «вимкнена» смуга
    const band = [-1, -1, -1, -1]
    if (bandsOn) {
      let slot = 0
      for (const node of bandList) {
        const box = node.getBoundingClientRect()
        if (box.bottom < 0 || box.top > innerHeight || slot >= 4) continue
        band[slot] = box.top
        band[slot + 1] = box.bottom
        slot += 2
      }
    }

    gl.uniform2f(u.uRes, width, height)
    gl.uniform1f(u.uTime, time)
    gl.uniform1f(u.uScale, SCALE)
    gl.uniform1f(u.uScroll, scrollY * 0.12 * SCALE)
    gl.uniform1f(u.uReveal, reveal)
    gl.uniform3fv(u.uBg, colors.bg)
    gl.uniform3fv(u.uLine, colors.line)
    gl.uniform3fv(u.uBg2, colors.bg2)
    gl.uniform3fv(u.uLine2, colors.line2)
    gl.uniform2f(u.uAlpha, colors.alpha, colors.alpha2)
    gl.uniform4fv(u.uBand, band)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

  }

  function tick(now) {
    if (document.hidden || paused) return
    if (now - lastFrame < MIN_FRAME - 2) return
    lastFrame = now
    draw(now)
  }
  function loop(now) {
    rafId = requestAnimationFrame(loop)
    tick(now)
  }
  let paused = false

  function schedule() {
    cancelAnimationFrame(rafId)
    rafId = 0
    if (!liveMode) {
      // Один нерухомий кадр (і ще кілька, поки доходить поява/колір)
      reveal = 1
      requestAnimationFrame((now) => draw(now))
      return
    }
    if (!externalTick) rafId = requestAnimationFrame(loop)
  }

  const themeWatch = !('MutationObserver' in window) ? { observe() {}, disconnect() {} } : new MutationObserver(() => {
    target = PALETTE[themeKey()]
    if (!liveMode) requestAnimationFrame((now) => draw(now))
  })
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  addEventListener('resize', () => {
    resize()
    bandList = bandEls()
    if (!liveMode) requestAnimationFrame((now) => draw(now))
  })
  document.addEventListener('visibilitychange', () => {
    lastNow = performance.now()
  })
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    cancelAnimationFrame(rafId)
    canvas.remove()
    onLost?.()
  })

  schedule()

  return {
    canvas,
    setLive(on) {
      liveMode = on
      schedule()
    },
    /** Запустити появу ліній (після заставки). */
    reveal() {
      revealing = true
    },
    revealNow() {
      reveal = 1
      revealing = false
    },
    pause(on) {
      paused = on
    },
    setBands(on) {
      bandsOn = on
      bandList = bandEls()
      document.documentElement.classList.toggle('gl-bands', on)
    },
    refreshBands() {
      bandList = bandEls()
    },
    /** Малювати з таймера GSAP (після Lenis) замість власного requestAnimationFrame. */
    useTicker(add, remove) {
      if (externalTick) remove(externalTick)
      externalTick = add ? () => tick(performance.now()) : null
      if (add) add(externalTick)
      schedule()
    },
  }
}
