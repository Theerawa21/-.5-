// วางโค้ดนี้ใน Apps Script ของชีต "ปพ.5" (Extensions > Apps Script) แทนโค้ดเดิมทั้งหมด
// สคริปต์นี้จะสร้างชีตย่อยให้อัตโนมัติเมื่อบันทึกข้อมูลครั้งแรก: นักเรียน, รายวิชา, คะแนน, เวลาเรียน, ครู, ชั้นเรียน, วันหยุด, มอบหมายวิชา, ตัวชี้วัด, คะแนนตัวชี้วัด, ตั้งค่า

var SHEETS = {
  student: 'นักเรียน',
  subject: 'รายวิชา',
  score: 'คะแนน',
  attendance: 'เวลาเรียน',
  teacher: 'ครู',
  class: 'ชั้นเรียน',
  holiday: 'วันหยุด',
  assignment: 'มอบหมายวิชา',
  indicator: 'ตัวชี้วัด',
  indicator_score: 'คะแนนตัวชี้วัด'
};

var HEADERS = {
  นักเรียน: ['เลขที่','รหัสนักเรียน','เลขประจำตัวประชาชน','คำนำหน้า','ชื่อ','นามสกุล','ชั้น','บันทึกเมื่อ'],
  รายวิชา: ['รหัสวิชา','ชื่อวิชา','ระดับชั้น','เก็บคะแนนเต็ม','กลางภาคเต็ม','ปลายภาคเต็ม','บันทึกเมื่อ'],
  คะแนน: ['รหัสนักเรียน','ชื่อ-สกุล','รหัสวิชา','ชื่อวิชา','เก็บคะแนน','กลางภาค','ปลายภาค','รวม','เกรด','บันทึกเมื่อ'],
  เวลาเรียน: ['รหัสนักเรียน','ชื่อ-สกุล','ภาคเรียน','มาเรียน(วัน)','ขาด(วัน)','ลา(วัน)','สาย(ครั้ง)','บันทึกเมื่อ'],
  ครู: ['รหัส','ชื่อ-สกุล','ตำแหน่ง','บันทึกเมื่อ'],
  ชั้นเรียน: ['รหัส','ชื่อชั้น','ครูประจำชั้น','บันทึกเมื่อ'],
  วันหยุด: ['รหัส','วันที่','ชื่อวันหยุด','ประเภท','บันทึกเมื่อ'],
  'มอบหมายวิชา': ['รหัส','ครูผู้สอน','รหัสวิชา','ชื่อวิชา','ระดับชั้น/ห้อง','ภาคเรียน','กลุ่มสาระ','หมายเหตุ','บันทึกเมื่อ'],
  'ตัวชี้วัด': ['รหัส','รหัสวิชา','ชื่อวิชา','ตัวชี้วัด','คะแนนเต็ม','ผู้กำหนด','บันทึกเมื่อ'],
  'คะแนนตัวชี้วัด': ['รหัส','รหัสนักเรียน','ชื่อ-สกุล','รหัสวิชา','รหัสตัวชี้วัด','ตัวชี้วัด','คะแนนที่ได้','บันทึกเมื่อ']
};

// ── ชีตผู้ใช้งาน (ชื่อ+รหัสผ่านสำหรับล็อกอิน) ──
// ตั้งใจแยกออกจาก SHEETS/HEADERS ด้านบน และไม่มี doGet ทั่วไปสำหรับชีตนี้
// เพื่อไม่ให้ใครก็ตามที่รู้ URL ดึงรายชื่อ+รหัสผ่านทั้งหมดออกไปได้ทาง GET
var USER_SHEET = 'ผู้ใช้งาน';
var USER_HEADERS = ['User_ID', 'ชื่อ', 'บทบาท', 'แผนก', 'รหัสผ่าน', 'บันทึกเมื่อ'];

function getUserSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USER_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(USER_SHEET);
    sheet.appendRow(USER_HEADERS);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(USER_HEADERS);
  }
  return sheet;
}

function normalize_(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(HEADERS[name]);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS[name]);
  }
  return sheet;
}

function calcGrade_(percent) {
  if (percent >= 80) return 4;
  if (percent >= 75) return 3.5;
  if (percent >= 70) return 3;
  if (percent >= 65) return 2.5;
  if (percent >= 60) return 2;
  if (percent >= 55) return 1.5;
  if (percent >= 50) return 1;
  return 0;
}

function newId_() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function deleteRowById_(sheetName, id) {
  var sh = getOrCreateSheet_(sheetName);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sh.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// ── ตั้งค่าโรงเรียน (เก็บเป็น JSON ก้อนเดียวในชีต "ตั้งค่า" เซลล์ A1) ──
function saveSettings_(obj) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ตั้งค่า');
  if (!sheet) sheet = ss.insertSheet('ตั้งค่า');
  sheet.getRange(1, 1).setValue(JSON.stringify(obj));
}
function getSettings_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ตั้งค่า');
  if (!sheet) return {};
  var v = sheet.getRange(1, 1).getValue();
  if (!v) return {};
  try { return JSON.parse(v); } catch (err) { return {}; }
}

// ── ใช้ครั้งเดียวตอนติดตั้ง: เลือกฟังก์ชันนี้จาก dropdown ด้านบนแล้วกด ▶ Run เพื่อขอสิทธิ์ Google Drive ──
// (ตั้งชื่อแบบไม่มี _ ต่อท้าย เพราะ Apps Script จะซ่อนฟังก์ชันที่ลงท้ายด้วย _ ออกจาก dropdown เลือกรัน)
// (ฟังก์ชันอื่นที่มีพารามิเตอร์ เช่น uploadLogo_ กดรันตรงๆ ไม่ได้ผล เพราะไม่มีค่าส่งเข้าไปจะ return ก่อนถึงจุดที่ต้องขอสิทธิ์)
function requestDriveAccess() {
  DriveApp.getRootFolder();
}

// ── อัปโหลดโลโก้ไป Google Drive ──
// เซลล์ของ Google Sheets จำกัดไว้ที่ 50,000 ตัวอักษร ซึ่งรูปภาพแปลงเป็น base64 มักเกินขนาดนี้เสมอ
// จึงอัปโหลดไฟล์จริงไป Drive แล้วเก็บแค่ URL (สั้น) ไว้ในการตั้งค่าแทน
function uploadLogo_(dataUrl, oldFileId) {
  var match = String(dataUrl || '').match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return { status: 'error', message: 'ข้อมูลรูปภาพไม่ถูกต้อง' };
  var mimeType = match[1];
  var bytes = Utilities.base64Decode(match[2]);
  var blob = Utilities.newBlob(bytes, mimeType, 'logo');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var folder;
  var parents = DriveApp.getFileById(ss.getId()).getParents();
  folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();

  if (oldFileId) {
    try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (err) { /* ไฟล์เดิมอาจถูกลบไปแล้ว ข้ามได้ */ }
  }

  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w300';
  return { status: 'ok', url: url, fileId: file.getId() };
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var type = data.type;

  if (type === 'student') {
    var sh = getOrCreateSheet_(SHEETS.student);
    sh.appendRow([
      data.no || '', data.sid || '', data.cid || '',
      data.prefix || '', data.fname || '', data.lname || '', data.grade || '',
      new Date()
    ]);
  } else if (type === 'subject') {
    var sh = getOrCreateSheet_(SHEETS.subject);
    sh.appendRow([
      data.code || '', data.name || '', data.grade || '',
      Number(data.fullFormative) || 0, Number(data.fullMid) || 0, Number(data.fullFinal) || 0,
      new Date()
    ]);
  } else if (type === 'score') {
    var sh = getOrCreateSheet_(SHEETS.score);
    var formative = Number(data.formative) || 0;
    // ถ้าวิชานี้มีการกำหนดตัวชี้วัดไว้ (โดยครู) ให้คำนวณ "เก็บคะแนน" จากผลรวมคะแนนตัวชี้วัดของนักเรียนคนนี้แทนค่าที่ส่งมาจากฟอร์มเสมอ
    var indicatorSheet = getOrCreateSheet_(SHEETS.indicator);
    var indicatorValues = indicatorSheet.getDataRange().getValues();
    var hasIndicators = false;
    for (var ii = 1; ii < indicatorValues.length; ii++) {
      if (indicatorValues[ii][1] === data.subjectCode) { hasIndicators = true; break; }
    }
    if (hasIndicators) {
      var indScoreSheet = getOrCreateSheet_(SHEETS.indicator_score);
      var indScoreValues = indScoreSheet.getDataRange().getValues();
      var sum = 0;
      for (var jj = 1; jj < indScoreValues.length; jj++) {
        if (indScoreValues[jj][1] === data.sid && indScoreValues[jj][3] === data.subjectCode) {
          sum += Number(indScoreValues[jj][6]) || 0;
        }
      }
      formative = sum;
    }
    var mid = Number(data.mid) || 0;
    var fin = Number(data.fin) || 0;
    var total = formative + mid + fin;
    var fullTotal = Number(data.fullTotal) || 100;
    var percent = fullTotal > 0 ? (total / fullTotal) * 100 : 0;
    var gr = calcGrade_(percent);
    sh.appendRow([
      data.sid || '', data.studentName || '', data.subjectCode || '', data.subjectName || '',
      formative, mid, fin, total, gr, new Date()
    ]);
  } else if (type === 'indicator') {
    var sh = getOrCreateSheet_(SHEETS.indicator);
    sh.appendRow([
      newId_(), data.subjectCode || '', data.subjectName || '', data.name || '',
      Number(data.fullScore) || 0, data.teacher || '', new Date()
    ]);
  } else if (type === 'indicator_del') {
    deleteRowById_(SHEETS.indicator, data.id);
  } else if (type === 'indicator_score') {
    var sh = getOrCreateSheet_(SHEETS.indicator_score);
    var values = sh.getDataRange().getValues();
    var sid = data.sid || '';
    var indicatorId = data.indicatorId || '';
    var row = [
      newId_(), sid, data.studentName || '', data.subjectCode || '',
      indicatorId, data.indicatorName || '', Number(data.score) || 0, new Date()
    ];
    var found = -1;
    for (var kk = 1; kk < values.length; kk++) {
      if (values[kk][1] === sid && values[kk][4] === indicatorId) { found = kk; break; }
    }
    if (found >= 0) {
      row[0] = values[found][0];
      sh.getRange(found + 1, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
  } else if (type === 'indicator_score_del') {
    deleteRowById_(SHEETS.indicator_score, data.id);
  } else if (type === 'attendance') {
    var sh = getOrCreateSheet_(SHEETS.attendance);
    sh.appendRow([
      data.sid || '', data.studentName || '', data.term || '',
      Number(data.present) || 0, Number(data.absent) || 0, Number(data.leave) || 0, Number(data.late) || 0,
      new Date()
    ]);
  } else if (type === 'teacher') {
    var sh = getOrCreateSheet_(SHEETS.teacher);
    sh.appendRow([newId_(), data.name || '', data.role || '', new Date()]);
  } else if (type === 'teacher_del') {
    deleteRowById_(SHEETS.teacher, data.id);
  } else if (type === 'class') {
    var sh = getOrCreateSheet_(SHEETS.class);
    sh.appendRow([newId_(), data.name || '', data.homeroom || '', new Date()]);
  } else if (type === 'class_del') {
    deleteRowById_(SHEETS.class, data.id);
  } else if (type === 'holiday') {
    var sh = getOrCreateSheet_(SHEETS.holiday);
    sh.appendRow([newId_(), data.date || '', data.name || '', data.kind || 'หยุด', new Date()]);
  } else if (type === 'holiday_del') {
    deleteRowById_(SHEETS.holiday, data.id);
  } else if (type === 'assignment') {
    var sh = getOrCreateSheet_(SHEETS.assignment);
    sh.appendRow([
      newId_(), data.teacher || '', data.subjectCode || '', data.subjectName || '',
      data.classRoom || '', data.term || '', data.department || '', data.note || '',
      new Date()
    ]);
  } else if (type === 'assignment_del') {
    deleteRowById_(SHEETS.assignment, data.id);
  } else if (type === 'settings') {
    saveSettings_(data.settings || {});
  } else if (type === 'logo_upload') {
    var result;
    try {
      result = uploadLogo_(data.dataUrl, data.oldFileId);
    } catch (err) {
      result = { status: 'error', message: String(err && err.message ? err.message : err) };
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (type === 'user') {
    var sh = getUserSheet_();
    sh.appendRow([
      data.userId || newId_(), data.name || '', data.role || '', data.department || '',
      String(data.password || ''), new Date()
    ]);
  } else if (type === 'user_del') {
    deleteRowById_(USER_SHEET, data.id);
  } else if (type === 'login') {
    var sh = getUserSheet_();
    var values = sh.getDataRange().getValues();
    var input = normalize_(data.username);
    var pass = String(data.password || '');
    var found = null;
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var uid = normalize_(row[0]);
      var uname = normalize_(row[1]);
      if ((uid === input || uname === input) && String(row[4]) === pass) {
        found = row;
        break;
      }
    }
    if (found) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok', name: found[1], role: found[2], department: found[3]
      })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
    })).setMimeType(ContentService.MimeType.JSON);
  } else {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'unknown type' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var type = e.parameter.type;

  if (type === 'settings') {
    return ContentService.createTextOutput(JSON.stringify(getSettings_()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (type === 'users_admin') {
    // รายชื่อผู้ใช้งานสำหรับหน้าแอดมินดูเท่านั้น — ปิดบังรหัสผ่านเสมอ ไม่ส่งค่าจริงกลับ
    var sh = getUserSheet_();
    var values = sh.getDataRange().getValues();
    var masked = values.map(function (row, i) {
      if (i === 0) return row;
      var copy = row.slice();
      copy[4] = copy[4] ? '••••' : '';
      return copy;
    });
    return ContentService.createTextOutput(JSON.stringify(masked))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (type === 'usernames') {
    // สำหรับ autocomplete ในช่องล็อกอิน — ส่งเฉพาะ User_ID + ชื่อ ไม่มีบทบาท/แผนก/รหัสผ่าน
    var sh = getUserSheet_();
    var values = sh.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < values.length; i++) {
      list.push([values[i][0], values[i][1]]);
    }
    return ContentService.createTextOutput(JSON.stringify(list))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var name = SHEETS[type];
  if (!name) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'unknown type' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var sh = getOrCreateSheet_(name);
  var values = sh.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify(values))
    .setMimeType(ContentService.MimeType.JSON);
}
