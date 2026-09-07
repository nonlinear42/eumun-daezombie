(async () => {
  // wait for layout bootstrap
  for (let i = 0; i < 60; i++) {
    if (window.GAME_FIT && document.querySelector(".battle-sidebar-left") && document.querySelector(".game-board-viewport")) break;
    await new Promise(r => setTimeout(r, 100));
  }
  // force fit at current window
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + String(el.className).trim().split(/\s+/).slice(0,3).join(".") : ""),
      parentId: el.parentElement && el.parentElement.id,
      parentClass: el.parentElement && el.parentElement.className,
      position: cs.position,
      transform: cs.transform,
      transformOrigin: cs.transformOrigin,
      overflow: cs.overflow + "/" + cs.overflowX + "/" + cs.overflowY,
      offsetWidth: el.offsetWidth,
      offsetHeight: el.offsetHeight,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }
    };
  }

  const root = document.getElementById("game-scale-root");
  const shell = document.getElementById("game-viewport-shell");
  const sidebar = document.querySelector(".battle-sidebar-left");
  const board = document.querySelector(".game-board-viewport");
  const remove = document.getElementById("remove-button") || document.querySelector(".sidebar-remove-wrap");
  const hud = document.querySelector(".status-bar");
  const laneOverlay = document.querySelector(".playfield-lane-overlay");

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const s = (window.GAME_FIT && GAME_FIT.scale) || 1;
  const BASE_W = 1672, BASE_H = 941;

  function overflowPx(rect) {
    if (!rect) return null;
    return {
      left: Math.min(0, rect.x),
      top: Math.min(0, rect.y),
      right: Math.max(0, rect.right - vw),
      bottom: Math.max(0, rect.bottom - vh)
    };
  }

  // design-space bottoms
  const boardTopDesign = 460;
  const boardBottomDesign = 460 + 450;
  const sidebarTopDesign = 96;
  const sidebarHDesign = 941 - 96 - 78;
  const sidebarBottomDesign = sidebarTopDesign + sidebarHDesign;

  const report = {
    viewport: { w: vw, h: vh, innerW: window.innerWidth, innerH: window.innerHeight },
    GAME_FIT: window.GAME_FIT ? { ...GAME_FIT } : null,
    expected: {
      scale: Math.min(vw / BASE_W, vh / BASE_H),
      scaledW: BASE_W * Math.min(vw / BASE_W, vh / BASE_H),
      scaledH: BASE_H * Math.min(vw / BASE_W, vh / BASE_H)
    },
    designAnchors: {
      boardTopDesign, boardBottomDesign, sidebarBottomDesign,
      rootHeight: BASE_H,
      boardOverflowPastRoot: boardBottomDesign - BASE_H,
      sidebarOverflowPastRoot: sidebarBottomDesign - BASE_H
    },
    shell: box(shell),
    root: box(root),
    sidebar: box(sidebar),
    board: box(board),
    remove: box(remove),
    removeWrap: box(document.querySelector(".sidebar-remove-wrap")),
    hud: box(hud),
    laneOverlay: box(laneOverlay),
    overflows: {
      root: overflowPx(box(root)?.rect),
      sidebar: overflowPx(box(sidebar)?.rect),
      board: overflowPx(box(board)?.rect),
      remove: overflowPx(box(remove)?.rect),
      hud: overflowPx(box(hud)?.rect)
    },
    ancestry: {
      removeInsideRoot: !!(remove && root && root.contains(remove)),
      sidebarInsideRoot: !!(sidebar && root && root.contains(sidebar)),
      boardInsideRoot: !!(board && root && root.contains(board)),
      hudInsideRoot: !!(hud && root && root.contains(hud))
    },
    fixedOutside: [...document.querySelectorAll("*")].filter(el => {
      const p = getComputedStyle(el).position;
      return p === "fixed" && root && !root.contains(el) && el.id !== "game-viewport-shell";
    }).slice(0, 30).map(el => ({ id: el.id, className: String(el.className).slice(0,80), display: getComputedStyle(el).display }))
  };

  document.documentElement.setAttribute("data-layout-report", JSON.stringify(report));
  console.log("LAYOUT_REPORT_START");
  console.log(JSON.stringify(report, null, 2));
  console.log("LAYOUT_REPORT_END");
})();
