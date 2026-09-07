(() => {
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  if (typeof setupBattleSideLayout === "function") {
    try { setupBattleSideLayout(); } catch (e) {}
  }
  if (typeof updateGameFitScale === "function") updateGameFitScale();

  function chain(el) {
    const rows = [];
    let p = el;
    while (p && p.nodeType === 1) {
      const cs = getComputedStyle(p);
      const r = p.getBoundingClientRect();
      rows.push({
        tag: p.tagName,
        id: p.id || "",
        cls: (typeof p.className === "string" ? p.className : "").slice(0, 70),
        pos: cs.position,
        transform: cs.transform,
        zoom: cs.zoom,
        filter: cs.filter,
        overflow: cs.overflow,
        top: cs.top,
        left: cs.left,
        width: cs.width,
        height: cs.height,
        offsetW: p.offsetWidth,
        offsetH: p.offsetHeight,
        offsetTop: p.offsetTop,
        offsetLeft: p.offsetLeft,
        offsetParent: p.offsetParent ? ((p.offsetParent.id || "") + "." + (p.offsetParent.className || "").toString().split(" ")[0]) : null,
        rect: { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), b: +r.bottom.toFixed(2) }
      });
      p = p.parentElement;
    }
    return rows;
  }

  const root = document.getElementById("game-scale-root");
  const board = document.querySelector(".game-board-viewport");
  const sidebar = document.querySelector(".battle-sidebar-left");
  const remove = document.getElementById("remove-button");
  const hud = document.querySelector(".status-bar");
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const tr = root ? getComputedStyle(root).transform : null;
  let scale = 1;
  const m = /matrix\(([^,]+)/.exec(tr || "");
  if (m) scale = parseFloat(m[1]);
  const rr = root.getBoundingClientRect();

  function report(name, el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      name,
      offsetW: el.offsetWidth,
      offsetH: el.offsetHeight,
      cssTop: getComputedStyle(el).top,
      cssLeft: getComputedStyle(el).left,
      cssPos: getComputedStyle(el).position,
      cssTransform: getComputedStyle(el).transform,
      inRoot: root.contains(el),
      rect: { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2) },
      designFromRect: {
        x: +((r.x - rr.x) / scale).toFixed(2),
        y: +((r.y - rr.y) / scale).toFixed(2),
        w: +(r.width / scale).toFixed(2),
        h: +(r.height / scale).toFixed(2),
        bottom: +((r.bottom - rr.y) / scale).toFixed(2)
      },
      overflowViewportPx: {
        right: Math.max(0, +(r.right - vw).toFixed(2)),
        bottom: Math.max(0, +(r.bottom - vh).toFixed(2)),
        left: Math.max(0, +(0 - r.x).toFixed(2)),
        top: Math.max(0, +(0 - r.y).toFixed(2))
      },
      overflowRootVisualPx: {
        right: Math.max(0, +(r.right - rr.right).toFixed(2)),
        bottom: Math.max(0, +(r.bottom - rr.bottom).toFixed(2))
      },
      ancestors: chain(el)
    };
  }

  // content that extends past root layout box (unscaled)
  const spill = [];
  for (const el of root.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    const bottomDesign = (r.bottom - rr.y) / scale;
    const rightDesign = (r.right - rr.x) / scale;
    if (bottomDesign > 941.5 || rightDesign > 1672.5) {
      if (r.width < 2 || r.height < 2) continue;
      spill.push({
        id: el.id || "",
        cls: (typeof el.className === "string" ? el.className : "").slice(0, 60),
        bottomDesign: +bottomDesign.toFixed(1),
        rightDesign: +rightDesign.toFixed(1),
        pastBottom: +(bottomDesign - 941).toFixed(1),
        pastRight: +(rightDesign - 1672).toFixed(1)
      });
      if (spill.length > 30) break;
    }
  }

  return {
    viewport: { w: vw, h: vh },
    scale: +scale.toFixed(6),
    expectedScale: +Math.min(vw / 1672, vh / 941).toFixed(6),
    root: {
      offsetW: root.offsetWidth,
      offsetH: root.offsetHeight,
      scrollW: root.scrollWidth,
      scrollH: root.scrollHeight,
      transform: tr,
      transformOrigin: getComputedStyle(root).transformOrigin,
      overflow: getComputedStyle(root).overflow,
      left: root.style.left,
      top: root.style.top,
      rect: { x: +rr.x.toFixed(2), y: +rr.y.toFixed(2), w: +rr.width.toFixed(2), h: +rr.height.toFixed(2), bottom: +rr.bottom.toFixed(2) },
      expectedScaled: { w: +(1672 * scale).toFixed(2), h: +(941 * scale).toFixed(2) }
    },
    shell: report("shell", document.getElementById("game-viewport-shell")),
    board: report("board", board),
    sidebar: report("sidebar", sidebar),
    remove: report("remove", remove),
    hud: report("hud", hud),
    spillTop30: spill,
    htmlZoom: getComputedStyle(document.documentElement).zoom,
    bodyZoom: getComputedStyle(document.body).zoom,
    bodyTransform: getComputedStyle(document.body).transform
  };
})()
