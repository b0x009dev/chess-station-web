import { Chess } from 'chess.js';
import { renderBoard } from './board.js';
import './styles.css';

const catalog = document.querySelector('#catalog');
const editor = document.querySelector('#editor');
const notFound = document.querySelector('#not-found');
const boardFrame = document.querySelector('.board-frame');
const turn = document.querySelector('#turn');

function showScreen() {
  const hash = window.location.hash || '#/';

  catalog.hidden = hash !== '#/';
  editor.hidden = hash !== '#/new';
  notFound.hidden = !catalog.hidden || !editor.hidden;

  if (!editor.hidden) {
    const game = new Chess();
    renderBoard(boardFrame, game.board());
    turn.textContent = game.turn() === 'w' ? 'Ход белых' : 'Ход чёрных';
  }
}

window.addEventListener('hashchange', showScreen);
showScreen();
