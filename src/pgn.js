import { Chess } from 'chess.js';

const defaultTags = {
  Event: '?',
  Site: '?',
  Date: '????.??.??',
  Round: '?',
  White: '?',
  Black: '?',
  Result: '*',
};
export const editableTags = ['White', 'Black', 'Event', 'Date', 'Result'];

const results = ['1-0', '0-1', '1/2-1/2', '*'];
const tagPattern = /^\[[ \t]*([A-Za-z]+)[ \t]+"([^"\\\p{Cc}]+)"[ \t]*\](?=$|\s|\[)/u;
const datePattern = /^(?:[0-9]{4}|\?{4})\.(?:[0-9]{2}|\?{2})\.(?:[0-9]{2}|\?{2})$/;
const maxPgnBytes = 128 * 1024;

function validateSize(bytes, limit = maxPgnBytes) {
  if (bytes > limit) {
    throw new Error('Размер PGN превышает 128 КиБ.');
  }
}

function validateTag(name, value) {
  let message = '';
  if (!value.trim() || !value.isWellFormed() || /["\\\p{Cc}]/u.test(value)) {
    message = 'Значение содержит недопустимые символы или пусто.';
  } else if (name === 'Date' && !datePattern.test(value)) {
    message = 'Введите дату в формате ГГГГ.ММ.ДД.';
  } else if (name === 'Result' && !results.includes(value)) {
    message = 'Выберите допустимый результат.';
  } else if (['White', 'Black', 'Event'].includes(name) && Array.from(value).length > 255) {
    message = 'Допускается не более 255 символов.';
  }
  if (message) {
    const error = new Error(`Тег ${name}. ${message}`);
    error.field = name;
    throw error;
  }
}

export function readPgn(pgn) {
  if (!pgn.trim() || pgn.startsWith('\uFEFF') || pgn.includes('\0') || !pgn.isWellFormed()) {
    throw new Error('PGN пуст или содержит недопустимые символы.');
  }
  validateSize(new TextEncoder().encode(pgn).length);

  const tags = new Map();
  let moves = pgn.trimStart();
  while (moves.startsWith('[')) {
    const match = tagPattern.exec(moves);
    if (!match) {
      throw new Error('Некорректный заголовок PGN.');
    }
    const [header, name, value] = match;
    if (tags.has(name)) {
      throw new Error(`Тег ${name} указан несколько раз.`);
    }
    validateTag(name, value);
    tags.set(name, value);
    moves = moves.slice(header.length).trimStart();
  }

  if (tags.has('SetUp') || tags.has('FEN') || (tags.has('Variant') && tags.get('Variant') !== 'Standard')) {
    throw new Error('Редактор поддерживает партии со стандартной начальной позицией.');
  }
  if (/[{}();!?$%[\]]|--/.test(moves)) {
    throw new Error('Редактор поддерживает одну партию без комментариев, вариантов и аннотаций.');
  }
  const marker = moves.trimEnd().match(/(1\/2-1\/2|1-0|0-1|\*)$/)?.[1];
  const result = tags.get('Result');
  if (result && marker && result !== marker) {
    throw new Error('Результат в заголовке PGN расходится с результатом в записи ходов.');
  }

  const chess = new Chess();
  try {
    chess.loadPgn(moves, { strict: true });
  } catch {
    throw new Error('Не удалось воспроизвести запись ходов PGN.');
  }
  tags.set('Result', result ?? marker ?? '*');
  return { tags, history: chess.history({ verbose: true }) };
}

export async function readPgnFile(file) {
  validateSize(file.size, maxPgnBytes + 3);
  let pgn;
  try {
    pgn = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error('Не удалось прочитать PGN-файл в кодировке UTF-8.');
  }
  return readPgn(pgn);
}

export function gameFields(tags) {
  return Object.fromEntries(editableTags.map((name) => [name, tags.get(name) ?? defaultTags[name]]));
}

export function writePgn(tags, history, fields) {
  const headers = new Map(Object.entries(defaultTags));
  for (const [name, value] of tags) {
    headers.set(name, value);
  }
  for (const name of editableTags) {
    const value = fields[name];
    const tag = value.trim() ? value : defaultTags[name];
    validateTag(name, tag);
    headers.set(name, tag);
  }

  const tokens = history.flatMap((move, index) => {
    return index % 2 === 0 ? [`${index / 2 + 1}.`, move.san] : [move.san];
  });
  tokens.push(headers.get('Result'));

  const lines = [];
  let line = '';
  for (const token of tokens) {
    if (line.length + token.length + 1 > 80) {
      lines.push(line);
      line = '';
    }
    line = line ? `${line} ${token}` : token;
  }
  lines.push(line);

  const header = Array.from(headers, ([name, value]) => `[${name} "${value}"]`).join('\n');
  const pgn = `${header}\n\n${lines.join('\n')}\n`;
  validateSize(new TextEncoder().encode(pgn).length);
  return pgn;
}
