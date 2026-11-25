const base = `${import.meta.env.BASE_URL}api/v1/games`;
const unavailable = 'Сервер недоступен. Попробуйте ещё раз.';
const errorCodes = ['VALIDATION_ERROR', 'GAME_NOT_FOUND', 'NOT_FOUND', 'PAYLOAD_TOO_LARGE', 'TOO_MANY_REQUESTS', 'INTERNAL_ERROR'];

async function request(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch(base + path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(unavailable);
  }

  if (response.status === 204) {
    return;
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    throw new Error(unavailable);
  }
  if (!response.ok) {
    if (typeof data.code !== 'string' || typeof data.message !== 'string') {
      throw new Error(unavailable);
    }
    if (!errorCodes.includes(data.code)) {
      throw new Error('Операция не выполнена. Попробуйте ещё раз.');
    }
    const details = Array.isArray(data.details) ? data.details : [];
    const messages = details.map(({ field, message }) => `${field} – ${message}`);
    throw new Error([data.message, ...messages].join('\n'));
  }
  return data;
}

export function listGames(player, page) {
  const query = new URLSearchParams({ player, page, limit: 20 });
  return request(`?${query}`);
}

export function getGame(id) {
  return request(`/${id}`);
}

export function saveGame(id, pgn) {
  return id === null ? request('', 'POST', { pgn }) : request(`/${id}`, 'PUT', { pgn });
}

export function deleteGame(id) {
  return request(`/${id}`, 'DELETE');
}
