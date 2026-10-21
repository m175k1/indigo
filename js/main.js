(function () {
  "use strict";

  // Header shadow on scroll
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile navigation
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    function setMenu(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    toggle.addEventListener("click", function () {
      setMenu(!nav.classList.contains("is-open"));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        setMenu(false);
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (window.getComputedStyle(toggle).display === "none") setMenu(false);
    });
  }

  // Keep the service section links consistent with the other active navigation items.
  if (document.querySelector(".service-block")) {
    var serviceNavigation = document.querySelectorAll('.e2-nav a[href^="services.html#"], .service-nav a[href^="#"]');
    function updateServiceNavigation() {
      var currentSection = window.location.hash || "#writing";
      serviceNavigation.forEach(function (link) {
        if (link.hash === currentSection) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }
    window.addEventListener("hashchange", updateServiceNavigation);
    updateServiceNavigation();
  }

  // Parallax backgrounds: [data-parallax="0.35"] moves at that fraction of scroll speed
  var parallaxEls = document.querySelectorAll("[data-parallax]");
  var motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = motionPreference.matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!reduceMotion) document.documentElement.classList.add("effects-ready");

  // Visitors can pause the client marquee independently of hover or motion settings.
  var logoSection = document.querySelector(".logos");
  var logoPause = document.querySelector(".logos__pause");
  if (logoSection && logoPause) {
    logoPause.hidden = false;
    logoPause.addEventListener("click", function () {
      var paused = logoSection.classList.toggle("is-paused");
      logoPause.setAttribute("aria-pressed", String(paused));
      logoPause.setAttribute("aria-label", paused ? "Resume client list" : "Pause client list");
      logoPause.textContent = paused ? "Resume ▶" : "Pause Ⅱ";
    });
  }

  // Client-category tabs on the About page.
  var clientTabs = document.querySelector(".client-tabs");
  if (clientTabs) {
    var clientTabButtons = Array.prototype.slice.call(clientTabs.querySelectorAll('[role="tab"]'));
    var clientTabPanels = Array.prototype.slice.call(clientTabs.querySelectorAll('[role="tabpanel"]'));
    function activateClientTab(tab, moveFocus) {
      var panelId = tab.getAttribute("aria-controls");
      clientTabButtons.forEach(function (button) {
        var selected = button === tab;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      clientTabPanels.forEach(function (panel) {
        var selected = panel.id === panelId;
        panel.hidden = !selected;
        if (selected) panel.querySelectorAll(".reveal").forEach(function (item) { item.classList.add("is-visible"); });
      });
      if (moveFocus) tab.focus();
    }
    clientTabButtons.forEach(function (tab, index) {
      tab.addEventListener("click", function () { activateClientTab(tab, false); });
      tab.addEventListener("keydown", function (event) {
        var nextIndex;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % clientTabButtons.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + clientTabButtons.length) % clientTabButtons.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = clientTabButtons.length - 1;
        else return;
        event.preventDefault();
        activateClientTab(clientTabButtons[nextIndex], true);
      });
    });
  }

  // One scheduled update for scroll effects; small screens keep images still.
  var progress = document.createElement("div");
  progress.className = "reading-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.appendChild(progress);
  var ticking = false;
  function updateScrollEffects() {
    var distance = document.documentElement.scrollHeight - window.innerHeight;
    var position = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
    progress.style.transform = "scaleX(" + position.toFixed(4) + ")";
    parallaxEls.forEach(function (el) {
      if (reduceMotion || window.innerWidth <= 860) {
        el.style.removeProperty("transform");
        return;
      }
      var box = el.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) return;
      var speed = parseFloat(el.getAttribute("data-parallax")) || 0.35;
      // Book imagery has a limited overscan; keep its edges outside the section.
      var limit = el.classList.contains("publications-section__books") ? box.height * .18 : box.height * .35;
      var offset = Math.max(-limit, Math.min(limit, -box.top * speed));
      el.style.transform = "translate3d(0," + offset.toFixed(1) + "px,0)";
    });
    ticking = false;
  }
  function requestScrollEffects() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(updateScrollEffects); }
  }
  window.addEventListener("scroll", requestScrollEffects, { passive: true });
  window.addEventListener("resize", requestScrollEffects);
  window.addEventListener("load", requestScrollEffects);
  if ("ResizeObserver" in window) new ResizeObserver(requestScrollEffects).observe(document.body);
  updateScrollEffects();

  // Count-up numbers: [data-count] animates from 0 when scrolled into view
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length && !reduceMotion && "IntersectionObserver" in window) {
    var countUp = function (el) {
      var target = parseInt(el.getAttribute("data-count"), 10);
      var start = null;
      var step = function (now) {
        if (reduceMotion) { el.textContent = target; return; }
        if (!start) start = now;
        var p = Math.min((now - start) / 1400, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          countUp(entry.target);
          countIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) {
      el.textContent = "0";
      countIO.observe(el);
    });
  }

  // Footer year
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // Share the same entrance rhythm across home, services, work, and contact.
  document.querySelectorAll(".service-list.reveal").forEach(function (list) { list.classList.remove("reveal"); });
  document.querySelectorAll(".section-head, .work-card, .pub, .client-wall__item, .service-list > li, .form, .contact-card, .map, .e2-hero__content > *, .e2-hero__values, .page-hero > .container > *").forEach(function (el) {
    if (!el.parentElement.closest(".reveal")) el.classList.add("reveal");
  });
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    document.documentElement.classList.add("motion-ready");
    document.querySelectorAll(".grid-3, .grid-4, .steps, .stats, .mvo, .work-grid, .pubs, .client-wall, .service-list, .e2-hero__content, .page-hero > .container").forEach(function (group) {
      group.querySelectorAll(".reveal").forEach(function (el, index) {
        el.style.setProperty("--reveal-delay", (Math.min(index % 4, 3) * 75) + "ms");
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -24px 0px", threshold: 0.05 });
    revealEls.forEach(function (el) { io.observe(el); });
    document.querySelectorAll(".process-section .steps").forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    document.querySelectorAll(".process-section .steps").forEach(function (el) { el.classList.add("is-visible"); });
  }

  // Keyboard navigation never waits for an entrance animation.
  document.addEventListener("focusin", function (event) {
    var el = event.target.closest(".reveal");
    while (el) {
      el.classList.add("is-visible");
      el = el.parentElement.closest(".reveal");
    }
  });

  // Pointer lighting is local to each surface, with at most one write per frame.
  var spotlights = document.querySelectorAll(".service-card, .work-card, .service-list > li, .mvo__item, .consultation-banner");
  spotlights.forEach(function (surface) {
    surface.setAttribute("data-spotlight", "");
    var lightFrame = 0;
    var pointerX = 0;
    var pointerY = 0;
    function clearLight() {
      window.cancelAnimationFrame(lightFrame);
      lightFrame = 0;
      surface.classList.remove("is-lit");
    }
    surface.addEventListener("pointermove", function (event) {
      if (reduceMotion || !finePointer.matches || event.pointerType === "touch") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (lightFrame) return;
      lightFrame = window.requestAnimationFrame(function () {
        lightFrame = 0;
        if (reduceMotion || !finePointer.matches) return;
        var rect = surface.getBoundingClientRect();
        surface.style.setProperty("--light-x", (pointerX - rect.left).toFixed(1) + "px");
        surface.style.setProperty("--light-y", (pointerY - rect.top).toFixed(1) + "px");
        surface.classList.add("is-lit");
      });
    });
    surface.addEventListener("pointerleave", clearLight);
    surface.addEventListener("pointercancel", clearLight);
  });

  // Honor a changed OS preference immediately, including in-flight counters.
  motionPreference.addEventListener("change", function (event) {
    reduceMotion = event.matches;
    document.documentElement.classList.toggle("effects-ready", !reduceMotion);
    if (reduceMotion) {
      if (io) io.disconnect();
      if (countIO) countIO.disconnect();
      document.documentElement.classList.remove("motion-ready");
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
      counters.forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
      spotlights.forEach(function (el) { el.classList.remove("is-lit"); });
      document.querySelectorAll("[data-category]").forEach(function (el) {
        el.getAnimations().forEach(function (animation) { animation.cancel(); });
      });
    }
    requestScrollEffects();
  });

  // Work page filters
  var filters = document.querySelectorAll("[data-filter]");
  var items = document.querySelectorAll("[data-category]");
  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var cat = btn.getAttribute("data-filter");
      filters.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      items.forEach(function (item) {
        item.getAnimations().forEach(function (animation) { animation.cancel(); });
        item.classList.add("is-filtered");
        item.hidden = !(cat === "all" || item.getAttribute("data-category") === cat);
        if (!item.hidden) item.classList.add("is-visible");
      });
      if (!reduceMotion) {
        Array.from(items).filter(function (item) { return !item.hidden; }).forEach(function (item, index) {
          if (item.animate) item.animate([
            { opacity: 0, translate: "0 12px" },
            { opacity: 1, translate: "0 0" }
          ], { duration: 380, delay: Math.min(index, 3) * 45, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" });
        });
      }
    });
  });

  // Contact form
  var form = document.getElementById("inquiry-form");
  if (!form) return;

  // Pre-select a service when linked as contact.html?service=writing
  var service = new URLSearchParams(window.location.search).get("service");
  var select = form.querySelector("#service");
  if (service && select) {
    var match = select.querySelector('option[value="' + service + '"]');
    if (match) select.value = service;
  }

  var status = form.querySelector(".form__status");

  function setStatus(type, message) {
    status.className = "form__status is-" + type;
    status.textContent = message;
  }

  function validate() {
    var ok = true;
    form.querySelectorAll("[required]").forEach(function (input) {
      var field = input.closest(".field");
      var valid = input.value.trim() !== "" && (input.type !== "email" || /\S+@\S+\.\S+/.test(input.value));
      field.classList.toggle("has-error", !valid);
      if (!valid && ok) { input.focus(); ok = false; }
    });
    return ok;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) return;

    var data = new FormData(form);
    var endpoint = form.getAttribute("data-endpoint");

    // With a form service configured (e.g. Formspree), post the inquiry directly.
    if (endpoint) {
      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("Request failed");
          form.reset();
          setStatus("success", "Thank you. Your inquiry has been sent and we will get back to you soon.");
        })
        .catch(function () {
          setStatus("error", "Something went wrong. Please email us directly at contact@indigo-mx.com.");
        })
        .finally(function () { button.disabled = false; });
      return;
    }

    // Fallback: open the visitor's email app with the inquiry filled in.
    var serviceLabel = select && select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : "";
    var subject = "Project inquiry: " + serviceLabel + " (" + data.get("organization") + ")";
    var body = [
      "Name: " + data.get("name"),
      "Organization: " + data.get("organization"),
      "Email: " + data.get("email"),
      "Phone: " + (data.get("phone") || "-"),
      "Service: " + serviceLabel,
      "Timeline: " + (data.get("timeline") || "-"),
      "",
      data.get("message")
    ].join("\n");
    window.location.href = "mailto:contact@indigo-mx.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    setStatus("success", "Your email app should open with your inquiry ready to send. If it doesn't, email us at contact@indigo-mx.com.");
  });

  form.querySelectorAll("[required]").forEach(function (input) {
    input.addEventListener("input", function () { input.closest(".field").classList.remove("has-error"); });
  });
})();
