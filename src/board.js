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

export function renderBoard(frame, position) {
  const cells = position.flatMap((rank, row) => rank.map((piece, column) => {
    const file = files[column];
    const rankNumber = 8 - row;
    const square = `${file}${rankNumber}`;
    const cell = document.createElement('div');
    cell.className = (row + column) % 2 === 0 ? 'square square-light' : 'square square-dark';
    cell.dataset.square = square;

    if (piece) {
      const image = document.createElement('img');
      const name = piece.color + piece.type.toUpperCase();
      image.className = 'piece';
      image.src = `${import.meta.env.BASE_URL}pieces/staunty/${name}.svg`;
      image.alt = `${sideNames[piece.color]}, ${pieceNames[piece.type]}, ${square}`;
      image.draggable = false;
      cell.append(image);
    }

    return cell;
  }));

  frame.querySelector('#board').replaceChildren(...cells);
  frame.querySelector('.board-ranks').replaceChildren(...position.map((_, row) => createCoordinate(8 - row)));
  frame.querySelector('.board-files').replaceChildren(...Array.from(files, createCoordinate));
}
