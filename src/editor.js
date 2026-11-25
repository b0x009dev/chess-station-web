import { Chess } from 'chess.js';
import { deleteGame, saveGame } from './api.js';
import { bindBoard, createPiece, renderBoard } from './board.js';
import { editableTags, gameFields, readPgn, writePgn } from './pgn.js';

function ending(chess) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? '0-1' : '1-0';
  }
  return chess.isStalemate() ? '1/2-1/2' : null;
}

function moveButton(move, ply) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = move.san;
  button.dataset.ply = ply;
  return button;
}

export function createEditor(screen, { onSave, onDelete }) {
  const frame = screen.querySelector('.board-frame');
  const board = frame.querySelector('#board');
  const movesPanel = screen.querySelector('.moves-panel');
  const moves = screen.querySelector('#moves');
  const emptyMoves = screen.querySelector('#moves-empty');
  const steps = Array.from(screen.querySelectorAll('[data-step]'));
  const turn = screen.querySelector('#turn');
  const details = screen.querySelector('#details');
  const form = screen.querySelector('#metadata');
  const title = screen.querySelector('#editor-title');
  const message = screen.querySelector('#editor-message');
  const unsupportedMessage = screen.querySelector('#unsupported-message');
  const save = screen.querySelector('#save-game');
  const remove = screen.querySelector('#delete-game');
  const flip = screen.querySelector('#flip-board');
  const viewPgn = screen.querySelector('#view-pgn');
  const exportPgn = screen.querySelector('#export-pgn');
  const importPgn = screen.querySelector('[data-import]');
  const promotion = document.querySelector('#promotion');
  const promotionPieces = document.querySelector('#promotion-pieces');
  const pgnDialog = document.querySelector('#pgn-dialog');
  const pgnText = document.querySelector('#pgn-text');
  const inputs = Object.fromEntries(editableTags.map((name) => [name, form.elements.namedItem(name)]));
  const fieldErrors = Array.from(form.querySelectorAll('[data-error]'));

  let record;
  let baseline;
  let chess;
  let ply;
  let selected;
  let flipped;
  let busy = false;
  let lastWheel = 0;

  function snapshot() {
    return JSON.stringify([record.history.map((move) => move.san), record.fields]);
  }

  function isDirty() {
    return Boolean(record && !record.issue && (record.imported || snapshot() !== baseline));
  }

  function showMessage(text, failed = false) {
    message.textContent = text;
    message.classList.toggle('message-error', failed);
    message.hidden = !text;
  }

  function clearFieldErrors() {
    for (const error of fieldErrors) {
      error.hidden = true;
      inputs[error.dataset.error].removeAttribute('aria-invalid');
    }
  }

  function fillFields() {
    for (const name of editableTags) {
      inputs[name].value = record.fields[name];
    }
  }

  function showError(error) {
    const field = fieldErrors.find((item) => item.dataset.error === error.field);
    if (field) {
      field.textContent = error.message;
      field.hidden = false;
      inputs[error.field].setAttribute('aria-invalid', 'true');
      inputs[error.field].focus();
    } else {
      showMessage(error.message, true);
    }
  }

  function updateActions() {
    save.hidden = Boolean(record.issue);
    flip.hidden = Boolean(record.issue);
    remove.hidden = record.id === null;
    save.disabled = busy || (record.id !== null && !isDirty());
    save.textContent = busy ? 'Подождите…' : 'Сохранить';
    for (const button of [flip, viewPgn, exportPgn, importPgn, remove]) {
      button.disabled = busy;
    }
    for (const input of Object.values(inputs)) {
      input.disabled = busy;
    }
  }

  function drawPosition() {
    const checked = chess.isCheck() ? chess.findPiece({ color: chess.turn(), type: 'k' })[0] : null;
    const destinations = selected ? chess.moves({ square: selected, verbose: true }).map((move) => move.to) : [];
    renderBoard(frame, {
      position: chess.board(),
      flipped,
      selected,
      destinations,
      lastMove: record.history[ply - 1],
      checked,
      locked: busy,
    });
    let status = chess.turn() === 'w' ? 'Ход белых' : 'Ход чёрных';
    if (chess.isCheckmate()) {
      status = 'Мат';
    } else if (chess.isStalemate()) {
      status = 'Пат';
    }
    turn.textContent = status;

    const active = moves.querySelector(`[data-ply="${ply}"]`);
    moves.querySelector('[aria-current]')?.removeAttribute('aria-current');
    active?.setAttribute('aria-current', 'step');
    if (active && (active.offsetTop < moves.scrollTop || active.offsetTop + active.offsetHeight > moves.scrollTop + moves.clientHeight)) {
      moves.scrollTop = Math.max(0, active.offsetTop - moves.clientHeight / 2);
    }
    for (const button of steps) {
      const backward = ['start', 'previous'].includes(button.dataset.step);
      button.disabled = busy || (backward ? ply === 0 : ply === record.history.length);
    }
  }

  function renderHistory() {
    const rows = [];
    for (let index = 0; index < record.history.length; index += 2) {
      const row = document.createElement('li');
      const number = document.createElement('span');
      number.textContent = index / 2 + 1;
      row.append(number, moveButton(record.history[index], index + 1));
      if (record.history[index + 1]) {
        row.append(moveButton(record.history[index + 1], index + 2));
      }
      rows.push(row);
    }
    moves.replaceChildren(...rows);
    emptyMoves.hidden = rows.length > 0;
    moves.hidden = rows.length === 0;
  }

  function goTo(target) {
    if (busy || record.issue) {
      return;
    }
    ply = Math.max(0, Math.min(record.history.length, target));
    chess = new Chess(record.history[ply - 1]?.after);
    selected = null;
    drawPosition();
  }

  function open({ game, draft } = {}) {
    let parsed = draft ?? { tags: new Map(), history: [] };
    let issue = '';
    if (game) {
      try {
        parsed = readPgn(game.pgn);
        if (parsed.tags.get('Result') !== game.result) {
          throw new Error('Результат в PGN не совпадает с результатом, сохранённым в каталоге.');
        }
      } catch (error) {
        issue = error.message;
      }
    }
    record = {
      ...parsed,
      id: game?.id ?? null,
      original: game?.pgn,
      fields: gameFields(parsed.tags),
      imported: Boolean(draft),
      issue,
    };
    const last = new Chess(record.history.at(-1)?.after);
    record.automatic = ending(last) === record.fields.Result;
    flipped = false;
    baseline = snapshot();
    fillFields();
    title.textContent = game ? `Партия №${game.id}` : 'Новая партия';
    unsupportedMessage.textContent = issue ? `Редактирование недоступно. ${issue}` : '';
    unsupportedMessage.hidden = !issue;
    frame.hidden = Boolean(issue);
    movesPanel.hidden = Boolean(issue);
    details.hidden = Boolean(issue);
    clearFieldErrors();
    showMessage('');
    updateActions();
    renderHistory();
    goTo(record.history.length);
  }

  function choosePromotion(color, choices) {
    promotion.returnValue = '';
    promotionPieces.replaceChildren(...choices.map((move) => {
      const button = document.createElement('button');
      button.value = move.promotion;
      button.append(createPiece(color, move.promotion));
      return button;
    }));
    promotion.showModal();
    return new Promise((resolve) => {
      promotion.addEventListener('close', () => resolve(promotion.returnValue), { once: true });
    });
  }

  async function play(from, to) {
    if (busy || promotion.open || record.issue) {
      return;
    }
    const choices = chess.moves({ square: from, verbose: true }).filter((move) => move.to === to);
    if (!choices.length) {
      return;
    }
    let move = choices[0];
    if (move.promotion) {
      const piece = await choosePromotion(chess.turn(), choices);
      move = choices.find((choice) => choice.promotion === piece);
      if (!move) {
        selected = null;
        drawPosition();
        return;
      }
    }

    const next = record.history[ply];
    if (next && next.from === from && next.to === to && next.promotion === move.promotion) {
      goTo(ply + 1);
      return;
    }
    if (next && !window.confirm('Заменить все последующие ходы?')) {
      return;
    }

    const result = ending(new Chess(move.after));
    if (result || (next && record.automatic)) {
      record.fields.Result = result ?? '*';
      record.automatic = Boolean(result);
      inputs.Result.value = record.fields.Result;
    }
    record.history = [...record.history.slice(0, ply), move];
    showMessage('');
    renderHistory();
    goTo(record.history.length);
    updateActions();
  }

  bindBoard(board, {
    canDrag: (square) => !busy && chess.get(square)?.color === chess.turn(),
    drop: play,
    select(square) {
      if (busy) {
        return;
      }
      if (chess.get(square)?.color === chess.turn()) {
        selected = selected === square ? null : square;
        drawPosition();
      } else if (selected) {
        play(selected, square);
      }
    },
  });

  movesPanel.addEventListener('click', (event) => {
    const { ply: target, step } = event.target.dataset;
    if (target) {
      goTo(Number(target));
    }
    if (step) {
      const targets = { start: 0, previous: ply - 1, next: ply + 1, end: record.history.length };
      goTo(targets[step]);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (screen.hidden || busy || record.issue || promotion.open || pgnDialog.open ||
      event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, select, textarea, [contenteditable]')) {
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(ply + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });

  board.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
      return;
    }
    event.preventDefault();
    const now = performance.now();
    if (event.deltaY && now - lastWheel > 120) {
      lastWheel = now;
      goTo(ply + Math.sign(event.deltaY));
    }
  }, { passive: false });

  flip.addEventListener('click', () => {
    flipped = !flipped;
    drawPosition();
  });

  form.addEventListener('input', ({ target }) => {
    if (!Object.hasOwn(inputs, target.name) || busy) {
      return;
    }
    record.fields[target.name] = target.value;
    if (target.name === 'Result') {
      record.automatic = false;
    }
    clearFieldErrors();
    showMessage('');
    updateActions();
  });

  function pgn() {
    if (record.id !== null && !isDirty()) {
      return record.original;
    }
    return writePgn(record.tags, record.history, record.fields);
  }

  viewPgn.addEventListener('click', () => {
    try {
      pgnText.textContent = pgn();
      pgnDialog.showModal();
    } catch (error) {
      showError(error);
    }
  });

  exportPgn.addEventListener('click', () => {
    try {
      const url = URL.createObjectURL(new Blob([pgn()], { type: 'application/x-chess-pgn;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = record.id === null ? 'chess-station.pgn' : `chess-station-${record.id}.pgn`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      showError(error);
    }
  });

  function setBusy(value) {
    busy = value;
    updateActions();
    if (!record.issue) {
      drawPosition();
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || record.issue || (record.id !== null && !isDirty())) {
      return;
    }
    clearFieldErrors();
    showMessage('');
    try {
      const source = pgn();
      setBusy(true);
      const game = await saveGame(record.id, source);
      record.id = game.id;
      record.original = game.pgn;
      record.imported = false;
      record.fields = { White: game.white, Black: game.black, Event: game.event, Date: game.date, Result: game.result };
      fillFields();
      baseline = snapshot();
      title.textContent = `Партия №${game.id}`;
      onSave(game.id);
      showMessage('Партия сохранена.');
    } catch (error) {
      showError(error);
    } finally {
      if (busy) {
        setBusy(false);
      }
    }
  });

  remove.addEventListener('click', async () => {
    if (busy || record.id === null || !window.confirm('Удалить партию?')) {
      return;
    }
    showMessage('');
    setBusy(true);
    try {
      await deleteGame(record.id);
      onDelete();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  });

  return { open, isDirty, isBusy: () => busy || promotion.open || pgnDialog.open };
}
