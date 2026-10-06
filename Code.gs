const SHEETS = {
  EVENTS: 'Events',
  ANNOUNCEMENTS: 'Announcements',
  MEMORIES: 'Memories',
  REGISTRATIONS: 'Registrations',
  IDEAS: 'Ideas',
  ATTENDANCE: 'Attendance'
};

const HEADERS = {
  Events: ['id','title','category','date','time','location','description','capacity','registrationCount','published','createdAt'],
  Announcements: ['id','title','body','date','published','createdAt'],
  Memories: ['id','title','caption','imageUrl','date','published','createdAt'],
  Registrations: ['id','eventId','eventTitle','firstName','lastName','email','activity','team','createdAt'],
  Ideas: ['id','name','email','idea','createdAt'],
  Attendance: ['id','eventId','eventTitle','firstName','lastName','type','registrationId','note','present','createdAt']
};

function setupDatabase() {
  const ss = SpreadsheetApp.openById(requiredProp_('SPREADSHEET_ID'));
  Object.keys(SHEETS).forEach(k => {
    const name = SHEETS[k];
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(HEADERS[name]);
  });

  seedIfEmpty_(ss.getSheetByName(SHEETS.EVENTS), [
    ['evt1','Deepavali Eco Celebration','festival','2026-10-24','17:30','Apartment Courtyard','Lights, crafts, rangoli and a child-led eco-friendly celebration.',60,0,true,now_()],
    ['evt2','Festival Quiz Challenge','competition','2026-10-31','16:30','Community Hall','Teams compete in a fun culture, festival and general knowledge quiz.',40,0,true,now_()],
    ['evt3','Paper, Paint & Patterns','creative','2026-11-07','15:30','Activity Room','A relaxed creative afternoon with paper art, painting and patterns.',30,0,true,now_()]
  ]);

  seedIfEmpty_(ss.getSheetByName(SHEETS.ANNOUNCEMENTS), [
    ['ann1','Ideas are open!','Have an idea for an Assembly? Send it through the Ideas section.','2026-10-06',true,now_()],
    ['ann2','Eco-friendly celebrations','Let’s choose reusable decorations and keep our celebrations kind to the planet.','2026-10-06',true,now_()]
  ]);

  seedIfEmpty_(ss.getSheetByName(SHEETS.MEMORIES), [
    ['mem1','Welcome to Assemblies','Our apartment, our ideas, our community.','', '2026-10-06',true,now_()]
  ]);

  return json_({ok:true, message:'Database ready'});
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'bootstrap';
    return handle_(action, e.parameter || {});
  } catch (err) {
    return json_({ok:false,error:String(err)});
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return handle_(body.action || '', body);
  } catch (err) {
    return json_({ok:false,error:String(err)});
  }
}

function handle_(action, p) {
  switch(action) {
    case 'bootstrap': return json_({ok:true, events:publicRows_(SHEETS.EVENTS), announcements:publicRows_(SHEETS.ANNOUNCEMENTS), memories:publicRows_(SHEETS.MEMORIES)});
    case 'login': return login_(p);
    case 'register': return register_(p);
    case 'idea': return idea_(p);
    case 'adminData': requireAuth_(p.token, true); return adminData_();
    case 'createEvent': requireAuth_(p.token, true); return createEvent_(p);
    case 'createAnnouncement': requireAuth_(p.token, true); return createAnnouncement_(p);
    case 'uploadPhoto': requireAuth_(p.token, true); return uploadPhoto_(p);
    case 'toggleAttendance': requireAuth_(p.token, true); return toggleAttendance_(p);
    case 'walkin': requireAuth_(p.token, true); return walkin_(p);
    default: return json_({ok:false,error:'Unknown action'});
  }
}

function login_(p) {
  const username = String(p.username || '').trim();
  const password = String(p.password || '');
  const userPassword = requiredProp_('USER_PASSWORD');
  const adminPassword = requiredProp_('ADMIN_PASSWORD');

  let role = '';
  if (username.toLowerCase() === 'admin' && password === adminPassword) role = 'admin';
  else if (username.toLowerCase() === 'tiny achievers' && password === userPassword) role = 'user';
  else return json_({ok:false,error:'Invalid username or password'});

  const token = Utilities.getUuid() + '-' + Utilities.getUuid();
  const data = {role:role, username:username, expires:Date.now() + 1000*60*60*12};
  PropertiesService.getScriptProperties().setProperty('SESSION_' + token, JSON.stringify(data));
  return json_({ok:true,token:token,role:role,username:username});
}

function requireAuth_(token, adminOnly) {
  if (!token) throw new Error('Login required');
  const raw = PropertiesService.getScriptProperties().getProperty('SESSION_' + token);
  if (!raw) throw new Error('Session expired');
  const session = JSON.parse(raw);
  if (session.expires < Date.now()) {
    PropertiesService.getScriptProperties().deleteProperty('SESSION_' + token);
    throw new Error('Session expired');
  }
  if (adminOnly && session.role !== 'admin') throw new Error('Admin access required');
  return session;
}

function register_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const event = findRow_(SHEETS.EVENTS, 'id', String(p.eventId || ''));
    if (!event || String(event.published) !== 'true') throw new Error('Event not available');
    const capacity = Number(event.capacity || 0);
    const count = Number(event.registrationCount || 0);
    if (capacity > 0 && count >= capacity) throw new Error('This event is full');

    const email = String(p.email || '').trim().toLowerCase();
    if (!email || !String(p.firstName || '').trim()) throw new Error('Name and email are required');

    const existing = getRows_(SHEETS.REGISTRATIONS).find(r =>
      String(r.email).toLowerCase() === email && String(r.eventId) === String(p.eventId)
    );
    if (existing) throw new Error('This email is already registered for this event');

    const id = Utilities.getUuid();
    append_(SHEETS.REGISTRATIONS, [
      id, event.id, event.title, String(p.firstName).trim(), String(p.lastName || '').trim(),
      email, String(p.activity || '').trim(), String(p.team || '').trim(), now_()
    ]);

    updateCellByHeader_(SHEETS.EVENTS, event._row, 'registrationCount', count + 1);

    sendRegistrationEmail_(email, p.firstName, event);
    const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (adminEmail) {
      MailApp.sendEmail(adminEmail, 'New Assemblies registration: ' + event.title,
        `${p.firstName} ${p.lastName || ''} registered for ${event.title}.\nEmail: ${email}`);
    }

    return json_({ok:true,message:'Registration confirmed',remaining:capacity ? Math.max(capacity-count-1,0) : null});
  } finally {
    lock.releaseLock();
  }
}

function idea_(p) {
  const idea = String(p.idea || '').trim();
  if (!idea) throw new Error('Please enter an idea');
  append_(SHEETS.IDEAS, [Utilities.getUuid(), String(p.name || '').trim(), String(p.email || '').trim(), idea, now_()]);
  return json_({ok:true,message:'Thanks! Your idea has been sent.'});
}

function adminData_() {
  return json_({
    ok:true,
    events:getRows_(SHEETS.EVENTS),
    announcements:getRows_(SHEETS.ANNOUNCEMENTS),
    memories:getRows_(SHEETS.MEMORIES),
    registrations:getRows_(SHEETS.REGISTRATIONS),
    ideas:getRows_(SHEETS.IDEAS),
    attendance:getRows_(SHEETS.ATTENDANCE)
  });
}

function createEvent_(p) {
  const title = String(p.title || '').trim();
  if (!title) throw new Error('Event title required');
  append_(SHEETS.EVENTS, [
    Utilities.getUuid(), title, String(p.category || 'community'), String(p.date || ''),
    String(p.time || ''), String(p.location || ''), String(p.description || ''),
    Number(p.capacity || 0), 0, true, now_()
  ]);
  return json_({ok:true});
}

function createAnnouncement_(p) {
  append_(SHEETS.ANNOUNCEMENTS, [
    Utilities.getUuid(), String(p.title || '').trim(), String(p.body || '').trim(),
    new Date(), true, now_()
  ]);
  return json_({ok:true});
}

function uploadPhoto_(p) {
  const bytes = Utilities.base64Decode(String(p.data || ''));
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Photo must be under 10 MB');
  const mime = String(p.mime || 'image/jpeg');
  if (mime.indexOf('image/') !== 0) throw new Error('Only image files are allowed');

  const folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
  const blob = Utilities.newBlob(bytes, mime, String(p.filename || 'photo.jpg'));
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  append_(SHEETS.MEMORIES, [
    Utilities.getUuid(), String(p.title || 'Assembly memory'), String(p.caption || ''),
    'https://drive.google.com/uc?export=view&id=' + file.getId(), String(p.date || new Date()),
    true, now_()
  ]);
  return json_({ok:true,url:'https://drive.google.com/uc?export=view&id=' + file.getId()});
}

function toggleAttendance_(p) {
  const id = String(p.registrationId || '');
  const existing = getRows_(SHEETS.ATTENDANCE).find(r => String(r.registrationId) === id && String(r.eventId) === String(p.eventId));
  if (existing) {
    updateCellByHeader_(SHEETS.ATTENDANCE, existing._row, 'present', p.present === true);
  } else {
    append_(SHEETS.ATTENDANCE, [
      Utilities.getUuid(), String(p.eventId), String(p.eventTitle || ''), String(p.firstName || ''),
      String(p.lastName || ''), 'registered', id, '', p.present === true, now_()
    ]);
  }
  return json_({ok:true});
}

function walkin_(p) {
  append_(SHEETS.ATTENDANCE, [
    Utilities.getUuid(), String(p.eventId), String(p.eventTitle || ''), String(p.firstName || '').trim(),
    String(p.lastName || '').trim(), 'walk-in', '', String(p.note || '').trim(), true, now_()
  ]);
  return json_({ok:true});
}

function sendRegistrationEmail_(email, firstName, event) {
  const subject = 'Assemblies registration confirmed — ' + event.title;
  const body = `Hi ${firstName},\n\nYour Assemblies registration is confirmed.\n\nEvent: ${event.title}\nDate: ${event.date}\nTime: ${event.time}\nLocation: ${event.location}\n\nSee you there!\n\nAssemblies`;
  MailApp.sendEmail(email, subject, body);
}

function publicRows_(sheetName) {
  return getRows_(sheetName).filter(r => String(r.published) === 'true');
}

function getRows_(sheetName) {
  const sh = SpreadsheetApp.openById(requiredProp_('SPREADSHEET_ID')).getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).filter(row => row.some(v => v !== '')).map((row, i) => {
    const o = {};
    headers.forEach((h,j) => o[h] = normalize_(row[j]));
    o._row = i + 2;
    return o;
  });
}

function findRow_(sheetName, header, value) {
  return getRows_(sheetName).find(r => String(r[header]) === value) || null;
}

function append_(sheetName, row) {
  SpreadsheetApp.openById(requiredProp_('SPREADSHEET_ID')).getSheetByName(sheetName).appendRow(row);
}

function updateCellByHeader_(sheetName, rowNumber, header, value) {
  const sh = SpreadsheetApp.openById(requiredProp_('SPREADSHEET_ID')).getSheetByName(sheetName);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const col = headers.indexOf(header) + 1;
  if (col < 1) throw new Error('Unknown column ' + header);
  sh.getRange(rowNumber, col).setValue(value);
}

function seedIfEmpty_(sh, rows) {
  if (sh.getLastRow() < 2) rows.forEach(r => sh.appendRow(r));
}

function normalize_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  return v;
}

function now_() {
  return new Date();
}

function requiredProp_(name) {
  const v = PropertiesService.getScriptProperties().getProperty(name);
  if (!v) throw new Error('Missing Script Property: ' + name);
  return v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
