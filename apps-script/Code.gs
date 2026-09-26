/**
 * سجل بوابة الأفراد — Google Apps Script
 * البيانات بتتسجل في الشيت اللي السكريبت ده مربوط بيه.
 *
 * ⚙️ غيّر الرقم السري ده قبل ما تبعت اللينك لأفراد الأمن.
 */
const GATE_PIN = '2468';

const SHEET_NAME = 'سجل الدخول';
const HEADERS = [
  'الاسم', 'الرقم القومي', 'تاريخ الميلاد', 'النوع', 'المحافظة', 'العنوان', 'رقم الموبايل',
  'القطاع', 'رايح فين', 'سبب الدخول', 'الشركة / صاحب العمل', 'ملاحظات',
  'التاريخ', 'وقت الدخول', 'وقت الخروج', 'مدة التواجد (س:د)',
  'فرد الأمن (دخول)', 'فرد الأمن (خروج)',
  'ID', 'inMs', 'outMs'
];
const COL = {};
HEADERS.forEach(function (h, i) { COL[h] = i; });
const TZ = 'Africa/Cairo';

const GOV = {"01":"القاهرة","02":"الإسكندرية","03":"بورسعيد","04":"السويس","11":"دمياط","12":"الدقهلية","13":"الشرقية","14":"القليوبية","15":"كفر الشيخ","16":"الغربية","17":"المنوفية","18":"البحيرة","19":"الإسماعيلية","21":"الجيزة","22":"بني سويف","23":"الفيوم","24":"المنيا","25":"أسيوط","26":"سوهاج","27":"قنا","28":"أسوان","29":"الأقصر","31":"البحر الأحمر","32":"الوادي الجديد","33":"مطروح","34":"شمال سيناء","35":"جنوب سيناء","88":"مواليد خارج مصر"};

// ---------------------------------------------------------------- web app

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('سجل بوابة الأفراد')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** شغّلها مرة واحدة من المحرر: بتعمل الشيت في الـ Drive بتاعك وبتطلب الصلاحيات. */
function setup() {
  const ss = ss_();
  sheet_();
  ss.getSheets().forEach(function (s) {
    if (s.getName() !== SHEET_NAME && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  Logger.log('الشيت جاهز: ' + ss.getName() + ' — ' + ss.getUrl());
}

/** الشيت: لو السكريبت معمول من جوه شيت بيستخدمه، غير كده بيعمل شيت جديد اسمه "سجل بوابة الأفراد". */
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

// ---------------------------------------------------------------- API (called from Index.html)

function checkPin(pin) {
  auth_(pin);
  return true;
}

function getState(pin, day) {
  auth_(pin);
  const rows = rows_();
  const today = dayKey_(new Date());
  day = day || today;
  return {
    today: today,
    inside: rows.filter(function (r) { return !r.outMs; }),
    day: rows.filter(function (r) { return r.day === day; }),
    todayCount: rows.filter(function (r) { return r.day === today; }).length,
    sectors: unique_(rows.map(function (r) { return r.sector; }))
  };
}

function ocrId(pin, base64, mime) {
  auth_(pin);
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
      try { Drive.Files.remove(fileId); }                       // حذف نهائي
      catch (e) { try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e2) {} }
    }
  }
  return parseIdText_(text);
}

function saveEntry(pin, e) {
  auth_(pin);
  const name = clean_(e.name), nid = digits_(e.nid), guard = clean_(e.guard), sector = clean_(e.sector);
  if (!guard) throw new Error('اكتب اسم فرد الأمن.');
  if (!sector) throw new Error('اختار القطاع.');
  if (!name) throw new Error('اكتب الاسم.');
  const p = parseNid_(nid);
  if (!p) throw new Error('الرقم القومي لازم يكون ١٤ رقم صحيح.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const inside = rows_().filter(function (r) { return !r.outMs && r.nid === nid; })[0];
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
    row[COL['outMs']] = '';
    // علامة ' في الأول بتخلي الشيت يحفظهم نص (ما يتحولوش لأرقام أو تواريخ)
    ['الرقم القومي','رقم الموبايل','تاريخ الميلاد','التاريخ','وقت الدخول'].forEach(function (h) {
      if (row[COL[h]] !== '') row[COL[h]] = "'" + row[COL[h]];
    });
    sheet_().appendRow(row);
    return { ok: true, time: hm_(now) };
  } finally {
    lock.releaseLock();
  }
}

function checkout(pin, id, guard) {
  auth_(pin);
  guard = clean_(guard);
  if (!guard) throw new Error('اكتب اسم فرد الأمن.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    const last = sh.getLastRow();
    if (last < 2) throw new Error('السطر مش موجود.');
    const ids = sh.getRange(2, COL['ID'] + 1, last - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (ids[i][0] === id) {
        const r = i + 2;
        const inMs = Number(sh.getRange(r, COL['inMs'] + 1).getValue());
        if (Number(sh.getRange(r, COL['outMs'] + 1).getValue())) return { ok: true };
        const now = new Date();
        sh.getRange(r, COL['وقت الخروج'] + 1, 1, 4).setValues([["'" + hm_(now), "'" + dur_(inMs, now.getTime()), sh.getRange(r, COL['فرد الأمن (دخول)'] + 1).getValue(), guard]]);
        sh.getRange(r, COL['outMs'] + 1).setValue(now.getTime());
        return { ok: true };
      }
    }
    throw new Error('السطر مش موجود.');
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- helpers

function auth_(pin) {
  if (String(pin || '') !== String(GATE_PIN)) throw new Error('PIN_WRONG');
}

function sheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#16414D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    // النصوص تفضل نص (الرقم القومي والموبايل والوقت ما يتحولوش لأرقام)
    sh.getRange(1, 1, sh.getMaxRows(), COL['فرد الأمن (خروج)'] + 1).setNumberFormat('@');
    sh.getRange(1, COL['inMs'] + 1, sh.getMaxRows(), 2).setNumberFormat('0');
    sh.hideColumns(COL['ID'] + 1, 3);
    sh.setColumnWidth(COL['الاسم'] + 1, 220);
    sh.setColumnWidth(COL['الرقم القومي'] + 1, 150);
    sh.setColumnWidth(COL['العنوان'] + 1, 260);
  }
  return sh;
}

function rows_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const start = Math.max(2, last - 3000 + 1);          // آخر ٣٠٠٠ حركة تكفي للشاشة
  const vals = sh.getRange(start, 1, last - start + 1, HEADERS.length).getValues();
  const out = [];
  for (let i = vals.length - 1; i >= 0; i--) {
    const v = vals[i].map(function (x, j) { return j >= COL['inMs'] ? x : (x instanceof Date ? Utilities.formatDate(x, TZ, j === COL['التاريخ'] || j === COL['تاريخ الميلاد'] ? 'yyyy-MM-dd' : 'HH:mm') : String(x)); });
    if (!v[COL['ID']]) continue;
    out.push({
      id: v[COL['ID']], name: v[COL['الاسم']], nid: v[COL['الرقم القومي']],
      sector: v[COL['القطاع']], dest: v[COL['رايح فين']], reason: v[COL['سبب الدخول']],
      company: v[COL['الشركة / صاحب العمل']], day: v[COL['التاريخ']],
      inTime: v[COL['وقت الدخول']], outTime: v[COL['وقت الخروج']], duration: v[COL['مدة التواجد (س:د)']],
      guardIn: v[COL['فرد الأمن (دخول)']], guardOut: v[COL['فرد الأمن (خروج)']],
      inMs: Number(v[COL['inMs']]) || 0,
      outMs: Number(v[COL['outMs']]) || 0
    });
  }
  return out;                                          // الأحدث الأول
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

/** بيحاول يطلع الاسم والرقم القومي والعنوان من نص البطاقة. النتيجة اقتراح وفرد الأمن بيراجعها. */
function parseIdText_(text) {
  const raw = String(text || '');
  const latin = latinDigits_(raw);

  // الرقم القومي: أي ١٤ رقم ورا بعض (مع السماح بمسافات)، ونجرب المعكوس كمان
  let nid = '';
  const runs = latin.match(/\d[\d\s\-]{12,40}\d/g) || [];
  outer:
  for (let k = 0; k < runs.length; k++) {
    const s = runs[k].replace(/\D/g, '');
    for (let i = 0; i + 14 <= s.length; i++) {
      const cand = s.substr(i, 14);
      if (parseNid_(cand)) { nid = cand; break outer; }
      const rev = cand.split('').reverse().join('');
      if (parseNid_(rev)) { nid = rev; break outer; }
    }
  }
  if (!nid) {
    const any = (latin.replace(/\s/g, '').match(/\d{14}/) || [''])[0];
    nid = any;
  }

  // السطور العربي بعد شيل العناوين الثابتة
  const skip = /(جمهورية|جمهوريه|مصر العربية|مصر العربيه|بطاقة|بطاقه|تحقيق|الشخصية|الشخصيه|الرقم القومي|وزارة|الداخلية)/;
  const lines = raw.split(/\r?\n/)
    .map(function (l) { return l.replace(/[^؀-ۿ0-9٠-٩\s\-\/]/g, ' ').replace(/\s+/g, ' ').trim(); })
    .filter(function (l) { return l && /[ء-ي]{2,}/.test(l) && !skip.test(l); });
  const textLines = lines.filter(function (l) { return !/[0-9٠-٩]{6,}/.test(l); });

  const name = textLines.slice(0, 2).join(' ').trim();
  const address = textLines.slice(2, 4).join(' - ').trim();
  return { name: name, nationalId: nid, address: address, raw: raw.slice(0, 1500) };
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
function dur_(a, b) { const m = Math.max(0, Math.round((b - a) / 60000)); return Math.floor(m / 60) + ':' + pad_(m % 60); }
function unique_(a) { const o = {}; a.forEach(function (x) { if (x) o[x] = 1; }); return Object.keys(o).sort(); }
