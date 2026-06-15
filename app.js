// --- 1. GAME COMPONENT STATE ---
// ropeOffset is the SINGLE source of truth for rope position.
// > 0 = Red side winning, < 0 = Blue side winning.
const gameState = {
    leftPlayerScore: 0,
    rightPlayerScore: 0,
    isGameOver: false
};

// DOM Cache Matrix — these are the ONLY elements used for touch-hit-testing
const leftPad = document.getElementById('left-player-pad');
const rightPad = document.getElementById('right-player-pad');

// --- 2. GLOBAL SYSTEM OVERRIDES ---
// Completely neutralize scrolling, zooming, and context menus
window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
// window.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
window.addEventListener('contextmenu', (e) => e.preventDefault());

// --- 3. THE MULTI-TOUCH INTERPOLATOR ENGINE ---
window.addEventListener('touchstart', (event) => {
    // FIX #5: Guard against input after game over or when locked
    if (gameState.isGameOver || state.victory || state.locked) return;

    // Process concurrent fingers
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!targetElement) continue;

        // ONLY prevent default behavior if tapping inside the math pads
        if (leftPad.contains(targetElement) || rightPad.contains(targetElement)) {
            event.preventDefault(); // Stops zooming/double-tap delays for the game
            
            if (leftPad.contains(targetElement)) {
                processPlayerAction('left', targetElement);
            } else {
                processPlayerAction('right', targetElement);
            }
        }
        // If they tap outside the pads (menus/buttons), do NOT call preventDefault().
        // allows normal smartboard/tablet touch-clicks to work
    }
}, { passive: false });

// FIX #2: Add click/mousedown handlers so calculators work with mouse clicks too
function setupClickHandlers() {
    document.querySelectorAll('.key').forEach((key) => {
        key.addEventListener('click', handleKeyClick);
    });
}

function handleKeyClick(event) {
    if (gameState.isGameOver || state.victory || state.locked) return;
    const element = event.currentTarget;
    const team = element.getAttribute('data-team');
    if (!team) return;
    processPlayerAction(team === 'blue' ? 'left' : 'right', element);
}

// --- 4. DATA VALIDATION AND ACTION ROUTING ---
function processPlayerAction(player, element) {
    // Extract the numeric value of the button tapped (0-9, Clear, or Submit)
    const digit = element.getAttribute('data-key');
    const action = element.getAttribute('data-action');

    if (digit !== null) {
        // Map 'left' -> 'blue', 'right' -> 'red' for existing game logic
        const team = player === 'left' ? 'blue' : 'red';
        appendDigit(team, digit);
        return;
    }

    if (action === 'clear') {
        const team = player === 'left' ? 'blue' : 'red';
        clearInput(team);
        return;
    }

    if (action === 'submit') {
        const team = player === 'left' ? 'blue' : 'red';
        submitAnswer(team);
        return;
    }
}

// ============================================================
// GAME LOGIC
// ============================================================

const TEAM_CONFIG = {
  blue: {
    label: "Blue",
    panelId: "bluePanel",
    questionId: "blueQuestion",
    helperId: "blueHelper",
    answerId: "blueAnswer",
    numpadId: "blueNumpad",
    avatarId: "blueAvatar",
    winClass: "is-pulling-blue",
  },
  red: {
    label: "Red",
    panelId: "redPanel",
    questionId: "redQuestion",
    helperId: "redHelper",
    answerId: "redAnswer",
    numpadId: "redNumpad",
    avatarId: "redAvatar",
    winClass: "is-pulling-red",
  },
};

const OPERATION_POOL = ["+", "-", "×", "÷"];

const state = {
  level: 1,
  // SINGLE source of truth for rope position. 0 = center.
  // Negative = Blue side winning, Positive = Red side winning.
  ropeOffset: 0,
  maxOffset: 260,
  winOffset: 152,
  pullStep: 42,
  penaltyStep: 14,
  score: {
    blue: 0,
    red: 0,
  },
  locked: false,
  victory: false,
  mode: "mixed",
  teams: {
    blue: createTeamState("blue"),
    red: createTeamState("red"),
  },
};

const elements = {
  levelBadge: null,
  scoreboard: document.getElementById("scoreboard"),
  miniKnot: document.getElementById("miniKnot"),
  ropeKnot: document.getElementById("ropeKnot"),
  tugOfWar: document.getElementById("tugOfWar"),
  victoryOverlay: document.getElementById("victoryOverlay"),
  victoryCard: document.querySelector(".victory-card"),
  victoryTitle: document.getElementById("victoryTitle"),
  victoryTeam: document.getElementById("victoryTeam"),
  victorySubtitle: document.getElementById("victorySubtitle"),
  victoryScore: document.getElementById("victoryScore"),
  restartButton: document.getElementById("restartButton"),
  pauseBtn: document.getElementById("pauseBtn"),
  pauseModal: document.getElementById("pauseModal"),
  resumeGameBtn: document.getElementById("resumeGameBtn"),
  resetGameBtn: document.getElementById("resetGameBtn"),
  gameShell: document.querySelector(".game-shell"),
  confettiLayer: document.getElementById("confettiLayer"),
};

function createTeamState(team) {
  return {
    team,
    input: "",
    question: null,
    questionText: "",
    questionHistory: [],
  };
}

function init() {
  setupUIListeners();
  setupRestart();
  setupClickHandlers(); // FIX #2: Setup click handlers for mouse users
  setupModeButtons();
  setupPauseModal();
  generateQuestion("blue");
  generateQuestion("red");
  renderAll();
}

// Only UI controls (not player numpad) use click listeners
function setupUIListeners() {
  document.addEventListener("keydown", handleKeyboardInput);
}

function setupRestart() {
  elements.restartButton.addEventListener("click", restartRound);
}

function setupModeButtons() {
  document.querySelectorAll(".mode-btn").forEach((button) => {
    button.addEventListener("click", handleModeClick);
  });
}

function setupPauseModal() {
  elements.pauseBtn?.addEventListener("click", () => {
    elements.pauseModal?.classList.remove("hidden");
  });

  elements.resumeGameBtn?.addEventListener("click", () => {
    elements.pauseModal?.classList.add("hidden");
  });

  elements.resetGameBtn?.addEventListener("click", resetGame);
}

function resetGame() {
  state.score.blue = 0;
  state.score.red = 0;
  state.ropeOffset = 0;
  state.victory = false;
  state.locked = false;

  gameState.leftPlayerScore = 0;
  gameState.rightPlayerScore = 0;
  gameState.isGameOver = false;

  elements.pauseModal?.classList.add("hidden");
  elements.victoryOverlay.hidden = true;
  elements.victoryOverlay.setAttribute("aria-hidden", "true");
  elements.confettiLayer.innerHTML = "";

  disableInputs(false);

  document.querySelectorAll(".sumo-svg").forEach((avatar) => {
    avatar.classList.remove("is-winning", "is-pulling-blue", "is-pulling-red", "is-losing");
  });

  generateQuestion("blue");
  generateQuestion("red");
  updateScoreboard();
  updateRoundStatus("Ready");
  renderAll();
}

function handleModeClick(event) {
  const mode = event.currentTarget.dataset.mode;
  if (!mode) return;

  state.mode = mode;

  document.querySelectorAll(".mode-btn").forEach((btn) => btn.classList.remove("mode-btn--active"));
  event.currentTarget.classList.add("mode-btn--active");

  generateQuestion("blue");
  generateQuestion("red");
  renderAll();
  updateRoundStatus(modeLabels[mode] || mode);
}

const modeLabels = {
  mixed: "Mixed Mode",
  add: "Addition",
  sub: "Subtraction",
  mul: "Multiplication",
  div: "Division",
};

// Player input via keyboard (for development/testing)
function handleKeyboardInput(event) {
  if (state.victory || state.locked || gameState.isGameOver) return;

  if (/^[0-9]$/.test(event.key)) {
    appendDigit("blue", event.key);
    return;
  }

  if (event.key === "Backspace") {
    clearInput("blue");
    return;
  }

  if (event.key === "Enter") {
    submitAnswer("blue");
  }
}

function appendDigit(team, digit) {
  const teamState = state.teams[team];
  teamState.input = `${teamState.input}${digit}`.slice(0, 3);
  renderTeam(team);
}

function clearInput(team) {
  state.teams[team].input = "";
  renderTeam(team);
}

function submitAnswer(team) {
  const teamState = state.teams[team];
  if (!teamState.question) return;

  const expected = String(teamState.question.answer);
  const guess = teamState.input || "";

  if (guess === expected) {
    handleCorrectAnswer(team);
    return;
  }

  handleIncorrectAnswer(team);
}

function handleCorrectAnswer(team) {
  if (state.victory) return;

  playCorrectSound();
  playPullSound();

  const direction = team === "blue" ? -1 : 1;
  state.ropeOffset = clamp(state.ropeOffset + direction * state.pullStep, -state.maxOffset, state.maxOffset);

  pulseAvatar(team);
  animateRope();
  updateRoundStatus(`${TEAM_CONFIG[team].label} correct`);

  state.teams[team].input = "";

  // FIX #1: Check victory BEFORE generating new question and rendering
  // checkVictory will call generateQuestion for the opponent if no win
  checkVictory(team);
}

function handleIncorrectAnswer(team) {
  playIncorrectSound();

  const opponent = team === "blue" ? "red" : "blue";
  const direction = opponent === "blue" ? -1 : 1;

  state.ropeOffset = clamp(state.ropeOffset + direction * state.penaltyStep, -state.maxOffset, state.maxOffset);

  pulseAvatar(opponent);
  animateRope();
  updateRoundStatus(`${TEAM_CONFIG[team].label} missed`);

  state.teams[team].input = "";

  // FIX #1: Call checkVictory on incorrect answers too — if B's wrong answer
  // pushes the rope past A's win-line, victory must be declared.
  checkVictory(team);
}

function pulseAvatar(team) {
  const avatar = document.getElementById(TEAM_CONFIG[team].avatarId);
  if (!avatar) return;

  avatar.classList.remove(TEAM_CONFIG[team].winClass);
  void avatar.offsetWidth;
  avatar.classList.add(TEAM_CONFIG[team].winClass);

  window.setTimeout(() => {
    avatar.classList.remove(TEAM_CONFIG[team].winClass);
  }, 360);
}

function animateRope() {
  const offsetPercent = (state.ropeOffset / state.maxOffset) * 38;
  const winPercent = (state.winOffset / state.maxOffset) * 38;
  elements.tugOfWar.style.setProperty("--rope-offset", `${state.ropeOffset}px`);
  elements.tugOfWar.style.setProperty("--win-pct", `${winPercent}%`);
  document.querySelector(".map-chip__track").style.setProperty("--win-pct", `${winPercent}%`);
  elements.ropeKnot.style.left = `${50 + offsetPercent}%`;
  elements.miniKnot.style.left = `${50 + offsetPercent}%`;
}

function checkVictory(lastTeam) {
  if (state.ropeOffset <= -state.winOffset) {
    endMatch("blue");
    return;
  }

  if (state.ropeOffset >= state.winOffset) {
    endMatch("red");
    return;
  }

  // No victory — regenerate question for the team that just answered
  // (so the next player gets a fresh question)
  generateQuestion(lastTeam);
  updateScoreboard();
  renderAll();
}

function endMatch(winner) {
  state.victory = true;
  state.locked = true;
  gameState.isGameOver = true;
  state.score[winner] += 1;
  if (winner === 'blue') gameState.leftPlayerScore = state.score.blue;
  else gameState.rightPlayerScore = state.score.red;
  updateScoreboard();
  disableInputs(true);

  const loser = winner === "blue" ? "red" : "blue";

  // FIX #3: Add win/lose states on avatars
  const winningAvatar = document.getElementById(TEAM_CONFIG[winner].avatarId);
  winningAvatar?.classList.add("is-winning");

  const losingAvatar = document.getElementById(TEAM_CONFIG[loser].avatarId);
  losingAvatar?.classList.add("is-losing");

  elements.victoryCard.className = `victory-card victory-card--${winner}`;
  elements.victoryTitle.textContent = "WINNER";
  elements.victoryTeam.textContent = winner === "blue" ? "BLUE TEAM" : "RED TEAM";
  elements.victoryScore.textContent = `BLUE ${state.score.blue} – RED ${state.score.red}`;
  elements.victoryOverlay.hidden = false;
  elements.victoryOverlay.setAttribute("aria-hidden", "false");

  playVictoryFanfare();
  createConfetti(winner);
}

function restartRound() {
  state.victory = false;
  state.locked = false;
  gameState.isGameOver = false;
  state.ropeOffset = 0;
  state.teams.blue.input = "";
  state.teams.red.input = "";
  elements.victoryOverlay.hidden = true;
  elements.victoryOverlay.setAttribute("aria-hidden", "true");
  elements.confettiLayer.innerHTML = "";

  document.querySelectorAll(".sumo-svg").forEach((avatar) => {
    avatar.classList.remove("is-winning", "is-losing");
  });
  disableInputs(false);

  generateQuestion("blue");
  generateQuestion("red");
  updateRoundStatus("Ready");
  renderAll();
}

function disableInputs(disabled) {
  document.querySelectorAll(".team-panel, .numpad").forEach((node) => {
    node.classList.toggle("is-disabled", disabled);
  });
}

function generateQuestion(team) {
  const teamState = state.teams[team];
  const pool = resolveOperationPool();
  const history = teamState.questionHistory;
  const maxAttempts = 30;

  let question = null;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const operation = randomChoice(pool);
    question = createQuestionByOperation(operation);
    const key = questionKey(question);
    if (!history.includes(key)) {
      break;
    }
    attempts++;
  }

  history.push(questionKey(question));
  if (history.length > 12) {
    history.shift();
  }

  teamState.question = question;
  teamState.questionText = `${question.a} ${question.operator} ${question.b} = ?`;
}

function questionKey(q) {
  return `${q.a}|${q.operator}|${q.b}`;
}

function resolveOperationPool() {
  const mode = state.mode;
  if (mode === "mixed") return OPERATION_POOL;
  if (mode === "add") return ["+"];
  if (mode === "sub") return ["-"];
  if (mode === "mul") return ["×"];
  if (mode === "div") return ["÷"];
  return OPERATION_POOL;
}

function createQuestionByOperation(operation) {
  const max = 10;

  if (operation === "+") {
    const a = randomInt(1, max);
    const b = randomInt(1, max);
    return { a, b, operator: "+", answer: a + b };
  }

  if (operation === "-") {
    const a = randomInt(2, max);
    const b = randomInt(1, a - 1);
    return { a, b, operator: "-", answer: a - b };
  }

  if (operation === "×") {
    const a = randomInt(1, max);
    const b = randomInt(1, max);
    return { a, b, operator: "×", answer: a * b };
  }

  return createDivisionQuestion(max);
}

function createDivisionQuestion(max) {
  const divisor = randomInt(1, max);
  const quotient = randomInt(1, max);
  return {
    a: divisor * quotient,
    b: divisor,
    operator: "÷",
    answer: quotient,
  };
}

function randomChoice(items) {
  return items[randomInt(0, items.length - 1)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function renderAll() {
  renderTeam("blue");
  renderTeam("red");
  updateScoreboard();
  animateRope();
}

function renderTeam(team) {
  const teamState = state.teams[team];
  const questionEl = document.getElementById(TEAM_CONFIG[team].questionId);
  const helperEl = document.getElementById(TEAM_CONFIG[team].helperId);
  const answerEl = document.getElementById(TEAM_CONFIG[team].answerId);
  const panelEl = document.getElementById(TEAM_CONFIG[team].panelId);

  if (!questionEl || !helperEl || !answerEl || !panelEl) return;

  questionEl.textContent = teamState.questionText;

  // FIX #6 (Keypad display cleanup): Parse display value as int to remove leading zeros
  // This is DISPLAY-ONLY — the underlying teamState.input stays as-is for backend validation.
  const rawInput = teamState.input;
  const displayValue = rawInput ? String(parseInt(rawInput, 10)) : "";
  answerEl.textContent = displayValue || "_";

  panelEl.classList.remove("is-disabled");
  helperEl.textContent = "Enter answer, then press OK";
}

function updateScoreboard() {
  elements.scoreboard.textContent = `BLUE ${state.score.blue} – RED ${state.score.red}`;
}

function updateRoundStatus(text) {
  const statusEl = document.getElementById("roundStatus");
  if (statusEl) {
    statusEl.textContent = text;
  }
}

function createConfetti(winner) {
  elements.confettiLayer.innerHTML = "";
  const colors = winner === "blue"
    ? ["confetti--blue", "confetti--white", "confetti--yellow"]
    : ["confetti--red", "confetti--white", "confetti--yellow"];

  const count = 32;
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("span");
    const colorClass = colors[i % colors.length];
    piece.className = `confetti ${colorClass}`;
    piece.style.left = `${randomInt(0, 100)}vw`;
    piece.style.top = `${randomInt(-10, 20)}vh`;
    piece.style.setProperty("--drift", `${randomInt(-120, 120)}px`);
    piece.style.animationDelay = `${i * 18}ms`;
    elements.confettiLayer.appendChild(piece);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function playCorrectSound() {}
function playIncorrectSound() {}
function playPullSound() {}
function playVictoryFanfare() {}

window.playCorrectSound = playCorrectSound;
window.playIncorrectSound = playIncorrectSound;
window.playPullSound = playPullSound;
window.playVictoryFanfare = playVictoryFanfare;

document.addEventListener("DOMContentLoaded", init);
