const LEVEL = 1;

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

const OPERATION_POOL = {
  basic: ["+", "-"],
  intermediate: ["+", "-", "×", "÷"],
  advanced: ["+", "-", "×", "÷"],
};

const state = {
  level: LEVEL,
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
  teams: {
    blue: createTeamState("blue"),
    red: createTeamState("red"),
  },
};

const elements = {
  levelBadge: document.getElementById("levelBadge"),
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
  gameShell: document.querySelector(".game-shell"),
  confettiLayer: document.getElementById("confettiLayer"),
};

function createTeamState(team) {
  return {
    team,
    input: "",
    question: null,
    questionText: "",
  };
}

function init() {
  setupControls();
  setupRestart();
  generateQuestion("blue");
  generateQuestion("red");
  renderAll();
}

function setupControls() {
  document.querySelectorAll("[data-team][data-action], [data-team][data-key]").forEach((button) => {
    button.addEventListener("pointerdown", handlePointerDown);
    button.addEventListener("click", handleInputClick);
  });

  document.addEventListener("keydown", handleKeyboardInput);
}

function setupRestart() {
  elements.restartButton.addEventListener("pointerdown", handlePointerDown);
  elements.restartButton.addEventListener("click", restartRound);
}

function handlePointerDown(event) {
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function handleInputClick(event) {
  const button = event.currentTarget;
  const team = button.dataset.team;
  const action = button.dataset.action;
  const digit = button.dataset.key;

  if (!team || state.victory) return;

  if (digit !== undefined) {
    appendDigit(team, digit);
    return;
  }

  if (action === "clear") {
    clearInput(team);
    return;
  }

  if (action === "submit") {
    submitAnswer(team);
  }
}

function handleKeyboardInput(event) {
  if (state.victory) return;

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
  generateQuestion(team);
  renderAll();
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
  renderAll();
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

  const opponent = lastTeam === "blue" ? "red" : "blue";
  updateScoreboard();
  renderTeam(opponent);
}

function endMatch(winner) {
  state.victory = true;
  state.locked = true;
  state.score[winner] += 1;
  updateScoreboard();
  disableInputs(true);

  elements.victoryCard.className = `victory-card victory-card--${winner}`;
  elements.victoryTitle.textContent = "WINNER";
  elements.victoryTeam.textContent = winner === "blue" ? "BLUE TEAM" : "RED TEAM";
  elements.victorySubtitle.textContent = "The knot crossed the win line.";
  elements.victoryScore.textContent = `BLUE ${state.score.blue} – RED ${state.score.red}`;
  elements.victoryOverlay.hidden = false;
  elements.victoryOverlay.setAttribute("aria-hidden", "false");

  const winningAvatar = document.getElementById(TEAM_CONFIG[winner].avatarId);
  winningAvatar?.classList.add("is-winning");

  playVictoryFanfare();
  createConfetti(winner);
}

function restartRound() {
  state.victory = false;
  state.locked = false;
  state.ropeOffset = 0;
  state.teams.blue.input = "";
  state.teams.red.input = "";
  elements.victoryOverlay.hidden = true;
  elements.victoryOverlay.setAttribute("aria-hidden", "true");
  elements.confettiLayer.innerHTML = "";

  document.querySelectorAll(".sumo-svg").forEach((avatar) => avatar.classList.remove("is-winning"));
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
  const levelBand = getLevelBand(state.level);
  const operation = randomChoice(OPERATION_POOL[levelBand]);
  const question = createQuestionByOperation(operation, levelBand);

  teamState.question = question;
  teamState.questionText = `${question.a} ${question.operator} ${question.b} = ?`;
}

function createQuestionByOperation(operation, levelBand) {
  const range = getOperandRange(levelBand);

  if (operation === "+") {
    const a = randomInt(1, range.max);
    const b = randomInt(1, range.max);
    return { a, b, operator: "+", answer: a + b };
  }

  if (operation === "-") {
    const a = randomInt(2, range.max);
    const b = randomInt(1, a - 1);
    return { a, b, operator: "-", answer: a - b };
  }

  if (operation === "×") {
    const a = randomInt(1, range.max);
    const b = randomInt(1, range.max);
    return { a, b, operator: "×", answer: a * b };
  }

  return createDivisionQuestion(range.max);
}

function createDivisionQuestion(maxOperand) {
  const divisor = randomInt(1, maxOperand);
  const quotient = randomInt(1, maxOperand);
  return {
    a: divisor * quotient,
    b: divisor,
    operator: "÷",
    answer: quotient,
  };
}

function getLevelBand(level) {
  if (level <= 5) return "basic";
  if (level <= 9) return "intermediate";
  return "advanced";
}

function getOperandRange(levelBand) {
  if (levelBand === "basic") return { min: 1, max: 10 };
  if (levelBand === "intermediate") return { min: 1, max: 20 };
  return { min: 1, max: 50 };
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
  updateLevelBadge();
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
  answerEl.textContent = teamState.input || "_";

  panelEl.classList.remove("is-disabled");
  helperEl.textContent = "Enter answer, then press OK";
}

function updateScoreboard() {
  elements.scoreboard.textContent = `BLUE ${state.score.blue} – RED ${state.score.red}`;
}

function updateLevelBadge() {
  const levelName = getLevelName(state.level);
  elements.levelBadge.textContent = `LEVEL ${state.level}: ${levelName}`;
}

function getLevelName(level) {
  if (level <= 5) return "BASIC";
  if (level <= 9) return "INTERMEDIATE";
  return "ADVANCED";
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
