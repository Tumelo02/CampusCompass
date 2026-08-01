(function () {
  'use strict';

  var LAST_COURSE_KEY = 'timetable_last_course';

  (function setupTitleReload() {
    var title = document.getElementById('appTitle');
    if (!title) return;
    function reload() {
      try { localStorage.removeItem(LAST_COURSE_KEY); } catch (e) {}
      window.location.reload();
    }
    title.addEventListener('click', reload);
    title.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        reload();
      }
    });
  })();

  var THEME_KEY = 'timetable_theme';
  (function setupThemeToggle() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  })();

  // Share menu — native share sheet on mobile, social links elsewhere
  (function setupShareMenu() {
    var btn = document.getElementById('shareBtn');
    var menu = document.getElementById('shareMenu');
    if (!btn || !menu) return;

    var SHARE_TITLE = 'Campus Compass';
    var SHARE_TEXT = 'Campus Compass — your CUT class timetable, lecturer info, and campus directions in one place.';

    function shareUrl() {
      return window.location.origin + window.location.pathname;
    }

    function buildLinks() {
      var url = encodeURIComponent(shareUrl());
      var text = encodeURIComponent(SHARE_TEXT);
      var title = encodeURIComponent(SHARE_TITLE);
      var targets = {
        whatsapp: 'https://api.whatsapp.com/send?text=' + text + '%20' + url,
        x: 'https://twitter.com/intent/tweet?text=' + text + '&url=' + url,
        facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + url,
        telegram: 'https://t.me/share/url?url=' + url + '&text=' + text,
        linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + url + '&title=' + title
      };
      Object.keys(targets).forEach(function (key) {
        var link = menu.querySelector('[data-share="' + key + '"]');
        if (link) link.setAttribute('href', targets[key]);
      });
    }

    function setOpen(open) {
      if (open) {
        buildLinks();
        var profileMenu = document.getElementById('profileMenu');
        var profileBtn = document.getElementById('profileBtn');
        if (profileMenu && profileMenu.classList.contains('open')) {
          profileMenu.classList.remove('open');
          profileMenu.setAttribute('aria-hidden', 'true');
          if (profileBtn) {
            profileBtn.classList.remove('open');
            profileBtn.setAttribute('aria-expanded', 'false');
          }
        }
      }
      btn.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function nativeShare() {
      if (!navigator.share) return false;
      try {
        navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: shareUrl() }).catch(function () {});
        return true;
      } catch (e) {
        return false;
      }
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Phones/tablets get the OS share sheet, which already lists every installed app
      var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (coarse && !menu.classList.contains('open') && nativeShare()) return;
      setOpen(!menu.classList.contains('open'));
    });

    var copyBtn = menu.querySelector('[data-share="copy"]');
    if (copyBtn) {
      var copyLabel = copyBtn.querySelector('.share-copy-label');
      var copyTimer = null;
      copyBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var url = shareUrl();
        function done(ok) {
          if (copyLabel) copyLabel.textContent = ok ? 'Link copied!' : 'Press Ctrl+C to copy';
          copyBtn.classList.toggle('copied', ok);
          clearTimeout(copyTimer);
          copyTimer = setTimeout(function () {
            if (copyLabel) copyLabel.textContent = 'Copy link';
            copyBtn.classList.remove('copied');
          }, 2000);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
        } else {
          done(false);
        }
      });
    }

    menu.addEventListener('click', function (e) {
      if (e.target.closest('a.share-option')) setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('open')) return;
      if (!menu.contains(e.target) && e.target !== btn) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) setOpen(false);
    });
  })();

  // Profile menu (UI only — login wiring lives in a future update)
  (function setupProfileMenu() {
    var btn = document.getElementById('profileBtn');
    var menu = document.getElementById('profileMenu');
    if (!btn || !menu) return;

    function setOpen(open) {
      if (open) {
        var shareMenu = document.getElementById('shareMenu');
        var shareBtn = document.getElementById('shareBtn');
        if (shareMenu && shareMenu.classList.contains('open')) {
          shareMenu.classList.remove('open');
          shareMenu.setAttribute('aria-hidden', 'true');
          if (shareBtn) {
            shareBtn.classList.remove('open');
            shareBtn.setAttribute('aria-expanded', 'false');
          }
        }
      }
      btn.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!menu.classList.contains('open'));
    });
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('open')) return;
      if (!menu.contains(e.target) && e.target !== btn) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) setOpen(false);
    });
  })();

  var VENUE_IMAGES_KEY = 'timetable_venue_images';
  var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
  var DAY_LABELS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };
  var dayToCol = { mon: 2, tue: 3, wed: 4, thu: 5, fri: 6 };
  var SEMESTER_YEAR_KEY = 'timetable_semester_year';
  var TIMETABLE_INDEX_URL = 'timetable/index.json';
  var TIMETABLE_BUNDLE_URL = 'timetable/bundle.json';
  var TIMETABLE_CACHE_KEY = 'timetable_bundle_cache_v1';
  var VISIBILITY_API_URL = '/api/visibility';
  var liveDisabledCodes = null;

  function getSemesterLabel() {
    try {
      var raw = localStorage.getItem(SEMESTER_YEAR_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && (o.semester === 1 || o.semester === 2) && o.year)
          return (o.semester === 1 ? '1st' : '2nd') + ' Semester ' + o.year;
      }
    } catch (e) {}
    return '1st Semester 2026';
  }

  // Placeholder images - empty strings for faster loading (no external requests)
  // Add local image paths here if you have them
  var PLACEHOLDER_IMAGES = {
    class: ['', '', '', '', ''],
    office: ['', '', '', '', '']
  };

  // Building image mappings (building number → image paths)
  var BUILDING_IMAGES = {
    '12': 'Images/Building_exterior/BHP2.jpg',
    '13': 'Images/Building_exterior/Eng_Tech_Build.jpg',
    '14': 'Images/Building_exterior/BHP.png',
    '20': 'Images/Building_exterior/Yarona.png'
  };

  // Campus map images for step 1 (building number → image path)
  var CAMPUS_MAP_IMAGES = {
    '12': 'Images/CUT_MAP/CUT_BHP2.png',
    '13': 'Images/CUT_MAP/CUT_Eng_Tech_Build.png',
    '14': 'Images/CUT_MAP/CUT_BHP.png',
    '20': 'Images/CUT_MAP/CUT_Yarona.png'
  };

  // ── Data layer ──────────────────────────────────────────────────────────────
  // Timetables and lecturer info come from JSON files under `timetable/`.
  // `timetable/index.json` is the master directory of programs → per-year
  // timetable files + per-program lecturers file.

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Failed to load ' + url + ' (' + r.status + ')');
      return r.json();
    });
  }

  var MINS_PER_ROW = 5; // grid resolution: 1 row = 5 minutes (12 rows per hour)
  var GRID_START_HOUR = 7; // timetable starts at 07:00 (earliest class is 7:55 AM)

  function parseTimeRange(str) {
    var m = (str || '').match(/(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return { start: 8, span: 1, startHour: 8, startMinute: 0, endHour: 9, endMinute: 0 };
    var sh = parseInt(m[1], 10) % 12 + (/PM/i.test(m[3]) ? 12 : 0);
    var sm = parseInt(m[2], 10);
    var eh = parseInt(m[4], 10) % 12 + (/PM/i.test(m[6]) ? 12 : 0);
    var em = parseInt(m[5], 10);
    var startMin = sh * 60 + sm;
    var endMin = eh * 60 + em;
    // start = whole hour (for day-ordering logic); span = whole hours (legacy, kept for compat)
    var start = Math.floor(startMin / 60);
    var span = Math.max(1, Math.ceil((endMin - startMin) / 60));
    return {
      start: start,
      span: span,
      startHour: sh,
      startMinute: sm,
      endHour: eh,
      endMinute: em
    };
  }

  // Convert exact time to a grid row number (1-indexed; row 1 = header, row 2 = GRID_START_HOUR:00)
  function timeToGridRow(hour, minute) {
    var offsetMins = (hour - GRID_START_HOUR) * 60 + minute;
    return Math.max(2, 2 + Math.round(offsetMins / MINS_PER_ROW));
  }

  // Convert duration in minutes to grid row span
  function durationToSpan(durationMins) {
    return Math.max(1, Math.ceil(durationMins / MINS_PER_ROW));
  }

  function normalizeRoom(room) {
    // Strip a single leading zero only when the room number has 4+ digits starting with 0
    // e.g. "0003" -> "003", "0222" -> "222", "001" -> "001" (already 3, unchanged)
    while (room.length > 3 && room.charAt(0) === '0') {
      room = room.slice(1);
    }
    return room;
  }

  function parseRoom(str) {
    var first = (str || '').split(',')[0].trim();
    var parts = first.split('|');
    var bldg = (parts[0] || '').trim();
    var floor = parseInt(parts[1], 10);
    var room = normalizeRoom((parts[2] || '').trim());
    if (isNaN(floor)) floor = 0;
    var venue = '';
    if (bldg) venue = 'Building ' + bldg;
    if (room) venue += (venue ? ', Room ' : 'Room ') + room;
    return { venue: venue || '', floor: floor, buildingNumber: bldg, roomNumber: room };
  }

  function parseType(lecturerField) {
    var m = (lecturerField || '').match(/\|([CPT])\|/);
    if (!m) return 'theory';
    if (m[1] === 'P') return 'practical';
    if (m[1] === 'T') return 'tutorial';
    return 'theory';
  }

  // Raw scraped entries have an empty `day`. They are ordered Mon→Fri;
  // when the start time drops vs. the previous entry, we've crossed a day.
  function transformTimetable(rawEntries) {
    var slots = [];
    var lastStart = -1;
    var dayIndex = 0;
    var seen = {};
    (rawEntries || []).forEach(function (e) {
      var t = parseTimeRange(e.time);
      if (t.start < lastStart && dayIndex < DAYS.length - 1) dayIndex++;
      lastStart = t.start;

      var day = DAYS[dayIndex];
      var r = parseRoom(e.room);
      var code = ((e.course || '').split('|')[0] || '').trim();
      if (!code) return;

      var dedupeKey = day + '|' + t.start + '|' + code + '|' + r.venue;
      if (seen[dedupeKey]) return;
      seen[dedupeKey] = true;

      slots.push({
        day: day,
        start: t.start,
        span: t.span,
        subject: code,
        venue: r.venue,
        floor: r.floor,
        buildingNumber: r.buildingNumber,
        roomNumber: r.roomNumber,
        type: parseType(e.lecturer),
        lecturerId: code,
        startHour: t.startHour,
        startMinute: t.startMinute,
        endHour: t.endHour,
        endMinute: t.endMinute
      });
    });
    return slots;
  }

  function getAdminOverrides() {
    try {
      var raw = localStorage.getItem('timetable_admin_data');
      if (!raw) return {};
      var data = JSON.parse(raw);
      var map = {};
      (data.courses || []).forEach(function (c) {
        if (c && c.code) map[c.code] = c;
      });
      return map;
    } catch (e) {
      return {};
    }
  }

  function bundleToAppData(bundle) {
    var overrides = getAdminOverrides();
    var bundleDisabled = {};
    var disabledSource = Array.isArray(liveDisabledCodes)
      ? liveDisabledCodes
      : (Array.isArray(bundle.disabledCodes) ? bundle.disabledCodes : []);
    disabledSource.forEach(function (c) {
      bundleDisabled[c] = true;
    });
    var courses = [];
    var lecturers = {};
    (bundle.programs || []).forEach(function (prog) {
      if (prog.lecturers) Object.assign(lecturers, prog.lecturers);
      (prog.years || []).forEach(function (y) {
        var raw = Array.isArray(y.timetable) ? y.timetable : [];
        var yearNum = parseInt(y.year, 10) || y.year;
        var code = prog.code + '_' + y.year;
        var ov = overrides[code];
        var enabled = !bundleDisabled[code];
        if (ov && typeof ov.enabled === 'boolean') enabled = ov.enabled;
        courses.push({
          code: code,
          name: prog.name + ' · Year ' + yearNum,
          program: prog.code,
          year: y.year,
          enabled: enabled,
          timetable: transformTimetable(raw)
        });
      });
    });
    Object.keys(overrides).forEach(function (code) {
      if (!courses.some(function (c) { return c.code === code; })) {
        var ov = overrides[code];
        courses.push({
          code: code,
          name: ov.name || code,
          program: ov.folder || '',
          year: '',
          enabled: ov.enabled !== false,
          timetable: transformTimetable(ov.timetable || [])
        });
      }
    });
    courses.sort(function (a, b) { return a.code.localeCompare(b.code); });
    return { courses: courses, lecturers: lecturers };
  }

  function loadFromBundle() {
    return fetchJson(new URL(TIMETABLE_BUNDLE_URL, document.baseURI).href)
      .then(function (bundle) {
        try { localStorage.setItem(TIMETABLE_CACHE_KEY, JSON.stringify(bundle)); } catch (e) {}
        return bundleToAppData(bundle);
      });
  }

  function loadFromLegacyIndex() {
    // Paths inside index.json are relative to the index file itself.
    var indexUrl = new URL(TIMETABLE_INDEX_URL, document.baseURI);
    function resolve(p) { return new URL(p, indexUrl).href; }

    return fetchJson(indexUrl.href).then(function (index) {
      var tasks = [];
      var courses = [];
      var lecturers = {};

      (index.programs || []).forEach(function (prog) {
        if (prog.lecturers) {
          tasks.push(
            fetchJson(resolve(prog.lecturers))
              .then(function (L) { Object.assign(lecturers, L || {}); })
              .catch(function (err) { console.warn('[timetable] lecturers skipped for ' + prog.code + ':', err.message); })
          );
        }

        (prog.years || []).forEach(function (y) {
          if (!y.timetable) return;
          tasks.push(
            fetchJson(resolve(y.timetable))
              .then(function (raw) {
                var entries = Array.isArray(raw) ? raw : [];
                var yearNum = parseInt(y.year, 10) || y.year;
                courses.push({
                  code: prog.code + '_' + y.year,
                  name: prog.name + ' · Year ' + yearNum,
                  program: prog.code,
                  year: y.year,
                  timetable: transformTimetable(entries)
                });
              })
              .catch(function (err) { console.warn('[timetable] skipped ' + prog.code + ' year ' + y.year + ':', err.message); })
          );
        });
      });

      return Promise.all(tasks).then(function () {
        courses.sort(function (a, b) { return a.code.localeCompare(b.code); });
        return { courses: courses, lecturers: lecturers };
      });
    });
  }

  function fetchLiveVisibility() {
    return fetch(VISIBILITY_API_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        if (data && Array.isArray(data.disabledCodes)) {
          liveDisabledCodes = data.disabledCodes;
        }
      })
      .catch(function () { /* fall back to bundle.disabledCodes */ });
  }

  function loadTimetableIndex() {
    return fetchLiveVisibility().then(function () {
      return loadFromBundle().catch(function (err) {
        console.warn('[timetable] bundle.json unavailable, falling back:', err.message);
        return loadFromLegacyIndex();
      });
    });
  }

  function loadCachedBundle() {
    try {
      var raw = localStorage.getItem(TIMETABLE_CACHE_KEY);
      if (!raw) return null;
      var bundle = JSON.parse(raw);
      return bundleToAppData(bundle);
    } catch (e) {
      return null;
    }
  }

  function getVenueImages() {
    try {
      var raw = localStorage.getItem(VENUE_IMAGES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  var appData = { courses: [], lecturers: {} };
  var venueImageData = getVenueImages();

  // ── DOM refs ────────────────────────────────────────────────────────────────

  var timetableEl = document.getElementById('timetable');
  var dayTabs = document.getElementById('dayTabs');
  var dayTabButtons = document.querySelectorAll('.day-tab');
  var courseSelectSection = document.getElementById('courseSelect');
  var timetableView = document.getElementById('timetableView');
  var changeCourseBtn = document.getElementById('changeCourseBtn');
  var headerSubtitle = document.getElementById('headerSubtitle');
  var courseListEl = document.getElementById('courseList');
  var courseSearchEl = document.getElementById('courseSearch');
  var courseListEmptyEl = document.getElementById('courseListEmpty');
  var courseEmptyState = document.getElementById('courseEmptyState');
  var venueListEl = document.getElementById('venueList');
  var venueSearchEl = document.getElementById('venueSearch');
  var venueListEmptyEl = document.getElementById('venueListEmpty');
  var tabCourseBtn = document.getElementById('tabCourse');
  var tabVenueBtn = document.getElementById('tabVenue');
  var panelCourse = document.getElementById('panelCourse');
  var panelVenue = document.getElementById('panelVenue');
  var selectedCourseCode = null;
  var activeSelectTab = 'course'; // 'course' | 'venue'

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function formatTime(hour) {
    return (hour < 10 ? '0' : '') + hour + ':00';
  }

  function formatTimeExact(hour, minute) {
    var displayHour = hour;
    var suffix = 'AM';
    if (hour >= 12) {
      if (hour > 12) displayHour = hour - 12;
      suffix = 'PM';
    }
    if (hour < 12 && hour === 0) displayHour = 12;
    var minStr = (minute < 10 ? '0' : '') + minute;
    return displayHour + ':' + minStr + ' ' + suffix;
  }

  function floorLabel(floorNum) {
    var n = parseInt(floorNum, 10);
    if (isNaN(n) || n === 0) return 'ground floor';
    if (n === 1) return 'first floor';
    if (n === 2) return 'second floor';
    if (n === 3) return 'third floor';
    return n + 'th floor';
  }

  function getWeekDates(ref) {
    // Monday of the week containing `ref` (defaults to today).
    var d = ref ? new Date(ref) : new Date();
    var js = d.getDay(); // 0=Sun..6=Sat
    var diff = js === 0 ? -6 : 1 - js; // shift back to Monday
    var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
    var map = {};
    DAYS.forEach(function (key, i) {
      var day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      var dd = String(day.getDate()).padStart(2, '0');
      var mm = String(day.getMonth() + 1).padStart(2, '0');
      map[key] = { label: dd + '/' + mm, iso: day.getFullYear() + '-' + mm + '-' + dd };
    });
    return map;
  }

  function subjectToKey(subject) {
    if (!subject) return '';
    var s = (subject + '').trim();
    if (/^[A-Z0-9]{4,}$/i.test(s)) return s;
    var lower = s.toLowerCase();
    if (lower.indexOf('math') !== -1) return 'math';
    if (lower.indexOf('physics') !== -1) return 'physics';
    if (lower.indexOf('chemistry') !== -1) return 'chemistry';
    if (lower.indexOf('biology') !== -1) return 'biology';
    if (lower.indexOf('english') !== -1 || lower.indexOf('literature') !== -1) return 'english';
    if (lower.indexOf('history') !== -1) return 'history';
    if (lower.indexOf('geography') !== -1) return 'geography';
    if (lower.indexOf('computing') !== -1 || lower.indexOf('computer') !== -1) return 'computing';
    if (lower.indexOf('art') !== -1 || lower.indexOf('design') !== -1) return 'art';
    if (lower === 'pe' || lower === 'p.e.' || lower.indexOf('physical education') !== -1 || lower.indexOf('sport') !== -1) return 'pe';
    if (lower.indexOf('tutorial') !== -1) return 'tutorial';
    return s || 'tutorial';
  }

  // ── Course list ─────────────────────────────────────────────────────────────

  function buildCourseList() {
    venueImageData = getVenueImages();
    var courses = (appData.courses || []).filter(function (c) { return c.enabled !== false; });
    courseListEl.innerHTML = '';

    if (courses.length === 0) {
      if (courseEmptyState) courseEmptyState.style.display = 'block';
      if (courseSearchEl) courseSearchEl.parentElement.style.display = 'none';
      courseListEl.parentElement.style.display = 'none';
      return;
    }

    if (courseEmptyState) courseEmptyState.style.display = 'none';
    if (courseSearchEl) courseSearchEl.parentElement.style.display = '';
    courseListEl.parentElement.style.display = '';

    courses.forEach(function (c) {
      if (!c.code) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'course-card';
      btn.dataset.course = c.code;
      btn.textContent = c.code;
      if (c.name) {
        var desc = document.createElement('span');
        desc.className = 'course-card-desc';
        desc.textContent = c.name;
        btn.appendChild(desc);
      }
      courseListEl.appendChild(btn);
    });
  }

  // ── Building name map ────────────────────────────────────────────────────────
  var BUILDING_NAMES = {
    '12': 'BHP Phase 1',
    '13': 'ETB',
    '14': 'BHP Phase 2',
    '20': 'YARONA',
    '76': 'Workshop Block'
  };

  var FLOOR_LABELS = { 0: 'Ground Floor', 1: 'First Floor', 2: 'Second Floor', 3: 'Third Floor' };

  function floorLabel(f) {
    return FLOOR_LABELS[f] !== undefined ? FLOOR_LABELS[f] : 'Floor ' + f;
  }

  // Extract all unique venues from bundle data
  function getVenueList() {
    var seen = {};
    var list = [];
    (appData.courses || []).forEach(function (course) {
      (course.timetable || []).forEach(function (slot) {
        if (!slot.venue || slot.buildingNumber === undefined) return;
        var bldg = String(slot.buildingNumber || '').trim();
        var floor = typeof slot.floor === 'number' ? slot.floor : 0;
        var room = String(slot.roomNumber || slot.venue || '').trim();
        if (!bldg || !room) return;
        var key = bldg + '|' + floor + '|' + room;
        if (!seen[key]) {
          seen[key] = true;
          list.push({ building: bldg, floor: floor, room: room, key: key });
        }
      });
    });
    list.sort(function (a, b) {
      var ba = parseInt(a.building, 10), bb = parseInt(b.building, 10);
      if (ba !== bb) return ba - bb;
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.room.localeCompare(b.room);
    });
    return list;
  }

  function buildVenueList() {
    if (!venueListEl) return;
    venueListEl.innerHTML = '';
    var venues = getVenueList();

    if (venues.length === 0) {
      venueListEl.innerHTML = '<p class="course-list-empty">No venues available.</p>';
      return;
    }

    venues.forEach(function (v) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'venue-card';
      btn.dataset.venueKey = v.key;
      btn.dataset.building = v.building;
      btn.dataset.floor = v.floor;
      btn.dataset.room = v.room;

      var bldgName = BUILDING_NAMES[v.building] || 'Building ' + v.building;

      // Title: "BHP Phase 2 — Ground Floor"
      var titleSpan = document.createElement('span');
      titleSpan.className = 'venue-card-title';
      titleSpan.textContent = bldgName + ' — ' + floorLabel(v.floor);

      // Subtitle: "Building 14 · Room 222" with raw code reference
      var subSpan = document.createElement('span');
      subSpan.className = 'venue-card-sub';
      subSpan.textContent = 'Building ' + v.building + ' · Room ' + v.room + '  ';

      var codeSpan = document.createElement('span');
      codeSpan.className = 'venue-card-code';
      codeSpan.textContent = '(' + v.building + '|' + v.floor + '|' + v.room + ')';
      subSpan.appendChild(codeSpan);

      btn.appendChild(titleSpan);
      btn.appendChild(subSpan);
      venueListEl.appendChild(btn);
    });
  }

  function filterVenues() {
    if (!venueListEl) return;
    var q = (venueSearchEl && venueSearchEl.value) ? venueSearchEl.value.trim().toLowerCase() : '';
    var cards = venueListEl.querySelectorAll('.venue-card');
    var visible = 0;
    cards.forEach(function (card) {
      var text = (card.textContent || '').toLowerCase();
      var key = (card.dataset.venueKey || '').toLowerCase();
      var match = !q || text.indexOf(q) !== -1 || key.indexOf(q) !== -1;
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    if (venueListEmptyEl) venueListEmptyEl.style.display = visible ? 'none' : 'block';
  }

  // ── Tab switching ────────────────────────────────────────────────────────────
  function switchSelectTab(tab) {
    activeSelectTab = tab;
    var isCourse = tab === 'course';
    if (tabCourseBtn) { tabCourseBtn.classList.toggle('active', isCourse); tabCourseBtn.setAttribute('aria-selected', isCourse); }
    if (tabVenueBtn) { tabVenueBtn.classList.toggle('active', !isCourse); tabVenueBtn.setAttribute('aria-selected', !isCourse); }
    if (panelCourse) panelCourse.hidden = !isCourse;
    if (panelVenue) panelVenue.hidden = isCourse;
    if (!isCourse) buildVenueList();
  }

  function filterCourses() {
    var q = (courseSearchEl && courseSearchEl.value) ? courseSearchEl.value.trim().toLowerCase() : '';
    var cards = courseListEl ? courseListEl.querySelectorAll('.course-card') : [];
    var visible = 0;
    cards.forEach(function (card) {
      var code = (card.dataset.course || '').toLowerCase();
      var text = (card.textContent || '').toLowerCase();
      var match = !q || code.indexOf(q) !== -1 || text.indexOf(q) !== -1;
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    if (courseListEmptyEl) courseListEmptyEl.style.display = visible ? 'none' : 'block';
  }

  // ── Show / hide views ──────────────────────────────────────────────────────

  function showCourseSelect() {
    selectedCourseCode = null;
    buildCourseList();
    if (courseSelectSection) courseSelectSection.style.display = '';
    if (timetableView) timetableView.style.display = 'none';
    if (changeCourseBtn) changeCourseBtn.style.display = 'none';
    if (dayTabs) dayTabs.style.display = 'none';
    if (headerSubtitle) headerSubtitle.textContent = getSemesterLabel();
    // Restore the tab that was active when user navigated away
    switchSelectTab(activeSelectTab);
  }

  function showVenueTimetable(building, floor, room) {
    selectedCourseCode = null;

    // Build a synthetic timetable from all courses filtered to this venue
    var floorNum = parseInt(floor, 10);
    var slots = [];
    (appData.courses || []).forEach(function (course) {
      (course.timetable || []).forEach(function (slot) {
        var slotBldg = String(slot.buildingNumber || '').trim();
        var slotFloor = typeof slot.floor === 'number' ? slot.floor : 0;
        var slotRoom = String(slot.roomNumber || '').trim();
        if (slotBldg === building && slotFloor === floorNum && slotRoom === room) {
          // Clone and tag with the course code as subject label
          slots.push(Object.assign({}, slot, { subject: slot.subject || course.code }));
        }
      });
    });

    buildTimetableGrid(slots);

    if (courseSelectSection) courseSelectSection.style.display = 'none';
    if (timetableView) timetableView.style.display = '';
    if (changeCourseBtn) { changeCourseBtn.textContent = 'Change venue'; changeCourseBtn.style.display = 'inline-block'; }
    if (dayTabs) dayTabs.style.display = 'flex';

    var bldgName = BUILDING_NAMES[building] || 'Building ' + building;
    if (headerSubtitle) headerSubtitle.textContent = bldgName + ' · ' + floorLabel(floorNum) + ' · Room ' + room;

    dayTabButtons.forEach(function (t) {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    var targetTab = document.querySelector('.day-tab[data-day="all"]');
    if (targetTab) { targetTab.classList.add('active'); targetTab.setAttribute('aria-selected', 'true'); }
    timetableEl.classList.remove('filter-mon', 'filter-tue', 'filter-wed', 'filter-thu', 'filter-fri');

    refreshDisplayOptions();
  }

  function showTimetable(courseCode) {
    selectedCourseCode = courseCode;
    var course = null;
    (appData.courses || []).forEach(function (c) { if (c.code === courseCode) course = c; });
    if (!course) return;

    try { localStorage.setItem(LAST_COURSE_KEY, courseCode); } catch (e) {}

    buildTimetableGrid(course.timetable || []);

    if (courseSelectSection) courseSelectSection.style.display = 'none';
    if (timetableView) timetableView.style.display = '';
    if (changeCourseBtn) { changeCourseBtn.textContent = 'Change course'; changeCourseBtn.style.display = 'inline-block'; }
    if (dayTabs) dayTabs.style.display = 'flex';
    if (headerSubtitle) headerSubtitle.textContent = course.name ? course.name.trim() : courseCode;

    var isMobile = window.innerWidth <= 640;
    var todayDayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    var todayKey = todayDayNames[new Date().getDay()];
    var defaultDay = 'all';

    dayTabButtons.forEach(function (t) {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    var targetTab = document.querySelector('.day-tab[data-day="' + defaultDay + '"]');
    if (targetTab) {
      targetTab.classList.add('active');
      targetTab.setAttribute('aria-selected', 'true');
    }
    timetableEl.classList.remove('filter-mon', 'filter-tue', 'filter-wed', 'filter-thu', 'filter-fri');
    if (defaultDay !== 'all') {
      timetableEl.classList.add('filter-' + defaultDay);
    }

    refreshDisplayOptions();
  }

  // ── Dynamic timetable grid ─────────────────────────────────────────────────

  function calculateMaxEndHour(timetable) {
    var maxEndHour = 17; // Default minimum (covers up to 17:00)
    (timetable || []).forEach(function (slot) {
      var endHour;
      if (slot.endHour !== undefined) {
        endHour = slot.endHour + ((slot.endMinute || 0) > 0 ? 1 : 0);
      } else if (slot.start !== undefined && slot.span !== undefined) {
        endHour = slot.start + slot.span;
      }
      if (endHour !== undefined) maxEndHour = Math.max(maxEndHour, endHour);
    });
    return maxEndHour;
  }

  function updateTimeColumn(maxEndHour) {
    var timeColumn = document.querySelector('.time-column');
    if (!timeColumn) return;

    var cells = timeColumn.querySelectorAll('.time-cell:not(.header-cell)');
    cells.forEach(function (cell) { cell.remove(); });

    var rowsPerHour = 60 / MINS_PER_ROW; // 12

    for (var hour = GRID_START_HOUR; hour < maxEndHour; hour++) {
      // Time label — spans one full hour block in the time-column subgrid
      var cell = document.createElement('div');
      cell.className = 'time-cell';
      cell.textContent = (hour < 10 ? '0' : '') + hour + ':00';
      var rowInCol = 2 + (hour - GRID_START_HOUR) * rowsPerHour;
      cell.style.gridRow = rowInCol + ' / span ' + rowsPerHour;
      timeColumn.appendChild(cell);

    }

    // Fine-grained grid rows: 1 header row + (numHours × rowsPerHour) tiny rows
    var numHours = maxEndHour - GRID_START_HOUR;
    var totalFineRows = numHours * rowsPerHour;
    var newGridRows = '40px repeat(' + totalFineRows + ', minmax(0, 1fr))';
    timetableEl.style.gridTemplateRows = newGridRows;
  }

  function buildTimetableGrid(timetable) {
    var existingCols = timetableEl.querySelectorAll('.day-column');
    existingCols.forEach(function (col) { col.remove(); });
    
    // Calculate max end hour and update time column
    var maxEndHour = calculateMaxEndHour(timetable);
    updateTimeColumn(maxEndHour);

    var weekDates = getWeekDates();
    var now = new Date();
    var todayIso = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    DAYS.forEach(function (day) {
      var col = document.createElement('div');
      col.className = 'day-column';
      col.dataset.day = day;

      var header = document.createElement('div');
      header.className = 'day-header';
      var dayName = document.createElement('span');
      dayName.className = 'day-header-name';
      dayName.textContent = DAY_LABELS[day];
      var dayDate = document.createElement('span');
      dayDate.className = 'day-header-date';
      dayDate.textContent = weekDates[day] ? weekDates[day].label : '';
      header.appendChild(dayName);
      header.appendChild(dayDate);
      if (weekDates[day] && weekDates[day].iso === todayIso) {
        header.classList.add('is-today');
        col.classList.add('is-today');
      }
      col.appendChild(header);

      var daySlots = [];
      (timetable || []).forEach(function (s) { if (s.day === day) daySlots.push(s); });
      daySlots.sort(function (a, b) { return a.start - b.start; });

      // Compute exact minute bounds for each non-break slot
      var nonBreakSlots = daySlots.filter(function (s) { return !s.break; });
      var gridStartMin = GRID_START_HOUR * 60;
      var gridEndMin = maxEndHour * 60;
      var totalGridMins = gridEndMin - gridStartMin;

      nonBreakSlots.forEach(function (s) {
        var sh2 = s.startHour !== undefined ? s.startHour : s.start;
        var sm2 = s.startMinute !== undefined ? s.startMinute : 0;
        var eh2 = s.endHour !== undefined ? s.endHour : (s.start + (s.span || 1));
        var em2 = s.endMinute !== undefined ? s.endMinute : 0;
        s._startMin = sh2 * 60 + sm2;
        s._endMin = eh2 * 60 + em2;
      });

      // Lane-sweep overlap detection: each lane is a column within the day's slot area
      var lanes = []; // each entry = end minute of last slot placed in that lane
      nonBreakSlots.sort(function (a, b) { return a._startMin - b._startMin || a._endMin - b._endMin; });
      nonBreakSlots.forEach(function (s) {
        var placed = false;
        for (var li = 0; li < lanes.length; li++) {
          if (s._startMin >= lanes[li]) {
            s._lane = li;
            lanes[li] = s._endMin;
            placed = true;
            break;
          }
        }
        if (!placed) {
          s._lane = lanes.length;
          lanes.push(s._endMin);
        }
      });

      // For each slot determine how many lanes are concurrently active (its group width)
      nonBreakSlots.forEach(function (s) {
        var maxLane = s._lane;
        nonBreakSlots.forEach(function (other) {
          if (other !== s && other._startMin < s._endMin && other._endMin > s._startMin) {
            if (other._lane > maxLane) maxLane = other._lane;
          }
        });
        s._groupLanes = maxLane + 1;
      });

      // Slot body builder \u2014 shared between grid-positioned and absolute-positioned slots
      function buildSlotContent(slot, slotData, start, span) {
        var subjectKey = subjectToKey(slotData.subject);
        slot.dataset.subject = subjectKey;
        if (slotData.venue) slot.dataset.venue = slotData.venue;
        if (slotData.buildingNumber) slot.dataset.buildingNumber = slotData.buildingNumber;
        if (slotData.roomNumber) slot.dataset.roomNumber = slotData.roomNumber;
        if (slotData.floor !== undefined && slotData.floor !== null) slot.dataset.floor = slotData.floor;
        if (slotData.type) slot.dataset.type = slotData.type;
        if (slotData.lecturerId) slot.dataset.lecturer = slotData.lecturerId;
        slot.dataset.start = start;
        slot.dataset.span = span;

        var title = document.createElement('span');
        title.className = 'slot-title';
        title.textContent = slotData.subject || '';
        slot.appendChild(title);

        var timeMeta = document.createElement('span');
        timeMeta.className = 'slot-time meta';
        if (slotData.startHour !== undefined && slotData.startMinute !== undefined &&
            slotData.endHour !== undefined && slotData.endMinute !== undefined) {
          timeMeta.textContent = formatTimeExact(slotData.startHour, slotData.startMinute) +
            ' \u2013 ' + formatTimeExact(slotData.endHour, slotData.endMinute);
        } else {
          timeMeta.textContent = formatTime(start) + ' \u2013 ' + formatTime(start + span);
        }
        slot.appendChild(timeMeta);

        var venueMeta = document.createElement('span');
        venueMeta.className = 'slot-venue meta';
        venueMeta.textContent = slotData.venue || '';
        slot.appendChild(venueMeta);

        var floorMeta = document.createElement('span');
        floorMeta.className = 'slot-floor meta';
        floorMeta.textContent = (slotData.floor !== undefined && slotData.floor !== null) ? 'Floor ' + slotData.floor : '';
        slot.appendChild(floorMeta);

        var typeMeta = document.createElement('span');
        typeMeta.className = 'slot-type meta';
        var typeStr = slotData.type || 'theory';
        typeMeta.textContent = typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
        slot.appendChild(typeMeta);

        if (slotData.lecturerId) {
          slot.style.cursor = 'pointer';
          slot.addEventListener('click', (function (lid, s) {
            return function () { openLecturerCard(lid, s); };
          })(slotData.lecturerId, slot));
        }
      }

      // If any non-break slot overlaps another, use an absolute-positioned slot area
      // that spans the whole day column, so slots can be placed side by side freely.
      var hasOverlap = nonBreakSlots.some(function (s) { return s._groupLanes > 1; });

      if (hasOverlap) {
        // The slot area is a single grid cell spanning the full day column (rows 2 to end)
        var slotArea = document.createElement('div');
        slotArea.className = 'day-slot-area';
        slotArea.style.gridColumn = dayToCol[day];
        slotArea.style.gridRow = '2 / -1';

        nonBreakSlots.forEach(function (slotData) {
          var start = parseInt(slotData.start, 10) || 8;
          var span = parseInt(slotData.span, 10) || 1;

          var topPct = ((slotData._startMin - gridStartMin) / totalGridMins) * 100;
          var heightPct = ((slotData._endMin - slotData._startMin) / totalGridMins) * 100;
          var laneIndex = slotData._lane;
          var laneCount = slotData._groupLanes;
          var GAP = 2; // px gap between side-by-side overlapping slots

          var slot = document.createElement('div');
          slot.className = 'slot' + (laneCount > 1 ? ' overlapping' : '');
          slot.style.position = 'absolute';
          slot.style.top = 'calc(' + topPct.toFixed(4) + '% + 1px)';
          slot.style.height = 'calc(' + heightPct.toFixed(4) + '% - 2px)';
          if (laneCount > 1) {
            // Use calc to add pixel gaps between lanes
            var slotWidthPct = (100 / laneCount);
            slot.style.left = 'calc(' + (laneIndex * slotWidthPct).toFixed(4) + '% + ' + (laneIndex > 0 ? GAP / 2 : 0) + 'px)';
            slot.style.width = 'calc(' + slotWidthPct.toFixed(4) + '% - ' + (laneIndex > 0 && laneIndex < laneCount - 1 ? GAP : GAP / 2) + 'px)';
          } else {
            slot.style.left = '1px';
            slot.style.width = 'calc(100% - 2px)';
          }

          buildSlotContent(slot, slotData, start, span);
          slotArea.appendChild(slot);
        });

        col.appendChild(slotArea);
      } else {
        // No overlaps \u2014 place each slot as a direct grid item (original approach)
        daySlots.forEach(function (slotData) {
          var start = parseInt(slotData.start, 10) || 8;
          var span = parseInt(slotData.span, 10) || 1;
          var colIndex = dayToCol[day];

          var sh = slotData.startHour !== undefined ? slotData.startHour : start;
          var sm = slotData.startMinute !== undefined ? slotData.startMinute : 0;
          var eh = slotData.endHour !== undefined ? slotData.endHour : (start + span);
          var em = slotData.endMinute !== undefined ? slotData.endMinute : 0;
          var durationMins = (eh * 60 + em) - (sh * 60 + sm);
          var rowStart = timeToGridRow(sh, sm);
          var rowSpan = durationToSpan(durationMins);

          var slot = document.createElement('div');
          slot.className = 'slot';
          slot.style.gridColumn = colIndex;
          slot.style.gridRow = rowStart + ' / span ' + rowSpan;

          if (slotData.break) {
            slot.classList.add('break');
            slot.textContent = slotData.subject || 'Break';
            col.appendChild(slot);
            return;
          }

          buildSlotContent(slot, slotData, start, span);
          col.appendChild(slot);
        });
      }

      timetableEl.appendChild(col);
    });

    var legendEl = document.getElementById('subjectLegend');
    if (legendEl) {
      var seen = {};
      (timetable || []).forEach(function (s) {
        if (!s.break && s.subject) {
          var k = subjectToKey(s.subject);
          if (k && !seen[k]) seen[k] = s.subject;
        }
      });
      var order = Object.keys(seen).sort();
      legendEl.innerHTML = '';
      legendEl.appendChild(document.createTextNode('Subjects: '));
      order.forEach(function (key) {
        var label = seen[key];
        var item = document.createElement('span');
        item.className = 'legend-item';
        item.setAttribute('data-subject', key);
        var swatch = document.createElement('span');
        swatch.className = 'legend-swatch';
        swatch.setAttribute('data-subject', key);
        swatch.setAttribute('aria-hidden', 'true');
        item.appendChild(swatch);
        item.appendChild(document.createTextNode(' ' + label));
        legendEl.appendChild(item);
      });
    }
  }

  // ── Display options ────────────────────────────────────────────────────────

  function refreshDisplayOptions() {
    var pairs = [
      ['opt-venue', 'slot-venue'],
      ['opt-floor', 'slot-floor'],
      ['opt-type', 'slot-type']
    ];
    pairs.forEach(function (pair) {
      var opt = document.getElementById(pair[0]);
      if (!opt) return;
      var metas = timetableEl.querySelectorAll('.slot:not(.break) .' + pair[1]);
      metas.forEach(function (el) { el.classList.toggle('visible', opt.checked); });
    });
  }

  (function setupDisplayOptions() {
    var ids = ['opt-venue', 'opt-floor', 'opt-type'];
    ids.forEach(function (id) {
      var opt = document.getElementById(id);
      if (opt) opt.addEventListener('change', refreshDisplayOptions);
    });
  })();

  // ── Day tab filter ─────────────────────────────────────────────────────────

  var dayTabsMobileHint = document.getElementById('dayTabsMobileHint');

  function updateMobileHint(day) {
    if (dayTabsMobileHint) dayTabsMobileHint.style.display = day === 'all' ? '' : 'none';
  }

  dayTabButtons.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var day = tab.dataset.day;
      dayTabButtons.forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      timetableEl.classList.remove('filter-mon', 'filter-tue', 'filter-wed', 'filter-thu', 'filter-fri');
      if (day !== 'all') timetableEl.classList.add('filter-' + day);
      updateMobileHint(day);
    });
  });
  updateMobileHint('all');

  // ── Lecturer card ──────────────────────────────────────────────────────────

  var overlay = document.getElementById('lecturerOverlay');
  var backdrop = document.getElementById('lecturerBackdrop');
  var closeBtn = document.getElementById('lecturerClose');
  var currentLecturerId = null;
  var currentSlot = null;

  function openLecturerCard(lecturerId, slotEl) {
    currentLecturerId = lecturerId;
    currentSlot = slotEl
      ? { 
          venue: slotEl.dataset.venue || '', 
          floor: slotEl.dataset.floor !== undefined ? slotEl.dataset.floor : '1',
          buildingNumber: slotEl.dataset.buildingNumber || null,
          roomNumber: slotEl.dataset.roomNumber || null
        }
      : null;
    var lecturers = appData.lecturers || {};
    var L = lecturers[lecturerId];
    if (!L) return;

    var img = document.getElementById('lecturerPhoto');
    var avatarUrl = (function () {
      var nameParts = (L.name || 'U').split(' ');
      var initials = (nameParts[0][0] + (nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '')).toUpperCase();
      return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(initials) + '&size=120&background=6366f1&color=fff';
    })();

    img.src = L.photo || avatarUrl;
    img.alt = L.name || '';
    img.onerror = function () {
      this.src = avatarUrl;
      this.onerror = null;
    };

    document.getElementById('lecturerCardTitle').textContent = L.name || '';
    document.getElementById('lecturerTitle').textContent = L.title || '';
    document.getElementById('lecturerOffice').textContent = L.office || '';
    document.getElementById('lecturerHours').textContent = L.consultation || '';
    var emailEl = document.getElementById('lecturerEmail');
    emailEl.href = L.email ? 'mailto:' + L.email : '#';
    emailEl.textContent = L.email || '';

    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeLecturerCard() {
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (backdrop) backdrop.addEventListener('click', closeLecturerCard);
  if (closeBtn) closeBtn.addEventListener('click', closeLecturerCard);
  overlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLecturerCard();
  });

  // ── Directions overlay ─────────────────────────────────────────────────────

  var directionsOverlay = document.getElementById('directionsOverlay');
  var directionsBackdrop = document.getElementById('directionsBackdrop');
  var directionsClose = document.getElementById('directionsClose');
  var currentStepInstructions = [];

  function getVenueImagesForSteps(mode, buildingNum) {
    var stored = venueImageData || {};
    var defaultSet = stored['default'] || {};
    var imgs = [];
    var fallback = PLACEHOLDER_IMAGES[mode] || PLACEHOLDER_IMAGES['class'];
    
    // Get room data from currentSlot for class mode
    var floor = null;
    var roomNum = null;
    if (mode === 'class' && currentSlot) {
      floor = currentSlot.floor;
      roomNum = currentSlot.roomNumber;
    }
    
    // Build 5-step image array
    for (var i = 1; i <= 5; i++) {
      var imgPath = null;
      
      // Step 1 (Campus map) - use campus map if available
      if (i === 1 && buildingNum && CAMPUS_MAP_IMAGES[buildingNum]) {
        imgPath = CAMPUS_MAP_IMAGES[buildingNum];
      }
      // Step 2 (Building exterior) - use building image from new folder
      else if (i === 2 && buildingNum) {
        imgPath = 'Images/Building/' + buildingNum + '.jpg';
      }
      // Step 3 (Floor) - use floor image from new folder
      else if (i === 3 && buildingNum && floor !== null && floor !== undefined) {
        imgPath = 'Images/Building/' + buildingNum + '_' + floor + '.jpg';
      }
      // Step 4 (Room door) - use room image from new folder
      else if (i === 4 && buildingNum && floor !== null && floor !== undefined && roomNum) {
        imgPath = 'Images/Building/' + buildingNum + '_' + floor + '_' + roomNum + '.jpg';
      }
      // Step 5 (Inside venue) - use inside venue image from new folder
      else if (i === 5 && buildingNum && floor !== null && floor !== undefined && roomNum) {
        imgPath = 'Images/Building/' + buildingNum + '_' + floor + '_' + roomNum + '_i.jpg';
      }
      
      // Use generated path or fallback to stored/placeholder
      imgs.push(imgPath || (defaultSet[i] || defaultSet['' + i] || fallback[i - 1]));
    }
    return imgs;
  }

  function openDirections(mode) {
    var lecturers = appData.lecturers || {};
    var L = currentLecturerId && lecturers[currentLecturerId] ? lecturers[currentLecturerId] : null;
    if (!L) return;
    
    // Extract building number for images
    var buildingNum = null;
    if (mode === 'class' && currentSlot) {
      buildingNum = currentSlot.buildingNumber;
    }
    
    var imgs = getVenueImagesForSteps(mode, buildingNum);
    var building, floorLabelText, doorLabel;

    if (mode === 'class' && currentSlot) {
      building = L.classBuilding || 'the building';
      floorLabelText = floorLabel(currentSlot.floor);
      var roomPart = (currentSlot.venue || '').split(' \u00b7 ')[0].trim() || 'the room';
      doorLabel = roomPart;
    } else {
      var officeParts = (L.office || '').split(',');
      building = (officeParts[1] || officeParts[0] || 'the building').trim();
      floorLabelText = floorLabel(L.officeFloor);
      doorLabel = (officeParts[0] || 'the office').trim();
    }

    var adminInstr = {};
    try {
      var rawInstr = localStorage.getItem('timetable_venue_instructions');
      if (rawInstr) {
        var parsed = JSON.parse(rawInstr);
        adminInstr = parsed['default'] || {};
      }
    } catch (_) {}

    var defaults = [
      'Look for this building.',
      'Look for this building.',
      'Go to the ' + floorLabelText + '.',
      'Look for this door (' + doorLabel + ').',
      'The venue should look like this.'
    ];
    currentStepInstructions = [];
    for (var _ii = 1; _ii <= 5; _ii++) {
      currentStepInstructions.push(adminInstr[_ii] || adminInstr['' + _ii] || defaults[_ii - 1]);
    }

    for (var i = 1; i <= 5; i++) {
      var imgEl = document.getElementById('dirImg' + i);
      var instEl = document.getElementById('dirInst' + i);
      var triggerEl = document.getElementById('dirTrigger' + i);
      if (imgEl) imgEl.src = imgs[i - 1];
      if (instEl) { instEl.textContent = currentStepInstructions[i - 1] || ''; instEl.classList.remove('visible'); }
      if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
    }

    directionsOverlay.setAttribute('aria-hidden', 'false');
    directionsOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (directionsClose) directionsClose.focus();
  }

  // Open directions directly from a venue card (no lecturer card needed)
  function openDirectionsForVenue(building, floor, room) {
    var floorNum = parseInt(floor, 10);
    var bldgName = BUILDING_NAMES[building] || 'Building ' + building;
    var floorText = floorLabel(floorNum);

    var imgs = [];
    for (var i = 1; i <= 5; i++) {
      if (i === 1 && CAMPUS_MAP_IMAGES[building]) {
        imgs.push(CAMPUS_MAP_IMAGES[building]);
      } else if (i === 2) {
        imgs.push('Images/Building/' + building + '.jpg');
      } else if (i === 3) {
        imgs.push('Images/Building/' + building + '_' + floorNum + '.jpg');
      } else if (i === 4) {
        imgs.push('Images/Building/' + building + '_' + floorNum + '_' + room + '.jpg');
      } else if (i === 5) {
        imgs.push('Images/Building/' + building + '_' + floorNum + '_' + room + '_i.jpg');
      } else {
        imgs.push('');
      }
    }

    var adminInstr = {};
    try {
      var rawInstr = localStorage.getItem('timetable_venue_instructions');
      if (rawInstr) adminInstr = (JSON.parse(rawInstr)['default']) || {};
    } catch (_) {}

    var defaults = [
      'Locate ' + bldgName + ' on campus.',
      'This is the entrance to ' + bldgName + '.',
      'Go to the ' + floorText + '.',
      'Look for Room ' + room + '.',
      'The venue should look like this.'
    ];
    currentStepInstructions = [];
    for (var ii = 1; ii <= 5; ii++) {
      currentStepInstructions.push(adminInstr[ii] || adminInstr['' + ii] || defaults[ii - 1]);
    }

    // Update directions title
    var titleEl = document.getElementById('directionsTitle');
    if (titleEl) titleEl.textContent = bldgName + ' — ' + floorText + ' · Room ' + room;

    for (var j = 1; j <= 5; j++) {
      var imgEl = document.getElementById('dirImg' + j);
      var instEl = document.getElementById('dirInst' + j);
      var triggerEl = document.getElementById('dirTrigger' + j);
      if (imgEl) imgEl.src = imgs[j - 1];
      if (instEl) { instEl.textContent = currentStepInstructions[j - 1] || ''; instEl.classList.remove('visible'); }
      if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
    }

    directionsOverlay.setAttribute('aria-hidden', 'false');
    directionsOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (directionsClose) directionsClose.focus();
  }

  function closeDirections() {
    directionsOverlay.setAttribute('aria-hidden', 'true');
    directionsOverlay.classList.remove('open');
    document.body.style.overflow = overlay.classList.contains('open') ? 'hidden' : '';
  }

  document.getElementById('btnGoToClass').addEventListener('click', function () { openDirections('class'); });
  document.getElementById('btnGoToOffice').addEventListener('click', function () { alert('Coming soon'); });
  if (directionsBackdrop) directionsBackdrop.addEventListener('click', closeDirections);
  if (directionsClose) directionsClose.addEventListener('click', closeDirections);
  directionsOverlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDirections();
  });

  // ── Lightbox ───────────────────────────────────────────────────────────────

  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxBackdrop = document.getElementById('lightboxBackdrop');
  var lightboxClose = document.getElementById('lightboxClose');
  var lightboxPrev = document.getElementById('lightboxPrev');
  var lightboxNext = document.getElementById('lightboxNext');
  var currentLightboxStep = 0;
  var totalSteps = 0;

  function openLightbox(src, alt, instructions, stepNum) {
    if (!lightboxImg) return;
    lightboxImg.src = src || '';
    lightboxImg.alt = alt || 'Enlarged view';
    var instEl = document.getElementById('lightboxInstructions');
    if (instEl) instEl.textContent = instructions || '';
    currentLightboxStep = stepNum || 0;
    totalSteps = document.querySelectorAll('.direction-step:not([style*="display: none"])').length;
    updateLightboxNavigation();
    lightbox.setAttribute('aria-hidden', 'false');
    lightbox.classList.add('open');
    if (lightboxClose) lightboxClose.focus();
  }

  function updateLightboxNavigation() {
    if (lightboxPrev) lightboxPrev.style.display = currentLightboxStep > 1 ? 'block' : 'none';
    if (lightboxNext) lightboxNext.style.display = currentLightboxStep < totalSteps ? 'block' : 'none';
  }

  function navigateLightbox(direction) {
    var newStep = currentLightboxStep + direction;
    if (newStep < 1 || newStep > totalSteps) return;
    
    var allSteps = document.querySelectorAll('.direction-step:not([style*="display: none"])');
    var targetStep = null;
    var stepCount = 0;
    
    for (var i = 0; i < allSteps.length; i++) {
      stepCount++;
      if (stepCount === newStep) {
        targetStep = allSteps[i];
        break;
      }
    }
    
    if (!targetStep) return;
    
    var img = targetStep.querySelector('img');
    var stepNum = targetStep.dataset.step;
    if (img && stepNum) {
      openLightbox(img.src, img.alt, currentStepInstructions[parseInt(stepNum, 10) - 1] || '', newStep);
    }
  }

  function closeLightbox() {
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.classList.remove('open');
  }

  document.getElementById('directionsSteps').addEventListener('click', function (e) {
    var imgTarget = e.target.closest('img');
    if (imgTarget) {
      var step = imgTarget.closest('.direction-step');
      var stepNum = step && step.dataset.step;
      if (stepNum) {
        e.preventDefault();
        var visibleSteps = document.querySelectorAll('.direction-step:not([style*="display: none"])');
        var stepIndex = 0;
        for (var i = 0; i < visibleSteps.length; i++) {
          if (visibleSteps[i].dataset.step === stepNum) {
            stepIndex = i + 1;
            break;
          }
        }
        openLightbox(imgTarget.src, imgTarget.alt, currentStepInstructions[parseInt(stepNum, 10) - 1] || '', stepIndex);
        return;
      }
    }

    var trigger = e.target.closest('.direction-step-trigger');
    if (!trigger) return;
    var step = trigger.closest('.direction-step');
    var stepNum = step && step.dataset.step;
    if (!stepNum) return;
    var instEl = document.getElementById('dirInst' + stepNum);
    var isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    if (instEl) {
      instEl.classList.toggle('visible', !isExpanded);
      trigger.setAttribute('aria-expanded', String(!isExpanded));
    }
  });

  if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxPrev) lightboxPrev.addEventListener('click', function () { navigateLightbox(-1); });
  if (lightboxNext) lightboxNext.addEventListener('click', function () { navigateLightbox(1); });
  lightbox.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });
  lightbox.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  // ── Course list events ─────────────────────────────────────────────────────

  if (courseListEl) {
    courseListEl.addEventListener('click', function (e) {
      var card = e.target.closest('.course-card');
      if (card && card.dataset.course && card.style.display !== 'none') {
        showTimetable(card.dataset.course);
      }
    });
  }

  if (courseSearchEl) {
    courseSearchEl.addEventListener('input', filterCourses);
    courseSearchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        courseSearchEl.value = '';
        filterCourses();
        courseSearchEl.blur();
      }
    });
  }

  // ── Venue list events ──────────────────────────────────────────────────────

  if (venueListEl) {
    venueListEl.addEventListener('click', function (e) {
      var card = e.target.closest('.venue-card');
      if (card && card.dataset.venueKey && card.style.display !== 'none') {
        openDirectionsForVenue(card.dataset.building, card.dataset.floor, card.dataset.room);
      }
    });
  }

  if (venueSearchEl) {
    venueSearchEl.addEventListener('input', filterVenues);
    venueSearchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        venueSearchEl.value = '';
        filterVenues();
        venueSearchEl.blur();
      }
    });
  }

  // ── Select tab events ──────────────────────────────────────────────────────

  if (tabCourseBtn) tabCourseBtn.addEventListener('click', function () { switchSelectTab('course'); });
  if (tabVenueBtn) tabVenueBtn.addEventListener('click', function () { switchSelectTab('venue'); });

  // Set initial tab state
  switchSelectTab('course');

  if (changeCourseBtn) {
    changeCourseBtn.addEventListener('click', function () {
      if (courseSearchEl) courseSearchEl.value = '';
      try { localStorage.removeItem(LAST_COURSE_KEY); } catch (e) {}
      showCourseSelect();
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function showLoadingState() {
    if (courseEmptyState) courseEmptyState.style.display = 'none';
    if (courseSearchEl) courseSearchEl.parentElement.style.display = 'none';
    if (courseListEl) {
      courseListEl.parentElement.style.display = '';
      courseListEl.innerHTML = '<p class="course-list-empty">Loading courses…</p>';
    }
    if (courseSelectSection) courseSelectSection.style.display = '';
    if (timetableView) timetableView.style.display = 'none';
    if (changeCourseBtn) changeCourseBtn.style.display = 'none';
    if (dayTabs) dayTabs.style.display = 'none';
    if (headerSubtitle) headerSubtitle.textContent = getSemesterLabel();
  }

  function showLoadError(err) {
    if (courseListEl) {
      courseListEl.innerHTML =
        '<p class="course-list-empty">Could not load timetables. ' +
        'If you opened this page directly from disk, run it through a local web server ' +
        '(e.g. <code>python -m http.server</code>) so JSON files can be fetched.' +
        '<br><small>' + (err && err.message ? err.message : err) + '</small></p>';
    }
  }

  // ── Now indicator & next-class banner ──────────────────────────────────────

  var DAY_FULL_LABELS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };
  var DAY_JS_INDEX = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5 };

  function escapeHtml(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function getTodayKey() {
    var jsDay = new Date().getDay();
    return (jsDay >= 1 && jsDay <= 5) ? DAYS[jsDay - 1] : null;
  }

  function getActiveFilterDay() {
    if (!timetableEl) return null;
    var match = null;
    timetableEl.classList.forEach(function (c) {
      var m = c.match(/^filter-(mon|tue|wed|thu|fri)$/);
      if (m) match = m[1];
    });
    return match;
  }

  function updateNowIndicator() {
    if (!timetableEl) return;
    var line = document.getElementById('nowLine');
    function hide() { if (line) line.style.display = 'none'; }

    var todayKey = getTodayKey();
    // Clear slot highlights first
    var allSlots = timetableEl.querySelectorAll('.slot.is-now');
    allSlots.forEach(function (s) { s.classList.remove('is-now'); });

    if (!todayKey || !selectedCourseCode) return hide();

    var now = new Date();
    var hoursNow = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    if (hoursNow < GRID_START_HOUR || hoursNow >= 20) return hide();

    var filterDay = getActiveFilterDay();
    if (filterDay && filterDay !== todayKey) return hide();

    var todayHeader = timetableEl.querySelector('.day-column[data-day="' + todayKey + '"] .day-header');
    if (!todayHeader) return hide();

    var timeCells = timetableEl.querySelectorAll('.time-column .time-cell');
    if (timeCells.length < 2) return hide();
    var firstHourRect = timeCells[1].getBoundingClientRect();
    var ttRect = timetableEl.getBoundingClientRect();
    var todayRect = todayHeader.getBoundingClientRect();
    var rowHeight = firstHourRect.height; // height of one hour block (spans 12 fine rows)
    if (rowHeight <= 0) return hide();

    var topPx = (firstHourRect.top - ttRect.top) + (hoursNow - GRID_START_HOUR) * rowHeight;

    if (!line) {
      line = document.createElement('div');
      line.className = 'now-line';
      line.id = 'nowLine';
      line.setAttribute('aria-hidden', 'true');
      timetableEl.appendChild(line);
    }
    line.style.display = '';
    line.style.top = topPx + 'px';
    line.style.left = (todayRect.left - ttRect.left) + 'px';
    line.style.width = todayRect.width + 'px';

    timetableEl.querySelectorAll('.day-column[data-day="' + todayKey + '"] .slot:not(.break)')
      .forEach(function (slot) {
        var s = parseFloat(slot.dataset.start);
        var sp = parseFloat(slot.dataset.span);
        if (isNaN(s) || isNaN(sp)) return;
        if (s <= hoursNow && hoursNow < s + sp) slot.classList.add('is-now');
      });
  }

  function findCurrentAndNext(course) {
    var result = { current: null, next: null, nextDayKey: null, todayKey: null };
    if (!course || !course.timetable) return result;
    var slots = course.timetable.filter(function (s) { return !s.break && s.subject; });
    var now = new Date();
    var jsDay = now.getDay();
    var isWeekday = jsDay >= 1 && jsDay <= 5;
    var todayKey = isWeekday ? DAYS[jsDay - 1] : null;
    var hoursNow = now.getHours() + now.getMinutes() / 60;
    result.todayKey = todayKey;

    if (todayKey) {
      slots.forEach(function (s) {
        if (s.day === todayKey && s.start <= hoursNow && hoursNow < s.start + s.span) {
          result.current = s;
        }
      });
    }

    var dayOrder = isWeekday
      ? DAYS.slice(jsDay - 1).concat(DAYS.slice(0, jsDay - 1))
      : DAYS.slice();

    for (var offset = 0; offset < dayOrder.length; offset++) {
      var day = dayOrder[offset];
      var daySlots = slots.filter(function (s) { return s.day === day; });
      if (offset === 0 && todayKey && day === todayKey) {
        daySlots = daySlots.filter(function (s) { return s.start > hoursNow; });
      }
      if (daySlots.length === 0) continue;
      daySlots.sort(function (a, b) { return a.start - b.start; });
      result.next = daySlots[0];
      result.nextDayKey = day;
      break;
    }
    return result;
  }

  function refreshNextClassBanner() {
    // Banner disabled - only showing now line, not text banner
    var banner = document.getElementById('nextClassBanner');
    if (banner) {
      banner.hidden = true;
      banner.innerHTML = '';
    }
  }

  function refreshLiveUI() {
    updateNowIndicator();
    refreshNextClassBanner();
  }

  // Periodic refresh
  setInterval(refreshLiveUI, 60 * 1000);
  window.addEventListener('resize', updateNowIndicator);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refreshLiveUI();
  });
  dayTabButtons.forEach(function (tab) {
    tab.addEventListener('click', function () {
      // runs after the existing handler that sets the filter class
      setTimeout(updateNowIndicator, 0);
    });
  });
  ['opt-venue', 'opt-floor', 'opt-type'].forEach(function (id) {
    var opt = document.getElementById(id);
    if (opt) opt.addEventListener('change', function () { setTimeout(updateNowIndicator, 0); });
  });

  // Hook into showTimetable's downstream refresh
  var _origShowTimetable = showTimetable;
  showTimetable = function (code) {
    _origShowTimetable(code);
    refreshLiveUI();
  };
  var _origShowCourseSelect = showCourseSelect;
  showCourseSelect = function () {
    _origShowCourseSelect();
    var banner = document.getElementById('nextClassBanner');
    if (banner) { banner.hidden = true; banner.innerHTML = ''; }
  };

  // ── Print hooks ────────────────────────────────────────────────────────────
  // Strip the active day-filter before print so all weekdays appear on paper,
  // then restore it after the print dialog closes.
  (function setupPrintHooks() {
    var savedFilter = null;
    window.addEventListener('beforeprint', function () {
      if (!timetableEl) return;
      savedFilter = getActiveFilterDay();
      if (savedFilter) timetableEl.classList.remove('filter-' + savedFilter);
    });
    window.addEventListener('afterprint', function () {
      if (savedFilter && timetableEl) {
        timetableEl.classList.add('filter-' + savedFilter);
        savedFilter = null;
        updateNowIndicator();
      }
    });
  })();

  function renderInitial(data) {
    appData = data;
    var saved = null;
    try { saved = localStorage.getItem(LAST_COURSE_KEY); } catch (e) {}
    var hasSaved = saved && (appData.courses || []).some(function (c) { return c.code === saved; });
    if (hasSaved) {
      buildCourseList();
      showTimetable(saved);
    } else {
      showCourseSelect();
    }
  }

  // Instant paint from cache (if present), then revalidate from network.
  var cached = loadCachedBundle();
  if (cached && cached.courses && cached.courses.length) {
    renderInitial(cached);
  } else {
    showLoadingState();
  }

  loadTimetableIndex()
    .then(function (data) {
      // Only re-render if nothing was shown yet, or if the data changed.
      if (!cached) {
        renderInitial(data);
        return;
      }
      // If user is on the course-select view, refresh the list silently.
      appData = data;
      if (courseSelectSection && courseSelectSection.style.display !== 'none') {
        buildCourseList();
      } else if (selectedCourseCode) {
        // Timetable view: rebuild grid in case data changed.
        var c = (appData.courses || []).filter(function (x) { return x.code === selectedCourseCode; })[0];
        if (c) buildTimetableGrid(c.timetable || []);
        refreshLiveUI();
      }
    })
    .catch(function (err) {
      if (!cached) showLoadError(err);
      else console.warn('[timetable] refresh failed, using cache:', err && err.message);
    });
})();
