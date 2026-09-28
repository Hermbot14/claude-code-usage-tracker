// Layout, contrast and focus QA for the renderer, run on the live Electron
// window by e2e/visual-qa.spec.ts. Adapted from the SportsLink hub's
// web/scripts/qa-check.js (same method, solid page ground, plus __focus).
//
// __qa(label) -> { hScroll, offscreen, clippedNoTitle, overlaps, smallTargets,
//                  pinnedOverlaps, h, verdict }
//   Scrolls to the top first. Text rects are clipped to their overflow boxes,
//   so a truncated label is not an "overlap". Targets under 24px pass when a
//   24px circle on their centre clears every other target (WCAG 2.5.8).
// __contrast(label) -> text under 4.5:1 (3:1 for large text), with every
//   translucent layer composited over the page's --background. Text inside
//   a disabled control is skipped (WCAG exempts inactive components).
// __focus() -> how the focused element shows focus: its outline, its ring
//   (box-shadow) and its border, each with its contrast against the ground.
//   A ring needs 3:1 against what it sits on to count as visible.
//
// Not in the build: nothing imports this file.
;(() => {
  const desc = (e) => {
    const t = (e.getAttribute?.('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ')
    return t.slice(0, 44) || `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`
  }
  const visible = (e) => {
    const r = e.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const cs = getComputedStyle(e)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05
  }
  // Visually hidden: Tailwind's sr-only and Base UI's own hidden helpers
  // (a Progress span, a Select's form input, fixed or absolute), all
  // clipped to nothing.
  const srOnly = (e) => {
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (cs.clipPath === 'inset(50%)' && p.getBoundingClientRect().width <= 1) return true
    }
    return false
  }
  const pinnedRoot = (e) => {
    let root = null
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const pos = getComputedStyle(p).position
      if (pos === 'sticky' || pos === 'fixed') root = p
    }
    return root
  }
  const inScroller = (e) => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) return true
    }
    return false
  }
  const hasTitle = (e) => {
    for (let p = e; p && p !== document.body; p = p.parentElement) if (p.title) return true
    return false
  }
  // A range measures the whole string, even the part overflow:hidden cuts
  // off, so clip it to every clipping box on the way up. Without this a
  // truncated label "overlaps" the figure its ellipsis stops short of.
  const textRect = (e) => {
    const range = document.createRange()
    range.selectNodeContents(e)
    const r = range.getBoundingClientRect()
    let [l, t, rt, b] = [r.left, r.top, r.right, r.bottom]
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) {
        const c = p.getBoundingClientRect()
        l = Math.max(l, c.left)
        t = Math.max(t, c.top)
        rt = Math.min(rt, c.right)
        b = Math.min(b, c.bottom)
      }
    }
    return { left: l, top: t, right: rt, bottom: b }
  }
  const hits = (a, b, pad = 2) =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > pad &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > pad

  const texty = (all) =>
    all.filter(
      (e) =>
        !srOnly(e) &&
        [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
        e.getBoundingClientRect().top > -5000,
    )

  // A target scrolled under a sticky footer, or clipped out of its scroll
  // box, cannot be hit there; only what is on top at its centre counts.
  const reachable = (e) => {
    const r = e.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !!top && (top === e || e.contains(top) || top.contains(e))
  }

  // With a modal open, the page behind it is inert and covered by the
  // backdrop, so only the dialog is checked.
  const scope = () => document.querySelector('[role="dialog"][aria-modal="true"], [role="dialog"]') || document.body

  window.__qa = (label) => {
    window.scrollTo(0, 0)
    const vw = document.documentElement.clientWidth
    const hScroll = Math.max(0, document.documentElement.scrollWidth - vw)
    const root = scope()
    const all = [...root.querySelectorAll('*')].filter(visible)
    const words = texty(all)

    const offscreen = all
      .filter((e) => {
        if (srOnly(e) || inScroller(e)) return false
        const r = e.getBoundingClientRect()
        if (r.top < -5000) return false
        return r.right > vw + 1 || r.left < -1
      })
      .slice(0, 8)
      .map(desc)

    const clippedNoTitle = words
      .filter((e) => {
        const cs = getComputedStyle(e)
        const clamps =
          cs.textOverflow === 'ellipsis' ||
          (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') ||
          cs.overflow === 'hidden' ||
          cs.overflowX === 'hidden'
        if (!clamps || typeof e.scrollWidth !== 'number') return false
        const over = e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1
        return over && !hasTitle(e)
      })
      .map(desc)

    const flow = words.filter((e) => !pinnedRoot(e))
    const rects = flow.map(textRect)
    const overlaps = []
    for (let i = 0; i < flow.length; i++) {
      for (let j = i + 1; j < flow.length; j++) {
        if (flow[i].contains(flow[j]) || flow[j].contains(flow[i])) continue
        if (hits(rects[i], rects[j])) overlaps.push(`${desc(flow[i])} <> ${desc(flow[j])}`)
      }
    }

    // WCAG 2.5.8: under 24px passes if a 24px circle on its centre clears
    // every other target (the spacing exception).
    const targets = all.filter(
      (e) =>
        !srOnly(e) &&
        e.getAttribute('tabindex') !== '-1' &&
        e.matches('button, a[href], select, input, textarea, [role="button"], [tabindex="0"]') &&
        reachable(e),
    )
    const boxes = targets.map((e) => e.getBoundingClientRect())
    const small = boxes.map((r) => r.width < 24 || r.height < 24)
    const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2]
    const distToRect = ([x, y], r) =>
      Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom))
    const smallTargets = []
    targets.forEach((e, i) => {
      if (!small[i]) return
      const c = centre(boxes[i])
      const crowded = targets.some((_, j) => {
        if (j === i) return false
        return small[j]
          ? Math.hypot(c[0] - centre(boxes[j])[0], c[1] - centre(boxes[j])[1]) < 24
          : distToRect(c, boxes[j]) < 12
      })
      if (crowded) {
        smallTargets.push(`${desc(e)} ${Math.round(boxes[i].width)}x${Math.round(boxes[i].height)}`)
      }
    })

    const pins = [...new Set(all.map(pinnedRoot).filter((p) => p && p !== root && !p.contains(root)))]
    const pinnedOverlaps = []
    for (const p of pins) {
      const pr = p.getBoundingClientRect()
      flow.forEach((e, i) => {
        if (hits(pr, rects[i], 1)) pinnedOverlaps.push(desc(e))
      })
    }

    const res = {
      label,
      vw,
      hScroll,
      offscreen,
      clippedNoTitle,
      overlaps: overlaps.slice(0, 10),
      smallTargets,
      pinnedOverlaps: pinnedOverlaps.slice(0, 10),
      h: document.documentElement.scrollHeight,
    }
    const bad =
      hScroll > 0 ||
      offscreen.length ||
      clippedNoTitle.length ||
      overlaps.length ||
      smallTargets.length ||
      pinnedOverlaps.length
    res.verdict = bad ? 'ISSUES' : 'clean'
    return res
  }

  // --- contrast -----------------------------------------------------------
  // Paint one pixel and read it back: handles rgb(), oklab(), color() and
  // color-mix() results alike, which string parsing does not.
  const px = document.createElement('canvas')
  px.width = px.height = 1
  const pctx = px.getContext('2d', { willReadFrequently: true })
  const cache = new Map()
  const parse = (s) => {
    if (cache.has(s)) return cache.get(s)
    pctx.clearRect(0, 0, 1, 1)
    pctx.fillStyle = '#000'
    pctx.fillStyle = s
    pctx.fillRect(0, 0, 1, 1)
    const d = pctx.getImageData(0, 0, 1, 1).data
    const v = [d[0], d[1], d[2], d[3] / 255]
    cache.set(s, v)
    return v
  }
  const over = (top, under) => {
    const a = top[3]
    return [0, 1, 2].map((k) => top[k] * a + under[k] * (1 - a)).concat(1)
  }
  const lum = (c) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
    return (x + 0.05) / (y + 0.05)
  }
  window.__contrast = (label) => {
    const root = getComputedStyle(document.documentElement)
    const grounds = [parse(root.getPropertyValue('--background').trim())]
    const all = [...scope().querySelectorAll('*')].filter(visible)
    const fails = []
    for (const e of texty(all)) {
      if (e.closest(':disabled, [aria-disabled="true"], [data-disabled]')) continue
      const layers = []
      for (let p = e; p; p = p.parentElement) {
        const bg = parse(getComputedStyle(p).backgroundColor)
        if (bg[3] > 0) layers.push(bg)
        if (bg[3] >= 1) break
      }
      const cs = getComputedStyle(e)
      let worst = 99
      for (const g of grounds) {
        let bg = g
        for (let k = layers.length - 1; k >= 0; k--) bg = over(layers[k], bg)
        let fg = parse(cs.color)
        const op = Number(cs.opacity)
        fg = over([fg[0], fg[1], fg[2], fg[3] * op], bg)
        worst = Math.min(worst, ratio(fg, bg))
      }
      const size = Number.parseFloat(cs.fontSize)
      const bold = Number(cs.fontWeight) >= 700
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
      if (worst < need) fails.push(`${worst.toFixed(2)} (${need}) ${size}px "${desc(e)}"`)
    }
    return { label, checked: texty(all).length, fails: [...new Set(fails)].slice(0, 25) }
  }

  // --- focus --------------------------------------------------------------
  // What the ground under an element is: its nearest opaque background,
  // translucent layers composited on top.
  const groundOf = (e) => {
    const layers = []
    for (let p = e.parentElement; p; p = p.parentElement) {
      const bg = parse(getComputedStyle(p).backgroundColor)
      if (bg[3] > 0) layers.push(bg)
      if (bg[3] >= 1) break
    }
    let bg = parse(getComputedStyle(document.documentElement).getPropertyValue('--background').trim())
    for (let k = layers.length - 1; k >= 0; k--) bg = over(layers[k], bg)
    return bg
  }
  // Every colour in a box-shadow list, with its spread; Tailwind stacks
  // several layers and the ring is one of them (trap: never truncate it).
  const shadowColours = (s) =>
    s === 'none' ? [] : [...s.matchAll(/(rgba?\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\)|color\([^)]*\))[^,]*?(-?\d+(?:\.\d+)?)px(?=\s*(?:inset)?\s*(?:,|$))/g)].map((m) => ({ colour: m[1], spread: Number(m[2]) }))

  // Rest styles of every focusable, taken before anything has focus, so a
  // border or shadow the control always has is not mistaken for focus.
  const rest = new WeakMap()
  const styleKey = (cs) => ({
    border: cs.borderTopColor,
    outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
    shadow: cs.boxShadow,
  })
  window.__snapshotRest = () => {
    // A dialog opens with focus already inside it; blur so nothing is
    // recorded in its focused state.
    document.activeElement?.blur?.()
    const focusables = document.querySelectorAll('button, a[href], input, select, textarea, [tabindex], [data-slot]')
    focusables.forEach((e) => rest.set(e, styleKey(getComputedStyle(e))))
    return focusables.length
  }

  let nextId = 0
  window.__focus = () => {
    const focused = document.activeElement
    if (!focused || focused === document.body) return null
    // Base UI's focus-trap guards hold focus for an instant and hand it on;
    // they are not a place a keyboard user ever rests.
    if (focused.hasAttribute('data-base-ui-focus-guard')) return null
    if (!focused.dataset.qaId) focused.dataset.qaId = String(++nextId)
    // A visually hidden input (a Slider's range input, say) shows its focus
    // on the nearest visible ancestor, which is what a user sees.
    let e = focused
    const hidden = (x) => getComputedStyle(x).clipPath === 'inset(50%)' || x.getBoundingClientRect().width < 2
    while (e.parentElement && hidden(e)) e = e.parentElement
    const cs = getComputedStyle(e)
    const was = rest.get(e)
    const now = styleKey(cs)
    const ground = groundOf(e)
    const contrastOf = (c) => {
      const v = parse(c)
      return v[3] === 0 ? 0 : ratio(over(v, ground), ground)
    }
    const indicators = []
    if (cs.outlineStyle !== 'none' && Number.parseFloat(cs.outlineWidth) > 0 && now.outline !== was?.outline) {
      indicators.push({ kind: 'outline', width: Number.parseFloat(cs.outlineWidth), contrast: contrastOf(cs.outlineColor) })
    }
    if (Number.parseFloat(cs.borderTopWidth) > 0 && was && now.border !== was.border) {
      indicators.push({ kind: 'border', width: Number.parseFloat(cs.borderTopWidth), contrast: contrastOf(cs.borderTopColor) })
    }
    if (now.shadow !== was?.shadow) {
      for (const r of shadowColours(cs.boxShadow).filter((x) => x.spread > 0)) {
        indicators.push({ kind: 'ring', width: r.spread, contrast: contrastOf(r.colour) })
      }
    }
    for (const i of indicators) i.contrast = Number(i.contrast.toFixed(2))
    const visible = indicators.some((i) => i.contrast >= 3)
    return {
      id: focused.dataset.qaId,
      name: desc(focused.getAttribute('aria-label') || focused.getAttribute('aria-labelledby') ? focused : e),
      tag: focused.tagName.toLowerCase(),
      shownOn: e === focused ? undefined : e.dataset.slot || e.tagName.toLowerCase(),
      visible,
      indicators,
    }
  }
})()
