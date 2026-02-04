const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRJgZUsgdm07UIdbSnoF2jIPNE-PdU656gIS641l5pufVDBa7Suj3eMOt-FWVgBdlBEcAalmJXNjsCg/pub?output=csv";

let board = [];
let target = 0;
let path = [];
let visited = new Set();

const boardEl = document.getElementById("board");
const msgEl = document.getElementById("msg");
const perfectEl = document.getElementById("perfect");

fetch(CSV_URL)
  .then(res => res.text())
  .then(text => {
    const rows = text.trim().split("\n").map(r => r.split(","));
    target = Number(rows[0][1]);
    board = rows.slice(2).map(r => r.map(Number));
    render();
  });

function render() {
  boardEl.innerHTML = "";
  visited.clear();
  path = [];
  msgEl.textContent = "";
  perfectEl.textContent = "";

  board.forEach((row, r) => {
    row.forEach((num, c) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = num;
      cell.onclick = () => select(r, c, cell);
      boardEl.appendChild(cell);
    });
  });
}

function select(r, c, cell) {
  const key = `${r},${c}`;
  if (visited.has(key)) return;

  visited.add(key);
  path.push(board[r][c]);
  cell.classList.add("active");

  const sum = path.reduce((a, b) => a + b, 0);

  if (sum === target) {
    msgEl.textContent = "🎉 You hit the target!";
    perfectEl.textContent = "Perfect path found";
  } else if (sum > target) {
    msgEl.textContent = "❌ Too high. Try again.";
  }
}

document.getElementById("clearBtn").onclick = render;
document.getElementById("reloadBtn").onclick = () => location.reload();
