import { getGame } from './api.js';
import { createCatalog } from './catalog.js';
import { createEditor } from './editor.js';
import { readPgnFile } from './pgn.js';
import './styles.css';

const catalogScreen = document.querySelector('#catalog');
const editorScreen = document.querySelector('#editor');
const messageScreen = document.querySelector('#not-found');
const routeTitle = document.querySelector('#route-title');
const routeMessage = document.querySelector('#route-message');
const retry = document.querySelector('#retry-game');
const pgnFile = document.querySelector('#pgn-file');
const importMessage = document.querySelector('#import-message');
const catalog = createCatalog(catalogScreen);
const editor = createEditor(editorScreen, {
  onSave(id) {
    currentHash = `#/game/${id}`;
    history.replaceState({ entry }, '', currentHash);
  },
  onDelete() {
    navigate('#/');
  },
});

let entry = history.state?.entry ?? 0;
let currentHash = window.location.hash;
let revision = 0;
history.replaceState({ entry }, '');

function display(screen) {
  for (const section of [catalogScreen, editorScreen, messageScreen]) {
    section.hidden = section !== screen;
  }
}

function showMessage(title, message = '', canRetry = false) {
  routeTitle.textContent = title;
  routeMessage.textContent = message;
  routeMessage.hidden = !message;
  retry.hidden = !canRetry;
  display(messageScreen);
}

async function showRoute(draft) {
  const current = ++revision;
  importMessage.hidden = true;
  if (currentHash === '' || currentHash === '#/') {
    display(catalogScreen);
    catalog.load();
    return;
  }
  if (currentHash === '#/new') {
    display(editorScreen);
    editor.open({ draft });
    return;
  }
  const match = /^#\/game\/([0-9]+)$/.exec(currentHash);
  const id = Number(match?.[1]);
  if (!(id >= 1 && id <= 2147483647)) {
    showMessage('Страница не найдена');
    return;
  }
  showMessage('Загрузка партии…');
  try {
    const game = await getGame(id);
    if (current === revision) {
      display(editorScreen);
      editor.open({ game });
    }
  } catch (error) {
    if (current === revision) {
      showMessage('Не удалось открыть партию', error.message, true);
    }
  }
}

function canLeave() {
  if (editorScreen.hidden) {
    return true;
  }
  if (editor.isBusy()) {
    return false;
  }
  return !editor.isDirty() || window.confirm('Уйти без сохранения изменений?');
}

function navigate(hash, draft) {
  if (hash !== currentHash) {
    entry += 1;
    history.pushState({ entry }, '', hash);
    currentHash = hash;
  }
  showRoute(draft);
  window.scrollTo(0, 0);
}

document.addEventListener('click', (event) => {
  const importButton = event.target.closest('[data-import]');
  if (importButton) {
    pgnFile.click();
    return;
  }
  const link = event.target.closest('a[href^="#/"]');
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  if (link.hash !== currentHash && canLeave()) {
    navigate(link.hash);
  }
});

window.addEventListener('popstate', () => {
  const nextEntry = history.state?.entry ?? entry + 1;
  const hash = window.location.hash;
  if (nextEntry === entry && hash === currentHash) {
    return;
  }
  if (!canLeave()) {
    history.go(entry - nextEntry);
    return;
  }
  entry = nextEntry;
  currentHash = hash;
  history.replaceState({ entry }, '');
  showRoute();
});

window.addEventListener('beforeunload', (event) => {
  if (!editorScreen.hidden && editor.isDirty()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

pgnFile.addEventListener('change', async () => {
  const file = pgnFile.files[0];
  pgnFile.value = '';
  if (!file) {
    return;
  }
  const current = ++revision;
  importMessage.hidden = true;
  try {
    const draft = await readPgnFile(file);
    if (current === revision && canLeave()) {
      navigate('#/new', draft);
    }
  } catch (error) {
    if (current === revision) {
      importMessage.textContent = error.message;
      importMessage.hidden = false;
    }
  }
});

retry.addEventListener('click', () => showRoute());
showRoute();
