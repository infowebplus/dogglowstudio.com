/**
 * Dog Glow Studio — Google Calendar booking API
 *
 * Deploy: Extensions → Apps Script → paste this file → Deploy → New deployment → Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Config: edit config.json → npm run build → paste this file into Apps Script.
 * Put the /exec URL in config.json → bookingApi.url, then build again.
 */

/* @@CONFIG_START@@ — generated from config.json by build.mjs */
var CONFIG = {
  calendarId: "primary",
  timezone: "Europe/Madrid",
  workingDays: [
    1,
    2,
    3,
    4,
    5,
    6
  ],
  workingHours: {
    start: "09:00",
    end: "19:00"
  },
  slotStepMinutes: 30,
  bufferMinutes: 0,
  services: {
    "peluqueria-canina": 90,
    "spa-aromaterapia": 60,
    ozonoterapia: 45,
    "tratamientos-especiales": 60
  },
  CREATE_EVENTS: false,
  apiKey: ""
};
/* @@CONFIG_END@@ */

/* ===================================================================== */

function doGet(e) {
  try {
    e = e || { parameter: {} };
    var params = e.parameter || {};
    assertApiKey_(params.key);

    var action = String(params.action || "config");

    if (action === "config") {
      return json_({
        ok: true,
        timezone: CONFIG.timezone,
        workingDays: CONFIG.workingDays,
        workingHours: CONFIG.workingHours,
        slotStepMinutes: CONFIG.slotStepMinutes,
        bufferMinutes: CONFIG.bufferMinutes,
        services: CONFIG.services,
        createEvents: !!CONFIG.CREATE_EVENTS
      });
    }

    if (action === "slots") {
      var date = String(params.date || "");
      var service = String(params.service || "");
      return json_(getSlots_(date, service));
    }

    return json_({ ok: false, error: "Unknown action" }, 400);
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) }, 400);
  }
}

function doPost(e) {
  try {
    e = e || {};
    var body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    assertApiKey_(body.key);

    var action = String(body.action || "book");
    if (action !== "book") {
      return json_({ ok: false, error: "Unknown action" }, 400);
    }

    return json_(createBooking_(body));
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) }, 400);
  }
}

/* ===================================================================== */

function getSlots_(dateStr, serviceId) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, error: "Invalid date" };
  }

  var duration = CONFIG.services[serviceId];
  if (!duration) {
    return { ok: false, error: "Unknown service" };
  }

  var parts = dateStr.split("-");
  var y = Number(parts[0]);
  var m = Number(parts[1]) - 1;
  var d = Number(parts[2]);
  // Local calendar day in CONFIG.timezone via Utilities
  var noon = Utilities.parseDate(dateStr + " 12:00:00", CONFIG.timezone, "yyyy-MM-dd HH:mm:ss");
  var weekday = Number(Utilities.formatDate(noon, CONFIG.timezone, "u")); // 1=Mon … 7=Sun
  // Convert to JS getDay style: 0=Sun … 6=Sat
  var dayJs = weekday === 7 ? 0 : weekday;

  if (CONFIG.workingDays.indexOf(dayJs) === -1) {
    return {
      ok: true,
      date: dateStr,
      service: serviceId,
      duration: duration,
      slots: [],
      closed: true
    };
  }

  var dayStart = Utilities.parseDate(
    dateStr + " " + CONFIG.workingHours.start + ":00",
    CONFIG.timezone,
    "yyyy-MM-dd HH:mm:ss"
  );
  var dayEnd = Utilities.parseDate(
    dateStr + " " + CONFIG.workingHours.end + ":00",
    CONFIG.timezone,
    "yyyy-MM-dd HH:mm:ss"
  );

  var busy = getBusy_(dayStart, dayEnd);
  var stepMs = CONFIG.slotStepMinutes * 60 * 1000;
  var needMs = (duration + CONFIG.bufferMinutes) * 60 * 1000;
  var now = new Date();

  var slots = [];
  for (var t = dayStart.getTime(); t + needMs <= dayEnd.getTime(); t += stepMs) {
    if (t < now.getTime()) continue;
    if (!overlapsBusy_(t, t + needMs, busy)) {
      slots.push(Utilities.formatDate(new Date(t), CONFIG.timezone, "HH:mm"));
    }
  }

  return {
    ok: true,
    date: dateStr,
    service: serviceId,
    duration: duration,
    slots: slots,
    closed: false
  };
}

function createBooking_(body) {
  var dateStr = String(body.date || "");
  var timeStr = String(body.time || "");
  var serviceId = String(body.service || "");
  var duration = CONFIG.services[serviceId];

  if (!duration) return { ok: false, error: "Unknown service" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, error: "Invalid date" };
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return { ok: false, error: "Invalid time" };

  // Re-check availability
  var availability = getSlots_(dateStr, serviceId);
  if (!availability.ok) return availability;
  if (availability.slots.indexOf(timeStr) === -1) {
    return { ok: false, error: "Slot no longer available" };
  }

  if (!CONFIG.CREATE_EVENTS) {
    return {
      ok: true,
      created: false,
      message: "CREATE_EVENTS is false — WhatsApp-only mode"
    };
  }

  var start = Utilities.parseDate(
    dateStr + " " + timeStr + ":00",
    CONFIG.timezone,
    "yyyy-MM-dd HH:mm:ss"
  );
  var end = new Date(start.getTime() + duration * 60 * 1000);

  var title = "Cita · " + (body.serviceLabel || serviceId);
  if (body.perro) title += " · " + body.perro;

  var description = [
    "Servicio: " + (body.serviceLabel || serviceId),
    "Cliente: " + (body.nombre || "-"),
    "Teléfono: " + (body.telefono || "-"),
    body.perro ? "Perro: " + body.perro + (body.tamano ? " (" + body.tamano + ")" : "") : "",
    body.notas ? "Notas: " + body.notas : "",
    "Origen: web dogglowstudio.com"
  ]
    .filter(Boolean)
    .join("\n");

  var cal = getCalendar_();
  var event = cal.createEvent(title, start, end, { description: description });

  return {
    ok: true,
    created: true,
    eventId: event.getId()
  };
}

function getBusy_(from, to) {
  var cal = getCalendar_();
  var events = cal.getEvents(from, to);
  var busy = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    busy.push({
      start: ev.getStartTime().getTime(),
      end: ev.getEndTime().getTime()
    });
  }
  return busy;
}

function overlapsBusy_(startMs, endMs, busy) {
  for (var i = 0; i < busy.length; i++) {
    var b = busy[i];
    if (startMs < b.end && endMs > b.start) return true;
  }
  return false;
}

function getCalendar_() {
  if (!CONFIG.calendarId || CONFIG.calendarId === "primary") {
    return CalendarApp.getDefaultCalendar();
  }
  var cal = CalendarApp.getCalendarById(CONFIG.calendarId);
  if (!cal) {
    throw new Error("Calendar not found: " + CONFIG.calendarId);
  }
  return cal;
}

function assertApiKey_(key) {
  if (!CONFIG.apiKey) return;
  if (String(key || "") !== String(CONFIG.apiKey)) {
    throw new Error("Unauthorized");
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
