const files = 'abcdefgh';

const pieceNames = {
  p: 'пешка',
  n: 'конь',
  b: 'слон',
  r: 'ладья',
  q: 'ферзь',
  k: 'король',
};

const sideNames = {
  w: 'Белые',
  b: 'Чёрные',
};

function createCoordinate(value) {
  const label = document.createElement('span');
  label.textContent = value;
  return label;
}

export function createPiece(color, type, square = '') {
  const image = document.createElement('img');
  const name = color + type.toUpperCase();
  image.className = 'piece';
  image.src = `${import.meta.env.BASE_URL}pieces/staunty/${name}.svg`;
  image.alt = [sideNames[color], pieceNames[type], square].filter(Boolean).join(', ');
  image.draggable = false;
  return image;
}

export function renderBoard(frame, { position, flipped, selected, destinations, lastMove, checked, locked }) {
  const board = frame.querySelector('#board');
  const focused = board.contains(document.activeElement) ? document.activeElement.dataset.square : null;
  const ranks = flipped ? [...position].reverse() : position;
  const columns = flipped ? [...files].reverse() : [...files];
  const cells = ranks.flatMap((rank, row) => {
    const pieces = flipped ? [...rank].reverse() : rank;
    return pieces.map((piece, column) => {
      const square = `${columns[column]}${flipped ? row + 1 : 8 - row}`;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.disabled = locked;
      cell.className = (row + column) % 2 === 0 ? 'square square-light' : 'square square-dark';
      cell.dataset.square = square;
      cell.setAttribute('aria-label', square);
      cell.classList.toggle('square-selected', square === selected);
      cell.classList.toggle('square-destination', destinations.includes(square));
      cell.classList.toggle('square-last', square === lastMove?.from || square === lastMove?.to);
      cell.classList.toggle('square-check', square === checked);

      if (piece) {
        const image = createPiece(piece.color, piece.type, square);
        cell.setAttribute('aria-label', image.alt);
        cell.append(image);
      }

      return cell;
    });
  });

  board.replaceChildren(...cells);
  board.setAttribute('aria-label', `Шахматная доска. ${flipped ? 'Чёрные' : 'Белые'} снизу`);
  frame.querySelector('.board-ranks').replaceChildren(...ranks.map((_, row) => createCoordinate(flipped ? row + 1 : 8 - row)));
  frame.querySelector('.board-files').replaceChildren(...columns.map(createCoordinate));
  if (focused) {
    board.querySelector(`[data-square="${focused}"]`)?.focus({ preventScroll: true });
  }
}

export function bindBoard(board, { select, canDrag, drop }) {
  let pointer;
  let dragged = false;

  board.addEventListener('click', (event) => {
    const square = event.target.closest('[data-square]')?.dataset.square;
    if (square && (!dragged || event.detail === 0)) {
      select(square);
    }
  });

  board.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    dragged = false;
    const cell = event.target.closest('[data-square]');
    const image = cell?.querySelector('.piece');
    if (image && canDrag(cell.dataset.square)) {
      pointer = { id: event.pointerId, from: cell.dataset.square, x: event.clientX, y: event.clientY, image };
    }
  });

  window.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer?.id) {
      return;
    }
    if (!pointer.ghost) {
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) {
        return;
      }
      const size = pointer.image.getBoundingClientRect().width;
      if (size === 0) {
        pointer = null;
        return;
      }
      pointer.ghost = pointer.image.cloneNode();
      pointer.ghost.className = 'drag-piece';
      pointer.ghost.style.width = `${size}px`;
      pointer.image.classList.add('piece-dragged');
      document.body.append(pointer.ghost);
      board.setPointerCapture(event.pointerId);
    }
    pointer.ghost.style.left = `${event.clientX}px`;
    pointer.ghost.style.top = `${event.clientY}px`;
  });

  function finish(event) {
    if (event.pointerId !== pointer?.id) {
      return;
    }
    const { from, ghost, image } = pointer;
    pointer = null;
    if (!ghost) {
      return;
    }
    dragged = true;
    ghost.remove();
    image.classList.remove('piece-dragged');
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-square]');
    if (event.type === 'pointerup' && cell && board.contains(cell)) {
      drop(from, cell.dataset.square);
    }
  }

  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
}
