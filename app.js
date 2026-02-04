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
  solutions: null,
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

// End overlay
const endOverlay = document.getElementById("endOverlay");
const endTitle = document.getElementById("endTitle");
const endSummary = document.getElementById("endSummary");
const closeOverlayBtn = document.getElementById("closeOverlayBtn");
const showSolutionBtn = document.getElementById("showSolutionBtn");
const solutionWrap = document.getElementById("solutionWrap");
const solutionBoard = document.getElementById("solutionBoard");
const solutionNote = document.getElementById("solutionNote");

// Palette for completed paths
const PATH_COLORS = [
  "#44d07b",
  "#ffd24a",
  "#6aa6ff",
  "#ff7aa2",
  "#a78bfa",
  "#ff9f4a",
  "#2dd4bf",
  "#f472b6",
  "#86efac",
  "#fca5a5",
];

let size = 5;
let target = 18;
let grid = FALLBACK.grid;

// Game state
const used = new Set(); // permanently used cells across accepted paths: "r,c"
let current = []; // current path: [{r,c,val}]
let pathsFound = 0;

// For coloring: cellKey -> colorIndex
const cellColor = new Map();

// Optional: solution paths as arrays of {r,c}
let solutions = null;

function key(r, c) {
  return `${r},${c}`;
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

  // Optional solution rows after the grid
  // Expected: solution1,<coords> where coords is "r,c r,c r,c"
  const sol = [];
  for (let i = 7; i < lines.length; i++) {
    const label = lines[i][0] || "";
    const payload = lines[i][1] || "";
    if (!label.toLowerCase().startsWith("solution")) continue;
    if (!payload) continue;

    const coords = payload
      .split(" ")
      .map((tok) => tok.trim())
      .filter(Boolean)
      .map((tok) => tok.split(",").map((n) => Number(n)));

    const path = [];
    for (const pair of coords) {
      if (pair.length !== 2) continue;
      const r = pair[0];
      const c = pair[1];
      if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
      if (r < 0 || r >= 5 || c < 0 || c >= 5) continue;
      path.push({ r, c });
    }
    if (path.length >= 2) sol.push(path);
  }

  return { size: 5, target: t, grid: boardRows, solutions: sol.length ? sol : null };
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

      // Completed / used coloring
      if (used.has(k)) {
        btn.classList.add("done");
        const ci = cellColor.get(k);
        if (ci !== undefined) {
          btn.style.background = PATH_COLORS[ci % PATH_COLORS.length];
          btn.style.color = "#0b1020";
          btn.style.fontWeight = "900";
        }
      }

      // Current selection overlay
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

  // If tapping the last selected tile, unselect it (tap-to-undo)
  if (current.length > 0) {
    const last = current[current.length - 1];
    if (last.r === r && last.c === c) {
      current.pop();
      setMsg("Undid last step.", "");
      render();
      return;
    }
  }

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

  // Accept path: permanently mark cells used and color them
  const colorIndex = pathsFound;
  for (const x of current) {
    const k = key(x.r, x.c);
    used.add(k);
    cellColor.set(k, colorIndex);
  }

  pathsFound += 1;
  current = [];

  setMsg("Nice. Path accepted.", "good");
  render();

  // Endgame check after every accepted path
  if (!hasAnyMoveLeft()) {
    showEndgame();
  }
}

function neighbors(r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      out.push({ r: rr, c: cc });
    }
  }
  return out;
}

// Returns true if any valid path exists using remaining tiles that sums to target.
// Uses DFS with pruning since digits are positive.
function hasAnyMoveLeft() {
  const remaining = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const k = key(r, c);
      if (!used.has(k)) remaining.push({ r, c });
    }
  }

  // If fewer than 2 tiles remain, no move
  if (remaining.length < 2) return false;

  const seen = new Set();

  function dfs(r, c, sum, depth, localUsed) {
    if (sum === target && depth >= 2) return true;
    if (sum > target) return false;

    // Memo key: position + sum + localUsed size (lightweight)
    const memoKey = `${r},${c}|${sum}|${localUsed.size}`;
    if (seen.has(memoKey)) return false;
    seen.add(memoKey);

    for (const nb of neighbors(r, c)) {
      const kk = key(nb.r, nb.c);
      if (used.has(kk)) continue;
      if (localUsed.has(kk)) continue;

      localUsed.add(kk);
      const ok = dfs(nb.r, nb.c, sum + grid[nb.r][nb.c], depth + 1, localUsed);
      localUsed.delete(kk);
      if (ok) return true;
    }
    return false;
  }

  for (const start of remaining) {
    const startKey = key(start.r, start.c);
    const localUsed = new Set([startKey]);
    const ok = dfs(start.r, start.c, grid[start.r][start.c], 1, localUsed);
    if (ok) return true;
  }

  return false;
}

function showEndgame() {
  const remaining = size * size - used.size;

  const perfect = remaining === 0;
  endTitle.textContent = perfect ? "Perfect solve" : "No more moves";

  endSummary.textContent =
    `Paths completed: ${pathsFound}. ` +
    `Tiles remaining: ${remaining}.`;

  // Solution button only meaningful if we have solution data
  solutionWrap.classList.add("hidden");
  if (solutions && solutions.length) {
    showSolutionBtn.disabled = false;
    solutionNote.textContent = "";
  } else {
    showSolutionBtn.disabled = false; // still allow, but we show a friendly message
    solutionNote.textContent = "Solution not provided for this puzzle yet.";
  }

  endOverlay.classList.remove("hidden");
}

function hideOverlay() {
  endOverlay.classList.add("hidden");
}

function renderSolutionBoard() {
  solutionBoard.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  solutionBoard.innerHTML = "";

  // Start with plain grid
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const div = document.createElement("div");
      div.className = "cell";
      div.textContent = String(grid[r][c]);
      solutionBoard.appendChild(div);
    }
  }

  if (!solutions || !solutions.length) {
    return;
  }

  // Color solution paths
  const cells = solutionBoard.querySelectorAll(".cell");
  solutions.forEach((path, idx) => {
    path.forEach((pt) => {
      const i = pt.r * size + pt.c;
      const cell = cells[i];
      cell.style.background = PATH_COLORS[idx % PATH_COLORS.length];
      cell.style.color = "#0b1020";
      cell.style.fontWeight = "900";
    });
  });
}

function showSolution() {
  solutionWrap.classList.remove("hidden");
  renderSolutionBoard();
}

async function init() {
  const puzzle = await loadPuzzle();
  size = puzzle.size;
  target = puzzle.target;
  grid = puzzle.grid;
  solutions = puzzle.solutions || null;

  used.clear();
  current = [];
  pathsFound = 0;
  cellColor.clear();

  hideOverlay();
  setMsg("Loaded puzzle.", "");
  render();
}

undoBtn.addEventListener("click", undo);
clearBtn.addEventListener("click", clear);
submitBtn.addEventListener("click", submit);
reloadBtn.addEventListener("click", init);

closeOverlayBtn.addEventListener("click", hideOverlay);
showSolutionBtn.addEventListener("click", showSolution);

init();
