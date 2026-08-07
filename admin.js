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
  var coursesList = document.getElementById('coursesList');
  var courseEditor = document.getElementById('courseEditor');
  var coursesHint = document.getElementById('coursesHint');
  var courseEditorCodeEl = document.getElementById('courseEditorCode');
  var courseEditorCloseBtn = document.getElementById('courseEditorClose');
  var editFolder = document.getElementById('editFolder');
  var editCode = document.getElementById('editCode');
  var editName = document.getElementById('editName');
  var slotsList = document.getElementById('slotsList');
  var slotAdd = document.getElementById('slotAdd');
  var courseAdd = document.getElementById('courseAdd');
  var coursePublish = document.getElementById('coursePublish');
  var publishBanner = document.getElementById('publishBanner');
  var publishBannerDetail = document.getElementById('publishBannerDetail');
  var courseDelete = document.getElementById('courseDelete');
  var courseUploadZoneEl = document.getElementById('courseUploadZone');
  var courseJsonInputEl = document.getElementById('courseJsonInput');
  var courseUploadBrowseBtn = document.getElementById('courseUploadBrowse');
  var courseUploadPreviewEl = document.getElementById('courseUploadPreview');
  var courseUploadPreviewJsonEl = document.getElementById('courseUploadPreviewJson');
  var courseUploadPreviewSummaryEl = document.getElementById('courseUploadPreviewSummary');
  var courseUploadConfirmBtn = document.getElementById('courseUploadConfirm');
  var courseUploadCancelBtn = document.getElementById('courseUploadCancel');
  var currentCourseCode = null;
  var pendingCourseUpload = null;
  var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

  function refreshCourseCards() {
    if (!coursesList) return;

    // Move editor out of coursesList before clearing it
    if (courseEditor && coursesList.contains(courseEditor)) {
      var panel = document.getElementById('panel-courses');
      if (panel) panel.appendChild(courseEditor);
    }

    var data = getStoredData();
    var courses = data.courses || [];
    coursesList.innerHTML = '';

    if (courses.length === 0) {
      if (coursesHint) coursesHint.style.display = '';
      return;
    }
    if (coursesHint) coursesHint.style.display = 'none';

    var grouped = {};
    courses.forEach(function (c) {
      if (!c.code) return;
      var folder = c.folder || 'Other';
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(c);
    });

    Object.keys(grouped).sort().forEach(function (folder) {
      var groupEl = document.createElement('div');
      groupEl.className = 'course-folder-group';

      var labelEl = document.createElement('div');
      labelEl.className = 'course-folder-label';
      labelEl.textContent = folder;
      groupEl.appendChild(labelEl);

      grouped[folder].forEach(function (c) {
        var isActive = currentCourseCode === c.code;
        var isEnabled = c.enabled !== false;
        var slotCount = (c.timetable || []).filter(function (s) { return !s.break; }).length;

        var card = document.createElement('div');
        card.className = 'course-card' + (isActive ? ' is-active' : '');
        card.dataset.code = c.code;
        card.innerHTML =
          '<div class="course-card-body">' +
            '<div class="course-card-info">' +
              '<span class="course-card-code">' + escapeHtml(c.code) + '</span>' +
              '<span class="course-card-name">' + escapeHtml(c.name || '—') + '</span>' +
            '</div>' +
            '<div class="course-card-controls">' +
              '<span class="course-slot-count">' + slotCount + ' slot' + (slotCount !== 1 ? 's' : '') + '</span>' +
              '<button type="button" class="course-visibility-btn ' + (isEnabled ? 'is-enabled' : 'is-disabled') + '" data-code="' + escapeHtml(c.code) + '">' +
                (isEnabled ? 'Visible' : 'Hidden') +
              '</button>' +
              '<button type="button" class="btn btn-small course-edit-btn" data-code="' + escapeHtml(c.code) + '">' +
                (isActive ? 'Close' : 'Edit') +
              '</button>' +
            '</div>' +
          '</div>';
        groupEl.appendChild(card);
      });

      coursesList.appendChild(groupEl);
    });

    // Insert editor inline after active card (accordion)
    if (currentCourseCode && courseEditor) {
      var activeCard = coursesList.querySelector('[data-code="' + currentCourseCode + '"]');
      if (activeCard) {
        activeCard.after(courseEditor);
        courseEditor.style.display = 'block';
      }
    }

    coursesList.querySelectorAll('.course-visibility-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var code = btn.dataset.code;
        var d = getStoredData();
        var course = (d.courses || []).find(function (c) { return c.code === code; });
        if (!course) return;
        course.enabled = (course.enabled === false) ? true : false;
        setStoredData(d);
        var nowEnabled = course.enabled !== false;
        btn.className = 'course-visibility-btn ' + (nowEnabled ? 'is-enabled' : 'is-disabled');
        btn.textContent = nowEnabled ? 'Visible' : 'Hidden';
        refreshPublishBanner();
      });
    });

    coursesList.querySelectorAll('.course-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.dataset.code;
        if (currentCourseCode === code) {
          closeCourseEditor();
        } else {
          openCourseEditor(code);
        }
      });
    });
  }

  function refreshCoursesPanel() { refreshCourseCards(); refreshPublishBanner(); }

  var liveDisabledSet = null;
  var liveLoadFailed = false;

  function fetchLiveDisabledCodes() {
    return fetch('/api/visibility', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        liveDisabledSet = {};
        (Array.isArray(data && data.disabledCodes) ? data.disabledCodes : []).forEach(function (c) {
          liveDisabledSet[c] = true;
        });
        liveLoadFailed = false;
      })
      .catch(function () { liveLoadFailed = true; });
  }

  function getLocalDisabledCodes() {
    var d = getStoredData();
    var out = [];
    (d.courses || []).forEach(function (c) {
      if (c && c.code && c.enabled === false) out.push(c.code);
    });
    out.sort();
    return out;
  }

  function diffLiveVsLocal() {
    var local = getLocalDisabledCodes();
    if (!liveDisabledSet) return { added: local, removed: [], total: local.length };
    var localSet = {};
    local.forEach(function (c) { localSet[c] = true; });
    var added = local.filter(function (c) { return !liveDisabledSet[c]; });
    var removed = Object.keys(liveDisabledSet).filter(function (c) { return !localSet[c]; });
    return { added: added, removed: removed, total: added.length + removed.length };
  }

  function refreshPublishBanner() {
    if (!publishBanner || !publishBannerDetail) return;
    if (liveLoadFailed) {
      publishBannerDetail.innerHTML = '<strong>Live visibility API unavailable.</strong> Set up Vercel KV and the <code>ADMIN_PASS_HASH</code> env var, then redeploy. Toggles only affect this device until then.';
      publishBanner.style.display = 'flex';
      return;
    }
    if (!liveDisabledSet) {
      publishBanner.style.display = 'none';
      return;
    }
    var diff = diffLiveVsLocal();
    if (diff.total === 0) {
      publishBanner.style.display = 'none';
      return;
    }
    var bits = [];
    if (diff.added.length) bits.push(diff.added.length + ' newly hidden (' + diff.added.join(', ') + ')');
    if (diff.removed.length) bits.push(diff.removed.length + ' newly visible (' + diff.removed.join(', ') + ')');
    publishBannerDetail.innerHTML = bits.join(' · ') + ' — click <em>Publish visibility</em> to push these changes live so mobile and other devices update instantly.';
    publishBanner.style.display = 'flex';
  }

  function publishVisibility() {
    var pw;
    try { pw = sessionStorage.getItem('admin_pw'); } catch (e) { pw = null; }
    if (!pw) {
      alert('Authentication expired. Please refresh the page and sign in again.');
      return;
    }
    var codes = getLocalDisabledCodes();
    var prev = coursePublish ? coursePublish.textContent : null;
    if (coursePublish) { coursePublish.disabled = true; coursePublish.textContent = 'Publishing…'; }
    fetch('/api/visibility', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + pw
      },
      body: JSON.stringify({ disabledCodes: codes })
    })
      .then(function (r) {
        if (r.status === 401) throw new Error('Server rejected the passcode. Check the ADMIN_PASS_HASH env var on Vercel.');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (resp) {
        liveDisabledSet = {};
        codes.forEach(function (c) { liveDisabledSet[c] = true; });
        liveLoadFailed = false;
        refreshPublishBanner();
        alert('Published ' + (resp.count != null ? resp.count : codes.length) + ' hidden course' + ((resp.count === 1) ? '' : 's') + '. Mobile and other devices will see the change on next page load.');
      })
      .catch(function (err) {
        alert('Publish failed: ' + err.message);
      })
      .finally(function () {
        if (coursePublish) { coursePublish.disabled = false; coursePublish.textContent = prev || 'Publish visibility'; }
      });
  }

  if (coursePublish) coursePublish.addEventListener('click', publishVisibility);

  function openCourseEditor(code) {
    var data = getStoredData();
    var course = (data.courses || []).find(function (c) { return c.code === code; });
    currentCourseCode = code;
    if (courseEditorCodeEl) courseEditorCodeEl.textContent = code;
    editFolder.value = course ? (course.folder || '') : '';
    editCode.value = course ? course.code : code;
    editName.value = course ? course.name : '';
    if (courseDelete) courseDelete.style.display = '';
    if (courseUploadPreviewEl) courseUploadPreviewEl.style.display = 'none';
    pendingCourseUpload = null;
    renderSlots(course ? course.timetable : []);
    refreshCourseCards();
    setTimeout(function () {
      if (courseEditor) courseEditor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }

  function closeCourseEditor() {
    currentCourseCode = null;
    if (courseEditor) {
      courseEditor.style.display = 'none';
      var panel = document.getElementById('panel-courses');
      if (panel) panel.appendChild(courseEditor);
    }
    refreshCourseCards();
  }

  if (courseEditorCloseBtn) {
    courseEditorCloseBtn.addEventListener('click', closeCourseEditor);
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
    var folder = editFolder.value.trim();
    if (!code) return;
    var timetable = getSlotsFromForm();
    var existing = (data.courses || []).find(function (c) { return c.code === currentCourseCode; });
    if (existing) {
      existing.code = code;
      existing.name = name;
      existing.folder = folder || 'Other';
      existing.timetable = timetable;
      // enabled is toggled separately via the card visibility button
    } else {
      (data.courses = data.courses || []).push({ code: code, name: name, folder: folder || 'Other', enabled: true, timetable: timetable });
    }
    if (code !== currentCourseCode) {
      data.courses = data.courses.filter(function (c) { return c.code !== currentCourseCode; });
      currentCourseCode = code;
      if (courseEditorCodeEl) courseEditorCodeEl.textContent = code;
    }
    setStoredData(data);
  }

  slotAdd.addEventListener('click', function () {
    addSlotRow(null, slotsList.children.length);
  });

  courseAdd.addEventListener('click', function () {
    var code = prompt('Course code (e.g. IENDCY336) — this will also be the folder name:');
    if (!code || !code.trim()) return;
    code = code.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      alert('Course code must contain only letters, numbers, underscores, or hyphens (no spaces or slashes), since it is also used as a folder name.');
      return;
    }
    var data = getStoredData();
    if ((data.courses || []).some(function (c) { return c.code === code; })) {
      openCourseEditor(code);
      return;
    }
    data.courses = data.courses || [];
    // `manual` marks this as hand-added so the bundle reconcile keeps it.
    data.courses.push({ code: code, name: '', folder: code, enabled: true, timetable: [], manual: true });
    setStoredData(data);
    refreshCourseCards();
    openCourseEditor(code);
  });

  if (courseDelete) {
    courseDelete.addEventListener('click', function () {
      if (!currentCourseCode) return;
      if (!confirm('Delete course "' + currentCourseCode + '"? This removes the course and its timetable.')) return;
      var data = getStoredData();
      data.courses = (data.courses || []).filter(function (c) { return c.code !== currentCourseCode; });
      setStoredData(data);
      closeCourseEditor();
    });
  }

  var courseSaveBtn = document.getElementById('courseSave');
  if (courseSaveBtn) {
    courseSaveBtn.addEventListener('click', function () {
      saveCurrentCourse();
      refreshCourseCards();
      alert('Course saved.');
    });
  }

  editCode.addEventListener('blur', function () { saveCurrentCourse(); refreshCourseCards(); });
  editName.addEventListener('blur', function () { saveCurrentCourse(); refreshCourseCards(); });
  editFolder.addEventListener('blur', function () { saveCurrentCourse(); refreshCourseCards(); });
  slotsList.addEventListener('change', saveCurrentCourse);
  slotsList.addEventListener('input', function () {
    clearTimeout(slotsList._saveTimer);
    slotsList._saveTimer = setTimeout(saveCurrentCourse, 800);
  });

  // Course-level upload with drag-and-drop and preview
  function courseHandleFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var json = JSON.parse(reader.result);
        var rawSlots = [];
        if (Array.isArray(json.timetable)) {
          rawSlots = json.timetable;
        } else if (Array.isArray(json.courses)) {
          var found = json.courses.find(function (c) { return c.code === currentCourseCode; });
          rawSlots = (found || json.courses[0] || {}).timetable || [];
        } else if (isCUTFormat(json)) {
          var conv = convertCUTFormatToApp(json);
          var found2 = (conv.courses || []).find(function (c) { return c.code === currentCourseCode; });
          rawSlots = (found2 || conv.courses[0] || {}).timetable || [];
        } else if (Array.isArray(json)) {
          rawSlots = json;
        }
        if (!rawSlots.length) { alert('No timetable slots found in this file.'); return; }
        pendingCourseUpload = rawSlots;
        if (courseUploadPreviewJsonEl) courseUploadPreviewJsonEl.textContent = JSON.stringify(rawSlots.slice(0, 3), null, 2) + (rawSlots.length > 3 ? '\n\n... and ' + (rawSlots.length - 3) + ' more slots' : '');
        if (courseUploadPreviewSummaryEl) courseUploadPreviewSummaryEl.textContent = rawSlots.length + ' slot' + (rawSlots.length !== 1 ? 's' : '') + ' found. This will replace this course\'s current timetable.';
        if (courseUploadPreviewEl) courseUploadPreviewEl.style.display = 'block';
      } catch (e) { alert('Invalid JSON: ' + e.message); }
    };
    reader.readAsText(file);
  }

  if (courseUploadBrowseBtn) courseUploadBrowseBtn.addEventListener('click', function () { if (courseJsonInputEl) courseJsonInputEl.click(); });
  if (courseJsonInputEl) courseJsonInputEl.addEventListener('change', function () { if (this.files && this.files[0]) courseHandleFile(this.files[0]); this.value = ''; });
  if (courseUploadZoneEl) {
    courseUploadZoneEl.addEventListener('dragover', function (e) { e.preventDefault(); courseUploadZoneEl.classList.add('drag-over'); });
    courseUploadZoneEl.addEventListener('dragleave', function () { courseUploadZoneEl.classList.remove('drag-over'); });
    courseUploadZoneEl.addEventListener('drop', function (e) {
      e.preventDefault(); courseUploadZoneEl.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) courseHandleFile(e.dataTransfer.files[0]);
    });
  }
  if (courseUploadConfirmBtn) {
    courseUploadConfirmBtn.addEventListener('click', function () {
      if (!pendingCourseUpload || !currentCourseCode) return;
      var data = getStoredData();
      var course = (data.courses || []).find(function (c) { return c.code === currentCourseCode; });
      if (course) {
        course.timetable = pendingCourseUpload;
        setStoredData(data);
        renderSlots(pendingCourseUpload);
        if (courseUploadPreviewEl) courseUploadPreviewEl.style.display = 'none';
        pendingCourseUpload = null;
        refreshCourseCards();
        alert('Imported ' + course.timetable.length + ' slot' + (course.timetable.length !== 1 ? 's' : '') + '.');
      }
    });
  }
  if (courseUploadCancelBtn) courseUploadCancelBtn.addEventListener('click', function () { pendingCourseUpload = null; if (courseUploadPreviewEl) courseUploadPreviewEl.style.display = 'none'; });

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
        if (!confirm('Delete lecturer "' + btn.dataset.id + '"? Timetable slots using this id will show no lecturer details.')) return;
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

  function migrateCourseCodes() {
    var data = getStoredData();
    if (!data.courses || !data.courses.length) return;
    var changed = false;
    data.courses.forEach(function (c) {
      if (typeof c.code === 'string' && /_Year(\d+)$/.test(c.code)) {
        c.code = c.code.replace(/_Year(\d+)$/, '_$1');
        changed = true;
      }
    });
    if (changed) setStoredData(data);
  }

  function initAdminFromBundle() {
    migrateCourseCodes();
    // Always reconcile against bundle.json rather than seeding only on a first
    // visit. The stored copy is a snapshot: when the timetable data changes
    // (e.g. a new semester), a browser that has visited before would otherwise
    // keep showing last semester's programs indefinitely.
    fetch('timetable/bundle.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (bundle) {
        var data = getStoredData();
        var stored = {};
        (data.courses || []).forEach(function (c) { stored[c.code] = c; });

        var courses = [];
        var lecturers = data.lecturers || {};
        (bundle.programs || []).forEach(function (prog) {
          if (prog.lecturers && typeof prog.lecturers === 'object') {
            Object.keys(prog.lecturers).forEach(function (id) {
              lecturers[id] = prog.lecturers[id];
            });
          }
          (prog.years || []).forEach(function (y) {
            var yearNum = parseInt(y.year, 10) || y.year;
            var code = prog.code + '_' + y.year;
            var prev = stored[code];
            courses.push({
              code: code,
              name: prog.name + ' · Year ' + yearNum,
              folder: prog.code,
              // Visibility is an admin decision, so keep whatever was set here.
              enabled: prev && typeof prev.enabled === 'boolean' ? prev.enabled : true,
              timetable: Array.isArray(y.timetable) ? y.timetable : []
            });
          });
        });

        // Keep only courses explicitly added by hand in the admin panel. A
        // stored course that is absent from the bundle and not flagged manual
        // is a leftover from older timetable data (e.g. last semester's
        // programs) and must not survive, or removed programs would reappear.
        (data.courses || []).forEach(function (c) {
          if (!c || !c.manual) return;
          if (!courses.some(function (n) { return n.code === c.code; })) courses.push(c);
        });

        data.courses = courses;
        data.lecturers = lecturers;
        setStoredData(data);
        refreshCoursesPanel();
        refreshLecturersPanel();
      })
      .catch(function () {});
  }

  initAdminFromBundle();
  refreshCoursesPanel();
  fetchLiveDisabledCodes().then(refreshPublishBanner);
  loadVenuePreviews();
  loadVenueInstructions();
})();
