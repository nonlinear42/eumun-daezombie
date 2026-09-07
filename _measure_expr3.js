(() => {
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  const root = document.getElementById("game-scale-root");
  const board = document.querySelector(".game-board-viewport");
  const scene = document.querySelector(".battle-scene");
  const layout = document.querySelector(".battle-layout");
  const sidebar = document.querySelector(".battle-sidebar-left");
  const els = [root, layout, scene, board, sidebar, document.documentElement, document.body];
  function props(el) {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      id: el.id || "",
      cls: (typeof el.className === "string" ? el.className : "").slice(0, 60),
      transform: cs.transform,
      transformOrigin: cs.transformOrigin,
      scale: cs.scale,
      zoom: cs.zoom,
      translate: cs.translate,
      rotate: cs.rotate,
      filter: cs.filter,
      perspective: cs.perspective,
      willChange: cs.willChange,
      inlineTransform: el.style.transform,
      inlineZoom: el.style.zoom,
      inlineScale: el.style.scale
    };
  }
  // Detect effective cumulative scale vs root
  const rr = root.getBoundingClientRect();
  const rootScale = parseFloat((/matrix\(([^,]+)/.exec(getComputedStyle(root).transform) || [])[1] || "1");
  function eff(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const sx = el.offsetWidth ? r.width / el.offsetWidth : null;
    const sy = el.offsetHeight ? r.height / el.offsetHeight : null;
    return {
      cls: (typeof el.className === "string" ? el.className : "").slice(0, 40),
      offset: [el.offsetWidth, el.offsetHeight],
      rect: [+r.width.toFixed(2), +r.height.toFixed(2)],
      effectiveScaleX: sx ? +sx.toFixed(5) : null,
      effectiveScaleY: sy ? +sy.toFixed(5) : null,
      rootScale: +rootScale.toFixed(5),
      extraScaleX: sx ? +(sx / rootScale).toFixed(5) : null,
      extraScaleY: sy ? +(sy / rootScale).toFixed(5) : null
    };
  }
  return {
    rootScale: +rootScale.toFixed(6),
    props: els.map(props),
    effective: {
      root: eff(root),
      layout: eff(layout),
      scene: eff(scene),
      board: eff(board),
      sidebar: eff(sidebar),
      hud: eff(document.querySelector(".status-bar")),
      remove: eff(document.getElementById("remove-button"))
    }
  };
})()
