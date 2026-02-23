const openings = [
  {
    id: "ruy_lopez",
    name: "Ruy Lopez (Spanish)",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"],
  },
  {
    id: "queens_gambit_declined",
    name: "Queen's Gambit Declined",
    moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O"],
  },
  {
    id: "sicilian_najdorf",
    name: "Sicilian Najdorf",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
  },
  {
    id: "french_classical",
    name: "French Defense (Classical)",
    moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "Bg5", "Be7", "e5", "Nfd7"],
  },
];

const openingSelect = document.getElementById("openingSelect");
const colorSelect = document.getElementById("colorSelect");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const feedbackEl = document.getElementById("feedback");
const lineView = document.getElementById("lineView");
const crossOverlay = document.getElementById("crossOverlay");
const evalBarFill = document.getElementById("evalFill");
const evalText = document.getElementById("evalText");

let game = new Chess();
let board;
let activeOpening = openings[0];
let userColor = "w";
let currentPly = 0;
let trainingActive = false;
let stockfishWorker;
let stockfishReady = false;

function fillOpeningChoices() {
  openings.forEach((opening) => {
    const option = document.createElement("option");
    option.value = opening.id;
    option.textContent = opening.name;
    openingSelect.appendChild(option);
  });
}

function setStatus(message) {
  statusEl.textContent = message;
}

function showFeedback(message, ok = false) {
  feedbackEl.textContent = message;
  feedbackEl.classList.toggle("ok", ok);
}

function renderLine() {
  const rendered = activeOpening.moves
    .map((move, index) => `${Math.floor(index / 2) + 1}${index % 2 === 0 ? "." : "..."} ${move}`)
    .join(" ");
  lineView.textContent = `Line: ${rendered}`;
}

function flashCross() {
  crossOverlay.classList.add("visible");
  setTimeout(() => crossOverlay.classList.remove("visible"), 600);
}

function setEvalDisplayFromPawns(scoreInPawns, descriptor = "") {
  const clamped = Math.max(-6, Math.min(6, scoreInPawns));
  const whiteShare = ((clamped + 6) / 12) * 100;
  evalBarFill.style.height = `${whiteShare}%`;

  const formatted = scoreInPawns >= 0 ? `+${scoreInPawns.toFixed(2)}` : scoreInPawns.toFixed(2);
  evalText.textContent = descriptor ? `Engine eval: ${descriptor}` : `Engine eval: ${formatted}`;
}

function setEvalDisplayMate(matePly) {
  const isWhiteWinning = matePly > 0;
  setEvalDisplayFromPawns(isWhiteWinning ? 6 : -6, `M${Math.abs(matePly)}`);
}

function startEngine() {
  try {
    stockfishWorker = new Worker("https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js");
  } catch (error) {
    evalText.textContent = "Engine eval unavailable (worker failed to load).";
    return;
  }

  stockfishWorker.onmessage = (event) => {
    const line = String(event.data || "");

    if (line === "uciok") {
      stockfishWorker.postMessage("isready");
      return;
    }

    if (line === "readyok") {
      stockfishReady = true;
      requestEvaluation();
      return;
    }

    if (!line.startsWith("info ")) return;

    const mateMatch = line.match(/score mate (-?\d+)/);
    if (mateMatch) {
      setEvalDisplayMate(Number(mateMatch[1]));
      return;
    }

    const cpMatch = line.match(/score cp (-?\d+)/);
    if (cpMatch) {
      setEvalDisplayFromPawns(Number(cpMatch[1]) / 100);
    }
  };

  stockfishWorker.onerror = () => {
    evalText.textContent = "Engine eval unavailable (runtime error).";
  };

  stockfishWorker.postMessage("uci");
}

function requestEvaluation() {
  if (!stockfishReady || !stockfishWorker) return;

  stockfishWorker.postMessage("stop");
  stockfishWorker.postMessage(`position fen ${game.fen()}`);
  stockfishWorker.postMessage(`go depth 12`);
  setEvalDisplayFromPawns(0, "calculating…");
}

function getExpectedMove() {
  const validationGame = new Chess(game.fen());
  return validationGame.move(activeOpening.moves[currentPly], { sloppy: true });
}

function finishIfDone() {
  if (currentPly >= activeOpening.moves.length) {
    trainingActive = false;
    showFeedback("Perfect. You completed the line!", true);
    setStatus("Training complete. Press Start Training to run it again.");
    return true;
  }
  return false;
}

function syncBoardAndEval() {
  board.position(game.fen());
  requestEvaluation();
}

function playComputerMovesIfNeeded() {
  if (!trainingActive) return;

  while (trainingActive && currentPly < activeOpening.moves.length && game.turn() !== userColor) {
    const computerSan = activeOpening.moves[currentPly];
    const moved = game.move(computerSan, { sloppy: true });

    if (!moved) {
      trainingActive = false;
      setStatus("This opening line has an invalid move. Pick a different line.");
      showFeedback("Line parsing failed.");
      break;
    }

    currentPly += 1;
    syncBoardAndEval();
  }

  if (finishIfDone()) return;

  const sideName = userColor === "w" ? "White" : "Black";
  setStatus(`${sideName} to move. Play the next opening move.`);
}

function startTraining() {
  const selected = openings.find((item) => item.id === openingSelect.value);
  activeOpening = selected || openings[0];
  userColor = colorSelect.value;
  game.reset();
  board.orientation(userColor === "w" ? "white" : "black");
  syncBoardAndEval();

  currentPly = 0;
  trainingActive = true;
  showFeedback("Training started. Follow the line exactly.");
  renderLine();

  playComputerMovesIfNeeded();
}

function resetTraining() {
  trainingActive = false;
  game.reset();
  currentPly = 0;
  syncBoardAndEval();
  showFeedback("");
  setStatus("Board reset. Choose an opening and press Start Training.");
}

function onDragStart(source, piece) {
  if (!trainingActive) return false;

  const movingColor = piece.startsWith("w") ? "w" : "b";
  if (movingColor !== userColor) return false;
  if (game.turn() !== userColor) return false;

  return true;
}

function onDrop(source, target) {
  if (!trainingActive) return "snapback";

  const expected = getExpectedMove();
  if (!expected) {
    setStatus("No expected move found. This line may be invalid.");
    return "snapback";
  }

  const isCorrectDestination =
    source === expected.from &&
    target === expected.to &&
    (!expected.promotion || expected.promotion === "q");

  if (!isCorrectDestination) {
    flashCross();
    showFeedback(`Incorrect. Correct move is: ${activeOpening.moves[currentPly]}`);
    return "snapback";
  }

  const legalMove = game.move({ from: source, to: target, promotion: "q" });
  if (!legalMove) return "snapback";

  currentPly += 1;
  showFeedback("Correct!", true);

  syncBoardAndEval();
  if (finishIfDone()) return;

  setTimeout(() => {
    playComputerMovesIfNeeded();
    syncBoardAndEval();
  }, 200);
}

function onSnapEnd() {
  syncBoardAndEval();
}

fillOpeningChoices();
renderLine();

board = Chessboard("board", {
  draggable: true,
  position: "start",
  onDragStart,
  onDrop,
  onSnapEnd,
});

startEngine();
requestEvaluation();

startBtn.addEventListener("click", startTraining);
resetBtn.addEventListener("click", resetTraining);
openingSelect.addEventListener("change", () => {
  const selected = openings.find((item) => item.id === openingSelect.value);
  activeOpening = selected || openings[0];
  renderLine();
});
