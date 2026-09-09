/** Saint Theresa Drive database. Deploy as a NEW standalone Apps Script project. */
const ST_FOLDER = '1khpXrVLvw3ERl22OUwzApbnL27uAKdVs';
const ST_LIMIT = 12000000;
function setupSaintTheresa() {
  DriveApp.getFolderById(ST_FOLDER).getName();
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ST_ACCESS_KEY')) p.setProperty('ST_ACCESS_KEY', Utilities.getUuid() + Utilities.getUuid());
  console.log('Setup complete. Copy ST_ACCESS_KEY from Project Settings > Script Properties.');
}
function doGet() { return stJson({ok:true, service:'SaintTheresaDrive', version:1}); }
function doPost(e) {
  let lock;
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > ST_LIMIT) throw new Error('REQUEST_SIZE');
    const req = JSON.parse(raw);
    const p = PropertiesService.getScriptProperties();
    const key = p.getProperty('ST_ACCESS_KEY');
    if (!key || typeof req.key !== 'string' || req.key !== key) throw new Error('UNAUTHORIZED');
    if (!['load','save'].includes(req.action)) throw new Error('BAD_ACTION');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error('BUSY');
    const id = p.getProperty('ST_CURRENT_FILE');
    const state = id ? JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8')) : {revision:0,payload:null,operationId:null};
    if (req.action === 'load') return stJson({ok:true, folderId:ST_FOLDER, ...state});
    if (typeof req.operationId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(req.operationId)) throw new Error('BAD_OPERATION');
    // A retry of the most recent successful request must not create another revision.
    if (req.operationId === state.operationId) return stJson({ok:true, revision:state.revision, updatedAt:state.updatedAt});
    if (!Number.isSafeInteger(req.revision) || req.revision !== state.revision) return stJson({ok:false,error:'CONFLICT',revision:state.revision});
    const v = req.payload;
    if (!v || v.format !== 'ST-AES-GCM-1' || !/^[A-Za-z0-9+/]{16}$/.test(v.iv || '') || typeof v.data !== 'string' || v.data.length < 24 || !/^[A-Za-z0-9+/]+={0,2}$/.test(v.data)) throw new Error('BAD_PAYLOAD');
    const next = {revision:state.revision+1,updatedAt:new Date().toISOString(),operationId:req.operationId,payload:v};
    // Immutable revisions: a failed write cannot destroy the last good database.
    const file = DriveApp.getFolderById(ST_FOLDER).createFile('Saint-Theresa-r'+String(next.revision).padStart(6,'0')+'.json',JSON.stringify(next),MimeType.PLAIN_TEXT);
    p.setProperty('ST_CURRENT_FILE',file.getId());
    return stJson({ok:true,revision:next.revision,updatedAt:next.updatedAt});
  } catch (err) {
    const known = ['REQUEST_SIZE','UNAUTHORIZED','BAD_ACTION','BUSY','BAD_OPERATION','BAD_PAYLOAD'];
    return stJson({ok:false,error:known.includes(err.message)?err.message:'SERVER_ERROR'});
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
function stJson(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
