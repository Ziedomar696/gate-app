/**
 * مفقودات مراسي — Google Apps Script
 * البيانات في Google Sheet، والصور في فولدرات خاصة على Google Drive.
 *
 * ⚙️ SETUP_CODE: كود بيتطلب مرة واحدة بس علشان تعمل أول حساب "إدارة".
 *    غيّره لأي كلمة تختارها قبل ما تعمل Deploy.
 */
const SETUP_CODE = 'CHANGE-ME';

const TZ = 'Africa/Cairo';
const TOKEN_DAYS = 30;

const ITEMS_SHEET = 'المفقودات';
const HANDOVERS_SHEET = 'التسليمات';
const HISTORY_SHEET = 'سجل الحالات';
const USERS_SHEET = 'المستخدمين';
const PERMS_SHEET = 'الصلاحيات';
const LISTS_SHEET = 'القوائم';

const ITEM_HEADERS = ['الكود', 'النوع', 'الوصف', 'المكان', 'تاريخ العثور', 'وقت العثور',
  'اسم اللي لقاها', 'موبايل اللي لقاها', 'تبعيته', 'مشرف الأمن المستلم', 'وقت التسليم للأمن',
  'الحالة', 'سجّلها', 'وقت التسجيل', 'آخر تعديل', 'محذوف', 'صورة (Drive ID)', 'مصغّرة'];
const IC = {}; ITEM_HEADERS.forEach(function (h, i) { IC[h] = i; });
const HO_HEADERS = ['الكود', 'اسم صاحبها', 'رقم الوحدة', 'الصفة', 'الموبايل', 'ملاحظات', 'سلّمها', 'وقت التسليم', 'صورة البطاقة (Drive ID)'];
const HC = {}; HO_HEADERS.forEach(function (h, i) { HC[h] = i; });
const HIST_HEADERS = ['الكود', 'من', 'إلى', 'بواسطة', 'الوقت'];
const U_HEADERS = ['اسم المستخدم', 'الاسم', 'الدور', 'نشط', 'آخر دخول', 'تاريخ الإنشاء', 'salt', 'hash', 'ver'];

const ROLES = { admin: 'الإدارة', security: 'مشرف أمن', manager: 'مدير' };
const STATUSES = { found: 'اتلقت', office: 'في مكتب الأمن', requested: 'صاحبها سأل عليها', delivered: 'اتسلّمت لصاحبها' };
const NEXT = { found: ['office'], office: ['requested'], requested: [], delivered: [] };   // التسليم ليه خطوة خاصة
const CLAIMANT_TYPES = { owner: 'مالك', renter: 'مستأجر', visitor: 'زيارة', employee: 'موظف' };

const PERMISSIONS = {
  'items.view': 'عرض المفقودات والبحث',
  'items.create': 'تسجيل مفقود جديد',
  'items.edit': 'تعديل المفقود وتحديث حالته',
  'items.delete': 'مسح المفقود',
  'claims.view': 'عرض التسليمات وصور البطايق',
  'claims.approve': 'تسليم المفقود لصاحبه',
  'reports.view': 'عرض التقارير',
  'reports.export': 'تصدير التقارير',
  'charts.view': 'عرض الرسومات البيانية',
  'users.view': 'عرض المستخدمين',
  'users.create': 'إضافة مستخدم',
  'users.edit': 'تعديل المستخدم وكلمة السر',
  'users.deactivate': 'إيقاف / تشغيل المستخدم',
  'users.delete': 'مسح المستخدم',
  'lists.manage': 'تعديل قوائم الأنواع والأماكن'
};
const DEFAULT_PERMS = {
  security: ['items.view', 'items.create', 'items.edit', 'claims.view', 'claims.approve', 'reports.view', 'charts.view'],
  manager: ['items.view', 'claims.view', 'reports.view', 'reports.export', 'charts.view']
};

const DEFAULT_CATEGORIES = ['موبايل', 'محفظة', 'مفاتيح', 'نضارة شمس', 'نضارة سباحة', 'ساعة', 'مجوهرات', 'إكسسوارات', 'شنطة',
  'لابتوب', 'تابلت', 'كاميرا', 'سماعات', 'شاحن', 'هدوم', 'أحذية', 'لعب أطفال', 'كورة', 'كارنيهات / بطاقات', 'كروت بنك', 'فلوس',
  'مفاتيح عربية', 'شمسية', 'حاجات بحر / بسين', 'أدوات رياضية', 'أدوية / متعلقات شخصية', 'حيوان أليف', 'أخرى'];
const DEFAULT_PLACES = ['Arezzo', 'Verona', 'Isola', 'Veneto', 'Salerno', 'Catania 1', 'Catania 2', 'Greek', 'Riva lagoon', 'Riva Views',
  'Lea', 'Faya', 'Skaia', 'Altea', 'Valencia', 'Blanca 1', 'Blanca 2', 'Blanca 3', 'Blanca 4', 'Verdi', 'Vectoria', 'Marassi Bay',
  'Celia', 'Safi Sands', 'Marina 1', 'Marina 2', 'Marina Views & Front', 'Marina West', 'B.C.H', 'North beach'];

// ================================================================ web app

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('مفقودات مراسي')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** شغّلها من المحرر بعد أي تحديث: بتجهز الشيت والفولدرات. */
function setup() {
  const ss = ss_();
  itemsSheet_(); handoversSheet_(); historySheet_(); usersSheet_(); permsSheet_(); listsSheet_();
  folder_('PHOTOS_FOLDER', 'مفقودات مراسي - صور المفقودات');
  folder_('IDS_FOLDER', 'مفقودات مراسي - صور البطايق (خاص)');
  const keep = [ITEMS_SHEET, HANDOVERS_SHEET, HISTORY_SHEET, USERS_SHEET, PERMS_SHEET, LISTS_SHEET];
  ss.getSheets().forEach(function (s) {
    if (keep.indexOf(s.getName()) < 0 && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  Logger.log('الشيت جاهز: ' + ss.getUrl());
  Logger.log(needsSetup() ? 'لسه مفيش حساب إدارة: افتح التطبيق واعمل أول حساب بـ SETUP_CODE.' : 'حسابات الإدارة موجودة.');
}

function ss_() {
  let ss = null;
  try { ss = SpreadsheetApp.getActive(); } catch (e) {}
  if (ss) return ss;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  ss = SpreadsheetApp.create('مفقودات مراسي');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function folder_(key, name) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(key);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder(name);          // خاص: محدش يشوفه غير صاحب الحساب
  props.setProperty(key, f.getId());
  return f;
}

// ================================================================ sheets

const _sheets = {};
function ensureSheet_(name, headers, init) {
  if (_sheets[name]) return _sheets[name];
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  const style = function (r) { r.setFontWeight('bold').setBackground('#0F4C5C').setFontColor('#FFFFFF'); };
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
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
function itemsSheet_() {
  return ensureSheet_(ITEMS_SHEET, ITEM_HEADERS, function (sh) {
    sh.hideColumns(IC['صورة (Drive ID)'] + 1, 2);
    sh.setColumnWidth(IC['الوصف'] + 1, 260);
  });
}
function handoversSheet_() { return ensureSheet_(HANDOVERS_SHEET, HO_HEADERS, function (sh) { sh.hideColumns(HC['صورة البطاقة (Drive ID)'] + 1, 1); }); }
function historySheet_() { return ensureSheet_(HISTORY_SHEET, HIST_HEADERS); }
function usersSheet_() { return ensureSheet_(USERS_SHEET, U_HEADERS, function (sh) { sh.hideColumns(7, 3); }); }
function permsSheet_() {
  return ensureSheet_(PERMS_SHEET, ['الدور', 'الصلاحية', 'مسموح', 'الوصف'], function (sh) {
    const rows = [];
    ['security', 'manager'].forEach(function (role) {
      Object.keys(PERMISSIONS).forEach(function (p) { rows.push([role, p, DEFAULT_PERMS[role].indexOf(p) >= 0 ? 'نعم' : 'لا', ROLES[role] + ' — ' + PERMISSIONS[p]]); });
    });
    sh.getRange(2, 1, rows.length, 4).setValues(rows);
  });
}
function listsSheet_() {
  return ensureSheet_(LISTS_SHEET, ['القائمة', 'القيمة', 'نشط'], function (sh) {
    const rows = DEFAULT_CATEGORIES.map(function (c) { return ['نوع', c, 'نعم']; })
      .concat(DEFAULT_PLACES.map(function (p) { return ['مكان', p, 'نعم']; }));
    sh.getRange(2, 1, rows.length, 3).setValues(rows);
  });
}

function values_(sh, width) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, width).getValues().map(function (r) {
    return r.map(function (x) { return x instanceof Date ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd HH:mm') : x; });
  });
}

// ================================================================ users & auth

function users_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('users');
  if (hit) return JSON.parse(hit);
  const out = [];
  values_(usersSheet_(), U_HEADERS.length).forEach(function (r, i) {
    if (!r[0]) return;
    out.push({ row: i + 2, username: String(r[0]).trim().toLowerCase(), name: String(r[1]), role: roleKey_(r[2]),
      active: String(r[3]).trim() !== 'لا', lastLogin: String(r[4] || ''), created: String(r[5] || ''),
      salt: String(r[6]), hash: String(r[7]), ver: Number(r[8]) || 1 });
  });
  cache.put('users', JSON.stringify(out), 300);
  return out;
}
function dropCache_(k) { CacheService.getScriptCache().remove(k); }
function findUser_(username) {
  username = String(username || '').trim().toLowerCase();
  return users_().filter(function (u) { return u.username === username; })[0] || null;
}
function roleKey_(v) {
  v = String(v || '').trim();
  for (const k in ROLES) if (k === v || ROLES[k] === v) return k;
  return 'security';
}
function publicUser_(u) {
  return { username: u.username, name: u.name, role: u.role, roleLabel: ROLES[u.role], active: u.active, lastLogin: u.lastLogin, created: u.created };
}

function hash_(salt, pw) {
  let h = String(pw);
  for (let i = 0; i < 50; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + h, Utilities.Charset.UTF_8));
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

/** perms_(): { security: {perm: true}, manager: {...} } — الإدارة ليها كل حاجة. */
function perms_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('perms');
  if (hit) return JSON.parse(hit);
  const out = { security: {}, manager: {} };
  values_(permsSheet_(), 3).forEach(function (r) {
    const role = roleKey_(r[0]);
    if (out[role] && PERMISSIONS[r[1]]) out[role][r[1]] = String(r[2]).trim() === 'نعم';
  });
  cache.put('perms', JSON.stringify(out), 300);
  return out;
}
function can_(u, perm) { return u.role === 'admin' || !!(perms_()[u.role] || {})[perm]; }
function myPerms_(u) { return Object.keys(PERMISSIONS).filter(function (p) { return can_(u, p); }); }

/** بيرجع المستخدم أو بيرمي AUTH. perm اختياري. */
function auth_(token, perm) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('AUTH');
  let p;
  try { p = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString(); } catch (e) { throw new Error('AUTH'); }
  if (sign_(p) !== parts[1]) throw new Error('AUTH');
  const f = p.split('|');
  if (Number(f[1]) < Date.now()) throw new Error('AUTH');
  const u = findUser_(f[0]);
  if (!u || !u.active || String(u.ver) !== f[2]) throw new Error('AUTH');
  if (perm && !can_(u, perm)) throw new Error('مش مسموح لحسابك بالعملية دي.');
  return u;
}

function lists_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('lists');
  if (hit) return JSON.parse(hit);
  const out = { categories: [], places: [], all: [] };
  values_(listsSheet_(), 3).forEach(function (r) {
    const kind = String(r[0]).trim(), val = String(r[1]).trim(), on = String(r[2]).trim() !== 'لا';
    if (!val) return;
    out.all.push({ kind: kind === 'مكان' ? 'place' : 'category', value: val, active: on });
    if (on) (kind === 'مكان' ? out.places : out.categories).push(val);
  });
  cache.put('lists', JSON.stringify(out), 300);
  return out;
}

function boot_(u) {
  const l = lists_();
  return { me: publicUser_(u), perms: myPerms_(u), categories: l.categories, places: l.places,
    statuses: STATUSES, claimantTypes: CLAIMANT_TYPES };
}

// ---------------------------------------------------------------- login

function needsSetup() { return !users_().some(function (u) { return u.role === 'admin' && u.active; }); }

function setupAdmin(code, username, name, password) {
  if (SETUP_CODE === 'CHANGE-ME') throw new Error('غيّر SETUP_CODE في أول ملف Code.gs واعمل Deploy بنسخة جديدة الأول.');
  if (String(code || '').trim() !== SETUP_CODE) throw new Error('كود التفعيل غلط.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (!needsSetup()) throw new Error('حساب الإدارة معمول قبل كده. سجّل دخول.');
    writeUser_({ username: username, name: name, role: 'admin', active: true, password: password }, true);
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
  try { usersSheet_().getRange(u.row, 5).setValue(stamp_(new Date())); dropCache_('users'); } catch (e) {}
  const out = boot_(u); out.token = makeToken_(u);
  return out;
}

function whoami(token) { return boot_(auth_(token)); }

function changeMyPassword(token, oldPw, newPw) {
  const u = auth_(token);
  if (hash_(u.salt, oldPw) !== u.hash) throw new Error('كلمة السر الحالية غلط.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { writeUser_({ username: u.username, name: u.name, role: u.role, active: true, password: newPw }, false); }
  finally { lock.releaseLock(); }
  return makeToken_(findUser_(u.username));
}

// ---------------------------------------------------------------- admin: users, permissions, lists

function usersData(token) {
  const me = auth_(token, 'users.view');
  return { users: users_().map(publicUser_), roles: ROLES,
    can: { create: can_(me, 'users.create'), edit: can_(me, 'users.edit'), deactivate: can_(me, 'users.deactivate'), del: can_(me, 'users.delete') },
    permissions: PERMISSIONS, matrix: perms_(), canPerms: me.role === 'admin',
    lists: lists_().all, canLists: can_(me, 'lists.manage') };
}

function saveUser(token, d) {
  const me = auth_(token, d.isNew ? 'users.create' : 'users.view');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const target = findUser_(d.username);
    if (!d.isNew) {
      if (!target) throw new Error('المستخدم مش موجود.');
      const editing = d.name !== target.name || roleKey_(d.role) !== target.role || !!d.password;
      if (editing && !can_(me, 'users.edit')) throw new Error('مش مسموح لحسابك تعدّل المستخدمين.');
      if ((d.active !== false) !== target.active && !can_(me, 'users.deactivate')) throw new Error('مش مسموح لحسابك توقف أو تشغّل المستخدمين.');
      if (roleKey_(d.role) === 'admin' && target.role !== 'admin' && me.role !== 'admin') throw new Error('الإدارة بس اللي تدّي دور الإدارة.');
      if (target.role === 'admin' && me.role !== 'admin') throw new Error('الإدارة بس اللي تعدّل حساب إدارة.');
      lastAdminGuard_(target, roleKey_(d.role) !== 'admin' || d.active === false);
    } else if (roleKey_(d.role) === 'admin' && me.role !== 'admin') {
      throw new Error('الإدارة بس اللي تعمل حساب إدارة.');
    }
    writeUser_(d, !!d.isNew);
  } finally { lock.releaseLock(); }
  return usersData(token);
}

function deleteUser(token, username) {
  const me = auth_(token, 'users.delete');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = findUser_(username);
    if (!t) throw new Error('المستخدم مش موجود.');
    if (t.username === me.username) throw new Error('مينفعش تمسح حسابك.');
    if (t.role === 'admin' && me.role !== 'admin') throw new Error('الإدارة بس اللي تمسح حساب إدارة.');
    lastAdminGuard_(t, true);
    usersSheet_().deleteRow(t.row);
    dropCache_('users');
  } finally { lock.releaseLock(); }
  return usersData(token);
}

function lastAdminGuard_(target, removing) {
  if (target.role !== 'admin' || !removing) return;
  const others = users_().filter(function (u) { return u.role === 'admin' && u.active && u.username !== target.username; });
  if (!others.length) throw new Error('لازم يفضل حساب إدارة واحد على الأقل شغال.');
}

function writeUser_(d, isNew) {
  const username = String(d.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('اسم المستخدم لازم يكون ٣ حروف على الأقل، إنجليزي صغير أو أرقام (مثال: ahmed.sec).');
  const name = clean_(d.name) || username;
  const role = roleKey_(d.role);
  const active = d.active !== false;
  const existing = findUser_(username);
  if (isNew && existing) throw new Error('اسم المستخدم ده موجود قبل كده.');
  if (!isNew && !existing) throw new Error('المستخدم مش موجود.');
  const pw = String(d.password || '');
  if ((isNew || pw) && pw.length < 6) throw new Error('كلمة السر لازم تبقى ٦ حروف أو أرقام على الأقل.');
  let salt = existing ? existing.salt : '', hash = existing ? existing.hash : '', ver = existing ? existing.ver : 1;
  if (pw) { salt = Utilities.getUuid(); hash = hash_(salt, pw); if (existing) ver++; }
  if (existing && existing.active && !active) ver++;
  if (existing && existing.role !== role) ver++;
  const row = [username, name, ROLES[role], active ? 'نعم' : 'لا', existing ? existing.lastLogin : '', existing ? existing.created : stamp_(new Date()), salt, hash, String(ver)];
  const sh = usersSheet_();
  if (existing) sh.getRange(existing.row, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  dropCache_('users');
}

function savePermission(token, role, perm, allowed) {
  const me = auth_(token);
  if (me.role !== 'admin') throw new Error('الإدارة بس اللي تعدّل الصلاحيات.');
  role = roleKey_(role);
  if (role === 'admin' || !PERMISSIONS[perm]) throw new Error('صلاحية غير صحيحة.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = permsSheet_();
    const rows = values_(sh, 2);
    let r = -1;
    rows.forEach(function (x, i) { if (roleKey_(x[0]) === role && x[1] === perm) r = i + 2; });
    if (r > 0) sh.getRange(r, 3).setValue(allowed ? 'نعم' : 'لا');
    else sh.appendRow([role, perm, allowed ? 'نعم' : 'لا', ROLES[role] + ' — ' + PERMISSIONS[perm]]);
    dropCache_('perms');
  } finally { lock.releaseLock(); }
  return usersData(token);
}

function saveListValue(token, kind, value, active) {
  auth_(token, 'lists.manage');
  value = clean_(value);
  if (!value) throw new Error('اكتب القيمة.');
  const label = kind === 'place' ? 'مكان' : 'نوع';
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = listsSheet_();
    let r = -1;
    values_(sh, 2).forEach(function (x, i) { if (String(x[0]).trim() === label && String(x[1]).trim() === value) r = i + 2; });
    if (r > 0) sh.getRange(r, 3).setValue(active === false ? 'لا' : 'نعم');
    else sh.appendRow([label, value, 'نعم']);
    dropCache_('lists');
  } finally { lock.releaseLock(); }
  return usersData(token);
}

// ================================================================ items

function statusKey_(v) {
  v = String(v || '').trim();
  for (const k in STATUSES) if (k === v || STATUSES[k] === v) return k;
  return 'found';
}

/** كل المفقودات (غير الممسوحة)، الأحدث الأول. withThumb لإرجاع الصورة المصغّرة. */
function items_(withThumb) {
  const out = [];
  const rows = values_(itemsSheet_(), ITEM_HEADERS.length);
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (!r[IC['الكود']] || String(r[IC['محذوف']] || '').trim()) continue;
    out.push({
      row: i + 2, code: String(r[IC['الكود']]), category: String(r[IC['النوع']]), description: String(r[IC['الوصف']]),
      place: String(r[IC['المكان']]), date: String(r[IC['تاريخ العثور']]).slice(0, 10), time: String(r[IC['وقت العثور']]).slice(-5),
      finderName: String(r[IC['اسم اللي لقاها']]), finderPhone: String(r[IC['موبايل اللي لقاها']]), finderType: String(r[IC['تبعيته']]),
      supervisor: String(r[IC['مشرف الأمن المستلم']]), officeAt: String(r[IC['وقت التسليم للأمن']]),
      status: statusKey_(r[IC['الحالة']]), by: String(r[IC['سجّلها']]), createdAt: String(r[IC['وقت التسجيل']]),
      edited: String(r[IC['آخر تعديل']] || ''), hasPhoto: !!String(r[IC['صورة (Drive ID)']] || '').trim(),
      photoId: String(r[IC['صورة (Drive ID)']] || ''), thumb: withThumb ? String(r[IC['مصغّرة']] || '') : ''
    });
  }
  return out;
}
function item_(code) { return items_(true).filter(function (x) { return x.code === code; })[0] || null; }
function clientItem_(x) { const o = Object.assign({}, x); delete o.row; delete o.photoId; return o; }

function matches_(x, f) {
  f = f || {};
  if (f.status && x.status !== f.status) return false;
  if (f.category && x.category !== f.category) return false;
  if (f.place && x.place !== f.place) return false;
  if (f.from && x.date < f.from) return false;
  if (f.to && x.date > f.to) return false;
  if (f.q) {
    const q = String(f.q).toLowerCase();
    if ([x.code, x.description, x.category, x.place, x.finderName, x.supervisor].join(' ').toLowerCase().indexOf(q) < 0) return false;
  }
  return true;
}

function listItems(token, f, offset, limit) {
  auth_(token, 'items.view');
  const all = items_(true);
  const rows = all.filter(function (x) { return matches_(x, f); });
  offset = Number(offset) || 0; limit = Math.min(Number(limit) || 30, 100);
  const today = dayKey_(new Date());
  const count = function (s) { return all.filter(function (x) { return x.status === s; }).length; };
  return {
    total: rows.length,
    items: rows.slice(offset, offset + limit).map(clientItem_),
    stats: { all: all.length, found: count('found'), office: count('office'), requested: count('requested'), delivered: count('delivered'),
      today: all.filter(function (x) { return x.date === today; }).length }
  };
}

function getItem(token, code) {
  const u = auth_(token, 'items.view');
  const x = item_(code);
  if (!x) throw new Error('المفقود ده مش موجود.');
  const hist = values_(historySheet_(), HIST_HEADERS.length).filter(function (r) { return r[0] === code; })
    .map(function (r) { return { from: statusKey_(r[1]), to: statusKey_(r[2]), by: String(r[3]), at: String(r[4]) }; });
  let ho = null;
  if (can_(u, 'claims.view')) {
    const h = handovers_().filter(function (r) { return r.code === code; })[0];
    if (h) { ho = Object.assign({}, h); delete ho.idPhotoId; delete ho.row; }
  }
  return { item: clientItem_(x), history: hist, handover: ho, next: NEXT[x.status] || [] };
}

/** الصورة الكاملة للمفقود (base64). */
function getPhoto(token, code) {
  auth_(token, 'items.view');
  const x = item_(code);
  if (!x || !x.photoId) return '';
  return 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(x.photoId).getBlob().getBytes());
}

function savePhoto_(dataUrl, folderKey, folderName, name) {
  const m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return '';
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 6 * 1024 * 1024) throw new Error('الصورة كبيرة قوي.');
  return folder_(folderKey, folderName).createFile(Utilities.newBlob(bytes, m[1], name + '.jpg')).getId();
}

function nextCode_() {
  const prefix = 'LF-' + Utilities.formatDate(new Date(), TZ, 'yyyy') + '-';
  let max = 0;
  values_(itemsSheet_(), 1).forEach(function (r) {
    const c = String(r[0]);
    if (c.indexOf(prefix) === 0) max = Math.max(max, Number(c.slice(prefix.length)) || 0);
  });
  return prefix + ('000000' + (max + 1)).slice(-6);
}

function itemFields_(d) {
  const category = clean_(d.category), place = clean_(d.place);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : '';
  const time = /^\d{2}:\d{2}$/.test(d.time || '') ? d.time : '';
  if (!category) throw new Error('اختار نوع الحاجة.');
  if (!place) throw new Error('اختار المكان.');
  if (!date || !time) throw new Error('اكتب تاريخ ووقت العثور.');
  return { category: category, place: place, date: date, time: time, description: clean_(d.description, 1000),
    finderName: clean_(d.finderName), finderPhone: digits_(d.finderPhone), finderType: clean_(d.finderType), supervisor: clean_(d.supervisor), toOffice: d.toOffice === true };
}

function createItem(token, d, photo, thumb) {
  const u = auth_(token, 'items.create');
  const f = itemFields_(d);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const code = nextCode_();
    const photoId = photo ? savePhoto_(photo, 'PHOTOS_FOLDER', 'مفقودات مراسي - صور المفقودات', code) : '';
    const now = stamp_(new Date());
    // الحاجة بتبقى "في مكتب الأمن" بس لما يتعلّم إنها اتسلّمت، واسم المشرف لوحده مش كفاية
    if (f.toOffice && !f.supervisor) throw new Error('اكتب اسم مشرف الأمن اللي استلمها.');
    const status = f.toOffice ? 'office' : 'found';
    const row = new Array(ITEM_HEADERS.length).fill('');
    row[IC['الكود']] = code; row[IC['النوع']] = f.category; row[IC['الوصف']] = f.description; row[IC['المكان']] = f.place;
    row[IC['تاريخ العثور']] = "'" + f.date; row[IC['وقت العثور']] = "'" + f.time;
    row[IC['اسم اللي لقاها']] = f.finderName; row[IC['موبايل اللي لقاها']] = f.finderPhone ? "'" + f.finderPhone : ''; row[IC['تبعيته']] = f.finderType;
    row[IC['مشرف الأمن المستلم']] = f.supervisor; row[IC['وقت التسليم للأمن']] = f.toOffice ? now : '';
    row[IC['الحالة']] = STATUSES[status]; row[IC['سجّلها']] = u.name + ' (' + u.username + ')'; row[IC['وقت التسجيل']] = now;
    row[IC['صورة (Drive ID)']] = photoId; row[IC['مصغّرة']] = /^data:image\/jpeg;base64,/.test(thumb || '') && thumb.length < 45000 ? thumb : '';
    itemsSheet_().appendRow(row);
    history_(code, '', status, u);
    return { code: code };
  } finally { lock.releaseLock(); }
}

function updateItem(token, code, d, photo, thumb) {
  const u = auth_(token, 'items.edit');
  const f = itemFields_(d);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const x = item_(code);
    if (!x) throw new Error('المفقود ده مش موجود.');
    const sh = itemsSheet_();
    const set = function (h, v) { sh.getRange(x.row, IC[h] + 1).setValue(v); };
    set('النوع', f.category); set('الوصف', f.description); set('المكان', f.place); set('تاريخ العثور', "'" + f.date); set('وقت العثور', "'" + f.time);
    set('اسم اللي لقاها', f.finderName); set('موبايل اللي لقاها', f.finderPhone ? "'" + f.finderPhone : ''); set('تبعيته', f.finderType);
    if (f.supervisor) set('مشرف الأمن المستلم', f.supervisor);
    if (f.toOffice && x.status === 'found') {
      if (!f.supervisor && !x.supervisor) throw new Error('اكتب اسم مشرف الأمن اللي استلمها.');
      set('وقت التسليم للأمن', stamp_(new Date()));
      set('الحالة', STATUSES.office);
      history_(code, 'found', 'office', u);
    }
    if (photo) {
      set('صورة (Drive ID)', savePhoto_(photo, 'PHOTOS_FOLDER', 'مفقودات مراسي - صور المفقودات', code));
      set('مصغّرة', /^data:image\/jpeg;base64,/.test(thumb || '') && thumb.length < 45000 ? thumb : '');
      if (x.photoId) { try { DriveApp.getFileById(x.photoId).setTrashed(true); } catch (e) {} }
    }
    set('آخر تعديل', u.username + ' ' + stamp_(new Date()));
    return getItem(token, code);
  } finally { lock.releaseLock(); }
}

function setStatus(token, code, status, supervisor) {
  const u = auth_(token, 'items.edit');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const x = item_(code);
    if (!x) throw new Error('المفقود ده مش موجود.');
    if ((NEXT[x.status] || []).indexOf(status) < 0) throw new Error('مينفعش تنقل للحالة دي قبل ما تخلّص الخطوة اللي قبلها.');
    const sh = itemsSheet_();
    if (status === 'office') {
      const sup = clean_(supervisor) || x.supervisor;
      if (!sup) throw new Error('اكتب اسم مشرف الأمن اللي استلمها.');
      sh.getRange(x.row, IC['مشرف الأمن المستلم'] + 1).setValue(sup);
      sh.getRange(x.row, IC['وقت التسليم للأمن'] + 1).setValue(stamp_(new Date()));
    }
    sh.getRange(x.row, IC['الحالة'] + 1).setValue(STATUSES[status]);
    history_(code, x.status, status, u);
  } finally { lock.releaseLock(); }
  return getItem(token, code);
}

function deleteItem(token, code) {
  const u = auth_(token, 'items.delete');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const x = item_(code);
    if (!x) throw new Error('المفقود ده مش موجود.');
    itemsSheet_().getRange(x.row, IC['محذوف'] + 1).setValue(u.username + ' ' + stamp_(new Date()));
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function history_(code, from, to, u) {
  historySheet_().appendRow([code, from ? STATUSES[from] : '', STATUSES[to], u.name + ' (' + u.username + ')', stamp_(new Date())]);
}

// ================================================================ handover (security only)

function handovers_() {
  return values_(handoversSheet_(), HO_HEADERS.length).map(function (r, i) {
    return { row: i + 2, code: String(r[HC['الكود']]), name: String(r[HC['اسم صاحبها']]), unit: String(r[HC['رقم الوحدة']]),
      type: String(r[HC['الصفة']]), phone: String(r[HC['الموبايل']]), note: String(r[HC['ملاحظات']]), by: String(r[HC['سلّمها']]),
      at: String(r[HC['وقت التسليم']]), idPhotoId: String(r[HC['صورة البطاقة (Drive ID)']] || '') };
  }).filter(function (h) { return h.code; }).reverse();
}

function handover(token, code, d, idPhoto) {
  const u = auth_(token, 'claims.approve');
  const name = clean_(d.name), unit = clean_(d.unit), phone = digits_(d.phone), note = clean_(d.note, 500);
  const type = CLAIMANT_TYPES[d.type] ? d.type : '';
  if (!name || !unit || !type || !phone) throw new Error('من فضلك أكمل بيانات صاحب الحاجة.');
  if (!idPhoto) throw new Error('صوّر الـ ID أو الـ Application بتاع صاحبها.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const x = item_(code);
    if (!x) throw new Error('المفقود ده مش موجود.');
    if (x.status === 'delivered') throw new Error('المفقود ده اتسلّم لصاحبه قبل كده.');
    if (x.status !== 'office' && x.status !== 'requested') throw new Error('لازم الحاجة تكون متسلّمة لمكتب الأمن الأول قبل ما تتسلّم لصاحبها.');
    const idId = savePhoto_(idPhoto, 'IDS_FOLDER', 'مفقودات مراسي - صور البطايق (خاص)', 'id_' + code);
    if (!idId) throw new Error('صورة البطاقة مش مظبوطة. صوّر تاني.');
    const now = stamp_(new Date());
    handoversSheet_().appendRow([code, name, unit, CLAIMANT_TYPES[type], "'" + phone, note, u.name + ' (' + u.username + ')', now, idId]);
    itemsSheet_().getRange(x.row, IC['الحالة'] + 1).setValue(STATUSES.delivered);
    history_(code, x.status, 'delivered', u);
  } finally { lock.releaseLock(); }
  return getItem(token, code);
}

function listHandovers(token) {
  auth_(token, 'claims.view');
  const items = {};
  items_(false).forEach(function (x) { items[x.code] = x; });
  return handovers_().filter(function (h) { return items[h.code]; }).slice(0, 300).map(function (h) {
    return { code: h.code, category: items[h.code].category, name: h.name, unit: h.unit, type: h.type, phone: h.phone,
      note: h.note, by: h.by, at: h.at, hasId: !!h.idPhotoId };
  });
}

function getIdPhoto(token, code) {
  auth_(token, 'claims.view');
  const h = handovers_().filter(function (r) { return r.code === code; })[0];
  if (!h || !h.idPhotoId) return '';
  return 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(h.idPhotoId).getBlob().getBytes());
}

// ================================================================ reports & charts

function reportRows_(f) {
  return items_(false).filter(function (x) { return matches_(x, f); });
}

function getReport(token, f) {
  const u = auth_(token, 'reports.view');
  const rows = reportRows_(f);
  const ho = {};
  handovers_().forEach(function (h) { if (!ho[h.code]) ho[h.code] = h; });
  return {
    total: rows.length,
    byStatus: Object.keys(STATUSES).map(function (k) { return { k: k, n: rows.filter(function (x) { return x.status === k; }).length }; }),
    rows: rows.slice(0, 500).map(function (x) {
      const h = ho[x.code];
      return { code: x.code, category: x.category, place: x.place, date: x.date, time: x.time, status: x.status,
        description: x.description, finderName: x.finderName, supervisor: x.supervisor, owner: h ? h.name + ' — ' + h.unit : '' };
    }),
    more: Math.max(0, rows.length - 500),
    canExport: can_(u, 'reports.export')
  };
}

/** كل الصفوف للتصدير (CSV). */
function exportRows(token, f) {
  auth_(token, 'reports.export');
  const ho = {};
  handovers_().forEach(function (h) { if (!ho[h.code]) ho[h.code] = h; });
  const head = ['الكود', 'النوع', 'الوصف', 'المكان', 'تاريخ العثور', 'وقت العثور', 'الحالة', 'اسم اللي لقاها', 'موبايل اللي لقاها', 'تبعيته',
    'مشرف الأمن المستلم', 'وقت التسليم للأمن', 'سجّلها', 'اسم صاحبها', 'رقم الوحدة', 'الصفة', 'موبايل صاحبها', 'سلّمها', 'وقت التسليم'];
  return [head].concat(reportRows_(f).map(function (x) {
    const h = ho[x.code] || {};
    return [x.code, x.category, x.description, x.place, x.date, x.time, STATUSES[x.status], x.finderName, x.finderPhone, x.finderType,
      x.supervisor, x.officeAt, x.by, h.name || '', h.unit || '', h.type || '', h.phone || '', h.by || '', h.at || ''];
  }));
}

function getCharts(token, f) {
  auth_(token, 'charts.view');
  f = f || {};
  const today = dayKey_(new Date());
  const to = /^\d{4}-\d{2}-\d{2}$/.test(f.to || '') ? f.to : today;
  let from = /^\d{4}-\d{2}-\d{2}$/.test(f.from || '') ? f.from : shiftDay_(to, -29);
  if (shiftDay_(from, 366) < to) from = shiftDay_(to, -366);
  const rows = reportRows_({ from: from, to: to, category: f.category, place: f.place });
  const count = function (key) { const m = {}; rows.forEach(function (x) { const k = x[key] || 'غير محدد'; m[k] = (m[k] || 0) + 1; }); return top_(m, 12); };
  const days = [], byDay = {};
  for (let d = from; d <= to; d = shiftDay_(d, 1)) { days.push(d); byDay[d] = 0; }
  rows.forEach(function (x) { if (byDay[x.date] !== undefined) byDay[x.date]++; });
  const delivered = rows.filter(function (x) { return x.status === 'delivered'; }).length;
  return {
    from: from, to: to, total: rows.length, delivered: delivered,
    open: rows.filter(function (x) { return x.status !== 'delivered'; }).length,
    rate: rows.length ? Math.round(delivered / rows.length * 100) : 0,
    byDay: days.map(function (d) { return { k: d, n: byDay[d] }; }),
    byCategory: count('category'), byPlace: count('place'),
    byStatus: Object.keys(STATUSES).map(function (k) { return { k: STATUSES[k], n: rows.filter(function (x) { return x.status === k; }).length }; })
  };
}

function top_(m, n) {
  return Object.keys(m).map(function (k) { return { k: k, n: m[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, n);
}

// ================================================================ helpers

function latinDigits_(s) {
  return String(s || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
}
function digits_(s) { return latinDigits_(s).replace(/\D/g, ''); }
function clean_(s, max) { return String(s == null ? '' : s).replace(/^[=+\-@]+/, '').trim().slice(0, max || 300); }
function pad_(n) { return (n < 10 ? '0' : '') + n; }
function dayKey_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function stamp_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm'); }
function shiftDay_(key, n) {
  const p = key.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + pad_(d.getUTCMonth() + 1) + '-' + pad_(d.getUTCDate());
}
