console.log("Add-venture app.js loaded");

const LIVE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRJgZUsgdm07UIdbSnoF2jIPNE-PdU656gIS641l5pufVDBa7Suj3eMOt-FWVgBdlBEcAalmJXNjsCg/pub?output=csv";

const FALLBACK = {
  target: 18,
  grid: [
    [9, 3, 4, 1, 6],
    [7, 2, 3, 8, 2],
    [9, 1, 3, 4, 3],
    [1, 6, 9, 9, 4],
    [9, 1, 8, 8, 6],
  ],
};

function $(id) {
  return document.getElementById(id);
}

const elBoard = $("board");
const elTarget = $("targetVal");
const elCurrent = $("currentVal");
const elUsed = $("usedVal");
const elPaths = $("pathsVal");
const elMsg = $("msg");

const btnUndo = $("undoBtn");
const btnClear = $("clearBtn");
const btnSubmit = $("submitBtn");
const btnReload = $("reloadBtn");

let size = 5;
let target = 18;
let grid = FALLBACK.grid;

// State
let currentPath = []; // array of {r,c}
let currentSum = 0;

let used = new Set(); // key "r,c"
let paths = []; // each path = { cells:[{r,c}], sum, colorIndex }
const endOverlay = document.getElementById("endOverlay");
const endTitle = document.getElementById("endTitle");
const endBody = document.getElementById("endBody");
const showSolutionBtn = document.getElementById("showSolutionBtn");
const playAgainBtn = document.getElementById("playAgainBtn");

function openEndModal(title, bodyHtml) {
  endTitle.textContent = title;
  endBody.innerHTML = bodyHtml;
  endOverlay.classList.remove("hidden");
}

function closeEndModal() {
  endOverlay.classList.add("hidden");
}

playAgainBtn?.addEventListener("click", () => {
  closeEndModal();
  loadToday();
});

endOverlay?.addEventListener("click", (e) => {
  if (e.target === endOverlay) closeEndModal();
});

// Placeholder. We can implement solution highlighting next.
showSolutionBtn?.addEventListener("click", () => {
  alert("Solution view coming next.");
});
const PATH_COLORS = [
  "path0",
  "path1",
  "path2",
  "path3",
  "path4",
  "path5",
  "path6",
  "path7",
  "path8",
  "path9",
];

function keyOf(r, c) {
  return `${r},${c}`;
}

function setMsg(text) {
  if (elMsg) elMsg.textContent = text || "";
}

function isAdjacent(a, b) {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

function parseCSV(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(",").map((x) => x.trim()));

  // Expect:
  // row 1: target,<number>
  // row 2: board
  // rows 3-7: 5 numbers each
  const t = Number(lines?.[0]?.[1]);
  const boardRows = lines.slice(2, 7).map((row) => row.slice(0, 5).map(Number));

  const okTarget = Number.isFinite(t);
  const okGrid =
    boardRows.length === 5 &&
    boardRows.every((r) => r.length === 5 && r.every((n) => Number.isFinite(n)));

  if (!okTarget || !okGrid) return null;

  return { size: 5, target: t, grid: boardRows };
}

async function loadPuzzle() {
  try {
    const res = await fetch(LIVE_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV fetch failed");
    const text = await res.text();
    const parsed = parseCSV(text);
    if (!parsed) throw new Error("CSV parse failed");
    return parsed;
  } catch (e) {
    console.warn("Falling back to built-in puzzle:", e);
    return FALLBACK;
  }
}

function resetRunState() {
  currentPath = [];
  currentSum = 0;
  used = new Set();
  paths = [];
  setMsg("");
  updateStats();
}

function updateStats() {
  if (elTarget) elTarget.textContent = String(target);
  if (elCurrent) elCurrent.textContent = String(currentSum);
  if (elUsed) elUsed.textContent = `${used.size}/${size * size}`;
  if (elPaths) elPaths.textContent = String(paths.length);
}

function clearCurrentSelectionUI() {
  const selected = elBoard.querySelectorAll(".cell.selected");
  selected.forEach((el) => el.classList.remove("selected"));
}

function applyUsedUI() {
  // Re-apply classes based on paths list
  const all = elBoard.querySelectorAll(".cell");
  all.forEach((el) => {
    el.classList.remove(
      "used",
      ...PATH_COLORS
    );
  });

  for (const p of paths) {
    const cls = PATH_COLORS[p.colorIndex % PATH_COLORS.length];
    for (const cell of p.cells) {
      const btn = cellEl(cell.r, cell.c);
      if (!btn) continue;
      btn.classList.add("used", cls);
    }
  }
}

function cellEl(r, c) {
  return elBoard.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function renderBoard() {
  if (!elBoard) {
    alert('Could not find an element with id="board" in index.html');
    return;
  }

  elBoard.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  elBoard.innerHTML = "";

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.textContent = String(grid[r][c]);
      btn.dataset.r = String(r);
      btn.dataset.c = String(c);

      btn.addEventListener("click", () => onCellClick(r, c));
      elBoard.appendChild(btn);
    }
  }

  resetRunState();
}

function onCellClick(r, c) {
  const k = keyOf(r, c);

  // Already locked into a submitted path
  if (used.has(k)) {
    setMsg("That digit is already used.");
    return;
  }

  // If clicking the last tile again, pop it off
  if (currentPath.length > 0) {
    const last = currentPath[currentPath.length - 1];
    if (last.r === r && last.c === c) {
      popCurrent();
      return;
    }
  }

  // If first selection, always ok
  if (currentPath.length === 0) {
    pushCurrent(r, c);
    return;
  }

  // Must be adjacent to the last (including diagonal)
  const last = currentPath[currentPath.length - 1];
  if (!isAdjacent(last, { r, c })) {
    setMsg("Must touch the last digit (diagonals allowed).");
    return;
  }

  // Cannot reuse within the current path
  if (currentPath.some((p) => p.r === r && p.c === c)) {
    setMsg("A digit cannot be used twice in one path.");
    return;
  }

  pushCurrent(r, c);
}

function pushCurrent(r, c) {
  currentPath.push({ r, c });
  currentSum += grid[r][c];

  const btn = cellEl(r, c);
  if (btn) btn.classList.add("selected");

  updateStats();
  setMsg("");
}

function popCurrent() {
  if (currentPath.length === 0) return;
  const last = currentPath.pop();
  currentSum -= grid[last.r][last.c];

  const btn = cellEl(last.r, last.c);
  if (btn) btn.classList.remove("selected");

  updateStats();
  setMsg("");
}

function submitPath() {
  if (currentPath.length === 0) {
    setMsg("Select digits first.");
    return;
  }

  if (currentSum !== target) {
    setMsg(`That path sums to ${currentSum}. Need ${target}.`);
    return;
  }

  // Lock in the path
  const colorIndex = paths.length;
  paths.push({ cells: [...currentPath], sum: currentSum, colorIndex });

  for (const cell of currentPath) {
    used.add(keyOf(cell.r, cell.c));
  }

  // Clear selection, apply coloring
  currentPath = [];
  currentSum = 0;

  clearCurrentSelectionUI();
  applyUsedUI();
  updateStats();


// PERFECT SCORE
if (used.size === size * size) {
  openEndModal(
    "Congratulations",
    `<div><b>Perfect score.</b> You used every digit.</div>
     <div style="margin-top:8px;">Paths: <b>${paths.length}</b></div>`
  );
  return;
}

// OUT OF MOVES (but not perfect)
if (used.size < size * size && !hasAnyMoveLeft()) {
  const remaining = size * size - used.size;
  openEndModal(
    "Your adventure ends here",
    `<div><b>No more moves.</b></div>
     <div style="margin-top:8px;">Paths: <b>${paths.length}</b></div>
     <div>Tiles remaining: <b>${remaining}</b></div>`
  );
  return;
}

// NORMAL CONTINUE STATE
setMsg("Nice. Path locked.");

}
function clearSelection() {
  currentPath = [];
  currentSum = 0;
  clearCurrentSelectionUI();
  updateStats();
  setMsg("");
}

function undo() {
  popCurrent();
}

async function reload() {
  const puzzle = await loadPuzzle();
  size = puzzle.size;
  target = puzzle.target;
  grid = puzzle.grid;
  renderBoard();
}

function wireButtons() {
  if (btnUndo) btnUndo.addEventListener("click", undo);
  if (btnClear) btnClear.addEventListener("click", clearSelection);
  if (btnSubmit) btnSubmit.addEventListener("click", submitPath);
  if (btnReload) btnReload.addEventListener("click", reload);
}

(async function init() {
  wireButtons();
  await reload();
})();
