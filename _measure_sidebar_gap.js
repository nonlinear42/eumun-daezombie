(async () => {
  for (let i = 0; i < 80; i++) {
    if (typeof setupBattleSideLayout === "function" && document.getElementById("game-scale-root")) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const overlay = document.getElementById("start-overlay");
  if (overlay) {
    overlay.style.display = "none";
    overlay.classList.add("hidden");
  }
  try { setupBattleSideLayout(); } catch (e) {}
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const sidebar = document.querySelector(".battle-sidebar-left.sidebar-accordion");
  if (sidebar && typeof openSidebarAccordion === "function") {
    openSidebarAccordion("consonant");
  }
  await new Promise((r) => setTimeout(r, 150));
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const panel = document.querySelector(".plant-accordion.is-open");
  const grid = panel && panel.querySelector(".plant-accordion-body");
  const cards = grid ? Array.from(grid.querySelectorAll(".plant-button:not(.hidden-plant)")) : [];
  const leftCard = cards[0] || null;
  const rightCard = cards[1] || null;

  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      id: el.id || null,
      className: (typeof el.className === "string" ? el.className : "").slice(0, 120),
      rect: {
        x: +r.x.toFixed(2),
        y: +r.y.toFixed(2),
        w: +r.width.toFixed(2),
        h: +r.height.toFixed(2),
        left: +r.left.toFixed(2),
        right: +r.right.toFixed(2),
        top: +r.top.toFixed(2),
        bottom: +r.bottom.toFixed(2)
      },
      offsetW: el.offsetWidth,
      offsetH: el.offsetHeight,
      clientW: el.clientWidth,
      clientH: el.clientHeight,
      scrollW: el.scrollWidth,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      marginLeft: cs.marginLeft,
      marginRight: cs.marginRight,
      borderLeft: cs.borderLeftWidth,
      borderRight: cs.borderRightWidth,
      width: cs.width,
      maxWidth: cs.maxWidth,
      boxSizing: cs.boxSizing,
      display: cs.display,
      gridTemplateColumns: cs.gridTemplateColumns,
      columnGap: cs.columnGap,
      gap: cs.gap,
      transform: cs.transform,
      left: cs.left,
      right: cs.right,
      position: cs.position,
      overflow: cs.overflow + "/" + cs.overflowX
    };
  }

  const p = box(panel);
  const g = box(grid);
  const L = box(leftCard);
  const R = box(rightCard);
  const scale = (() => {
    const root = document.getElementById("game-scale-root");
    const tr = root ? getComputedStyle(root).transform : "none";
    const m = /matrix\(([^,]+)/.exec(tr || "");
    return m ? parseFloat(m[1]) : 1;
  })();

  const rightOuterScreen = p && R ? +(p.rect.right - R.rect.right).toFixed(2) : null;
  const leftOuterScreen = p && L ? +(L.rect.left - p.rect.left).toFixed(2) : null;
  const colGapScreen = L && R ? +(R.rect.left - L.rect.right).toFixed(2) : null;

  // design-space (unscaled) approx
  const toDesign = (v) => (v == null ? null : +(v / scale).toFixed(2));

  const panelContentRight = p
    ? p.rect.right - parseFloat(p.paddingRight || "0") - parseFloat(p.borderRight || "0")
    : null;
  // panel itself may have padding 0; grid has the padding
  const gridContentLeft = g
    ? g.rect.left + parseFloat(g.paddingLeft || "0")
    : null;
  const gridContentRight = g
    ? g.rect.right - parseFloat(g.paddingRight || "0")
    : null;

  const rightGapToGridPaddingEdge = g && R
    ? +(gridContentRight - R.rect.right).toFixed(2)
    : null;
  const leftGapToGridPaddingEdge = g && L
    ? +(L.rect.left - gridContentLeft).toFixed(2)
    : null;

  const usableInnerW = g
    ? +(g.clientW - parseFloat(g.paddingLeft || "0") - parseFloat(g.paddingRight || "0")).toFixed(2)
    : null;
  const twoCardsPlusGap = L && R && g
    ? +(L.offsetW + R.offsetW + parseFloat(g.columnGap || "0")).toFixed(2)
    : null;

  return {
    viewport: {
      w: document.documentElement.clientWidth,
      h: document.documentElement.clientHeight
    },
    scale: +scale.toFixed(6),
    cardCount: cards.length,
    panel: p,
    grid: g,
    leftCard: L,
    rightCard: R,
    gapsScreen: {
      leftOuter_panelToLeftCard: leftOuterScreen,
      rightOuter_panelToRightCard: rightOuterScreen,
      columnGap_betweenCards: colGapScreen,
      leftOuter_gridContentToLeftCard: leftGapToGridPaddingEdge,
      rightOuter_gridContentToRightCard: rightGapToGridPaddingEdge
    },
    gapsDesign: {
      leftOuter_panelToLeftCard: toDesign(leftOuterScreen),
      rightOuter_panelToRightCard: toDesign(rightOuterScreen),
      columnGap_betweenCards: toDesign(colGapScreen),
      leftOuter_gridContentToLeftCard: toDesign(leftGapToGridPaddingEdge),
      rightOuter_gridContentToRightCard: toDesign(rightGapToGridPaddingEdge)
    },
    analysis: {
      gridOffsetW: g && g.offsetW,
      gridClientW: g && g.clientW,
      gridScrollW: g && g.scrollW,
      usableInnerW_offsetSpace: usableInnerW,
      cardOffsetW: L && L.offsetW,
      twoCardsPlusGap_offsetSpace: twoCardsPlusGap,
      overflowBy: usableInnerW != null && twoCardsPlusGap != null
        ? +(twoCardsPlusGap - usableInnerW).toFixed(2)
        : null,
      gridWiderThanPanel: p && g ? +(g.rect.w - p.rect.w).toFixed(2) : null,
      gridHasNegMargin: g ? (parseFloat(g.marginLeft) < 0 || parseFloat(g.marginRight) < 0) : null,
      cardHasTransform: !!(L && L.transform && L.transform !== "none") || !!(R && R.transform && R.transform !== "none"),
      gridBoxSizing: g && g.boxSizing,
      panelBoxSizing: p && p.boxSizing
    }
  };
})()
