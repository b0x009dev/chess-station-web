import { listGames } from './api.js';

function gameRow(game) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'game-row game-link';
  link.href = `#/game/${game.id}`;

  for (const field of ['white', 'black', 'event', 'date', 'result']) {
    const cell = document.createElement('span');
    cell.className = `game-${field}`;
    cell.textContent = game[field];
    link.append(cell);
  }

  item.append(link);
  return item;
}

export function createCatalog(screen) {
  const search = screen.querySelector('#search-form');
  const input = screen.querySelector('#player');
  const message = screen.querySelector('#catalog-message');
  const columns = screen.querySelector('#catalog-columns');
  const games = screen.querySelector('#games');
  const pagination = screen.querySelector('#pagination');
  const previous = screen.querySelector('#previous-page');
  const next = screen.querySelector('#next-page');
  const pageCount = screen.querySelector('#page-count');
  let player = '';
  let page = 1;
  let revision = 0;

  async function load() {
    const current = ++revision;
    input.value = player;
    pagination.hidden = true;
    columns.hidden = true;
    games.replaceChildren();
    message.hidden = false;
    message.classList.remove('message-error');
    message.textContent = 'Загрузка партий…';

    try {
      const result = await listGames(player, page);
      if (current !== revision) {
        return;
      }
      const pages = Math.max(1, Math.ceil(result.total / result.limit));
      if (page > pages) {
        page = pages;
        await load();
        return;
      }
      if (result.total === 0) {
        message.textContent = player ? 'По этому запросу партий нет.' : 'В базе пока нет партий.';
        return;
      }
      games.replaceChildren(...result.items.map(gameRow));
      columns.hidden = false;
      message.hidden = true;
      pagination.hidden = pages === 1;
      previous.disabled = page === 1;
      next.disabled = page === pages;
      pageCount.textContent = `${page} / ${pages}`;
    } catch (error) {
      if (current === revision) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Повторить';
        retry.addEventListener('click', load);
        message.classList.add('message-error');
        message.replaceChildren(error.message, retry);
      }
    }
  }

  search.addEventListener('submit', (event) => {
    event.preventDefault();
    player = input.value.trim();
    page = 1;
    load();
  });
  previous.addEventListener('click', () => {
    page -= 1;
    load();
  });
  next.addEventListener('click', () => {
    page += 1;
    load();
  });

  return { load };
}
