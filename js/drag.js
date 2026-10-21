// Generic pointer-based drag & drop manager (touch, pen, mouse), stage-scale aware.
// Contract: docs/DESIGN.md §4.3. Works purely in stage coordinates via toStage().
//
// Classes it sets:  root.is-dragging · source.drag-source · target.drop-ok / .drop-hover / .drop-bad
//                   ghost wrapper .drag-ghost (+ .is-returning / .is-dropping while flying),
//                   inner .drag-ghost-body (scale + shadow)
// Attributes:       [data-dnd-source] / [data-dnd-target] on registered elements.
// A target's hit rect is its element's box (plus the boxes of its optional hitEls), expanded by HIT_PAD; an accepted
// ghost shrinks into the centre of that box, or of its optional land element.

const HIT_PAD = 18; // stage px added around every target rect (the default of the hitPad option: more on a phone)
// Touch: the ghost centre floats TOUCH_LIFT_CSS css px (~9 mm on a tablet) above the finger, clamped to
// TOUCH_LIFT…TOUCH_LIFT_MAX stage px – never less than on a big screen, and never so much that the trash
// at the stage's bottom edge gets out of reach on a phone.
const TOUCH_LIFT_CSS = 48;
const TOUCH_LIFT = 40;
const TOUCH_LIFT_MAX = 80;
const SOURCE_PAD = 6; // stage px around the source: a pointer resting there never hits a target
const TAP_SLOP = 6; // css px a tap may wander
const TAP_MS = 300;
const RECT_TTL = 100; // ms between target rect refreshes while dragging
const RETURN_MS = 220;
const DROP_MS = 120;
const PICKUP_MS = 140;
const GHOST_SCALE = 1.12;
const GHOST_Z = '1000';
const SHADOW = 'drop-shadow(0 12px 10px rgba(42, 18, 54, 0.35))';

// Inline styles every source gets so touches never scroll, zoom, select or open callouts.
const SOURCE_LOCK = {
  'touch-action': 'none',
  'user-select': 'none',
  '-webkit-user-select': 'none',
  '-webkit-touch-callout': 'none',
};

const noop = () => {};
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const centered = (scale) => `translate(-50%, -50%) scale(${scale})`;

function report(err) {
  if (typeof reportError === 'function') reportError(err);
  else console.error(err);
}

function call(fn, ...args) {
  if (typeof fn !== 'function') return undefined;
  try {
    return fn(...args);
  } catch (err) {
    report(err);
    return undefined;
  }
}

function lockStyles(el) {
  const saved = {};
  for (const [prop, value] of Object.entries(SOURCE_LOCK)) {
    saved[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];
    el.style.setProperty(prop, value);
  }
  return saved;
}

function restoreStyles(el, saved) {
  for (const [prop, [value, priority]] of Object.entries(saved)) {
    if (value) el.style.setProperty(prop, value, priority);
    else el.style.removeProperty(prop);
  }
}

const preventDefault = (e) => {
  if (e.cancelable) e.preventDefault();
};

export function createDragManager({ root, toStage, ghostLayer, onPickup, onDrop, onCancel, hitPad = HIT_PAD } = {}) {
  const sources = new Map(); // el → registration
  const targets = new Map(); // el → registration
  const flights = new Set(); // ghosts still animating after a drag ended
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const captureRoot = root || document.documentElement;
  let drag = null;
  let listening = false;
  let destroyed = false;

  const reducedMotion = () => !!motionQuery?.matches;

  // ------------------------------------------------------------ geometry
  function rectOf(el) {
    const r = el.getBoundingClientRect();
    const a = toStage(r.left, r.top);
    const b = toStage(r.right, r.bottom);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: b.x - a.x, h: b.y - a.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  // Touch lift in stage px for the current stage scale. A fixed stage-px lift would shrink with the
  // scale and hide the ghost under the fingertip on small tablets and phones.
  function touchLift() {
    const a = toStage(0, 0);
    const b = toStage(100, 0);
    const stagePerCss = (b.x - a.x) / 100;
    if (!(stagePerCss > 0) || !Number.isFinite(stagePerCss)) return TOUCH_LIFT;
    return Math.min(TOUCH_LIFT_MAX, Math.max(TOUCH_LIFT, TOUCH_LIFT_CSS * stagePerCss));
  }

  // Follow the pointer: d.finger is the pointer itself, d.pos the ghost centre = hit-test point.
  function track(d, e) {
    d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.sx, e.clientY - d.sy));
    d.finger = toStage(e.clientX, e.clientY);
    d.pos = { x: d.finger.x, y: d.finger.y - d.lift };
  }

  // The pointer (not the lifted ghost) still rests on its source: it has not left the tap slop yet,
  // or it is back over the source rect (its box, reaching cfg.reach stage px higher where its hit area does).
  // Holding an item or putting it back must never drop it into a target next to the source (in the game a
  // cup's box ends 2 px above the fruit bins' raised hit area, within the lift).
  function onSource(d) {
    if (d.moved <= TAP_SLOP) return true;
    const s = d.src;
    const f = d.finger;
    return f.x >= s.x1 - SOURCE_PAD && f.x <= s.x2 + SOURCE_PAD && f.y >= s.y1 - SOURCE_PAD && f.y <= s.y2 + SOURCE_PAD;
  }

  // A target's hit rect: its element's box, joined by the boxes of its hitEls (e.g. a guest's order bubble,
  // wider than the guest).
  function targetRect(reg) {
    let r = rectOf(reg.el);
    for (const h of reg.cfg.hitEls || []) {
      if (!h.isConnected) continue;
      const b = rectOf(h);
      if (!(b.w > 0 || b.h > 0)) continue;
      if (!(r.w > 0 || r.h > 0)) {
        r = b;
        continue;
      }
      const x1 = Math.min(r.x1, b.x1);
      const y1 = Math.min(r.y1, b.y1);
      const x2 = Math.max(r.x2, b.x2);
      const y2 = Math.max(r.y2, b.y2);
      r = { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
    }
    return r;
  }

  function refreshRects(d) {
    d.rectsAt = now();
    d.rects.clear();
    for (const reg of d.oks) {
      if (!reg.el.isConnected) continue;
      const r = targetRect(reg);
      if (r.w > 0 || r.h > 0) d.rects.set(reg, r);
    }
  }

  function hitTest(d) {
    if (onSource(d)) return null; // no drop-hover, and a release here is a silent return
    if (now() - d.rectsAt > RECT_TTL) refreshRects(d);
    const { x, y } = d.pos;
    let best = null;
    let bestDist = Infinity;
    for (const [reg, r] of d.rects) {
      if (x < r.x1 - hitPad || x > r.x2 + hitPad || y < r.y1 - hitPad || y > r.y2 + hitPad) continue;
      const dist = Math.hypot(x - r.cx, y - r.cy);
      if (dist < bestDist) {
        best = reg;
        bestDist = dist;
      }
    }
    return best;
  }

  // valid(payload) is optional: an accepting target that is not valid can still be hit (its drop()
  // explains the rejection) but does not glow; hovering it shows drop-bad instead.
  function isValid(reg, payload) {
    return reg.cfg.valid ? call(reg.cfg.valid, payload) !== false : true;
  }

  function setHover(d, reg) {
    if (reg === d.hover) return;
    d.hover?.el.classList.remove('drop-hover', 'drop-bad');
    d.hover = reg;
    if (reg) {
      reg.el.classList.add('drop-hover');
      reg.el.classList.toggle('drop-bad', !isValid(reg, d.payload));
    }
  }

  // Where an accepted ghost shrinks into: the centre of the target's land element (e.g. the guest itself, when its
  // hit rect also spans its order bubble), else of its hit rect r.
  function landOf(reg, r) {
    const l = reg.cfg.land;
    if (l?.isConnected) {
      const b = rectOf(l);
      if (b.w > 0 || b.h > 0) return { x: b.cx, y: b.cy };
    }
    return { x: r.cx, y: r.cy };
  }

  // Where a returning ghost flies to: the source's current centre (or that of its `home` element, e.g. where a
  // blender's jug stands on its base), or its last known one.
  function homeOf(d) {
    const el = call(d.cfg.home) || d.el;
    if (el.isConnected) {
      const r = rectOf(el);
      if (r.w > 0 || r.h > 0) d.home = { x: r.cx, y: r.cy };
    }
    return d.home;
  }

  // ------------------------------------------------------------ ghost
  function fallbackGhost(el) {
    const r = rectOf(el);
    const clone = el.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.remove('drag-source', 'drop-ok', 'drop-hover', 'drop-bad');
    Object.assign(clone.style, { width: `${r.w}px`, height: `${r.h}px`, margin: '0', boxSizing: 'border-box' });
    return clone;
  }

  function makeGhost(d) {
    let content = call(d.cfg.ghost, d.payload);
    if (typeof content === 'string') {
      const holder = document.createElement('div'); // markup (e.g. an art.js SVG string) is fine too
      holder.innerHTML = content;
      content = holder;
    }
    if (!(content instanceof Node)) content = fallbackGhost(d.el);
    const wrap = document.createElement('div');
    wrap.className = 'drag-ghost';
    wrap.setAttribute('aria-hidden', 'true');
    Object.assign(wrap.style, {
      position: 'absolute', left: '0', top: '0', zIndex: GHOST_Z, pointerEvents: 'none',
      willChange: 'transform', transform: 'translate3d(0px, 0px, 0)',
    });
    const body = document.createElement('div');
    body.className = 'drag-ghost-body';
    Object.assign(body.style, {
      display: 'flex', pointerEvents: 'none', transform: centered(GHOST_SCALE), filter: SHADOW,
    });
    body.appendChild(content);
    wrap.appendChild(body);
    ghostLayer.appendChild(wrap);
    // The wrapper sits at the layer's origin; measure it once so any layer offset is handled.
    const r = wrap.getBoundingClientRect();
    d.origin = toStage(r.left, r.top);
    d.ghost = { wrap, body };
    placeGhost(d);
    if (!reducedMotion() && typeof body.animate === 'function') {
      body.animate([{ transform: centered(0.9) }, { transform: centered(GHOST_SCALE) }], {
        duration: PICKUP_MS, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      });
    }
  }

  function ghostTransform(d, p) {
    return `translate3d(${p.x - d.origin.x}px, ${p.y - d.origin.y}px, 0)`;
  }

  function placeGhost(d) {
    if (d.ghost) d.ghost.wrap.style.transform = ghostTransform(d, d.pos);
  }

  // Animate the ghost to dest ('return' = back to the source, 'drop' = shrink into a target),
  // or remove it at once when dest is null or motion is reduced.
  function fly(d, dest, kind) {
    const g = d.ghost;
    d.ghost = null;
    if (!g) {
      if (drag?.el !== d.el) d.el.classList.remove('drag-source');
      return;
    }
    const flight = { el: d.el, done: false, timer: 0 };
    flight.finish = () => {
      if (flight.done) return;
      flight.done = true;
      clearTimeout(flight.timer);
      flights.delete(flight);
      g.wrap.remove();
      if (drag?.el !== d.el) d.el.classList.remove('drag-source');
    };
    flights.add(flight);
    if (!dest || reducedMotion() || typeof g.wrap.animate !== 'function') {
      flight.finish();
      return;
    }
    const drop = kind === 'drop';
    const ms = drop ? DROP_MS : RETURN_MS;
    const from = g.wrap.style.transform;
    const to = ghostTransform(d, dest);
    const bodyTo = centered(drop ? 0.3 : 1);
    g.wrap.classList.add(drop ? 'is-dropping' : 'is-returning');
    g.wrap.style.transform = to;
    g.body.style.transform = bodyTo;
    if (drop) g.body.style.opacity = '0';
    const easing = drop ? 'cubic-bezier(0.55, 0, 0.75, 0.2)' : 'cubic-bezier(0.2, 0.9, 0.3, 1.05)';
    const anim = g.wrap.animate([{ transform: from }, { transform: to }], { duration: ms, easing });
    g.body.animate(
      [{ transform: centered(GHOST_SCALE), opacity: 1 }, { transform: bodyTo, opacity: drop ? 0 : 1 }],
      { duration: ms, easing },
    );
    anim.onfinish = flight.finish;
    flight.timer = setTimeout(flight.finish, ms + 120); // safety net if the animation never finishes
  }

  function settleFlightsOf(el) {
    for (const f of [...flights]) if (f.el === el) f.finish();
  }

  // ------------------------------------------------------------ drag lifecycle
  function considerTarget(d, reg) {
    if (reg.el === d.el) return;
    if (call(reg.cfg.accepts, d.payload)) {
      d.oks.add(reg);
      reg.el.classList.toggle('drop-ok', isValid(reg, d.payload));
    }
  }

  // Re-evaluate valid() of the hittable targets mid-drag (state can change under a still finger).
  // classList.toggle with an unchanged state does not touch the DOM, so this is cheap per frame.
  function refresh() {
    const d = drag;
    if (!d) return;
    for (const reg of d.oks) reg.el.classList.toggle('drop-ok', isValid(reg, d.payload));
    if (d.hover) d.hover.el.classList.toggle('drop-bad', !isValid(d.hover, d.payload));
  }

  function startDrag(e, reg, payload) {
    settleFlightsOf(reg.el);
    const lift = e.pointerType === 'touch' ? touchLift() : 0;
    const d = {
      id: e.pointerId, pointerType: e.pointerType || 'mouse', el: reg.el, cfg: reg.cfg, payload, lift,
      captureEl: reg.el,
      sx: e.clientX, sy: e.clientY, t0: now(), moved: 0,
      finger: null, pos: null, src: null, home: null, origin: { x: 0, y: 0 }, ghost: null,
      oks: new Set(), rects: new Map(), rectsAt: 0, hover: null,
    };
    track(d, e);
    const r = rectOf(reg.el); // before .drag-source restyles it
    const reach = Math.max(0, Number(reg.cfg.reach) || 0); // a hit area raised above the box (e.g. by a ::before)
    d.src = reach ? { ...r, y1: r.y1 - reach, h: r.h + reach, cy: r.cy - reach / 2 } : r;
    d.home = { x: r.cx, y: r.cy };
    homeOf(d);
    drag = d;
    try {
      reg.el.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already released pointer – window listeners still track it */
    }
    listen(true);
    root?.classList.add('is-dragging');
    reg.el.classList.add('drag-source');
    try {
      makeGhost(d);
    } catch (err) {
      report(err);
      cancelDrag(d, { animate: false, silent: true });
      return;
    }
    for (const t of targets.values()) considerTarget(d, t);
    refreshRects(d);
    setHover(d, hitTest(d));
    call(d.cfg.onStart, payload);
    if (drag === d) call(onPickup, payload);
  }

  // Leave the dragging state (listeners, classes, capture). Ghost + drag-source stay for the flight.
  function endDrag(d) {
    if (drag === d) drag = null;
    listen(false);
    try {
      if (d.captureEl.hasPointerCapture?.(d.id)) d.captureEl.releasePointerCapture(d.id);
    } catch {
      /* element gone */
    }
    root?.classList.remove('is-dragging');
    setHover(d, null);
    for (const reg of d.oks) reg.el.classList.remove('drop-ok', 'drop-bad');
    d.oks.clear();
    d.rects.clear();
  }

  // pos = the ghost centre (the hit-test point) in stage px at release.
  function makeResult(d, fields) {
    return {
      ok: false, reason: null, payload: d.payload, targetEl: null,
      tap: false, cancelled: false, pointerType: d.pointerType, pos: d.pos ? { x: d.pos.x, y: d.pos.y } : null, ...fields,
    };
  }

  function finishDrag(d, e) {
    if (e) {
      track(d, e);
      placeGhost(d);
    }
    if (d.moved <= TAP_SLOP && now() - d.t0 < TAP_MS) {
      endDrag(d);
      fly(d, null);
      const result = makeResult(d, { tap: true });
      call(d.cfg.onTap, d.payload);
      call(d.cfg.onEnd, result);
      call(onDrop, result);
      return;
    }
    const target = hitTest(d);
    const dest = target ? landOf(target, d.rects.get(target)) : null;
    const home = homeOf(d);
    endDrag(d);
    let result;
    if (target) {
      const res = call(target.cfg.drop, d.payload);
      const ok = res === true || res?.ok === true;
      result = makeResult(d, { ok, reason: res?.reason ?? null, targetEl: target.el });
      // back: the carried thing goes home after an accepted drop too (a jug poured into a cup)
      const into = ok && !d.cfg.back;
      fly(d, into ? dest : home, into ? 'drop' : 'return');
    } else {
      // pos is null while the pointer still rests on the source: a hold or put-back is a plain return,
      // the view must not explain it as a drop on a wrong station.
      result = makeResult(d, { pos: onSource(d) ? null : { x: d.pos.x, y: d.pos.y } });
      fly(d, home, 'return');
    }
    call(d.cfg.onEnd, result);
    call(onDrop, result);
  }

  function cancelDrag(d, { animate = true, silent = false } = {}) {
    const home = animate ? homeOf(d) : null;
    endDrag(d);
    fly(d, home, 'return');
    if (silent) return;
    const result = makeResult(d, { cancelled: true });
    call(d.cfg.onEnd, result);
    call(onCancel, result);
  }

  // ------------------------------------------------------------ pointer handlers
  function onSourceDown(e, reg) {
    if (destroyed || !reg.live || e.button !== 0) return;
    preventDefault(e); // no text selection, no compat mouse events, no focus jumps
    if (drag) return; // one drag at a time – extra fingers are ignored
    const payload = call(reg.cfg.payload);
    if (payload === null || payload === undefined) return;
    startDrag(e, reg, payload);
  }

  function onMove(e) {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    preventDefault(e);
    if (d.pointerType === 'mouse' && e.buttons === 0) {
      finishDrag(d, e); // the button was released somewhere we never heard about
      return;
    }
    track(d, e);
    placeGhost(d);
    setHover(d, hitTest(d));
  }

  function onUp(e) {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    preventDefault(e);
    finishDrag(d, e);
  }

  function onPointerCancel(e) {
    if (drag && e.pointerId === drag.id) cancelDrag(drag);
  }

  // Capture is lost when the source element is removed or re-inserted (a view re-render).
  // The drag then moves its capture to the root and carries on; if that fails, or the root
  // loses it too, the drag is cancelled.
  function onLostCapture(e) {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    if (d.captureEl !== captureRoot && recapture(d)) return;
    cancelDrag(d);
  }

  function recapture(d) {
    try {
      captureRoot.setPointerCapture(d.id);
    } catch {
      return false;
    }
    if (!captureRoot.hasPointerCapture(d.id)) return false;
    d.captureEl = captureRoot;
    return true;
  }

  function onBlur(e) {
    if (drag && e.target === window) cancelDrag(drag);
  }

  function onVisibility() {
    if (drag && document.visibilityState === 'hidden') cancelDrag(drag);
  }

  const capture = { capture: true, passive: false };

  function listen(on) {
    if (on === listening) return;
    listening = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    window[method]('pointermove', onMove, capture);
    window[method]('pointerup', onUp, capture);
    window[method]('pointercancel', onPointerCancel, capture);
    window[method]('lostpointercapture', onLostCapture, capture);
    window[method]('blur', onBlur);
    document[method]('visibilitychange', onVisibility);
  }

  // ------------------------------------------------------------ registration API
  function source(el, cfg) {
    if (destroyed || !el || !cfg) return noop;
    sources.get(el)?.off();
    const reg = { el, cfg, live: true };
    const down = (e) => onSourceDown(e, reg);
    el.addEventListener('pointerdown', down);
    el.addEventListener('touchmove', preventDefault, { passive: false });
    el.addEventListener('contextmenu', preventDefault);
    el.addEventListener('dragstart', preventDefault);
    el.addEventListener('selectstart', preventDefault);
    const saved = lockStyles(el);
    el.setAttribute('data-dnd-source', '');
    reg.off = () => {
      if (!reg.live) return;
      reg.live = false;
      if (sources.get(el) === reg) sources.delete(el);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('touchmove', preventDefault, { passive: false });
      el.removeEventListener('contextmenu', preventDefault);
      el.removeEventListener('dragstart', preventDefault);
      el.removeEventListener('selectstart', preventDefault);
      restoreStyles(el, saved);
      el.removeAttribute('data-dnd-source');
      // An active drag from this element keeps going; it holds its own references.
    };
    sources.set(el, reg);
    return reg.off;
  }

  function target(el, cfg) {
    if (destroyed || !el || !cfg) return noop;
    targets.get(el)?.off();
    const reg = { el, cfg, live: true };
    el.setAttribute('data-dnd-target', '');
    targets.set(el, reg);
    if (drag) {
      considerTarget(drag, reg);
      drag.rectsAt = 0; // pick up its rect on the next move
    }
    reg.off = () => {
      if (!reg.live) return;
      reg.live = false;
      if (targets.get(el) === reg) targets.delete(el);
      if (drag) {
        if (drag.hover === reg) setHover(drag, null);
        drag.oks.delete(reg);
        drag.rects.delete(reg);
      }
      el.classList.remove('drop-ok', 'drop-hover', 'drop-bad');
      el.removeAttribute('data-dnd-target');
    };
    return reg.off;
  }

  function cancel() {
    if (drag) cancelDrag(drag);
  }

  function destroy() {
    if (destroyed) return;
    if (drag) cancelDrag(drag, { animate: false, silent: true });
    for (const f of [...flights]) f.finish();
    for (const reg of [...sources.values()]) reg.off();
    for (const reg of [...targets.values()]) reg.off();
    listen(false);
    destroyed = true;
  }

  return { source, target, cancel, destroy, refresh, isDragging: () => !!drag };
}
