// Add-venture demo
// Loads target + 5x5 grid from your published Google Sheet CSV

const LIVE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRJgZUsgdm07UIdbSnoF2jIPNE-PdU656gIS641l5pufVDBa7Suj3eMOt-FWVgBdlBEcAalmJXNjsCg/pub?output=csv";

const FALLBACK = {
  size: 5,
  target: 18,
  grid: [
    [9, 3, 4, 1, 6],
    [7, 2, 3, 8, 2],
    [9, 1, 3, 4, 3],
    [1, 6, 9, 9, 4],
    [9, 1, 8, 8, 6],
  ],
};

const elBoard = document.getElementById("board");
const elTarget = document.getElementById("targetVal");
const elCurrent = document.getElementById("currentVal");
const elUsed = document.getElementById("usedVal");
const elPaths = document.getElementById("pathsVal");
const elMsg = document.getElementById("msg");
const elPerfect = document.getElementById("perfect");

const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const submitBtn = document.getElementById("submitBtn");
const reloadBtn = document.getElementById("reloadBtn");

let size = 5;
let target = 18;
let grid = FALLBACK.grid;

// Game state
const used = new Set(); // permanent used cells across accepted paths: "r,c"
let current = []; // current path cells: [{r,c,val}]
let pathsFound = 0;

function key(r, c) {
  return `${r},${c}`;
}

function parseCSV(text) {
  // Expected sheet layout:
  // Row 1: target,18
  // Row 2: board
  // Rows 3-7: 5 numbers across
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(",").map((x) => x.trim()));

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
    return FALLBACK;
  }
}

function isAdjacent(a, b) {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return dr <= 1 && dc <= 1 && (dr + dc) > 0;
}

function currentSum() {
  return current.reduce((s, x) => s + x.val, 0);
}

function setMsg(text, kind = "") {
  elMsg.textContent = text;
  elMsg.className = "msg " + kind;
}

function updateStats() {
  elTarget.textContent = String(target);
  elCurrent.textContent = String(currentSum());
  elUsed.textContent = `${used.size}/${size * size}`;
  elPaths.textContent = String(pathsFound);

  if (used.size === size * size) {
    elPerfect.textContent = "Perfect score. Board completed.";
    elPerfect.className = "perfect show";
  } else {
    elPerfect.textContent = "";
    elPerfect.className = "perfect";
  }
}

function render() {
  elBoard.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  elBoard.innerHTML = "";

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.textContent = String(grid[r][c]);

      const k = key(r, c);
      if (used.has(k)) btn.classList.add("used");

      const idx = current.findIndex((x) => x.r === r && x.c === c);
      if (idx >= 0) {
        btn.classList.add("selected");
        btn.setAttribute("data-order", String(idx + 1));
      }

      btn.addEventListener("click", () => onCellClick(r, c));
      elBoard.appendChild(btn);
    }
  }

  updateStats();
}

function onCellClick(r, c) {
  const k = key(r, c);

  if (used.has(k)) {
    setMsg("That digit is already used.", "bad");
    return;
  }
  if (current.some((x) => x.r === r && x.c === c)) {
    setMsg("You already used that digit in this path.", "bad");
    return;
  }

  const val = grid[r][c];

  if (current.length > 0) {
    const last = current[current.length - 1];
    if (!isAdjacent(last, { r, c })) {
      setMsg("Invalid move. Next digit must touch the last one.", "bad");
      return;
    }
  }

  current.push({ r, c, val });
  setMsg("Building path...", "");
  render();
}

function undo() {
  if (current.length === 0) return;
  current.pop();
  setMsg("Undid last step.", "");
  render();
}

function clear() {
  current = [];
  setMsg("Cleared current path.", "");
  render();
}

function submit() {
  if (current.length < 2) {
    setMsg("Path must be at least 2 digits.", "bad");
    return;
  }

  const sum = currentSum();
  if (sum !== target) {
    setMsg(`Not quite. Your path sums to ${sum}.`, "bad");
    return;
  }

  // Accept path: permanently mark these cells used
  for (const x of current) used.add(key(x.r, x.c));
  pathsFound += 1;
  current = [];

  setMsg("Nice. Path accepted.", "good");
  render();
}

async function init() {
  const puzzle = await loadPuzzle();
  size = puzzle.size;
  target = puzzle.target;
  grid = puzzle.grid;

  // reset state
  used.clear();
  current = [];
  pathsFound = 0;

  setMsg("Loaded puzzle.", "");
  render();
}

undoBtn.addEventListener("click", undo);
clearBtn.addEventListener("click", clear);
submitBtn.addEventListener("click", submit);
reloadBtn.addEventListener("click", init);

init();
