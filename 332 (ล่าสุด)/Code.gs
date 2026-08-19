// วางโค้ดนี้ใน Apps Script ของชีต "ปพ.5" (Extensions > Apps Script) แทนโค้ดเดิมทั้งหมด
// สคริปต์นี้จะสร้าง 4 ชีตย่อยให้อัตโนมัติเมื่อบันทึกข้อมูลครั้งแรก: นักเรียน, รายวิชา, คะแนน, เวลาเรียน

var SHEETS = {
  student: 'นักเรียน',
  subject: 'รายวิชา',
  score: 'คะแนน',
  attendance: 'เวลาเรียน'
};

var HEADERS = {
  นักเรียน: ['เลขที่','คำนำหน้า','ชื่อ','นามสกุล','เพศ','รหัสนักเรียน','เลขประจำตัวประชาชน','วันเกิด','ชั้น','ห้อง','บันทึกเมื่อ'],
  รายวิชา: ['รหัสวิชา','ชื่อวิชา','เก็บคะแนนเต็ม','กลางภาคเต็ม','ปลายภาคเต็ม','บันทึกเมื่อ'],
  คะแนน: ['รหัสนักเรียน','ชื่อ-สกุล','รหัสวิชา','ชื่อวิชา','เก็บคะแนน','กลางภาค','ปลายภาค','รวม','เกรด','บันทึกเมื่อ'],
  เวลาเรียน: ['รหัสนักเรียน','ชื่อ-สกุล','ภาคเรียน','มาเรียน(วัน)','ขาด(วัน)','ลา(วัน)','สาย(ครั้ง)','บันทึกเมื่อ']
};

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

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var type = data.type;

  if (type === 'student') {
    var sh = getOrCreateSheet_(SHEETS.student);
    sh.appendRow([
      data.no || '', data.prefix || '', data.fname || '', data.lname || '',
      data.gender || '', data.sid || '', data.cid || '', data.bday || '',
      data.grade || '', data.room || '', new Date()
    ]);
  } else if (type === 'subject') {
    var sh = getOrCreateSheet_(SHEETS.subject);
    sh.appendRow([
      data.code || '', data.name || '',
      Number(data.fullFormative) || 0, Number(data.fullMid) || 0, Number(data.fullFinal) || 0,
      new Date()
    ]);
  } else if (type === 'score') {
    var sh = getOrCreateSheet_(SHEETS.score);
    var formative = Number(data.formative) || 0;
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
  } else if (type === 'attendance') {
    var sh = getOrCreateSheet_(SHEETS.attendance);
    sh.appendRow([
      data.sid || '', data.studentName || '', data.term || '',
      Number(data.present) || 0, Number(data.absent) || 0, Number(data.leave) || 0, Number(data.late) || 0,
      new Date()
    ]);
  } else {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'unknown type' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var type = e.parameter.type;
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
