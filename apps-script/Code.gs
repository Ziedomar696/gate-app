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
const ALERT_HOURS = 8;              // بعد كام ساعة جوه يتبعت تنبيه للإدارة
const ROLES = { admin: 'الإدارة', manager: 'مدير', gate: 'فرد أمن' };
const REASONS_SHEET = 'أسباب الدخول';
const COMPANIES_SHEET = 'الشركات';
const PERMITS_SHEET = 'التصاريح';
// نفس أعمدة ملف التصدير من سيستم الايديهات + مصدر الملف وتاريخ الرفع
const P_HEADERS = ['الرقم التعريفي', 'الاسم', 'رقم البطاقة', 'اسم الشركة', 'مكان العمل', 'اسم البوابة', 'تاريخ بدء التصريح', 'تاريخ نهاية التصريح', 'الحالة', 'الصورة', 'الملف', 'آخر تحديث'];
const PC = {}; P_HEADERS.forEach(function (h, i) { PC[h] = i; });
const PERMIT_WARN_DAYS = 7;
const DEFAULT_COMPANIES = [
  'الأصالة', 'الرواد', 'اليكس بيلدرز', 'ألفا رونكس', 'الرؤى', 'ابيكس', 'ابليونا', 'Asym',
  'ATS', 'برازر', 'بي تي سي', 'كابس', 'كير كيمكال', 'كيريتف', 'دغش', 'دار الهندسة',
  'دي ماس', 'دي سكفري', 'Dore Tent', 'ابداع اوت دور', 'ايكو بيزنس', 'ايدن', 'EFS', 'إيجي بلانكو',
  'egytam', 'الفارس', 'السويدي', 'ETS', 'فاروس', 'فاستر', 'فيبر مصر', 'جولف سكيب',
  'حورس', 'ايتوس', 'انتركوم', 'جينت', 'القاسم', 'الخرافي', 'KMA', 'كوني',
  'ليجند', 'مارين', 'مودرن', 'MRE', 'نيو فيجن', 'اوت دوورز', 'رؤيا', 'روسيل',
  'صلاحكم', 'شنايدر', 'TKE', 'توب 10', 'Vee tech', 'فيوليا', 'ويفز', 'ويسترن',
  'البيت المصري', 'الشاطر', 'الشركة المتحدة للمقاولات العامة', 'المتحدة', 'المستقبل', 'في الخدمة', 'تابع لمالك الوحدة'];
// الأسماء القديمة (إنجليزي) → العربي: بتتغير مرة واحدة في شيت الشركات وفي السجل القديم.
const COMPANY_RENAMES = [
  ['Al Asala', 'الأصالة'],
  ['Al Rowad', 'الرواد'],
  ['Alex builders', 'اليكس بيلدرز'],
  ['Alpha Ronix', 'ألفا رونكس'],
  ['Alruaa', 'الرؤى'],
  ['Apex', 'ابيكس'],
  ['Apleona', 'ابليونا'],
  ['Brother', 'برازر'],
  ['BTC', 'بي تي سي'],
  ['CABS', 'كابس'],
  ['Care-Chemical', 'كير كيمكال'],
  ['Creative', 'كيريتف'],
  ['Daghash', 'دغش'],
  ['Dar Al Handsa', 'دار الهندسة'],
  ['De Mas', 'دي ماس'],
  ['Discovery', 'دي سكفري'],
  ['EbdaaOutdoor', 'ابداع اوت دور'],
  ['Eco business', 'ايكو بيزنس'],
  ['Eden', 'ايدن'],
  ['Egy Blanco', 'إيجي بلانكو'],
  ['El Fares', 'الفارس'],
  ['elsewedy', 'السويدي'],
  ['Faros', 'فاروس'],
  ['Faster', 'فاستر'],
  ['Fibermisr', 'فيبر مصر'],
  ['Golfscape', 'جولف سكيب'],
  ['Horus', 'حورس'],
  ['Ietos', 'ايتوس'],
  ['Intercom', 'انتركوم'],
  ['Jennet', 'جينت'],
  ['Kassem', 'القاسم'],
  ['Kharafi National', 'الخرافي'],
  ['Kone', 'كوني'],
  ['Legend', 'ليجند'],
  ['Marine', 'مارين'],
  ['Modern', 'مودرن'],
  ['New Vision', 'نيو فيجن'],
  ['OutDoors', 'اوت دوورز'],
  ['Roya', 'رؤيا'],
  ['Russell', 'روسيل'],
  ['Salahcom', 'صلاحكم'],
  ['Schnieder', 'شنايدر'],
  ['TOP 10', 'توب 10'],
  ['Veolia', 'فيوليا'],
  ['Waves', 'ويفز'],
  ['western', 'ويسترن']];
const DEFAULT_REASONS = ['أعمال صيانة', 'تشطيبات', 'نظافة', 'زراعة وحدائق', 'توريد / توصيل', 'نقل عفش',
  'حمامات سباحة', 'مختصين الزراعة التابعين للوحدات', 'السواقين التابعين للوحدات', 'المفوضين التابعين للوحدات', 'الدليفري'];

const HEADERS = [
  'الاسم', 'الرقم القومي', 'تاريخ الميلاد', 'النوع', 'المحافظة', 'العنوان',
  'القطاع', 'رايح فين', 'سبب الدخول', 'الشركة / صاحب العمل', 'ملاحظات',
  'التاريخ', 'وقت الدخول', 'وقت الخروج', 'مدة التواجد (س:د)',
  'فرد الأمن (دخول)', 'فرد الأمن (خروج)',
  'ID', 'inMs', 'outMs',
  'حساب الدخول', 'حساب الخروج',
  'رقم اللوحة', 'المركبة', 'لون المركبة',
  'آخر تعديل', 'محذوف',
  'تنبيه التأخير',
  'التصريح'
];
// ترتيب الأعمدة القديم (قبل ما عمود الموبايل يتشال) — بيستخدمه إصلاح الشيت بس.
const OLD_HEADERS = HEADERS.slice(0, 6).concat(['رقم الموبايل'], HEADERS.slice(6));
// مكان كل عمود بيتقري من أسماء العناوين في الشيت نفسه، فلو عمود اتمسح أو اتنقل البرنامج مش بيتلخبط.
const COL = {};
HEADERS.forEach(function (h, i) { COL[h] = i; });
let LOG_W = HEADERS.length;
const U_HEADERS = ['اسم المستخدم', 'الاسم', 'الدور', 'البوابات', 'نشط', 'آخر دخول', 'تاريخ الإنشاء', 'salt', 'hash', 'ver', 'الإيميل'];
const G_HEADERS = ['البوابة', 'نشطة'];

const GOV = {"01":"القاهرة","02":"الإسكندرية","03":"بورسعيد","04":"السويس","11":"دمياط","12":"الدقهلية","13":"الشرقية","14":"القليوبية","15":"كفر الشيخ","16":"الغربية","17":"المنوفية","18":"البحيرة","19":"الإسماعيلية","21":"الجيزة","22":"بني سويف","23":"الفيوم","24":"المنيا","25":"أسيوط","26":"سوهاج","27":"قنا","28":"أسوان","29":"الأقصر","31":"البحر الأحمر","32":"الوادي الجديد","33":"مطروح","34":"شمال سيناء","35":"جنوب سيناء","88":"مواليد خارج مصر"};

// ================================================================ web app

function doGet() {
  autoRepair_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('سجل بوابة الأفراد')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** شغّلها من المحرر بعد أي تحديث: بتجهز كل الشيتات. */
function setup() {
  const ss = ss_();
  logSheet_(); usersSheet_(); gatesSheet_(); reasonsSheet_(); companiesSheet_(); permitsSheet_();
  repairColumns();
  if (!PropertiesService.getScriptProperties().getProperty('COMPANIES_AR')) renameCompanies();
  installAlertTrigger_();
  ss.getSheets().forEach(function (s) {
    if ([LOG_SHEET, USERS_SHEET, GATES_SHEET, REASONS_SHEET, COMPANIES_SHEET, PERMITS_SHEET].indexOf(s.getName()) < 0 && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
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
    const have = w ? sh.getRange(1, 1, 1, w).getValues()[0].map(function (x) { return String(x).trim(); }) : [];
    const missing = headers.filter(function (h) { return have.indexOf(h) < 0; });
    if (missing.length) style(sh.getRange(1, w + 1, 1, missing.length).setValues([missing]));
  }
  _sheets[name] = sh;
  return sh;
}

function logSheet_() {
  const fresh = !_sheets[LOG_SHEET];
  const sh = ensureSheet_(LOG_SHEET, HEADERS, initLog_);
  if (fresh) mapColumns_(sh);
  return sh;
}
/** بيقرا صف العناوين ويحدد مكان كل عمود باسمه. */
function mapColumns_(sh) {
  const w = sh.getLastColumn();
  const head = sh.getRange(1, 1, 1, w).getValues()[0].map(function (x) { return String(x).trim(); });
  HEADERS.forEach(function (h) { const i = head.indexOf(h); if (i >= 0) COL[h] = i; });
  LOG_W = w;
}

/**
 * إصلاح الشيت بعد مسح عمود الموبايل يدوي:
 * - السطور اللي اتسجلت بعد المسح بالترتيب القديم بترجع لأماكنها الصح.
 * - الأعمدة المتكررة (زي "تنبيه التأخير") بتتدمج وبيتمسح التكرار.
 * بتشتغل لوحدها مرة واحدة، وممكن تشغلها من المحرر في أي وقت.
 */
function repairColumns() {
  const sh = logSheet_();
  const w = sh.getLastColumn(), last = sh.getLastRow();
  const head = sh.getRange(1, 1, 1, w).getValues()[0].map(function (x) { return String(x).trim(); });
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let fixedRows = 0, dropped = 0;
  if (last >= 2) {
    const data = sh.getRange(2, 1, last - 1, w).getValues();
    const oldId = OLD_HEADERS.indexOf('ID');
    data.forEach(function (r, i) {
      if (uuid.test(String(r[COL['ID']]))) return;
      if (!(oldId < r.length && uuid.test(String(r[oldId])))) return;
      // السطر ده متسجّل بالترتيب القديم: نرجّع كل قيمة تحت عنوانها
      const out = new Array(w).fill('');
      OLD_HEADERS.forEach(function (h, j) { if (h in COL && j < r.length) out[COL[h]] = r[j]; });
      data[i] = out; fixedRows++;
    });
    // دمج الأعمدة المتكررة في أول عمود بنفس الاسم
    head.forEach(function (h, j) {
      const first = head.indexOf(h);
      if (!h || first === j) return;
      data.forEach(function (r) { if ((r[first] === '' || r[first] == null) && r[j] !== '' && r[j] != null) r[first] = r[j]; r[j] = ''; });
    });
    if (fixedRows || head.some(function (h, j) { return h && head.indexOf(h) !== j; })) {
      // نحافظ على النصوص (التواريخ والأرقام) زي ما هي
      sh.getRange(2, 1, data.length, w).setNumberFormat('@');
      sh.getRange(2, COL['inMs'] + 1, data.length, 1).setNumberFormat('0');
      sh.getRange(2, COL['outMs'] + 1, data.length, 1).setNumberFormat('0');
      sh.getRange(2, 1, data.length, w).setValues(data.map(function (r) { return r.map(function (x, j) {
        if (x instanceof Date) return Utilities.formatDate(x, TZ, j === COL['التاريخ'] || j === COL['تاريخ الميلاد'] ? 'yyyy-MM-dd' : 'HH:mm');
        return x;
      }); }));
    }
  }
  for (let j = head.length - 1; j >= 0; j--) if (head[j] && head.indexOf(head[j]) !== j) { sh.deleteColumn(j + 1); dropped++; }
  delete _sheets[LOG_SHEET]; logSheet_();
  PropertiesService.getScriptProperties().setProperty('COLS_REPAIRED', '1');
  Logger.log('اتصلح: ' + fixedRows + ' سطر رجع مكانه، و' + dropped + ' عمود متكرر اتشال.');
  return { rows: fixedRows, cols: dropped };
}
/** مرة واحدة: أسماء الشركات الإنجليزي تبقى عربي في القايمة وفي الحركات القديمة (التطابق لازم يبقى بالظبط). */
function renameCompanies() {
  const map = {};
  COMPANY_RENAMES.forEach(function (p) { map[p[0]] = p[1]; });
  const csh = companiesSheet_();
  let listN = 0, logN = 0;
  const n = csh.getLastRow() - 1;
  if (n > 0) {
    const vals = csh.getRange(2, 1, n, 1).getValues();
    const have = vals.map(function (r) { return String(r[0]).trim(); });
    vals.forEach(function (r, i) {
      const to = map[String(r[0]).trim()];
      if (!to) return;
      if (have.indexOf(to) >= 0) return;               // العربي موجود قبل كده
      csh.getRange(i + 2, 1).setValue("'" + to); have[i] = to; listN++;
    });
  }
  const sh = logSheet_(), last = sh.getLastRow();
  if (last >= 2) {
    const rg = sh.getRange(2, COL['الشركة / صاحب العمل'] + 1, last - 1, 1);
    const v = rg.getValues();
    let changed = false;
    v.forEach(function (r) { const to = map[String(r[0]).trim()]; if (to) { r[0] = to; logN++; changed = true; } });
    if (changed) rg.setValues(v);
  }
  PropertiesService.getScriptProperties().setProperty('COMPANIES_AR', '1');
  Logger.log('أسماء الشركات بقت عربي: ' + listN + ' في القايمة، و' + logN + ' حركة قديمة.');
  return { list: listN, log: logN };
}

function autoRepair_() {
  if (!PropertiesService.getScriptProperties().getProperty('COMPANIES_AR')) {
    const l = LockService.getScriptLock();
    if (l.tryLock(20000)) { try { if (!PropertiesService.getScriptProperties().getProperty('COMPANIES_AR')) renameCompanies(); } catch (e) {} finally { l.releaseLock(); } }
  }
  if (PropertiesService.getScriptProperties().getProperty('COLS_REPAIRED')) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try { repairColumns(); } catch (e) {} finally { lock.releaseLock(); }
}

function initLog_(sh) {
  (function () {
    sh.getRange(1, 1, sh.getMaxRows(), COL['فرد الأمن (خروج)'] + 1).setNumberFormat('@');
    sh.getRange(1, COL['inMs'] + 1, sh.getMaxRows(), 2).setNumberFormat('0');
    sh.hideColumns(COL['ID'] + 1, 3);
    sh.setColumnWidth(COL['الاسم'] + 1, 220);
    sh.setColumnWidth(COL['الرقم القومي'] + 1, 150);
    sh.setColumnWidth(COL['العنوان'] + 1, 260);
  })();
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

function reasonsSheet_() {
  return ensureSheet_(REASONS_SHEET, ['السبب', 'نشط'], function (sh) {
    sh.getRange(2, 1, DEFAULT_REASONS.length, 2).setValues(DEFAULT_REASONS.map(function (r) { return [r, 'نعم']; }));
  });
}
function reasons_() {
  const sh = reasonsSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 2).getValues()
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r) { return { name: String(r[0]).trim(), active: String(r[1]).trim() !== 'لا' }; });
}
function activeReasons_() { return reasons_().filter(function (r) { return r.active; }).map(function (r) { return r.name; }); }

function companiesSheet_() {
  return ensureSheet_(COMPANIES_SHEET, ['الشركة / المقاول', 'نشط'], function (sh) {
    sh.getRange(2, 1, DEFAULT_COMPANIES.length, 2).setValues(DEFAULT_COMPANIES.map(function (r) { return [r, 'نعم']; }));
  });
}
function companies_() {
  const sh = companiesSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 2).getValues()
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r) { return { name: String(r[0]).trim(), active: String(r[1]).trim() !== 'لا' }; });
}
function activeCompanies_() { return companies_().filter(function (r) { return r.active; }).map(function (r) { return r.name; }); }

function logSectors_() {
  if (!ss_().getSheetByName(LOG_SHEET)) return [];
  const sh = logSheet_();
  if (sh.getLastRow() < 2) return [];
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
      salt: String(r[7]), hash: String(r[8]), ver: Number(r[9]) || 1, email: String(r[10] || '').trim()
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
  return 'gate';                                   // ("بوابة" القديمة = فرد أمن)
}
function publicUser_(u) {
  return { username: u.username, name: u.name, role: u.role, roleLabel: ROLES[u.role], gates: u.gates, active: u.active, lastLogin: u.lastLogin, created: u.created, email: u.email || '' };
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

function setupAdmin(code, username, name, password, email) {
  if (SETUP_CODE === 'CHANGE-ME') throw new Error('غيّر SETUP_CODE في أول ملف Code.gs واعمل Deploy بنسخة جديدة الأول.');
  if (String(code || '').trim() !== SETUP_CODE) throw new Error('كود التفعيل غلط.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (!needsSetup()) throw new Error('حساب الإدارة معمول قبل كده. سجّل دخول.');
    writeUser_({ username: username, name: name, role: 'admin', gates: ['*'], active: true, password: password, email: email || '' }, true);
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
  return { token: makeToken_(u), me: publicUser_(u), gates: myGates_(u), reasons: activeReasons_(), companies: activeCompanies_(), permitExempt: permitExempt_(), alertHours: ALERT_HOURS };
}

function whoami(token) {
  const u = auth_(token);
  return { me: publicUser_(u), gates: myGates_(u), reasons: activeReasons_(), companies: activeCompanies_(), permitExempt: permitExempt_(), alertHours: ALERT_HOURS };
}

function changeMyPassword(token, oldPw, newPw) {
  const u = auth_(token);
  if (hash_(u.salt, oldPw) !== u.hash) throw new Error('كلمة السر الحالية غلط.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { writeUser_({ username: u.username, name: u.name, role: u.role, gates: u.gates, active: true, password: newPw, email: u.email }, false); }
  finally { lock.releaseLock(); }
  return makeToken_(findUser_(u.username));
}

// ---------------------------------------------------------------- admin: users & gates

function adminData(token) {
  auth_(token, ['admin']);
  return { users: users_().map(publicUser_), gates: gates_(), reasons: reasons_(), companies: companies_(), roles: ROLES };
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
  const email = String(d.email || '').trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('الإيميل مش مظبوط.');
  if ((isNew || pw) && pw.length < 6) throw new Error('كلمة السر لازم تبقى ٦ حروف أو أرقام على الأقل.');

  let salt = existing ? existing.salt : '', hash = existing ? existing.hash : '', ver = existing ? existing.ver : 1;
  if (pw) { salt = Utilities.getUuid(); hash = hash_(salt, pw); if (existing) ver++; }
  if (existing && existing.active && !active) ver++;                 // الإيقاف بيطلّعه من كل الأجهزة

  const row = [username, name, ROLES[role], gates.join(','), active ? 'نعم' : 'لا',
    existing ? existing.lastLogin : '', existing ? existing.created : stamp_(new Date()), salt, hash, String(ver),
    d.email === undefined && existing ? existing.email : email];
  const vals = row.map(function (v, i) { return (i === 5 || i === 6) && v ? "'" + v : v; });
  if (existing) sh.getRange(existing.row, 1, 1, row.length).setValues([vals]);
  else sh.appendRow(vals);
  dropUsersCache_();
}

function saveReason(token, name, active) {
  auth_(token, ['admin']);
  name = clean_(name);
  if (!name) throw new Error('اكتب السبب.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = reasonsSheet_();
    const i = reasons_().map(function (r) { return r.name; }).indexOf(name);
    if (i >= 0) sh.getRange(i + 2, 2).setValue(active === false ? 'لا' : 'نعم');
    else sh.appendRow([name, 'نعم']);
  } finally { lock.releaseLock(); }
  return adminData(token);
}

function saveCompany(token, name, active) {
  auth_(token, ['admin']);
  name = clean_(name);
  if (!name) throw new Error('اكتب اسم الشركة.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = companiesSheet_();
    const i = companies_().map(function (r) { return r.name; }).indexOf(name);
    if (i >= 0) sh.getRange(i + 2, 2).setValue(active === false ? 'لا' : 'نعم');
    else sh.appendRow(["'" + name, 'نعم']);
  } finally { lock.releaseLock(); }
  return adminData(token);
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
    late: lateList_(rows),
    gates: myGates_(u),
    reasons: activeReasons_(),
    companies: activeCompanies_(), permitExempt: permitExempt_(),
    alertHours: ALERT_HOURS
  };
}

function ocrId(token, base64, mime) {
  auth_(token);
  return parseIdText_(ocrText_(base64, mime));
}

/** صورة نمرة العربية (أو الرخصة) → رقم اللوحة. */
function ocrCar(token, base64, mime) {
  auth_(token);
  return parsePlateText_(ocrText_(base64, mime));
}

/**
 * نص صورة النمرة: الحروف والأرقام ممكن ييجوا في سطور منفصلة، وجنبهم "مصر EGYPT".
 * بنجرب الأول طريقة السطر الواحد، ولو مانفعتش بنجمع الحروف المنفصلة وأول رقم من ١-٤ أرقام.
 */
function parsePlateText_(text) {
  const out = parseCarText_(text);
  if (out.plate) return out;
  const clean = latinDigits_(String(text || ''))
    .replace(/[ً-ْـ]/g, '')
    .replace(/مصر|EGYPT|Egypt|egypt|ملاكى|ملاكي|اجره|أجرة|اجرة|نقل|خاص|ملاكي/g, ' ')
    .replace(/[A-Za-z]/g, ' ')
    .replace(/[|_:：.،,\-]/g, ' ');
  const tokens = clean.split(/\s+/).filter(String);
  const isPlateLetters = new RegExp('^[' + PLATE_LETTERS + 'إآ' + ']{1,3}$');
  let letters = '', nums = '';
  tokens.forEach(function (t) {
    if (!nums && /^\d{1,4}$/.test(t)) nums = t;
    else if (isPlateLetters.test(t) && (letters.replace(/\s/g, '') + t).length <= 3) letters += t;
  });
  if (letters && nums) out.plate = plateNorm_(letters + ' ' + nums);
  return out;
}

function ocrText_(base64, mime) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mime || 'image/jpeg', 'scan.jpg');
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
  return text;
}

/** عدد الأسماء في الاسم (كلمات فيها حروف). */
function nameWords_(s) { return String(s || '').trim().split(/\s+/).filter(function (w) { return /[\u0600-\u06FFA-Za-z]/.test(w); }).length; }

// ================================================================ تصاريح سيستم الايديهات

function permitsSheet_() {
  return ensureSheet_(PERMITS_SHEET, P_HEADERS, function (sh) {
    sh.getRange(1, 1, sh.getMaxRows(), P_HEADERS.length).setNumberFormat('@');
  });
}

/** الإعداد: لو الرقم القومي مش موجود في داتا الايديهات — block (يتمنع) / warn (تحذير بس). */
function permitMissingMode_() {
  return PropertiesService.getScriptProperties().getProperty('PERMIT_MISSING') || 'block';
}
function permitsOn_() { return permitsSheet_().getLastRow() > 1; }
/** التبعيات اللي مش بنعملها تصاريح (زي ناس الملاك). بتعدّي بس لو الرقم القومي مش موجود في الداتا خالص. */
function permitExempt_() {
  const v = PropertiesService.getScriptProperties().getProperty('PERMIT_EXEMPT');
  if (v) { try { return JSON.parse(v); } catch (e) {} }
  return ['تابع لمالك الوحدة'];
}

function dateKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const m = String(v || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad_(+m[2]) + '-' + pad_(+m[3]);
  const d = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return d ? d[3] + '-' + pad_(+d[2]) + '-' + pad_(+d[1]) : '';
}

/** ملف Excel من سيستم الايديهات → صفوف. بيتحول لشيت جوجل مؤقت ويتمسح. */
function xlsxRows_(base64, name) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name || 'ids.xlsx');
  let id = null;
  try {
    id = Drive.Files.create({ name: 'ids-import-' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' }, blob, { fields: 'id' }).id;
    return SpreadsheetApp.openById(id).getSheets()[0].getDataRange().getValues();
  } finally {
    if (id) { try { Drive.Files.remove(id); } catch (e) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e2) {} } }
  }
}

/** رفع ملف (أو أكتر) من سيستم الايديهات. السجل بيتحدّث بالرقم التعريفي، والجديد بيتضاف. */
function importPermits(token, base64, fileName) {
  auth_(token, ['admin']);
  return importPermitRows_(xlsxRows_(base64, fileName), String(fileName || ''));
}

function importPermitRows_(rows, source) {
  if (!rows || rows.length < 2) throw new Error('الملف فاضي.');
  const head = rows[0].map(function (h) { return String(h).trim(); });
  const idx = function (names) { for (let i = 0; i < names.length; i++) { const k = head.indexOf(names[i]); if (k >= 0) return k; } return -1; };
  const c = {
    id: idx(['الرقم التعريفي']), name: idx(['الاسم']), card: idx(['رقم البطاقة', 'الرقم القومي']), company: idx(['اسم الشركة', 'الشركة']),
    place: idx(['المكان العمل', 'مكان العمل']), gate: idx(['اسم البوابة', 'البوابة']), start: idx(['تاريخ بدء التصريح']),
    end: idx(['تاريخ نهاية التصريح']), status: idx(['الحالة']), photo: idx(['الصورة'])
  };
  if (c.card < 0 || c.end < 0 || c.status < 0) throw new Error('ده مش ملف تصدير من سيستم الايديهات (لازم يبقى فيه «رقم البطاقة» و«تاريخ نهاية التصريح» و«الحالة»).');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = permitsSheet_();
    const last = sh.getLastRow();
    const data = last > 1 ? sh.getRange(2, 1, last - 1, P_HEADERS.length).getValues() : [];
    const byId = {}, byCard = {};
    data.forEach(function (r, i) { if (r[0] !== '') byId[String(r[0])] = i; else byCard[String(r[2])] = i; });
    const now = stamp_(new Date());
    let added = 0, updated = 0, skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const card = String(r[c.card] == null ? '' : r[c.card]).replace(/\.0$/, '').trim();
      if (!card) { skipped++; continue; }
      const rec = [
        c.id >= 0 ? String(r[c.id]).replace(/\.0$/, '').trim() : '', c.name >= 0 ? String(r[c.name]).trim() : '', /^\d+$/.test(digits_(card)) && digits_(card).length === 14 ? digits_(card) : card,
        c.company >= 0 ? String(r[c.company]).trim() : '', c.place >= 0 ? String(r[c.place]).trim() : '', c.gate >= 0 ? String(r[c.gate]).replace(/\.0$/, '').trim() : '',
        c.start >= 0 ? dateKey_(r[c.start]) : '', dateKey_(r[c.end]), String(r[c.status]).trim(), c.photo >= 0 ? String(r[c.photo]).trim() : '', source, now
      ];
      const at = rec[0] ? byId[rec[0]] : byCard[rec[2]];
      if (at !== undefined) { data[at] = rec; updated++; }
      else { data.push(rec); if (rec[0]) byId[rec[0]] = data.length - 1; else byCard[rec[2]] = data.length - 1; added++; }
    }
    if (data.length) sh.getRange(2, 1, data.length, P_HEADERS.length).setValues(data.map(function (r) { return r.map(function (x) { return String(x); }); }));
    CacheService.getScriptCache().remove('permitStats');
    return { added: added, updated: updated, skipped: skipped, stats: permitStats_() };
  } finally { lock.releaseLock(); }
}

function permitStats_() {
  const sh = permitsSheet_(), last = sh.getLastRow();
  const out = { total: 0, active: 0, expired: 0, excluded: 0, sources: {}, missingMode: permitMissingMode_(), exempt: permitExempt_() };
  if (last < 2) return out;
  const today = dayKey_(new Date());
  sh.getRange(2, 1, last - 1, P_HEADERS.length).getValues().forEach(function (r) {
    out.total++;
    const v = permitVerdict_(r, today).code;
    if (v === 'ok' || v === 'soon') out.active++; else if (v === 'expired') out.expired++; else if (v === 'excluded') out.excluded++;
    const src = String(r[PC['الملف']] || '—');
    const s = out.sources[src] || (out.sources[src] = { n: 0, at: '' });
    s.n++; if (String(r[PC['آخر تحديث']]) > s.at) s.at = String(r[PC['آخر تحديث']]);
  });
  return out;
}

function permitVerdict_(r, today) {
  const status = String(r[PC['الحالة']]).trim(), end = dateKey_(r[PC['تاريخ نهاية التصريح']]), start = dateKey_(r[PC['تاريخ بدء التصريح']]);
  if (/مستبعد|محظور|ممنوع|موقوف/.test(status)) return { code: 'excluded', block: true, msg: 'مستبعد من دخول القرية' };
  if (status && !/مفعل|ساري|نشط/.test(status)) return { code: 'inactive', block: true, msg: 'التصريح حالته «' + status + '»' };
  if (!end) return { code: 'noend', block: true, msg: 'التصريح مفيهوش تاريخ نهاية' };
  if (end < today) return { code: 'expired', block: true, msg: 'التصريح منتهي من ' + end };
  if (start && start > today) return { code: 'notstarted', block: true, msg: 'التصريح لسه مابدأش (بيبدأ ' + start + ')' };
  const left = Math.round((Date.parse(end) - Date.parse(today)) / 864e5);
  if (left <= PERMIT_WARN_DAYS) return { code: 'soon', block: false, msg: 'التصريح ساري بس هينتهي ' + end + ' (فاضل ' + left + ' يوم)' };
  return { code: 'ok', block: false, msg: 'التصريح ساري لحد ' + end };
}

/** حالة تصريح الرقم القومي. */
function permitFor_(nid, company) {
  nid = digits_(nid);
  if (!permitsOn_()) return { code: 'off', block: false, msg: '' };
  company = String(company || '').trim();
  const sh = permitsSheet_(), last = sh.getLastRow();
  const hits = sh.getRange(2, PC['رقم البطاقة'] + 1, last - 1, 1).createTextFinder(nid).matchEntireCell(true).findAll();
  if (!hits.length) {
    if (company && permitExempt_().indexOf(company) >= 0) return { code: 'exempt', block: false, msg: company + ' — مش محتاج تصريح' };
    const block = permitMissingMode_() === 'block';
    return { code: 'missing', block: block, msg: 'الرقم القومي ده مش موجود في سيستم الايديهات' };
  }
  // لو ليه أكتر من سجل (تجديد): بناخد اللي تاريخ نهايته الأبعد، إلا لو فيه سجل «مستبعد» أحدث منه
  const recs = hits.map(function (h) { return sh.getRange(h.getRow(), 1, 1, P_HEADERS.length).getValues()[0]; });
  const idOf = function (x) { return Number(x[PC['الرقم التعريفي']]) || 0; };
  const endOf = function (x) { return dateKey_(x[PC['تاريخ نهاية التصريح']]); };
  let r = recs.slice().sort(function (a, b) { return endOf(a) < endOf(b) ? 1 : endOf(a) > endOf(b) ? -1 : idOf(b) - idOf(a); })[0];
  const ex = recs.filter(function (x) { return /مستبعد|محظور|ممنوع|موقوف/.test(String(x[PC['الحالة']])) && idOf(x) >= idOf(r); })[0];
  if (ex) r = ex;
  const v = permitVerdict_(r, dayKey_(new Date()));
  v.name = String(r[PC['الاسم']]).trim(); v.company = String(r[PC['اسم الشركة']]).trim(); v.place = String(r[PC['مكان العمل']]).trim();
  v.start = dateKey_(r[PC['تاريخ بدء التصريح']]); v.end = dateKey_(r[PC['تاريخ نهاية التصريح']]); v.status = String(r[PC['الحالة']]).trim();
  v.photo = /^https:\/\//.test(String(r[PC['الصورة']])) ? String(r[PC['الصورة']]) : '';
  v.companyAr = companyArabic_(v.company);
  return v;
}

/** اسم الشركة من سيستم الايديهات (إنجليزي غالبًا) → اسمها في قايمة الشركات. */
function companyArabic_(name) {
  const k = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!k) return '';
  for (let i = 0; i < COMPANY_RENAMES.length; i++) if (COMPANY_RENAMES[i][0].toLowerCase() === k) return COMPANY_RENAMES[i][1];
  const list = activeCompanies_();
  for (let i = 0; i < list.length; i++) if (list[i].toLowerCase() === k) return list[i];
  return '';
}

function checkPermit(token, nid) {
  auth_(token);
  if (!parseNid_(nid)) throw new Error('الرقم القومي مش مظبوط.');
  return permitFor_(nid);
}

function permitsAdmin(token) { auth_(token, ['admin']); return permitStats_(); }
function setPermitExempt(token, list) {
  auth_(token, ['admin']);
  list = (Array.isArray(list) ? list : []).map(function (x) { return clean_(x); }).filter(String);
  PropertiesService.getScriptProperties().setProperty('PERMIT_EXEMPT', JSON.stringify(list));
  return permitStats_();
}
function setPermitMissingMode(token, mode) {
  auth_(token, ['admin']);
  if (['block', 'warn'].indexOf(mode) < 0) throw new Error('اختيار غلط.');
  PropertiesService.getScriptProperties().setProperty('PERMIT_MISSING', mode);
  return permitStats_();
}

function saveEntry(token, e) {
  const u = auth_(token);
  const name = clean_(e.name), nid = digits_(e.nid), guard = u.name;   // فرد الأمن = صاحب الحساب
  const sector = u.role === 'gate' ? u.gates[0] : clean_(e.sector);
  if (!sector) throw new Error('اختار البوابة.');
  if (myGates_(u).indexOf(sector) < 0) throw new Error('حسابك مش مسموح له يسجّل على بوابة ' + sector + '.');
  if (nameWords_(name) < 3) throw new Error('اكتب الاسم ثلاثي على الأقل (٣ أسماء).');
  const p = parseNid_(nid);
  if (!p) throw new Error('الرقم القومي لازم يكون ١٤ رقم صحيح.');
  if (!clean_(e.address)) throw new Error('اكتب العنوان.');
  if (!clean_(e.dest)) throw new Error('اكتب هو رايح فين (الوحدة / الموقع).');
  if (!clean_(e.reason)) throw new Error('اختار سبب الدخول.');
  if (!clean_(e.company)) throw new Error('اختار الشركة أو اكتب التبعية.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const inside = rows_(3000).filter(function (r) { return !r.outMs && r.nid === nid; })[0];
    if (inside) throw new Error('الشخص ده متسجل جوه من ' + inside.inTime + ' (' + inside.sector + ') ولسه ماخرجش.');
    // تصريح سيستم الايديهات: الممنوع مش بيدخل خالص، مفيش استثناءات لأي حد
    const pv = permitFor_(nid, clean_(e.company));
    if (pv.block) throw new Error('ممنوع الدخول: ' + pv.msg + '.');
    const now = new Date();
    const row = new Array(Math.max(LOG_W, logSheet_().getLastColumn())).fill('');
    row[COL['الاسم']] = name;
    row[COL['الرقم القومي']] = nid;
    row[COL['تاريخ الميلاد']] = p.dob;
    row[COL['النوع']] = p.gender;
    row[COL['المحافظة']] = p.gov;
    row[COL['العنوان']] = clean_(e.address);
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
    row[COL['رقم اللوحة']] = plateNorm_(e.plate);
    row[COL['المركبة']] = clean_(e.vehicle);
    row[COL['لون المركبة']] = clean_(e.vehicleColor);
    row[COL['التصريح']] = pv.code === 'off' ? '' : pv.msg;
    ['الرقم القومي', 'تاريخ الميلاد', 'التاريخ', 'وقت الدخول'].forEach(function (h) {
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
  guard = u.name;                                   // فرد الأمن = صاحب الحساب
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

/** رقم السطر في الشيت للحركة دي، أو 0. */
function rowOf_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2 || !id) return 0;
  const ids = sh.getRange(2, COL['ID'] + 1, last - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === id) return i + 2;
  return 0;
}

/** تعديل بيانات حركة (أي حد على البوابة دي). */
function updateEntry(token, id, e) {
  const u = auth_(token);
  const name = clean_(e.name), nid = digits_(e.nid);
  if (!name) throw new Error('اكتب الاسم.');
  const p = parseNid_(nid);
  if (!p) throw new Error('الرقم القومي لازم يكون ١٤ رقم صحيح.');
  const plate = plateNorm_(e.plate);
  if (plate && (!/\d/.test(plate) || !/[ء-ي]/.test(plate))) throw new Error('اكتب رقم اللوحة كامل (حروف وأرقام)، أو امسحه.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = logSheet_();
    const r = rowOf_(sh, id);
    if (!r) throw new Error('السطر مش موجود.');
    const cur = sh.getRange(r, 1, 1, LOG_W).getValues()[0];
    if (String(cur[COL['محذوف']] || '').trim()) throw new Error('الحركة دي اتمسحت.');
    if (!canSee_(u, String(cur[COL['القطاع']]))) throw new Error('الحركة دي على بوابة ' + cur[COL['القطاع']] + '، وحسابك مش عليها.');
    // مينفعش نفس الرقم القومي يبقى جوه مرتين
    if (!Number(cur[COL['outMs']]) && digits_(cur[COL['الرقم القومي']]) !== nid) {
      const other = rows_(3000).filter(function (x) { return !x.outMs && x.nid === nid && x.id !== id; })[0];
      if (other) throw new Error('الرقم القومي ده لشخص متسجل جوه من ' + other.inTime + ' (' + other.sector + ').');
    }
    if (name !== String(cur[COL['الاسم']]).trim() && nameWords_(name) < 3) throw new Error('اكتب الاسم ثلاثي على الأقل (٣ أسماء).');
    const set = function (h, v, text) { cur[COL[h]] = text && v !== '' ? "'" + v : v; };
    set('الاسم', name); set('الرقم القومي', nid, true); set('تاريخ الميلاد', p.dob, true);
    set('النوع', p.gender); set('المحافظة', p.gov);
    set('العنوان', clean_(e.address));
    set('رايح فين', clean_(e.dest)); set('سبب الدخول', clean_(e.reason));
    set('الشركة / صاحب العمل', clean_(e.company)); set('ملاحظات', clean_(e.notes));
    set('رقم اللوحة', plate);
    set('آخر تعديل', u.username + ' ' + stamp_(new Date()));
    // النصوص اللي كانت محفوظة كنص ترجع بعلامة ' علشان الشيت ما يحولهاش
    ['التاريخ', 'وقت الدخول', 'وقت الخروج', 'مدة التواجد (س:د)'].forEach(function (h) {
      const v = cur[COL[h]];
      if (v instanceof Date) cur[COL[h]] = "'" + Utilities.formatDate(v, TZ, h === 'التاريخ' ? 'yyyy-MM-dd' : 'HH:mm');
      else if (v !== '' && v != null) cur[COL[h]] = "'" + v;
    });
    sh.getRange(r, 1, 1, LOG_W).setValues([cur]);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** مسح حركة (المدير والإدارة). السطر بيفضل في الشيت متعلّم عليه "محذوف". */
function deleteEntry(token, id) {
  const u = auth_(token, ['admin', 'manager']);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = logSheet_();
    const r = rowOf_(sh, id);
    if (!r) throw new Error('السطر مش موجود.');
    const sector = String(sh.getRange(r, COL['القطاع'] + 1).getValue());
    if (!canSee_(u, sector)) throw new Error('الحركة دي على بوابة ' + sector + '، وحسابك مش عليها.');
    sh.getRange(r, COL['محذوف'] + 1).setValue(u.username + ' ' + stamp_(new Date()));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// ================================================================ 8-hour alerts

/** اللي جوه بقالهم أكتر من ALERT_HOURS (الأقدم الأول). */
function lateList_(rows) {
  const now = Date.now(), lim = ALERT_HOURS * 3600e3;
  return rows.filter(function (r) { return !r.outMs && r.inMs && now - r.inMs > lim; })
    .sort(function (a, b) { return a.inMs - b.inMs; })
    .map(function (r) {
      return { id: r.id, name: r.name, sector: r.sector, day: r.day, inTime: r.inTime, hours: Math.floor((now - r.inMs) / 3600e3),
        company: r.company, phone: r.phone, plate: r.plate, guardIn: r.guardIn, alerted: r.alerted };
    });
}

/** بتتشغل لوحدها كل ١٥ دقيقة (setup بيركّبها). بتبعت إيميل للإدارة مرة واحدة لكل شخص. */
function checkOverstays() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const fresh = lateList_(rows_(3000)).filter(function (r) { return !String(r.alerted || '').trim(); });
    if (!fresh.length) return;
    const to = alertEmails_();
    if (to.length) {
      const rowsHtml = fresh.map(function (r) {
        return '<tr><td>' + esc_(r.name) + '</td><td>' + esc_(r.sector) + '</td><td>' + esc_(r.day + ' ' + r.inTime) + '</td><td><b>' + r.hours + ' ساعة</b></td><td>' +
          esc_(r.company) + '</td><td>' + esc_(r.plate) + '</td><td>' + esc_(r.guardIn) + '</td></tr>';
      }).join('');
      const body = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif">' +
        '<h3 style="color:#B3261E">⚠️ ' + fresh.length + ' جوه الكمباوند بقالهم أكتر من ' + ALERT_HOURS + ' ساعات</h3>' +
        '<table border="1" cellpadding="6" style="border-collapse:collapse;font-size:14px"><tr style="background:#16414D;color:#fff">' +
        '<th>الاسم</th><th>البوابة</th><th>دخل</th><th>بقاله</th><th>الشركة</th><th>اللوحة</th><th>فرد الأمن</th></tr>' + rowsHtml + '</table>' +
        '<p>التنبيه ده بيتبعت مرة واحدة لكل شخص. افتح التطبيق وسجّل خروجه أو تابع مع البوابة.</p></div>';
      MailApp.sendEmail({
        to: to.join(','),
        subject: '⚠️ تنبيه بوابات: ' + fresh.length + ' جوه بقالهم أكتر من ' + ALERT_HOURS + ' ساعات',
        htmlBody: body,
        body: fresh.map(function (r) { return r.name + ' — ' + r.sector + ' — ' + r.hours + ' ساعة'; }).join('\n')
      });
    }
    const sh = logSheet_(), mark = 'اتبعت ' + stamp_(new Date());
    fresh.forEach(function (r) { const n = rowOf_(sh, r.id); if (n) sh.getRange(n, COL['تنبيه التأخير'] + 1).setValue(mark); });
  } finally { lock.releaseLock(); }
}

/** إيميلات الإدارة الشغالة، ولو مفيش: إيميل صاحب السكريبت. */
function alertEmails_() {
  const list = users_().filter(function (u) { return u.role === 'admin' && u.active && u.email; }).map(function (u) { return u.email; });
  if (list.length) return list;
  let owner = '';
  try { owner = Session.getEffectiveUser().getEmail(); } catch (e) {}
  return owner ? [owner] : [];
}

function installAlertTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'checkOverstays') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkOverstays').timeBased().everyMinutes(15).create();
}

function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

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
    withVehicle: rows.filter(function (r) { return r.plate; }).length,
    vehicles: top_(rows.reduce(function (m, r) {
      if (r.plate) { const k = String(r.vehicle || '').trim().split(/\s+/)[0] || 'غير محدد'; m[k] = (m[k] || 0) + 1; }
      return m;
    }, {}), 10),
    gender: { m: rows.filter(function (r) { return r.gender === 'ذكر'; }).length, f: rows.filter(function (r) { return r.gender === 'أنثى'; }).length },
    frequent: Object.keys(nids).map(function (k) { return nids[k]; }).filter(function (x) { return x.n > 1; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 10),
    overstay: lateList_(all).slice(0, 50),
    alertHours: ALERT_HOURS,
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
  const width = sh.getLastColumn();
  const vals = sh.getRange(start, 1, last - start + 1, width).getValues();
  const out = [];
  for (let i = vals.length - 1; i >= 0; i--) {
    const v = vals[i].map(function (x, j) {
      if (j === COL['inMs'] || j === COL['outMs']) return x;
      return x instanceof Date ? Utilities.formatDate(x, TZ, j === COL['التاريخ'] || j === COL['تاريخ الميلاد'] ? 'yyyy-MM-dd' : 'HH:mm') : String(x);
    });
    if (!v[COL['ID']] || String(v[COL['محذوف']] || '').trim()) continue;   // المحذوف مش بيظهر
    out.push({
      id: v[COL['ID']], name: v[COL['الاسم']], nid: v[COL['الرقم القومي']],
      gender: v[COL['النوع']], gov: v[COL['المحافظة']],
      sector: v[COL['القطاع']], dest: v[COL['رايح فين']], reason: v[COL['سبب الدخول']],
      company: v[COL['الشركة / صاحب العمل']], day: v[COL['التاريخ']],
      inTime: v[COL['وقت الدخول']], outTime: v[COL['وقت الخروج']], duration: v[COL['مدة التواجد (س:د)']],
      guardIn: v[COL['فرد الأمن (دخول)']], guardOut: v[COL['فرد الأمن (خروج)']],
      plate: v[COL['رقم اللوحة']] || '', vehicle: v[COL['المركبة']] || '', vehicleColor: v[COL['لون المركبة']] || '',
      address: v[COL['العنوان']] || '', notes: v[COL['ملاحظات']] || '',
      edited: v[COL['آخر تعديل']] || '', alerted: v[COL['تنبيه التأخير']] || '',
      permit: v[COL['التصريح']] || '',
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

// حروف لوحات مصر
const PLATE_LETTERS = 'اأبجدرسصطعفقلمنهوىيك';

/** "مسع1234" أو "١٢٣٤ ع س م" → "م س ع 1234" */
function plateNorm_(s) {
  s = latinDigits_(s).replace(/[إآ]/g, 'أ').replace(/ي/g, 'ى');
  const letters = (s.match(/[ء-ي]/g) || []).join(' ');
  const nums = (s.match(/\d/g) || []).join('');
  return (letters + (letters && nums ? ' ' : '') + nums).trim();
}

/**
 * بيطلّع رقم اللوحة والماركة واللون من نص رخصة المركبة.
 * اللوحة: ١-٣ حروف لوحدها + ١-٤ أرقام (بأي ترتيب). السطر اللي فيه "لوحة" أو اللي بعده له الأولوية.
 */
function parseCarText_(text) {
  const raw = String(text || '');
  const lines = latinDigits_(raw).split(/\r?\n/)
    .map(function (l) { return l.replace(/[ً-ْـ]/g, '').replace(/[|_:：.،,]/g, ' ').replace(/\s+/g, ' ').trim(); })
    .filter(String);

  const L = '[' + PLATE_LETTERS + 'إآ' + ']';
  const lettersFirst = new RegExp('(?:^|[^\\u0621-\\u064A])((?:' + L + ' ?){1,3})\\s*(\\d{1,4})(?!\\d)');
  const digitsFirst = new RegExp('(?:^|\\D)(\\d{1,4})\\s*((?:' + L + ' ?){1,3})(?![\\u0621-\\u064A])');
  const tryLine = function (l) {
    let m = l.match(lettersFirst);
    if (m) return { letters: m[1], nums: m[2] };
    m = l.match(digitsFirst);
    if (m) return { letters: m[2], nums: m[1] };
    return null;
  };
  const score = function (p, near) {
    const spaced = /\s/.test(p.letters.trim());
    return (near ? 10 : 0) + (spaced ? 3 : 0) + p.nums.length;
  };

  let best = null, bestScore = -1;
  lines.forEach(function (l, i) {
    const near = /لوح/.test(l) || (i > 0 && /لوح/.test(lines[i - 1]));
    const p = tryLine(l.replace(/.*لوح[هة]?\s*(رقم)?/, ' '));
    if (p) { const s = score(p, near); if (s > bestScore) { best = p; bestScore = s; } }
  });
  const plate = best ? plateNorm_(best.letters + ' ' + best.nums) : '';

  const field = function (re) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(re);
      if (!m) continue;
      const v = (m[1] || '').trim() || (lines[i + 1] || '');
      return v.replace(/[^؀-ۿa-zA-Z0-9\s\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    }
    return '';
  };
  const brand = field(/(?:الماركه|الماركة|ماركه|ماركة)\s*(.*)$/);
  const model = field(/(?:الطراز|الموديل|طراز)\s*(.*)$/);
  const color = field(/(?:اللون|لون)\s*(.*)$/);
  return {
    plate: plate,
    vehicle: [brand, model].filter(String).join(' ').replace(/\s+/g, ' ').trim(),
    color: color,
    raw: raw.slice(0, 1500)
  };
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
