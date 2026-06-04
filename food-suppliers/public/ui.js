export function escapeHtml(str) {
  if (str == null) return "";
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}

export function openPanel(panelEl) {
  const overlay = document.getElementById("overlay");
  if (!overlay || !panelEl) return;

  overlay.querySelectorAll(".panel").forEach((p) => {
    p.hidden = true;
  });

  panelEl.hidden = false;
  overlay.hidden = false;
  overlay.removeAttribute("data-panel");
  document.body.classList.add("modal-open");

  panelEl.classList.remove("panel--enter");
  void panelEl.offsetWidth;
  panelEl.classList.add("panel--enter");
}

export function closeAllPanels() {
  const overlay = document.getElementById("overlay");
  if (!overlay) return;

  overlay.hidden = true;
  overlay.querySelectorAll(".panel").forEach((p) => {
    p.hidden = true;
  });
  document.body.classList.remove("modal-open");
}
