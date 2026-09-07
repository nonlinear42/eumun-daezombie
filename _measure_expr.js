(async () => {
  for (let i = 0; i < 40; i++) {
    if (document.getElementById("game-scale-root")) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  if (typeof setupBattleSideLayout === "function") {
    try { setupBattleSideLayout(); } catch (e) {}
  }
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 250));
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      id: el.id || null,
      className: (typeof el.className === "string" ? el.className : "").slice(0, 160),
      parent: el.parentElement
        ? ((el.parentElement.id || "") + "/" + (typeof el.parentElement.className === "string"
            ? el.parentElement.className.split(/\s+/).slice(0, 4).join(".")
            : ""))
        : null,
      position: cs.position,
      top: cs.top,
      right: cs.right,
      bottom: cs.bottom,
      left: cs.left,
      transform: cs.transform,
      transformOrigin: cs.transformOrigin,
      overflow: cs.overflow + "/" + cs.overflowX + "/" + cs.overflowY,
      width: cs.width,
      height: cs.height,
      offsetW: el.offsetWidth,
      offsetH: el.offsetHeight,
      clientW: el.clientWidth,
      clientH: el.clientHeight,
      scrollW: el.scrollWidth,
      scrollH: el.scrollHeight,
      rect: {
        x: +r.x.toFixed(2),
        y: +r.y.toFixed(2),
        w: +r.width.toFixed(2),
        h: +r.height.toFixed(2),
        right: +r.right.toFixed(2),
        bottom: +r.bottom.toFixed(2)
      }
    };
  }

  function overflowVs(rect, vw, vh) {
    if (!rect) return null;
    return {
      left: Math.max(0, +(0 - rect.x).toFixed(2)),
      top: Math.max(0, +(0 - rect.y).toFixed(2)),
      right: Math.max(0, +(rect.right - vw).toFixed(2)),
      bottom: Math.max(0, +(rect.bottom - vh).toFixed(2))
    };
  }

  function designLocal(el, root) {
    if (!el || !root) return null;
    const er = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const s = (window.GAME_FIT && GAME_FIT.scale) || 1;
    return {
      x: +((er.x - rr.x) / s).toFixed(2),
      y: +((er.y - rr.y) / s).toFixed(2),
      w: +(er.width / s).toFixed(2),
      h: +(er.height / s).toFixed(2),
      right: +((er.right - rr.x) / s).toFixed(2),
      bottom: +((er.bottom - rr.y) / s).toFixed(2),
      pastRootBottom: +Math.max(0, (er.bottom - rr.bottom) / s).toFixed(2),
      pastRootRight: +Math.max(0, (er.right - rr.right) / s).toFixed(2),
      pastRootTop: +Math.max(0, (rr.top - er.top) / s).toFixed(2),
      pastRootLeft: +Math.max(0, (rr.left - er.left) / s).toFixed(2)
    };
  }

  function overflowParents(el) {
    const out = [];
    let p = el;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (/(hidden|clip|scroll|auto)/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
        out.push({
          id: p.id || null,
          className: (typeof p.className === "string" ? p.className : "").slice(0, 80),
          overflow: cs.overflow + "/" + cs.overflowX + "/" + cs.overflowY,
          position: cs.position
        });
      }
      p = p.parentElement;
    }
    return out;
  }

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const root = document.getElementById("game-scale-root");
  const shell = document.getElementById("game-viewport-shell");
  const sidebar = document.querySelector(".battle-sidebar-left");
  const board = document.querySelector(".game-board-viewport");
  const remove = document.getElementById("remove-button");
  const removeWrap = document.querySelector(".sidebar-remove-wrap");
  const hud = document.querySelector(".status-bar");
  const lane5 = document.querySelector('.playfield-start-marker[data-row="4"]')
    || document.querySelector('.cell[data-row="4"]')
    || null;

  const BASE_W = 1672;
  const BASE_H = 941;
  const expectedS = Math.min(vw / BASE_W, vh / BASE_H);
  const s = (window.GAME_FIT && GAME_FIT.scale) || expectedS;

  const rb = box(root);
  const sb = box(sidebar);
  const bb = box(board);
  const rm = box(remove);
  const rw = box(removeWrap);
  const hb = box(hud);
  const l5 = box(lane5);
  const sh = box(shell);

  // fixed / vh / vw offenders inside root subtree + outside
  const suspicious = [];
  const all = Array.from(document.querySelectorAll("body *"));
  for (const el of all) {
    const cs = getComputedStyle(el);
    const pos = cs.position;
    const t = cs.top + cs.bottom + cs.left + cs.right + cs.height + cs.width + cs.transform;
    const usesVhVw = /(vh|vw)/.test(t);
    const isFixed = pos === "fixed";
    const ownTransform = cs.transform && cs.transform !== "none";
    const inRoot = !!(root && root.contains(el));
    if (!isFixed && !usesVhVw && !(ownTransform && !inRoot)) continue;
    if (el === root) continue;
    if (el.id === "game-viewport-shell") continue;
    // skip tiny text nodes' parents noise: only report notable UI
    const idc = ((el.id || "") + " " + (typeof el.className === "string" ? el.className : "")).toLowerCase();
    if (!/(status|sidebar|board|remove|hud|battle|plant|pause|tutorial|overlay|lane|viewport|shell|scale)/.test(idc) && !isFixed) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2 && !isFixed) continue;
    suspicious.push({
      id: el.id || null,
      className: (typeof el.className === "string" ? el.className : "").slice(0, 100),
      inRoot,
      position: pos,
      usesVhVw,
      transform: cs.transform,
      top: cs.top,
      bottom: cs.bottom,
      left: cs.left,
      right: cs.right,
      height: cs.height,
      width: cs.width,
      rectBottom: +r.bottom.toFixed(2),
      rectTop: +r.top.toFixed(2)
    });
    if (suspicious.length > 40) break;
  }

  return {
    viewport: { w: vw, h: vh, innerW: window.innerWidth, innerH: window.innerHeight },
    GAME_FIT: window.GAME_FIT
      ? { baseWidth: GAME_FIT.baseWidth, baseHeight: GAME_FIT.baseHeight, scale: GAME_FIT.scale }
      : null,
    expected: {
      scale: +expectedS.toFixed(6),
      scaledW: +(BASE_W * expectedS).toFixed(2),
      scaledH: +(BASE_H * expectedS).toFixed(2)
    },
    shell: sh,
    root: rb,
    sidebar: sb,
    board: bb,
    remove: rm,
    removeWrap: rw,
    hud: hb,
    lane5: l5,
    overflowViewport: {
      root: overflowVs(rb && rb.rect, vw, vh),
      sidebar: overflowVs(sb && sb.rect, vw, vh),
      board: overflowVs(bb && bb.rect, vw, vh),
      remove: overflowVs(rm && rm.rect, vw, vh),
      removeWrap: overflowVs(rw && rw.rect, vw, vh),
      hud: overflowVs(hb && hb.rect, vw, vh),
      lane5: overflowVs(l5 && l5.rect, vw, vh)
    },
    designLocal: {
      sidebar: designLocal(sidebar, root),
      board: designLocal(board, root),
      remove: designLocal(remove, root),
      removeWrap: designLocal(removeWrap, root),
      hud: designLocal(hud, root),
      lane5: designLocal(lane5, root)
    },
    contains: {
      sidebar: !!(root && sidebar && root.contains(sidebar)),
      board: !!(root && board && root.contains(board)),
      remove: !!(root && remove && root.contains(remove)),
      hud: !!(root && hud && root.contains(hud)),
      removeWrap: !!(root && removeWrap && root.contains(removeWrap))
    },
    overflowAncestors: {
      board: board ? overflowParents(board) : [],
      remove: remove ? overflowParents(remove) : [],
      sidebar: sidebar ? overflowParents(sidebar) : []
    },
    suspicious,
    notes: {
      rootOverflowHidden: rb ? /hidden/.test(rb.overflow) : null,
      shellOverflowHidden: sh ? /hidden/.test(sh.overflow) : null,
      boardDesignBottomTarget: 460 + 450,
      sidebarDesignBottomTarget: 96 + (941 - 96 - 78)
    }
  };
})()
