const USERS_SHEET = 'Users';
const FLAGSHIP_RECORDS_SHEET = 'MeowtopiaRecords';
const PLACEMENT_RECORDS_SHEET = 'PlacementRecords';

function doPost(e) {
  const payload = parsePayload_(e);
  const action = payload.action || '';

  if (action === 'auth') {
    return json_(authenticate_(payload));
  }

  if (action === 'register') {
    return text_(register_(payload));
  }

  if (action === 'savePlacementRecord') {
    saveRecord_(payload, 'placement');
    return text_('success');
  }

  if (action === 'saveRecord') {
    saveRecord_(payload, payload.game || 'flagship');
    return text_('success');
  }

  return text_('unknown_action');
}

function doGet(e) {
  const params = e.parameter || {};
  const action = params.action || '';

  if (action === 'getLeaderboard') {
    return json_(getLeaderboard_(params.game || 'flagship', Number(params.level || 1)));
  }

  return json_({ status: 'unknown_action' });
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return {};
  }
}

function spreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name, headers) {
  const ss = spreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  const width = Math.max(headers.length, sheet.getLastColumn() || 1);
  const firstRow = sheet.getRange(1, 1, 1, width).getValues()[0];
  const hasHeaders = firstRow.some(value => String(value || '').trim());

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers.forEach(header => ensureColumn_(sheet, header));
  }

  return sheet;
}

function usersSheet_() {
  return sheet_(USERS_SHEET, ['username', 'password', 'meowtopiaLevel', 'placementLevel']);
}

function recordsSheet_(game) {
  if (game === 'placement') {
    return sheet_(PLACEMENT_RECORDS_SHEET, ['timestamp', 'username', 'level', 'steps', 'time', 'placement']);
  }

  return sheet_(FLAGSHIP_RECORDS_SHEET, ['timestamp', 'username', 'level', 'steps', 'time', 'circuit']);
}

function getHeaders_(sheet) {
  if (sheet.getLastColumn() < 1) {
    return [];
  }

  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(value => String(value || '').trim());
}

function normalizedHeader_(header) {
  return String(header || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function headerAliases_(canonical) {
  const aliases = {
    username: ['username', 'user', 'name', 'player', 'account'],
    password: ['password', 'pass', 'pwd'],
    meowtopiaLevel: ['meowtopialevel', 'flagshiplevel', 'currentlevel', 'level'],
    placementLevel: ['placementlevel', 'sensorlevel', 'placementprogress'],
    timestamp: ['timestamp', 'timecreated', 'createdat', 'date'],
    level: ['level', 'stage'],
    steps: ['steps', 'step', 'cats', 'catcount'],
    time: ['time', 'seconds', 'sec'],
    circuit: ['circuit'],
    placement: ['placement', 'circuit']
  };

  return aliases[canonical] || [canonical];
}

function columnIndex_(headers, canonical) {
  const wanted = headerAliases_(canonical).map(normalizedHeader_);
  for (let index = 0; index < headers.length; index++) {
    if (wanted.indexOf(normalizedHeader_(headers[index])) !== -1) {
      return index;
    }
  }

  return -1;
}

function ensureColumn_(sheet, canonical) {
  const headers = getHeaders_(sheet);
  const existingIndex = columnIndex_(headers, canonical);

  if (existingIndex !== -1) {
    if (headers[existingIndex] !== canonical) {
      sheet.getRange(1, existingIndex + 1).setValue(canonical);
    }
    return existingIndex + 1;
  }

  const nextColumn = sheet.getLastColumn() + 1;
  sheet.getRange(1, nextColumn).setValue(canonical);
  return nextColumn;
}

function getCell_(sheet, rowNumber, canonical) {
  const column = ensureColumn_(sheet, canonical);
  return sheet.getRange(rowNumber, column).getValue();
}

function setCell_(sheet, rowNumber, canonical, value) {
  const column = ensureColumn_(sheet, canonical);
  sheet.getRange(rowNumber, column).setValue(value);
}

function findUserRow_(username) {
  const sheet = usersSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = getHeaders_(sheet);
  const usernameIndex = columnIndex_(headers, 'username');

  if (usernameIndex === -1) {
    return { sheet, rowNumber: -1, rowValues: null, headers };
  }

  for (let row = 1; row < data.length; row++) {
    if (String(data[row][usernameIndex] || '').trim() === username) {
      return { sheet, rowNumber: row + 1, rowValues: data[row], headers };
    }
  }

  return { sheet, rowNumber: -1, rowValues: null, headers };
}

function authenticate_(payload) {
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '').trim();
  const found = findUserRow_(username);

  if (found.rowNumber === -1) {
    return { status: 'not_found' };
  }

  const storedPassword = String(getCell_(found.sheet, found.rowNumber, 'password') || '').trim();
  if (storedPassword !== password) {
    return { status: 'wrong_password' };
  }

  let meowtopiaLevel = Number(getCell_(found.sheet, found.rowNumber, 'meowtopiaLevel') || 0);
  let placementLevel = Number(getCell_(found.sheet, found.rowNumber, 'placementLevel') || 0);

  if (!meowtopiaLevel) {
    meowtopiaLevel = 1;
    setCell_(found.sheet, found.rowNumber, 'meowtopiaLevel', meowtopiaLevel);
  }

  if (!placementLevel) {
    placementLevel = 1;
    setCell_(found.sheet, found.rowNumber, 'placementLevel', placementLevel);
  }

  return {
    status: 'success',
    level: meowtopiaLevel,
    meowtopiaLevel: meowtopiaLevel,
    placementLevel: placementLevel
  };
}

function register_(payload) {
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '').trim();

  if (!username || !password) {
    return 'failed';
  }

  const found = findUserRow_(username);
  if (found.rowNumber !== -1) {
    return 'exists';
  }

  const sheet = usersSheet_();
  const nextRow = sheet.getLastRow() + 1;
  setCell_(sheet, nextRow, 'username', username);
  setCell_(sheet, nextRow, 'password', password);
  setCell_(sheet, nextRow, 'meowtopiaLevel', 1);
  setCell_(sheet, nextRow, 'placementLevel', 1);
  return 'success';
}

function saveRecord_(payload, game) {
  const username = String(payload.username || '').trim();
  const level = Number(payload.level || 1);
  const steps = Number(payload.steps || 0);
  const time = Number(payload.time || 0);
  const placement = String(payload.placement || payload.circuit || '');

  if (!username || !level) {
    return;
  }

  const records = recordsSheet_(game);
  const nextRow = records.getLastRow() + 1;
  setCell_(records, nextRow, 'timestamp', new Date());
  setCell_(records, nextRow, 'username', username);
  setCell_(records, nextRow, 'level', level);
  setCell_(records, nextRow, 'steps', steps);
  setCell_(records, nextRow, 'time', time);

  if (game === 'placement') {
    setCell_(records, nextRow, 'placement', placement);
    updateUserProgress_(username, 'placementLevel', Number(payload.unlockedLevel || level + 1));
  } else {
    setCell_(records, nextRow, 'circuit', placement);
    updateUserProgress_(username, 'meowtopiaLevel', level + 1);
  }
}

function updateUserProgress_(username, columnName, nextLevel) {
  const found = findUserRow_(username);
  if (found.rowNumber === -1) {
    return;
  }

  const current = Number(getCell_(found.sheet, found.rowNumber, columnName) || 1);
  if (nextLevel > current) {
    setCell_(found.sheet, found.rowNumber, columnName, nextLevel);
  }
}

function getLeaderboard_(game, level) {
  const sheet = recordsSheet_(game);
  const data = sheet.getDataRange().getValues();
  const headers = getHeaders_(sheet);
  const usernameIndex = columnIndex_(headers, 'username');
  const levelIndex = columnIndex_(headers, 'level');
  const stepsIndex = columnIndex_(headers, 'steps');
  const timeIndex = columnIndex_(headers, 'time');
  const rows = [];

  if ([usernameIndex, levelIndex, stepsIndex, timeIndex].some(index => index === -1)) {
    return rows;
  }

  for (let row = 1; row < data.length; row++) {
    if (Number(data[row][levelIndex]) !== level) {
      continue;
    }

    rows.push({
      username: data[row][usernameIndex],
      level: Number(data[row][levelIndex]),
      steps: Number(data[row][stepsIndex]),
      time: Number(data[row][timeIndex])
    });
  }

  return rows;
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function text_(value) {
  return ContentService
    .createTextOutput(String(value))
    .setMimeType(ContentService.MimeType.TEXT);
}
