/**
 * سجل بوابة الأفراد — Google Apps Script
 * مستخدمين بأدوار (إدارة / مدير / بوابة) + تقارير.
 *
 * ⚙️ SETUP_CODE: كود بيتطلب مرة واحدة بس علشان تعمل أول حساب "إدارة".
 *    غيّره لأي كلمة تختارها قبل ما تعمل Deploy. بعد أول حساب مش بيتطلب تاني.
 */
const SETUP_CODE = 'CHANGE-ME';

const TZ = 'Africa/Cairo';
const LOG_SHEET = 'سجل الدخول';
const USERS_SHEET = 'المستخدمين';
const GATES_SHEET = 'البوابات';
const DEFAULT_GATES = ['Arezzo', 'Verona', 'Isola', 'Veneto'];
const TOKEN_DAYS = 30;
const ROLES = { admin: 'الإدارة', manager: 'مدير', gate: 'بوابة' };

const HEADERS = [
  'الاسم', 'الرقم القومي', 'تاريخ الميلاد', 'النوع', 'المحافظة', 'العنوان', 'رقم الموبايل',
  'القطاع', 'رايح فين', 'سبب الدخول', 'الشركة / صاحب العمل', 'ملاحظات',
  'التاريخ', 'وقت الدخول', 'وقت الخروج', 'مدة التواجد (س:د)',
  'فرد الأمن (دخول)', 'فرد الأمن (خروج)',
  'ID', 'inMs', 'outMs',
  'حساب الدخول', 'حساب الخروج'
];
const COL = {};
HEADERS.forEach(function (h, i) { COL[h] = i; });
const U_HEADERS = ['اسم المستخدم', 'الاسم', 'الدور', 'البوابات', 'نشط', 'آخر دخول', 'تاريخ الإنشاء', 'salt', 'hash', 'ver'];
const G_HEADERS = ['البوابة', 'نشطة'];

const GOV = {"01":"القاهرة","02":"الإسكندرية","03":"بورسعيد","04":"السويس","11":"دمياط","12":"الدقهلية","13":"الشرقية","14":"القليوبية","15":"كفر الشيخ","16":"الغربية","17":"المنوفية","18":"البحيرة","19":"الإسماعيلية","21":"الجيزة","22":"بني سويف","23":"الفيوم","24":"المنيا","25":"أسيوط","26":"سوهاج","27":"قنا","28":"أسوان","29":"الأقصر","31":"البحر الأحمر","32":"الوادي الجديد","33":"مطروح","34":"شمال سيناء","35":"جنوب سيناء","88":"مواليد خارج مصر"};

// ================================================================ web app

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('سجل بوابة الأفراد')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** شغّلها من المحرر بعد أي تحديث: بتجهز كل الشيتات. */
function setup() {
  const ss = ss_();
  logSheet_(); usersSheet_(); gatesSheet_();
  ss.getSheets().forEach(function (s) {
    if ([LOG_SHEET, USERS_SHEET, GATES_SHEET].indexOf(s.getName()) < 0 && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  Logger.log('الشيت جاهز: ' + ss.getName() + ' — ' + ss.getUrl());
  Logger.log(needsSetup() ? 'لسه مفيش حساب إدارة: افتح التطبيق واعمل أول حساب بـ SETUP_CODE.' : 'حسابات الإدارة موجودة.');
}

function ss_() {
  let ss = null;
  try { ss = SpreadsheetApp.getActive(); } catch (e) {}
  if (ss) return ss;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  ss = SpreadsheetApp.create('سجل بوابة الأفراد');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

// ================================================================ sheets

const _sheets = {};
function ensureSheet_(name, headers, init) {
  if (_sheets[name]) return _sheets[name];
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  const style = function (r) { r.setFontWeight('bold').setBackground('#16414D').setFontColor('#FFFFFF'); };
  if (!sh) {
    sh = ss.insertSheet(name);
    style(sh.getRange(1, 1, 1, headers.length).setValues([headers]));
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    if (init) init(sh);
  } else {
    const w = sh.getLastColumn();
    if (w < headers.length) style(sh.getRange(1, w + 1, 1, headers.length - w).setValues([headers.slice(w)]));
  }
  _sheets[name] = sh;
  return sh;
}

function logSheet_() {
  return ensureSheet_(LOG_SHEET, HEADERS, function (sh) {
    sh.getRange(1, 1, sh.getMaxRows(), COL['فرد الأمن (خروج)'] + 1).setNumberFormat('@');
    sh.getRange(1, COL['inMs'] + 1, sh.getMaxRows(), 2).setNumberFormat('0');
    sh.hideColumns(COL['ID'] + 1, 3);
    sh.setColumnWidth(COL['الاسم'] + 1, 220);
    sh.setColumnWidth(COL['الرقم القومي'] + 1, 150);
    sh.setColumnWidth(COL['العنوان'] + 1, 260);
  });
}

function usersSheet_() {
  return ensureSheet_(USERS_SHEET, U_HEADERS, function (sh) {
    sh.getRange(1, 1, sh.getMaxRows(), U_HEADERS.length).setNumberFormat('@');
    sh.hideColumns(8, 3);
  });
}

function gatesSheet_() {
  return ensureSheet_(GATES_SHEET, G_HEADERS, function (sh) {
    const seen = {}, rows = [];
    DEFAULT_GATES.concat(logSectors_()).forEach(function (g) { if (g && !seen[g]) { seen[g] = 1; rows.push([g, 'نعم']); } });
    sh.getRange(2, 1, rows.length, 2).setValues(rows);
  });
}

function logSectors_() {
  const sh = ss_().getSheetByName(LOG_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  return unique_(sh.getRange(2, COL['القطاع'] + 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }));
}

// ================================================================ users & auth

function users_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('users');
  if (hit) return JSON.parse(hit);
  const sh = usersSheet_();
  const n = sh.getLastRow() - 1, out = [];
  if (n > 0) sh.getRange(2, 1, n, U_HEADERS.length).getValues().forEach(function (r, i) {
    if (!r[0]) return;
    out.push({
      row: i + 2, username: String(r[0]).trim().toLowerCase(), name: String(r[1]), role: roleKey_(r[2]),
      gates: String(r[3] || '').split(',').map(function (g) { return g.trim(); }).filter(String),
      active: String(r[4]).trim() !== 'لا', lastLogin: cell_(r[5]), created: cell_(r[6]),
      salt: String(r[7]), hash: String(r[8]), ver: Number(r[9]) || 1
    });
  });
  cache.put('users', JSON.stringify(out), 300);
  return out;
}
function dropUsersCache_() { CacheService.getScriptCache().remove('users'); }
function findUser_(username) {
  username = String(username || '').trim().toLowerCase();
  return users_().filter(function (u) { return u.username === username; })[0] || null;
}
function roleKey_(v) {
  v = String(v || '').trim();
  for (const k in ROLES) if (k === v || ROLES[k] === v) return k;
  return 'gate';
}
function publicUser_(u) {
  return { username: u.username, name: u.name, role: u.role, roleLabel: ROLES[u.role], gates: u.gates, active: u.active, lastLogin: u.lastLogin, created: u.created };
}

function hash_(salt, pw) {
  let h = String(pw);
  for (let i = 0; i < 50; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + h, Utilities.Charset.UTF_8));
  }
  return h;
}
function secret_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('TOKEN_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('TOKEN_SECRET', s); }
  return s;
}
function sign_(payload) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret_())); }
function makeToken_(u) {
  const p = u.username + '|' + (Date.now() + TOKEN_DAYS * 864e5) + '|' + u.ver;
  return Utilities.base64EncodeWebSafe(p) + '.' + sign_(p);
}

/** بيرجع المستخدم أو بيرمي AUTH. roles اختياري. */
function auth_(token, roles) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('AUTH');
  let p;
  try { p = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString(); } catch (e) { throw new Error('AUTH'); }
  if (sign_(p) !== parts[1]) throw new Error('AUTH');
  const f = p.split('|');
  if (Number(f[1]) < Date.now()) throw new Error('AUTH');
  const u = findUser_(f[0]);
  if (!u || !u.active || String(u.ver) !== f[2]) throw new Error('AUTH');
  if (roles && roles.indexOf(u.role) < 0) throw new Error('مش مسموح لحسابك بالعملية دي.');
  return u;
}

function gates_() {
  const sh = gatesSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 2).getValues()
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r) { return { name: String(r[0]).trim(), active: String(r[1]).trim() !== 'لا' }; });
}
function allGates_(u) { return u.role === 'admin' || u.gates.indexOf('*') >= 0; }
/** البوابات النشطة اللي المستخدم يقدر يسجّل فيها. */
function myGates_(u) {
  const act = gates_().filter(function (g) { return g.active; }).map(function (g) { return g.name; });
  return allGates_(u) ? act : act.filter(function (g) { return u.gates.indexOf(g) >= 0; });
}
/** يقدر يشوف حركة البوابة دي؟ (الإدارة وكل-البوابات بيشوفوا حتى البوابات القديمة) */
function canSee_(u, gate) { return allGates_(u) || u.gates.indexOf(gate) >= 0; }

// ---------------------------------------------------------------- public: login

function needsSetup() {
  return !users_().some(function (u) { return u.role === 'admin' && u.active; });
}

function setupAdmin(code, username, name, password) {
  if (SETUP_CODE === 'CHANGE-ME') throw new Error('غيّر SETUP_CODE في أول ملف Code.gs واعمل Deploy بنسخة جديدة الأول.');
  if (String(code || '').trim() !== SETUP_CODE) throw new Error('كود التفعيل غلط.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (!needsSetup()) throw new Error('حساب الإدارة معمول قبل كده. سجّل دخول.');
    writeUser_({ username: username, name: name, role: 'admin', gates: ['*'], active: true, password: password }, true);
  } finally { lock.releaseLock(); }
  return login(username, password);
}

function login(username, password) {
  username = String(username || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache(), key = 'fail:' + username;
  const fails = Number(cache.get(key)) || 0;
  if (fails >= 5) throw new Error('محاولات كتير غلط. استنى ١٠ دقايق وجرّب تاني.');
  const u = findUser_(username);
  if (!u || !u.active || hash_(u.salt, password) !== u.hash) {
    cache.put(key, String(fails + 1), 600);
    throw new Error(u && !u.active ? 'الحساب ده متوقف. كلّم الإدارة.' : 'اسم المستخدم أو كلمة السر غلط.');
  }
  cache.remove(key);
  try { usersSheet_().getRange(u.row, 6).setValue("'" + stamp_(new Date())); dropUsersCache_(); } catch (e) {}
  return { token: makeToken_(u), me: publicUser_(u), gates: myGates_(u) };
}

function whoami(token) {
  const u = auth_(token);
  return { me: publicUser_(u), gates: myGates_(u) };
}

function changeMyPassword(token, oldPw, newPw) {
  const u = auth_(token);
  if (hash_(u.salt, oldPw) !== u.hash) throw new Error('كلمة السر الحالية غلط.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { writeUser_({ username: u.username, name: u.name, role: u.role, gates: u.gates, active: true, password: newPw }, false); }
  finally { lock.releaseLock(); }
  return makeToken_(findUser_(u.username));
}

// ---------------------------------------------------------------- admin: users & gates

function adminData(token) {
  auth_(token, ['admin']);
  return { users: users_().map(publicUser_), gates: gates_(), roles: ROLES };
}

function saveUser(token, d) {
  auth_(token, ['admin']);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const isNew = !!d.isNew;
    const target = findUser_(d.username);
    // ما ينفعش يفضل النظام من غير إدارة
    if (!isNew && target && target.role === 'admin' && (roleKey_(d.role) !== 'admin' || d.active === false)) {
      const others = users_().filter(function (u) { return u.role === 'admin' && u.active && u.username !== target.username; });
      if (!others.length) throw new Error('لازم يفضل حساب إدارة واحد على الأقل شغال.');
    }
    writeUser_(d, isNew);
  } finally { lock.releaseLock(); }
  return adminData(token);
}

/** بيكتب مستخدم جديد أو بيعدّل موجود. password اختياري في التعديل. */
function writeUser_(d, isNew) {
  const username = String(d.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('اسم المستخدم لازم يكون ٣ حروف على الأقل، إنجليزي صغير أو أرقام (مثال: verona1).');
  const name = clean_(d.name) || username;
  const role = roleKey_(d.role);
  const active = d.active !== false;
  let gates = (d.gates || []).map(function (g) { return String(g).trim(); }).filter(String);
  const known = gates_().map(function (g) { return g.name; });
  gates = gates.filter(function (g) { return g === '*' || known.indexOf(g) >= 0; });
  if (role === 'admin') gates = ['*'];
  if (role === 'gate' && (gates.length !== 1 || gates[0] === '*')) throw new Error('حساب البوابة لازم يبقى عليه بوابة واحدة بالظبط.');
  if (role === 'manager' && !gates.length) throw new Error('اختار بوابة واحدة على الأقل للمدير (أو كل البوابات).');
  if (gates.indexOf('*') >= 0) gates = ['*'];

  const sh = usersSheet_();
  const existing = findUser_(username);
  if (isNew && existing) throw new Error('اسم المستخدم ده موجود قبل كده.');
  if (!isNew && !existing) throw new Error('المستخدم مش موجود.');
  const pw = String(d.password || '');
  if ((isNew || pw) && pw.length < 6) throw new Error('كلمة السر لازم تبقى ٦ حروف أو أرقام على الأقل.');

  let salt = existing ? existing.salt : '', hash = existing ? existing.hash : '', ver = existing ? existing.ver : 1;
  if (pw) { salt = Utilities.getUuid(); hash = hash_(salt, pw); if (existing) ver++; }
  if (existing && existing.active && !active) ver++;                 // الإيقاف بيطلّعه من كل الأجهزة

  const row = [username, name, ROLES[role], gates.join(','), active ? 'نعم' : 'لا',
    existing ? existing.lastLogin : '', existing ? existing.created : stamp_(new Date()), salt, hash, String(ver)];
  const vals = row.map(function (v, i) { return (i === 5 || i === 6) && v ? "'" + v : v; });
  if (existing) sh.getRange(existing.row, 1, 1, row.length).setValues([vals]);
  else sh.appendRow(vals);
  dropUsersCache_();
}

function saveGate(token, name, active) {
  auth_(token, ['admin']);
  name = clean_(name);
  if (!name) throw new Error('اكتب اسم البوابة.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = gatesSheet_();
    const i = gates_().map(function (g) { return g.name; }).indexOf(name);
    if (i >= 0) sh.getRange(i + 2, 2).setValue(active === false ? 'لا' : 'نعم');
    else sh.appendRow([name, 'نعم']);
  } finally { lock.releaseLock(); }
  return adminData(token);
}

// ================================================================ gate operations

function getState(token, day, gate) {
  const u = auth_(token);
  const rows = rows_(3000).filter(function (r) { return canSee_(u, r.sector); });
  const today = dayKey_(new Date());
  day = day || today;
  const inGate = function (r) { return !gate || r.sector === gate; };
  return {
    today: today,
    inside: rows.filter(function (r) { return !r.outMs && inGate(r); }),
    day: rows.filter(function (r) { return r.day === day; }),
    todayCount: rows.filter(function (r) { return r.day === today && inGate(r); }).length,
    gates: myGates_(u)
  };
}

function ocrId(token, base64, mime) {
  auth_(token);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mime || 'image/jpeg', 'id.jpg');
  let fileId = null, text = '';
  try {
    const f = Drive.Files.create(
      { name: 'gate-ocr-' + Date.now(), mimeType: 'application/vnd.google-apps.document' },
      blob,
      { ocrLanguage: 'ar', fields: 'id' }
    );
    fileId = f.id;
    text = DocumentApp.openById(fileId).getBody().getText();
  } finally {
    if (fileId) {
      try { Drive.Files.remove(fileId); }
      catch (e) { try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e2) {} }
    }
  }
  return parseIdText_(text);
}

function saveEntry(token, e) {
  const u = auth_(token);
  const name = clean_(e.name), nid = digits_(e.nid), guard = clean_(e.guard);
  const sector = u.role === 'gate' ? u.gates[0] : clean_(e.sector);
  if (!guard) throw new Error('اكتب اسم فرد الأمن.');
  if (!sector) throw new Error('اختار البوابة.');
  if (myGates_(u).indexOf(sector) < 0) throw new Error('حسابك مش مسموح له يسجّل على بوابة ' + sector + '.');
  if (!name) throw new Error('اكتب الاسم.');
  const p = parseNid_(nid);
  if (!p) throw new Error('الرقم القومي لازم يكون ١٤ رقم صحيح.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const inside = rows_(3000).filter(function (r) { return !r.outMs && r.nid === nid; })[0];
    if (inside) throw new Error('الشخص ده متسجل جوه من ' + inside.inTime + ' (' + inside.sector + ') ولسه ماخرجش.');
    const now = new Date();
    const row = new Array(HEADERS.length).fill('');
    row[COL['الاسم']] = name;
    row[COL['الرقم القومي']] = nid;
    row[COL['تاريخ الميلاد']] = p.dob;
    row[COL['النوع']] = p.gender;
    row[COL['المحافظة']] = p.gov;
    row[COL['العنوان']] = clean_(e.address);
    row[COL['رقم الموبايل']] = digits_(e.phone);
    row[COL['القطاع']] = sector;
    row[COL['رايح فين']] = clean_(e.dest);
    row[COL['سبب الدخول']] = clean_(e.reason);
    row[COL['الشركة / صاحب العمل']] = clean_(e.company);
    row[COL['ملاحظات']] = clean_(e.notes);
    row[COL['التاريخ']] = dayKey_(now);
    row[COL['وقت الدخول']] = hm_(now);
    row[COL['فرد الأمن (دخول)']] = guard;
    row[COL['ID']] = Utilities.getUuid();
    row[COL['inMs']] = now.getTime();
    row[COL['حساب الدخول']] = u.username;
    ['الرقم القومي', 'رقم الموبايل', 'تاريخ الميلاد', 'التاريخ', 'وقت الدخول'].forEach(function (h) {
      if (row[COL[h]] !== '') row[COL[h]] = "'" + row[COL[h]];
    });
    logSheet_().appendRow(row);
    return { ok: true, time: hm_(now) };
  } finally {
    lock.releaseLock();
  }
}

function checkout(token, id, guard) {
  const u = auth_(token);
  guard = clean_(guard);
  if (!guard) throw new Error('اكتب اسم فرد الأمن.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = logSheet_();
    const last = sh.getLastRow();
    if (last < 2) throw new Error('السطر مش موجود.');
    const ids = sh.getRange(2, COL['ID'] + 1, last - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (ids[i][0] !== id) continue;
      const r = i + 2;
      const sector = String(sh.getRange(r, COL['القطاع'] + 1).getValue());
      if (!canSee_(u, sector)) throw new Error('الشخص ده مسجّل على بوابة ' + sector + '، وحسابك مش عليها.');
      if (Number(sh.getRange(r, COL['outMs'] + 1).getValue())) return { ok: true };
      const inMs = Number(sh.getRange(r, COL['inMs'] + 1).getValue());
      const now = new Date();
      sh.getRange(r, COL['وقت الخروج'] + 1, 1, 2).setValues([["'" + hm_(now), "'" + dur_(inMs, now.getTime())]]);
      sh.getRange(r, COL['فرد الأمن (خروج)'] + 1).setValue(guard);
      sh.getRange(r, COL['outMs'] + 1).setValue(now.getTime());
      sh.getRange(r, COL['حساب الخروج'] + 1).setValue(u.username);
      return { ok: true };
    }
    throw new Error('السطر مش موجود.');
  } finally {
    lock.releaseLock();
  }
}

// ================================================================ reports

function getReport(token, from, to, gate) {
  const u = auth_(token, ['admin', 'manager']);
  const today = dayKey_(new Date());
  to = /^\d{4}-\d{2}-\d{2}$/.test(to || '') ? to : today;
  from = /^\d{4}-\d{2}-\d{2}$/.test(from || '') ? from : shiftDay_(to, -6);
  if (from > to) { const t = from; from = to; to = t; }
  if (shiftDay_(from, 366) < to) from = shiftDay_(to, -366);

  const all = rows_(0).filter(function (r) { return canSee_(u, r.sector) && (!gate || r.sector === gate); });
  const rows = all.filter(function (r) { return r.day >= from && r.day <= to; });
  const now = Date.now();

  const days = [];
  for (let d = from; d <= to; d = shiftDay_(d, 1)) days.push(d);
  const byDay = {}; days.forEach(function (d) { byDay[d] = 0; });
  const byHour = new Array(24).fill(0);
  const count = function (key) { const m = {}; rows.forEach(function (r) { const k = String(r[key] || '').trim() || 'غير محدد'; m[k] = (m[k] || 0) + 1; }); return top_(m, 10); };
  const nids = {}, stays = [];
  rows.forEach(function (r) {
    if (byDay[r.day] !== undefined) byDay[r.day]++;
    const h = Number(String(r.inTime).slice(0, 2));
    if (h >= 0 && h < 24) byHour[h]++;
    if (r.nid) { const x = nids[r.nid] || (nids[r.nid] = { nid: r.nid, name: r.name, n: 0 }); x.n++; }
    if (r.outMs && r.inMs && r.outMs > r.inMs) stays.push((r.outMs - r.inMs) / 60000);
  });

  return {
    from: from, to: to, gate: gate || '',
    total: rows.length,
    unique: Object.keys(nids).length,
    insideNow: all.filter(function (r) { return !r.outMs; }).length,
    avgStayMin: stays.length ? Math.round(stays.reduce(function (a, b) { return a + b; }, 0) / stays.length) : 0,
    byDay: days.map(function (d) { return { k: d, n: byDay[d] }; }),
    byHour: byHour,
    byGate: count('sector'),
    reasons: count('reason'),
    companies: count('company'),
    dests: count('dest'),
    govs: count('gov'),
    gender: { m: rows.filter(function (r) { return r.gender === 'ذكر'; }).length, f: rows.filter(function (r) { return r.gender === 'أنثى'; }).length },
    frequent: Object.keys(nids).map(function (k) { return nids[k]; }).filter(function (x) { return x.n > 1; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 10),
    overstay: all.filter(function (r) { return !r.outMs && r.inMs && now - r.inMs > 12 * 3600e3; })
      .map(function (r) { return { name: r.name, sector: r.sector, day: r.day, inTime: r.inTime, hours: Math.floor((now - r.inMs) / 3600e3) }; })
      .slice(0, 50),
    gates: myGates_(u)
  };
}

function top_(m, n) {
  return Object.keys(m).map(function (k) { return { k: k, n: m[k] }; })
    .sort(function (a, b) { return b.n - a.n; }).slice(0, n);
}

// ================================================================ helpers

/** limit = عدد آخر السطور (0 = الكل). الأحدث الأول. */
function rows_(limit) {
  const sh = logSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const start = limit ? Math.max(2, last - limit + 1) : 2;
  const width = Math.min(HEADERS.length, sh.getLastColumn());
  const vals = sh.getRange(start, 1, last - start + 1, width).getValues();
  const out = [];
  for (let i = vals.length - 1; i >= 0; i--) {
    const v = vals[i].map(function (x, j) {
      if (j === COL['inMs'] || j === COL['outMs']) return x;
      return x instanceof Date ? Utilities.formatDate(x, TZ, j === COL['التاريخ'] || j === COL['تاريخ الميلاد'] ? 'yyyy-MM-dd' : 'HH:mm') : String(x);
    });
    if (!v[COL['ID']]) continue;
    out.push({
      id: v[COL['ID']], name: v[COL['الاسم']], nid: v[COL['الرقم القومي']],
      gender: v[COL['النوع']], gov: v[COL['المحافظة']],
      sector: v[COL['القطاع']], dest: v[COL['رايح فين']], reason: v[COL['سبب الدخول']],
      company: v[COL['الشركة / صاحب العمل']], day: v[COL['التاريخ']],
      inTime: v[COL['وقت الدخول']], outTime: v[COL['وقت الخروج']], duration: v[COL['مدة التواجد (س:د)']],
      guardIn: v[COL['فرد الأمن (دخول)']], guardOut: v[COL['فرد الأمن (خروج)']],
      inMs: Number(v[COL['inMs']]) || 0,
      outMs: Number(v[COL['outMs']]) || 0
    });
  }
  return out;
}

function parseNid_(n) {
  n = digits_(n);
  if (!/^\d{14}$/.test(n)) return null;
  const c = n.charAt(0);
  const century = c === '2' ? 1900 : c === '3' ? 2000 : null;
  if (!century) return null;
  const y = century + Number(n.slice(1, 3)), m = Number(n.slice(3, 5)), d = Number(n.slice(5, 7));
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d || dt > new Date()) return null;
  const g = n.slice(7, 9);
  if (!GOV[g]) return null;
  return { dob: y + '-' + pad_(m) + '-' + pad_(d), gov: GOV[g], gender: Number(n.charAt(12)) % 2 ? 'ذكر' : 'أنثى' };
}

/**
 * بيطلّع الاسم والرقم القومي والعنوان من نص وش البطاقة.
 * البطاقة المصري: سطرين للاسم (الاسم الأول، وبعده باقي الاسم) وبعدهم سطرين للعنوان،
 * وآخر سطر في العنوان فيه المركز/القسم والمحافظة. بنمسك في السطر ده ونعدّ لورا.
 */
function parseIdText_(text) {
  const raw = String(text || '');
  const latin = latinDigits_(raw);

  // الرقم القومي: ١٤ رقم في نفس السطر (مسموح مسافات). الأول الترتيب العادي، وبعدين المعكوس.
  const runs = (latin.match(/\d[\d \t\-]{12,40}\d/g) || []).map(function (r) { return r.replace(/\D/g, ''); });
  const pick = function (rev) {
    for (let k = 0; k < runs.length; k++) for (let i = 0; i + 14 <= runs[k].length; i++) {
      let c = runs[k].substr(i, 14);
      if (rev) c = c.split('').reverse().join('');
      if (parseNid_(c)) return c;
    }
    return '';
  };
  let nid = pick(false) || pick(true);
  if (!nid) nid = (latin.replace(/[ \t]/g, '').match(/\d{14}/) || [''])[0];

  const skip = /(جمهوري[ةه]|مصر العربي[ةه]|بطاق[ةه]|تحقيق|الشخصي[ةه]|الرقم القومي|وزار[ةه]|الداخلي[ةه]|مصلح[ةه]|الأحوال|الاحوال|المدني[ةه])/;
  const lines = raw.split(/\r?\n/)
    .map(function (l) {
      return l.replace(/[^؀-ۿ0-9\s\-\/]/g, ' ').replace(/[ً-ْـ]/g, '')
        .replace(/\s+/g, ' ').replace(/^[\s\-\/]+|[\s\-\/]+$/g, '').trim();
    })
    .filter(function (l) { return (l.match(/[ء-ي]/g) || []).length >= 2 && !skip.test(l) && !/[0-9٠-٩]{6,}/.test(l); });

  const govs = Object.keys(GOV).map(function (k) { return norm_(GOV[k]); });
  const isAddrEnd = function (l) {
    const n = norm_(l);
    return /(^|\s)(مركز|قسم|بندر|محافظه|مدينه|حي)(\s|$)/.test(n) || govs.some(function (g) { return n.indexOf(g) >= 0; });
  };
  let end = -1;
  for (let i = lines.length - 1; i >= 1; i--) if (isAddrEnd(lines[i])) { end = i; break; }

  let nameLines, addrLines;
  if (end >= 2) {
    const aStart = end - 1;                                    // العنوان = السطر اللي قبل المحافظة + سطر المحافظة
    nameLines = lines.slice(Math.max(0, aStart - 2), aStart);  // الاسم = السطرين اللي قبلهم
    addrLines = lines.slice(aStart, end + 1);
  } else if (end === 1) {                                      // الاسم سطر واحد والعنوان سطر واحد
    nameLines = lines.slice(0, 1);
    addrLines = lines.slice(1, 2);
  } else {
    nameLines = lines.slice(0, 2);
    addrLines = lines.slice(2, 4);
  }
  const name = nameLines.filter(function (l) { return !/[0-9٠-٩]/.test(l); }).join(' ').replace(/\s+/g, ' ').trim();
  const address = addrLines.join(' - ').replace(/\s*-\s*(-\s*)+/g, ' - ').trim();
  return { name: name, nationalId: nid, address: address, raw: raw.slice(0, 1500) };
}

function norm_(s) {
  return String(s || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ـ/g, '');
}
function latinDigits_(s) {
  return String(s || '')
    .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
    .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
}
function digits_(s) { return latinDigits_(s).replace(/\D/g, ''); }
function clean_(s) { return String(s == null ? '' : s).replace(/^[=+\-@]+/, '').trim().slice(0, 300); }
function pad_(n) { return (n < 10 ? '0' : '') + n; }
function dayKey_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function hm_(d) { return Utilities.formatDate(d, TZ, 'HH:mm'); }
function stamp_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm'); }
function cell_(x) { return x instanceof Date ? stamp_(x) : String(x || ''); }
function shiftDay_(key, n) {
  const p = key.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + pad_(d.getUTCMonth() + 1) + '-' + pad_(d.getUTCDate());
}
function dur_(a, b) { const m = Math.max(0, Math.round((b - a) / 60000)); return Math.floor(m / 60) + ':' + pad_(m % 60); }
function unique_(a) { const o = {}; a.forEach(function (x) { if (x) o[x] = 1; }); return Object.keys(o).sort(); }
