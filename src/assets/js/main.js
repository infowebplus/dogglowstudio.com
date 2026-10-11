(function () {
  "use strict";

  /* ---------------------------------------------------------------------
   * Site config — edit config.json then run: node build.mjs
   * ------------------------------------------------------------------- */
  var SITE = window.SITE_CONFIG || {};

  var CONFIG = {
    whatsappNumber: SITE.whatsappNumber || "34617941049",
    whatsappMessage: SITE.whatsappMessage || "Hola, me gustaría reservar una cita para mi perro en Dog Glow Studio.",
    instagramUrl: SITE.instagramUrl || "",
    mapsUrl: SITE.mapsUrl || "https://www.google.com/maps?q=San+Luis+de+Sabinillas,+Manilva,+M%C3%A1laga",
    bookingApiUrl: SITE.bookingApiUrl || "",
    bookingApiKey: SITE.bookingApiKey || ""
  };

  var BOOKING_FALLBACK = SITE.bookingFallback || {
    workingDays: [1, 2, 3, 4, 5, 6],
    workingHours: { start: "09:00", end: "19:00" },
    slotStepMinutes: 30,
    bufferMinutes: 0,
    services: {
      "peluqueria-canina": 90,
      "spa-aromaterapia": 60,
      "ozonoterapia": 45,
      "tratamientos-especiales": 60
    },
    createEvents: false
  };

  var SERVICE_LABELS = SITE.serviceLabels || {
    "peluqueria-canina": "Peluquería canina",
    "spa-aromaterapia": "Spa y aromaterapia",
    "ozonoterapia": "Ozonoterapia",
    "tratamientos-especiales": "Tratamientos especiales"
  };

  function waLink(message) {
    return "https://wa.me/" + CONFIG.whatsappNumber + "?text=" + encodeURIComponent(message);
  }

  function wireContactLinks() {
    var href = waLink(CONFIG.whatsappMessage);
    document.querySelectorAll(".js-whatsapp").forEach(function (el) {
      if (el.id !== "btnConfirm") el.href = href;
    });
    document.querySelectorAll(".js-instagram").forEach(function (el) {
      if (CONFIG.instagramUrl) el.href = CONFIG.instagramUrl;
    });
    document.querySelectorAll(".js-maps").forEach(function (el) {
      if (CONFIG.mapsUrl) el.href = CONFIG.mapsUrl;
    });
  }

  /* ---------------------------------------------------------------------
   * Sticky header
   * ------------------------------------------------------------------- */
  function initHeader() {
    var header = document.getElementById("siteHeader");
    if (!header) return;
    function onScroll() {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------------------------------------------------------------------
   * Mobile nav
   * ------------------------------------------------------------------- */
  function initNav() {
    var header = document.getElementById("siteHeader");
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("mainNav");
    if (!header || !toggle || !nav) return;

    function close() {
      header.classList.remove("is-open");
      toggle.classList.remove("is-active");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var isOpen = header.classList.toggle("is-open");
      toggle.classList.toggle("is-active", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", close);
    });
  }

  /* ---------------------------------------------------------------------
   * Active section in nav (scroll spy)
   * ------------------------------------------------------------------- */
  function initNavActive() {
    var nav = document.getElementById("mainNav");
    if (!nav) return;

    var links = Array.prototype.slice.call(
      nav.querySelectorAll('a[href^="#"]')
    );
    if (!links.length) return;

    var sections = links
      .map(function (link) {
        var id = link.getAttribute("href").slice(1);
        var el = document.getElementById(id);
        return el ? { id: id, el: el, link: link } : null;
      })
      .filter(Boolean);

    if (!sections.length) return;

    function setActive(id) {
      links.forEach(function (link) {
        var on = link.getAttribute("href") === "#" + id;
        link.classList.toggle("is-active", on);
        if (on) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    }

    function update() {
      var offset = 120;
      var y = window.scrollY + offset;
      var ordered = sections.slice().sort(function (a, b) {
        return a.el.offsetTop - b.el.offsetTop;
      });
      var current = ordered[0].id;

      for (var i = 0; i < ordered.length; i++) {
        if (ordered[i].el.offsetTop <= y) current = ordered[i].id;
      }

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 48
      ) {
        current = "contacto";
      }

      setActive(current);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  /* ---------------------------------------------------------------------
   * Reveal-on-scroll
   * ------------------------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, i) {
          if (entry.isIntersecting) {
            setTimeout(function () {
              entry.target.classList.add("is-visible");
            }, (i % 6) * 70);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------------------------------------------------------------------
   * Booking stepper + Google Calendar slots
   * ------------------------------------------------------------------- */
  function initBooking() {
    var form = document.getElementById("bookingForm");
    if (!form) return;

    var totalSteps = 4;
    var current = 1;
    var bookingConfig = null;
    var createEvents = false;
    var selectedTime = null;
    var slotsRequestId = 0;

    var stepDots = document.querySelectorAll(".step-dot");
    var panels = document.querySelectorAll(".step-panel");
    var btnBack = document.getElementById("btnBack");
    var btnNext = document.getElementById("btnNext");
    var btnConfirm = document.getElementById("btnConfirm");
    var formError = document.getElementById("formError");

    var fechaInput = document.getElementById("fecha");
    var fechaField = fechaInput.closest(".field");
    var fechaError = document.getElementById("fechaError");
    var fechaHint = document.getElementById("fechaHint");
    var timeGrid = document.getElementById("timeGrid");
    var timeStatus = document.getElementById("timeStatus");
    var horaField = timeGrid.closest(".field");
    var horaError = document.getElementById("horaError");

    var DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

    var today = new Date();
    var isoToday = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");
    fechaInput.setAttribute("min", isoToday);

    function apiUrl(action, extra) {
      var url = CONFIG.bookingApiUrl + (CONFIG.bookingApiUrl.indexOf("?") >= 0 ? "&" : "?");
      url += "action=" + encodeURIComponent(action);
      if (CONFIG.bookingApiKey) url += "&key=" + encodeURIComponent(CONFIG.bookingApiKey);
      if (extra) {
        Object.keys(extra).forEach(function (k) {
          url += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(extra[k]);
        });
      }
      return url;
    }

    function applyConfig(cfg) {
      bookingConfig = cfg;
      createEvents = !!cfg.createEvents;
      if (fechaHint && cfg.workingDays) {
        var days = cfg.workingDays.slice().sort(function (a, b) { return a - b; });
        var labels = days.map(function (d) { return DAY_NAMES[d]; });
        var hours = cfg.workingHours
          ? cfg.workingHours.start + "–" + cfg.workingHours.end
          : "";
        fechaHint.textContent = "Abierto: " + labels.join(", ") +
          (hours ? " · " + hours : "") + ".";
      }
    }

    function loadConfig() {
      if (!CONFIG.bookingApiUrl) {
        applyConfig(BOOKING_FALLBACK);
        return Promise.resolve(bookingConfig);
      }

      return fetch(apiUrl("config"), { method: "GET" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.error) || "Config error");
          applyConfig({
            workingDays: data.workingDays || BOOKING_FALLBACK.workingDays,
            workingHours: data.workingHours || BOOKING_FALLBACK.workingHours,
            slotStepMinutes: data.slotStepMinutes || BOOKING_FALLBACK.slotStepMinutes,
            bufferMinutes: data.bufferMinutes || 0,
            services: data.services || BOOKING_FALLBACK.services,
            createEvents: !!data.createEvents
          });
          return bookingConfig;
        })
        .catch(function () {
          applyConfig(BOOKING_FALLBACK);
          return bookingConfig;
        });
    }

    function selectedService() {
      return form.querySelector('input[name="servicio"]:checked');
    }

    function serviceDuration(serviceInput) {
      if (!serviceInput) return 60;
      var fromData = Number(serviceInput.getAttribute("data-duration"));
      if (fromData) return fromData;
      if (bookingConfig && bookingConfig.services && bookingConfig.services[serviceInput.value]) {
        return bookingConfig.services[serviceInput.value];
      }
      return BOOKING_FALLBACK.services[serviceInput.value] || 60;
    }

    function parseHm(hm) {
      var p = hm.split(":");
      return Number(p[0]) * 60 + Number(p[1]);
    }

    function formatHm(mins) {
      var h = Math.floor(mins / 60);
      var m = mins % 60;
      return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    }

    function localFallbackSlots(dateStr, duration) {
      var cfg = bookingConfig || BOOKING_FALLBACK;
      var day = new Date(dateStr + "T12:00:00").getDay();
      if (cfg.workingDays.indexOf(day) === -1) {
        return { slots: [], closed: true };
      }

      var start = parseHm(cfg.workingHours.start);
      var end = parseHm(cfg.workingHours.end);
      var step = cfg.slotStepMinutes || 30;
      var need = duration + (cfg.bufferMinutes || 0);
      var now = new Date();
      var isToday = dateStr === isoToday;
      var slots = [];

      for (var t = start; t + need <= end; t += step) {
        if (isToday) {
          var nowMins = now.getHours() * 60 + now.getMinutes();
          if (t <= nowMins) continue;
        }
        slots.push(formatHm(t));
      }
      return { slots: slots, closed: false };
    }

    function setTimeStatus(text, isError) {
      if (!timeStatus) return;
      timeStatus.textContent = text || "";
      timeStatus.classList.toggle("is-error", !!isError);
      timeStatus.hidden = !text;
    }

    function renderSlots(slots) {
      timeGrid.innerHTML = "";
      selectedTime = null;

      if (!slots || !slots.length) {
        setTimeStatus("No hay huecos disponibles este día.", true);
        return;
      }

      setTimeStatus("");
      slots.forEach(function (hm) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "time-slot";
        btn.textContent = hm;
        timeGrid.appendChild(btn);
      });
    }

    function fetchSlots() {
      var dateStr = fechaInput.value;
      var serviceInput = selectedService();
      if (!dateStr || !serviceInput) {
        timeGrid.innerHTML = "";
        selectedTime = null;
        setTimeStatus("Elige un día para ver las horas disponibles.");
        return;
      }

      var requestId = ++slotsRequestId;
      var serviceId = serviceInput.value;
      var duration = serviceDuration(serviceInput);

      timeGrid.innerHTML = "";
      selectedTime = null;
      timeGrid.classList.add("is-loading");
      setTimeStatus("Buscando horas disponibles…");

      var done = function (result) {
        if (requestId !== slotsRequestId) return;
        timeGrid.classList.remove("is-loading");
        if (result.closed) {
          renderSlots([]);
          setTimeStatus("Cerrado este día — elige otra fecha.", true);
          return;
        }
        renderSlots(result.slots || []);
      };

      if (!CONFIG.bookingApiUrl) {
        done(localFallbackSlots(dateStr, duration));
        return;
      }

      fetch(apiUrl("slots", { date: dateStr, service: serviceId }), { method: "GET" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.error) || "Slots error");
          done({ slots: data.slots || [], closed: !!data.closed });
        })
        .catch(function () {
          done(localFallbackSlots(dateStr, duration));
          setTimeStatus("No se pudo consultar el calendario — mostrando horario base.", true);
        });
    }

    function isWorkingDay(dateStr) {
      var cfg = bookingConfig || BOOKING_FALLBACK;
      var day = new Date(dateStr + "T12:00:00").getDay();
      return cfg.workingDays.indexOf(day) !== -1;
    }

    timeGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".time-slot");
      if (!btn || btn.disabled) return;
      timeGrid.querySelectorAll(".time-slot").forEach(function (b) { b.classList.remove("is-selected"); });
      btn.classList.add("is-selected");
      selectedTime = btn.textContent.trim();
      horaField.classList.remove("has-error");
    });

    fechaInput.addEventListener("change", fetchSlots);
    form.querySelectorAll('input[name="servicio"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (fechaInput.value) fetchSlots();
      });
    });

    function showStep(n) {
      current = n;

      panels.forEach(function (p) {
        p.classList.toggle("is-active", Number(p.getAttribute("data-panel")) === n);
      });

      stepDots.forEach(function (dot) {
        var step = Number(dot.getAttribute("data-step"));
        dot.classList.toggle("is-active", step === n);
        dot.classList.toggle("is-done", step < n);
      });

      btnBack.classList.toggle("is-hidden", n === 1);
      btnNext.classList.toggle("is-hidden", n === totalSteps);
      btnConfirm.classList.toggle("is-hidden", n !== totalSteps);

      formError.classList.remove("is-visible");

      if (n === 2 && fechaInput.value) fetchSlots();
      if (n === totalSteps) buildSummary();
    }

    function clearErrors() {
      formError.classList.remove("is-visible");
      fechaField.classList.remove("has-error");
      horaField.classList.remove("has-error");
    }

    function validateStep(n) {
      clearErrors();

      if (n === 2) {
        var valid = true;

        if (!fechaInput.value) {
          fechaField.classList.add("has-error");
          fechaError.textContent = "Por favor, elige un día.";
          valid = false;
        } else if (!isWorkingDay(fechaInput.value)) {
          fechaField.classList.add("has-error");
          fechaError.textContent = "Ese día estamos cerrados — elige otro.";
          valid = false;
        }

        if (!selectedTime) {
          horaField.classList.add("has-error");
          valid = false;
        }

        if (!valid) {
          formError.textContent = "Revisa los campos marcados.";
          formError.classList.add("is-visible");
        }
        return valid;
      }

      if (n === 3) {
        var nombre = document.getElementById("nombre");
        var telefono = document.getElementById("telefono");
        if (!nombre.value.trim() || !telefono.value.trim()) {
          formError.textContent = "Por favor, indica tu nombre y teléfono.";
          formError.classList.add("is-visible");
          return false;
        }
      }

      return true;
    }

    function bookingPayload() {
      var servicioInput = selectedService();
      return {
        action: "book",
        key: CONFIG.bookingApiKey || "",
        date: fechaInput.value,
        time: selectedTime,
        service: servicioInput ? servicioInput.value : "",
        serviceLabel: servicioInput ? SERVICE_LABELS[servicioInput.value] : "",
        nombre: document.getElementById("nombre").value.trim(),
        telefono: document.getElementById("telefono").value.trim(),
        perro: document.getElementById("perro").value.trim(),
        tamano: document.getElementById("tamano").value,
        notas: document.getElementById("notas").value.trim()
      };
    }

    function buildSummary() {
      var summary = document.getElementById("summary");
      var servicioInput = selectedService();
      var servicioLabel = SERVICE_LABELS[servicioInput.value];
      var price = servicioInput.getAttribute("data-price");
      var duration = serviceDuration(servicioInput);
      var fecha = fechaInput.value
        ? new Date(fechaInput.value + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
        : "-";
      var nombre = document.getElementById("nombre").value.trim();
      var telefono = document.getElementById("telefono").value.trim();
      var perro = document.getElementById("perro").value.trim();
      var tamano = document.getElementById("tamano").value;
      var notas = document.getElementById("notas").value.trim();

      var rows = [
        ["Servicio", servicioLabel + " · Desde €" + price + " · ~" + duration + " min"],
        ["Fecha", fecha],
        ["Hora", selectedTime || "-"],
        ["Nombre", nombre],
        ["Teléfono", telefono]
      ];
      if (perro) rows.push(["Perro", perro + (tamano ? " (" + tamano + ")" : "")]);
      if (notas) rows.push(["Notas", notas]);

      summary.innerHTML = rows.map(function (r) {
        return '<div class="summary-row"><span>' + r[0] + "</span><span>" + r[1] + "</span></div>";
      }).join("");

      var message = "Hola, soy " + nombre + ". Quiero reservar una cita en Dog Glow Studio.\n" +
        "Servicio: " + servicioLabel + " (desde €" + price + ", ~" + duration + " min)\n" +
        "Fecha: " + fecha + "\n" +
        "Hora: " + selectedTime + "\n" +
        (perro ? "Perro: " + perro + (tamano ? " (" + tamano + ")" : "") + "\n" : "") +
        (notas ? "Notas: " + notas + "\n" : "") +
        "Mi teléfono: " + telefono;

      btnConfirm.href = waLink(message);
      btnConfirm.setAttribute("data-wa-href", waLink(message));
    }

    function openWhatsApp() {
      var href = btnConfirm.getAttribute("data-wa-href") || btnConfirm.href;
      window.open(href, "_blank", "noopener");
    }

    btnNext.addEventListener("click", function () {
      if (!validateStep(current)) return;
      if (current < totalSteps) showStep(current + 1);
    });

    btnBack.addEventListener("click", function () {
      if (current > 1) showStep(current - 1);
    });

    btnConfirm.addEventListener("click", function (e) {
      e.preventDefault();
      if (!validateStep(3) && current !== totalSteps) return;

      var goWa = function () { openWhatsApp(); };

      if (!createEvents || !CONFIG.bookingApiUrl) {
        goWa();
        return;
      }

      btnConfirm.classList.add("is-busy");
      fetch(CONFIG.bookingApiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(bookingPayload())
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          btnConfirm.classList.remove("is-busy");
          if (!data || !data.ok) {
            formError.textContent = (data && data.error)
              ? ("No se pudo reservar en el calendario: " + data.error)
              : "No se pudo reservar en el calendario. Puedes continuar por WhatsApp.";
            formError.classList.add("is-visible");
          }
          goWa();
        })
        .catch(function () {
          btnConfirm.classList.remove("is-busy");
          formError.textContent = "No se pudo contactar el calendario. Continuamos por WhatsApp.";
          formError.classList.add("is-visible");
          goWa();
        });
    });

    document.querySelectorAll(".js-book").forEach(function (link) {
      link.addEventListener("click", function () {
        var service = link.getAttribute("data-service");
        var radio = form.querySelector('input[name="servicio"][value="' + service + '"]');
        if (radio) radio.checked = true;
        showStep(1);
      });
    });

    loadConfig().then(function () {
      showStep(1);
      setTimeStatus("Elige un día para ver las horas disponibles.");
    });
  }

  /* ---------------------------------------------------------------------
   * Footer year
   * ------------------------------------------------------------------- */
  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ---------------------------------------------------------------------
   * Mobile app dock — show Reservar + WhatsApp after hero
   * ------------------------------------------------------------------- */
  function initMobileDock() {
    var dock = document.getElementById("mobileDock");
    var hero = document.querySelector(".hero");
    if (!dock || !hero) return;

    function setVisible(visible) {
      dock.classList.toggle("is-visible", visible);
      document.body.classList.toggle("has-mobile-dock", visible);
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            setVisible(!entry.isIntersecting);
          });
        },
        { threshold: 0, rootMargin: "0px 0px -8% 0px" }
      );
      io.observe(hero);
      return;
    }

    function onScroll() {
      var rect = hero.getBoundingClientRect();
      setVisible(rect.bottom <= 48);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireContactLinks();
    initHeader();
    initNav();
    initNavActive();
    initReveal();
    initBooking();
    initYear();
    initMobileDock();
  });
})();
