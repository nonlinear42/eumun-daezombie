(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const overlay = document.getElementById("start-overlay");
  if (overlay) {
    overlay.style.display = "none";
    overlay.classList.add("hidden");
  }
  // Click first start button without unicode regex
  const btns = Array.from(document.querySelectorAll(".start-buttons button, #start-overlay button, button"));
  for (const el of btns) {
    const id = (el.id || "") + " " + (el.className || "");
    if (/start|play|begin/i.test(id) || /start|play/i.test(el.textContent || "")) {
      try { el.click(); } catch (e) {}
      break;
    }
  }
  await sleep(400);
  if (typeof setupBattleSideLayout === "function") {
    try { setupBattleSideLayout(); } catch (e) {}
  }
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  await sleep(200);
  return {
    sidebar: !!document.querySelector(".battle-sidebar-left"),
    board: !!document.querySelector(".game-board-viewport"),
    remove: !!document.getElementById("remove-button"),
    scaleRoot: !!document.getElementById("game-scale-root"),
    GAME_FIT: window.GAME_FIT ? { scale: GAME_FIT.scale, baseWidth: GAME_FIT.baseWidth, baseHeight: GAME_FIT.baseHeight } : null
  };
})()
