console.log("Add-venture app.js loaded");

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

function $(id) {
  return document.getElementById(id);
}

const elBoard = $("board");
const elTarget = $("targetVal");
const elCurrent = $("currentVal");
const elUsed = $("usedVal");
const elMsg = $("msg");

let size = 5;
let target = 18;
let grid = FALLBACK.grid;

function setMsg(text) {
  if (elMsg) elMsg.textContent = text;
}

function parseCSV(text) {
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
    console.warn("Falling back to built-in puzzle:", e);
    return FALLBACK;
  }
}

function render() {
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
      elBoard.appendChild(btn);
    }
  }

  if (elTarget) elTarget.textContent = String(target);
  if (elCurrent) elCurrent.textContent = "0";
  if (elUsed) elUsed.textContent = `0/${size * size}`;

  setMsg("Board rendered.");
}

async function init() {
  const puzzle = await loadPuzzle();
  size = puzzle.size;
  target = puzzle.target;
  grid = puzzle.grid;
  render();
}

init();
