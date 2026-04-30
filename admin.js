(function () {
  'use strict';

  var STORAGE_KEY = 'timetable_admin_data';
  var VENUE_IMAGES_KEY = 'timetable_venue_images';

  function getStoredData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { courses: [], lecturers: {} };
    } catch (e) {
      return { courses: [], lecturers: {} };
    }
  }

  function setStoredData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getVenueImages() {
    try {
      var raw = localStorage.getItem(VENUE_IMAGES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function setVenueImages(obj) {
    localStorage.setItem(VENUE_IMAGES_KEY, JSON.stringify(obj));
  }

  var SEMESTER_YEAR_KEY = 'timetable_semester_year';

  function getSemesterYear() {
    try {
      var raw = localStorage.getItem(SEMESTER_YEAR_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && (o.semester === 1 || o.semester === 2) && o.year) return o;
      }
    } catch (e) {}
    return { semester: 1, year: 2026 };
  }

  function setSemesterYear(o) {
    localStorage.setItem(SEMESTER_YEAR_KEY, JSON.stringify(o));
  }

  function updateSemesterPreview() {
    var sy = getSemesterYear();
    var label = (sy.semester === 1 ? '1st' : '2nd') + ' Semester ' + sy.year;
    var el = document.getElementById('semesterPreview');
    if (el) el.textContent = label;
  }

  (function initSemesterPanel() {
    var sel = document.getElementById('semesterSelect');
    var yearInp = document.getElementById('yearInput');
    if (!sel || !yearInp) return;
    var sy = getSemesterYear();
    sel.value = String(sy.semester);
    yearInp.value = sy.year;
    updateSemesterPreview();
    sel.addEventListener('change', function () {
      setSemesterYear({ semester: parseInt(sel.value, 10), year: parseInt(yearInp.value, 10) || 2026 });
      updateSemesterPreview();
    });
    yearInp.addEventListener('change', function () {
      setSemesterYear({ semester: parseInt(sel.value, 10), year: parseInt(yearInp.value, 10) || 2026 });
      updateSemesterPreview();
    });
  })();

  // Tab switching is handled by inline script in admin.html so it works even if this file has errors.

  // —— Upload JSON ——
  var uploadZone = document.getElementById('uploadZone');
  var jsonFileInput = document.getElementById('jsonFileInput');
  var uploadBrowse = document.getElementById('uploadBrowse');
  var uploadPreview = document.getElementById('uploadPreview');
  var uploadPreviewJson = document.getElementById('uploadPreviewJson');
  var uploadPreviewSummary = document.getElementById('uploadPreviewSummary');
  var uploadConfirm = document.getElementById('uploadConfirm');
  var uploadCancel = document.getElementById('uploadCancel');

  var pendingUpload = null;

  function handleFile(file) {
    if (!file || file.type !== 'application/json') {
      alert('Please choose a JSON file.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var json = JSON.parse(reader.result);
        pendingUpload = normalizeUploadedData(json);
        uploadPreviewJson.textContent = JSON.stringify(pendingUpload, null, 2);
        var courses = (pendingUpload.courses || []).length;
        var lecturers = pendingUpload.lecturers ? Object.keys(pendingUpload.lecturers).length : 0;
        uploadPreviewSummary.textContent = 'Courses: ' + courses + ', Lecturers: ' + lecturers + '. Click "Import into app" to save.';
        uploadPreview.style.display = 'block';
      } catch (e) {
        alert('Invalid JSON: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  function isCUTFormat(json) {
    if (!Array.isArray(json) || json.length === 0) return false;
    var first = json[0];
    return first && typeof first === 'object' &&
      first.day != null && first.time != null && first.course != null &&
      first.room != null && first.program != null;
  }

  function convertCUTFormatToApp(cutArray) {
    var dayMap = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'fri' };
    var coursesByKey = {};
    var lecturersUsed = {};

    function parseTime(timeStr) {
      var parts = (timeStr || '').split(/\s*-\s*/);
      if (parts.length < 2) return { start: 8, span: 1 };
      function toHours(s) {
        s = s.trim();
        var match = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return 8;
        var h = parseInt(match[1], 10);
        var m = parseInt(match[2], 10);
        if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
        return h + m / 60;
      }
      var startH = toHours(parts[0]);
      var endH = toHours(parts[1]);
      var start = Math.floor(startH);
      var end = Math.ceil(endH);
      if (end <= start) end = start + 1;
      var span = end - start;
      if (start < 8) start = 8;
      if (start > 16) start = 16;
      if (start + span > 17) span = 17 - start;
      if (span < 1) span = 1;
      return { start: start, span: span };
    }

    function parseRoom(roomStr) {
      if (!roomStr) return { venue: '', floor: 0 };
      var firstPart = (roomStr + '').split(',')[0].trim();
      var segs = firstPart.split('|');
      var building = segs[0] || '';
      var floor = parseInt(segs[1], 10);
      if (isNaN(floor)) floor = 0;
      var room = segs[2] || '';
      var venue = building && room ? 'Building ' + building + ', Room ' + room : (roomStr + '').trim();
      return { venue: venue, floor: floor };
    }

    cutArray.forEach(function (row) {
      var program = (row.program || '').trim();
      var year = (row.year || '').trim();
      var programName = (row.program_name || '').trim();
      var key = program + (year ? '_' + year : '');
      if (!key) return;
      if (!coursesByKey[key]) {
        coursesByKey[key] = {
          code: key,
          name: (programName || program) + (year ? ' · Year ' + year : ''),
          timetable: []
        };
      }
      var coursePart = (row.course || '').split('|')[0].trim();
      var timeInfo = parseTime(row.time);
      var roomInfo = parseRoom(row.room);
      var type = 'theory';
      if ((row.lecturer || '').indexOf('|P|') !== -1) type = 'practical';
      var lecturerId = coursePart || 'unknown';
      lecturersUsed[lecturerId] = true;
      coursesByKey[key].timetable.push({
        day: dayMap[row.day] || 'mon',
        start: timeInfo.start,
        span: timeInfo.span,
        subject: coursePart,
        venue: roomInfo.venue,
        floor: roomInfo.floor,
        type: type,
        lecturerId: lecturerId
      });
    });

    var lecturers = {};
    Object.keys(lecturersUsed).forEach(function (id) {
      lecturers[id] = {
        name: 'Lecturer (' + id + ')',
        title: id,
        office: 'TBA',
        officeFloor: 0,
        classBuilding: 'TBA',
        consultation: 'TBA',
        email: ''
      };
    });

    return { courses: Object.values(coursesByKey), lecturers: lecturers };
  }

  function normalizeUploadedData(json) {
    if (isCUTFormat(json)) {
      return convertCUTFormatToApp(json);
    }
    var out = { courses: [], lecturers: {} };
    if (Array.isArray(json.courses)) {
      out.courses = json.courses.map(function (c) {
        return {
          code: (c.code || c.courseCode || '').trim(),
          name: (c.name || c.courseName || '').trim(),
          timetable: Array.isArray(c.timetable) ? c.timetable.map(function (s) {
            return {
              day: (s.day || 'mon').toLowerCase().slice(0, 3),
              start: parseInt(s.start, 10) || 8,
              span: parseInt(s.span, 10) || 1,
              break: !!s.break,
              subject: (s.subject || '').trim(),
              venue: (s.venue || '').trim(),
              floor: s.floor !== undefined ? parseInt(s.floor, 10) : 1,
              type: (s.type || 'theory').toLowerCase(),
              lecturerId: (s.lecturerId || s.lecturer || '').trim()
            };
          }) : []
        };
      });
    } else if (json.courseCode && json.timetable) {
      out.courses = [normalizeUploadedData({ courses: [json] }).courses[0]];
    }
    if (json.lecturers && typeof json.lecturers === 'object') {
      out.lecturers = json.lecturers;
    }
    return out;
  }

  uploadBrowse.addEventListener('click', function () { jsonFileInput.click(); });
  jsonFileInput.addEventListener('change', function () {
    if (this.files && this.files[0]) handleFile(this.files[0]);
  });

  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', function () {
    uploadZone.classList.remove('drag-over');
  });
  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  uploadConfirm.addEventListener('click', function () {
    if (!pendingUpload) return;
    var existing = getStoredData();
    var courseCodes = {};
    (existing.courses || []).forEach(function (c) { courseCodes[c.code] = c; });
    (pendingUpload.courses || []).forEach(function (c) {
      if (c.code) courseCodes[c.code] = c;
    });
    existing.courses = Object.values(courseCodes);
    if (pendingUpload.lecturers) {
      Object.keys(pendingUpload.lecturers).forEach(function (id) {
        existing.lecturers[id] = pendingUpload.lecturers[id];
      });
    }
    setStoredData(existing);
    pendingUpload = null;
    uploadPreview.style.display = 'none';
    alert('Data imported.');
    refreshCoursesPanel();
    refreshLecturersPanel();
  });

  uploadCancel.addEventListener('click', function () {
    pendingUpload = null;
    uploadPreview.style.display = 'none';
  });

  // —— Courses panel ——
  var courseSelect = document.getElementById('courseSelect');
  var courseEditor = document.getElementById('courseEditor');
  var coursesHint = document.getElementById('coursesHint');
  var editCode = document.getElementById('editCode');
  var editName = document.getElementById('editName');
  var slotsList = document.getElementById('slotsList');
  var slotAdd = document.getElementById('slotAdd');
  var courseAdd = document.getElementById('courseAdd');

  var courseDelete = document.getElementById('courseDelete');
  var currentCourseCode = null;
  var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

  function refreshCoursesPanel() {
    var data = getStoredData();
    var courses = data.courses || [];
    courseSelect.innerHTML = '<option value="">Select a course…</option>';
    courses.forEach(function (c) {
      if (!c.code) return;
      var opt = document.createElement('option');
      opt.value = c.code;
      opt.textContent = c.code + (c.name ? ' · ' + c.name : '');
      courseSelect.appendChild(opt);
    });
    if (currentCourseCode && courseSelect.value !== currentCourseCode) {
      currentCourseCode = null;
      courseEditor.style.display = 'none';
      coursesHint.style.display = 'block';
    }
  }

  function renderSlots(timetable) {
    slotsList.innerHTML = '';
    (timetable || []).forEach(function (slot, index) {
      addSlotRow(slot, index);
    });
  }

  function addSlotRow(slot, index) {
    slot = slot || { day: 'mon', start: 8, span: 1, break: false, subject: '', venue: '', floor: 1, type: 'theory', lecturerId: '' };
    var row = document.createElement('div');
    row.className = 'slot-row';
    row.dataset.index = index;
    var dayOpts = DAYS.map(function (d) {
      return '<option value="' + d + '"' + (slot.day === d ? ' selected' : '') + '>' + d + '</option>';
    }).join('');
    row.innerHTML =
      '<select class="slot-field-day">' + dayOpts + '</select>' +
      '<input type="number" class="slot-field-start" min="8" max="16" value="' + (slot.start || 8) + '" placeholder="Start" />' +
      '<input type="number" class="slot-field-span" min="1" max="4" value="' + (slot.span || 1) + '" placeholder="Hrs" title="Hours" />' +
      '<input type="text" class="slot-field-subject" value="' + (slot.subject || '') + '" placeholder="Subject" ' + (slot.break ? 'disabled' : '') + ' />' +
      '<input type="text" class="slot-field-venue" value="' + (slot.venue || '') + '" placeholder="Venue" ' + (slot.break ? 'disabled' : '') + ' />' +
      '<select class="slot-field-type"><option value="theory"' + (slot.type === 'theory' ? ' selected' : '') + '>Theory</option><option value="practical"' + (slot.type === 'practical' ? ' selected' : '') + '>Practical</option></select>' +
      '<input type="number" class="slot-field-floor" min="0" max="5" value="' + (slot.floor !== undefined ? slot.floor : 1) + '" placeholder="Floor" ' + (slot.break ? 'disabled' : '') + ' />' +
      '<input type="text" class="slot-field-lecturerId" value="' + (slot.lecturerId || '') + '" placeholder="Lecturer id" ' + (slot.break ? 'disabled' : '') + ' />' +
      '<label><input type="checkbox" class="slot-field-break" ' + (slot.break ? 'checked' : '') + ' /> Break</label>' +
      '<button type="button" class="slot-remove" aria-label="Remove slot">×</button>';
    slotsList.appendChild(row);

    row.querySelector('.slot-field-break').addEventListener('change', function () {
      var isBreak = this.checked;
      row.querySelector('.slot-field-subject').disabled = isBreak;
      row.querySelector('.slot-field-venue').disabled = isBreak;
      row.querySelector('.slot-field-type').disabled = isBreak;
      row.querySelector('.slot-field-floor').disabled = isBreak;
      row.querySelector('.slot-field-lecturerId').disabled = isBreak;
    });
    row.querySelector('.slot-remove').addEventListener('click', function () {
      row.remove();
    });
  }

  function getSlotsFromForm() {
    var rows = slotsList.querySelectorAll('.slot-row');
    var timetable = [];
    rows.forEach(function (row) {
      var breakChecked = row.querySelector('.slot-field-break').checked;
      var spanEl = row.querySelector('.slot-field-span');
      timetable.push({
        day: row.querySelector('.slot-field-day').value,
        start: parseInt(row.querySelector('.slot-field-start').value, 10) || 8,
        span: spanEl ? (parseInt(spanEl.value, 10) || 1) : 1,
        break: breakChecked,
        subject: row.querySelector('.slot-field-subject').value.trim(),
        venue: row.querySelector('.slot-field-venue').value.trim(),
        floor: parseInt(row.querySelector('.slot-field-floor').value, 10),
        type: row.querySelector('.slot-field-type').value,
        lecturerId: row.querySelector('.slot-field-lecturerId').value.trim()
      });
    });
    return timetable;
  }

  function saveCurrentCourse() {
    if (!currentCourseCode) return;
    var data = getStoredData();
    var code = editCode.value.trim();
    var name = editName.value.trim();
    if (!code) return;
    var timetable = getSlotsFromForm();
    var existing = (data.courses || []).find(function (c) { return c.code === currentCourseCode; });
    if (existing) {
      existing.code = code;
      existing.name = name;
      existing.timetable = timetable;
    } else {
      data.courses.push({ code: code, name: name, timetable: timetable });
    }
    if (code !== currentCourseCode) {
      data.courses = data.courses.filter(function (c) { return c.code !== currentCourseCode; });
      currentCourseCode = code;
    }
    setStoredData(data);
    refreshCoursesPanel();
    courseSelect.value = code;
  }

  courseSelect.addEventListener('change', function () {
    var code = this.value;
    coursesHint.style.display = code ? 'none' : 'block';
    if (courseDelete) courseDelete.style.display = code ? '' : 'none';
    if (!code) {
      courseEditor.style.display = 'none';
      currentCourseCode = null;
      return;
    }
    var data = getStoredData();
    var course = (data.courses || []).find(function (c) { return c.code === code; });
    currentCourseCode = code;
    editCode.value = course ? course.code : code;
    editName.value = course ? course.name : '';
    renderSlots(course ? course.timetable : []);
    courseEditor.style.display = 'block';
  });

  slotAdd.addEventListener('click', function () {
    addSlotRow(null, slotsList.children.length);
  });

  courseAdd.addEventListener('click', function () {
    var code = prompt('Course code (e.g. IENDCY336):');
    if (!code || !code.trim()) return;
    code = code.trim();
    var data = getStoredData();
    if ((data.courses || []).some(function (c) { return c.code === code; })) {
      courseSelect.value = code;
      courseSelect.dispatchEvent(new Event('change'));
      return;
    }
    data.courses = data.courses || [];
    data.courses.push({ code: code, name: '', timetable: [] });
    setStoredData(data);
    refreshCoursesPanel();
    courseSelect.value = code;
    courseSelect.dispatchEvent(new Event('change'));
  });

  editCode.addEventListener('blur', saveCurrentCourse);
  editName.addEventListener('blur', saveCurrentCourse);
  slotsList.addEventListener('change', saveCurrentCourse);
  slotsList.addEventListener('input', function () {
    clearTimeout(slotsList._saveTimer);
    slotsList._saveTimer = setTimeout(saveCurrentCourse, 800);
  });

  // —— Lecturers panel ——
  var lecturersList = document.getElementById('lecturersList');
  var lecturerEditor = document.getElementById('lecturerEditor');
  var lecturerEditorTitle = document.getElementById('lecturerEditorTitle');
  var lecturerAdd = document.getElementById('lecturerAdd');
  var lecturerSave = document.getElementById('lecturerSave');
  var lecturerCancel = document.getElementById('lecturerCancel');

  var editingLecturerId = null;

  function refreshLecturersPanel() {
    if (!lecturersList) return;
    var data = getStoredData();
    var lecturers = data.lecturers || {};
    var ids = Object.keys(lecturers).sort();
    lecturersList.innerHTML = '';
    ids.forEach(function (id) {
      var L = lecturers[id];
      var card = document.createElement('div');
      card.className = 'lecturer-card';
      card.innerHTML =
        '<div class="lecturer-card-main">' +
          '<span class="lecturer-card-id">' + escapeHtml(id) + '</span>' +
          '<span class="lecturer-card-name">' + escapeHtml(L.name || '—') + '</span>' +
          '<span class="lecturer-card-title">' + escapeHtml(L.title || '') + '</span>' +
        '</div>' +
        '<div class="lecturer-card-actions">' +
          '<button type="button" class="btn btn-small lecturer-edit" data-id="' + escapeHtml(id) + '">Edit</button>' +
          '<button type="button" class="btn btn-small btn-ghost lecturer-delete" data-id="' + escapeHtml(id) + '">Delete</button>' +
        '</div>';
      lecturersList.appendChild(card);
    });
    lecturersList.querySelectorAll('.lecturer-edit').forEach(function (btn) {
      btn.addEventListener('click', function () { openLecturerEditor(btn.dataset.id); });
    });
    lecturersList.querySelectorAll('.lecturer-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Delete lecturer “‘ + btn.dataset.id + '”? Timetable slots using this id will show no lecturer details.')) return;
        var data = getStoredData();
        if (data.lecturers[btn.dataset.id]) delete data.lecturers[btn.dataset.id];
        setStoredData(data);
        refreshLecturersPanel();
        if (editingLecturerId === btn.dataset.id) closeLecturerEditor();
      });
    });
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function openLecturerEditor(id) {
    editingLecturerId = id || null;
    lecturerEditorTitle.textContent = id ? 'Edit lecturer' : 'New lecturer';
    var data = getStoredData();
    var L = id ? (data.lecturers[id] || {}) : {};
    document.getElementById('lectId').value = id || '';
    document.getElementById('lectId').disabled = !!id;
    document.getElementById('lectName').value = L.name || '';
    document.getElementById('lectTitle').value = L.title || '';
    document.getElementById('lectOffice').value = L.office || '';
    document.getElementById('lectOfficeFloor').value = L.officeFloor !== undefined ? L.officeFloor : 1;
    document.getElementById('lectClassBuilding').value = L.classBuilding || '';
    document.getElementById('lectConsultation').value = L.consultation || '';
    document.getElementById('lectEmail').value = L.email || '';
    document.getElementById('lectPhoto').value = L.photo || '';
    lecturerEditor.style.display = 'block';
  }

  function closeLecturerEditor() {
    lecturerEditor.style.display = 'none';
    editingLecturerId = null;
  }

  function saveLecturer() {
    var idRaw = document.getElementById('lectId').value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!idRaw) {
      alert('Please enter a lecturer ID (e.g. chen).');
      return;
    }
    var data = getStoredData();
    data.lecturers = data.lecturers || {};
    var oldId = editingLecturerId;
    if (oldId && oldId !== idRaw) {
      delete data.lecturers[oldId];
    }
    data.lecturers[idRaw] = {
      name: document.getElementById('lectName').value.trim(),
      title: document.getElementById('lectTitle').value.trim(),
      office: document.getElementById('lectOffice').value.trim(),
      officeFloor: parseInt(document.getElementById('lectOfficeFloor').value, 10) || 0,
      classBuilding: document.getElementById('lectClassBuilding').value.trim(),
      consultation: document.getElementById('lectConsultation').value.trim(),
      email: document.getElementById('lectEmail').value.trim(),
      photo: document.getElementById('lectPhoto').value.trim()
    };
    setStoredData(data);
    refreshLecturersPanel();
    closeLecturerEditor();
  }

  if (lecturerAdd) lecturerAdd.addEventListener('click', function () { openLecturerEditor(null); });
  if (lecturerSave) lecturerSave.addEventListener('click', saveLecturer);
  if (lecturerCancel) lecturerCancel.addEventListener('click', closeLecturerEditor);

  refreshLecturersPanel();

  // —— Venue images panel ——
  var venueSetSelect = document.getElementById('venueSetSelect');
  var venueSetAdd = document.getElementById('venueSetAdd');

  function getCurrentVenueSetKey() {
    return (venueSetSelect && venueSetSelect.value) ? venueSetSelect.value : 'default';
  }

  function loadVenuePreviews() {
    var images = getVenueImages();
    var key = getCurrentVenueSetKey();
    var set = images[key] || {};
    for (var i = 1; i <= 5; i++) {
      var el = document.getElementById('venuePreview' + i);
      if (!el) continue;
      el.innerHTML = '';
      if (set[i] || set['' + i]) {
        var img = document.createElement('img');
        img.src = set[i] || set['' + i];
        img.alt = 'Step ' + i;
        el.appendChild(img);
      }
    }
  }

  function saveVenueImage(step, dataUrl) {
    var images = getVenueImages();
    var key = getCurrentVenueSetKey();
    if (!images[key]) images[key] = {};
    images[key][step] = dataUrl;
    setVenueImages(images);
    loadVenuePreviews();
  }

  document.querySelectorAll('.venue-upload-btn').forEach(function (btn) {
    var step = btn.dataset.step;
    var fileInput = document.getElementById('venueFile' + step);
    if (!fileInput) return;
    btn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      var reader = new FileReader();
      reader.onload = function () {
        saveVenueImage(step, reader.result);
      };
      reader.readAsDataURL(file);
      this.value = '';
    });
  });

  if (venueSetAdd) venueSetAdd.addEventListener('click', function () {
    var name = prompt('Name for this venue set (e.g. "Block A" or "Room 101"):');
    if (!name || !name.trim()) return;
    name = name.trim();
    var images = getVenueImages();
    if (images[name]) {
      venueSetSelect.value = name;
      loadVenuePreviews();
      loadVenueInstructions();
      return;
    }
    images[name] = {};
    setVenueImages(images);
    var opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    venueSetSelect.appendChild(opt);
    venueSetSelect.value = name;
    loadVenuePreviews();
    loadVenueInstructions();
  });

  // Populate venue set dropdown from stored keys
  if (venueSetSelect) {
    var venueImages = getVenueImages();
    Object.keys(venueImages).forEach(function (key) {
      if (key === 'default') return;
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      venueSetSelect.appendChild(opt);
    });
  }

  // —— Delete course ——
  if (courseDelete) {
    courseDelete.addEventListener('click', function () {
      if (!currentCourseCode) return;
      if (!confirm('Delete course "' + currentCourseCode + '"? This removes the course and its timetable.')) return;
      var data = getStoredData();
      data.courses = (data.courses || []).filter(function (c) { return c.code !== currentCourseCode; });
      setStoredData(data);
      currentCourseCode = null;
      courseEditor.style.display = 'none';
      courseDelete.style.display = 'none';
      coursesHint.style.display = 'block';
      refreshCoursesPanel();
    });
  }

  // —— Save course button (explicit) ——
  var courseSaveBtn = document.getElementById('courseSave');
  if (courseSaveBtn) {
    courseSaveBtn.addEventListener('click', function () {
      saveCurrentCourse();
      alert('Course saved.');
    });
  }

  // —— Data management panel ——
  var dataExport = document.getElementById('dataExport');
  var dataClear = document.getElementById('dataClear');

  if (dataExport) {
    dataExport.addEventListener('click', function () {
      var data = getStoredData();
      data._venueImages = getVenueImages();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'timetable_export.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    });
  }

  if (dataClear) {
    dataClear.addEventListener('click', function () {
      if (!confirm('Are you sure? This will delete ALL courses, lecturers, and venue images from this browser.')) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(VENUE_IMAGES_KEY);
      refreshCoursesPanel();
      refreshLecturersPanel();
      loadVenuePreviews();
      currentCourseCode = null;
      courseEditor.style.display = 'none';
      if (courseDelete) courseDelete.style.display = 'none';
      alert('All data cleared.');
    });
  }

  // —— Venue step instructions ——
  var VENUE_INSTR_KEY = 'timetable_venue_instructions';

  function getVenueInstructions() {
    try {
      var raw = localStorage.getItem(VENUE_INSTR_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function setVenueInstructions(obj) {
    localStorage.setItem(VENUE_INSTR_KEY, JSON.stringify(obj));
  }

  function loadVenueInstructions() {
    var instrs = getVenueInstructions();
    var key = getCurrentVenueSetKey();
    var set = instrs[key] || {};
    for (var i = 1; i <= 5; i++) {
      var el = document.getElementById('venueInstr' + i);
      if (el) el.value = set[i] || '';
    }
  }

  for (var _si = 1; _si <= 5; _si++) {
    (function (step) {
      var el = document.getElementById('venueInstr' + step);
      if (!el) return;
      el.addEventListener('blur', function () {
        var instrs = getVenueInstructions();
        var key = getCurrentVenueSetKey();
        if (!instrs[key]) instrs[key] = {};
        instrs[key][step] = el.value.trim();
        setVenueInstructions(instrs);
      });
    })(_si);
  }

  if (venueSetSelect) {
    venueSetSelect.addEventListener('change', function () {
      loadVenuePreviews();
      loadVenueInstructions();
    });
  }

  refreshCoursesPanel();
  loadVenuePreviews();
  loadVenueInstructions();
})();
