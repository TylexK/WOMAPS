const searchInput = document.querySelector("#mapper-search");

if (searchInput) {
  const mapperFolders = [...document.querySelectorAll(".mapper-folder")];
  const emptyState = document.querySelector("#empty-state");

  function filterMappers() {
    const query = searchInput.value.trim().toLocaleLowerCase("es");
    let visibleCount = 0;

    for (const folder of mapperFolders) {
      const categorySearch = folder.dataset.categorySearch || "";
      const categoryMatches = query !== "" && categorySearch.includes(query);
      const rows = [...folder.querySelectorAll(".mapper-row")];
      let matchingRows = 0;

      for (const row of rows) {
        const matches = query === "" || categoryMatches || row.dataset.search.includes(query);
        row.hidden = !matches;
        if (matches) matchingRows += 1;
      }

      const matches = query === "" || categoryMatches || matchingRows > 0;
      folder.hidden = !matches;
      if (query !== "" && matches && rows.length > 0) folder.open = true;
      if (matches) visibleCount += 1;
    }

    emptyState.hidden = visibleCount !== 0;
  }

  searchInput.addEventListener("input", filterMappers);

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  });
}

const menuToggle = document.querySelector(".menu-toggle");
const siteMenu = document.querySelector("#site-menu");

if (menuToggle && siteMenu) {
  const topbar = menuToggle.closest(".topbar");

  function setMenuOpen(isOpen) {
    topbar.classList.toggle("menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  }

  menuToggle.addEventListener("click", () => {
    setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
  });

  siteMenu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenuOpen(false);
  });

  document.addEventListener("pointerdown", (event) => {
    if (topbar.classList.contains("menu-open") && !topbar.contains(event.target)) setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && topbar.classList.contains("menu-open")) {
      setMenuOpen(false);
      menuToggle.focus();
    }
  });
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canAnimate = typeof Element.prototype.animate === "function";
const revealItems = document.querySelectorAll("[data-reveal]");

if (revealItems.length > 0 && "IntersectionObserver" in window && !prefersReducedMotion && canAnimate) {
  const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      const delay = Number(entry.target.dataset.revealDelay || 0);
      entry.target.animate(
        [
          { opacity: 0, transform: "translateY(18px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 560, delay, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" },
      );
      revealObserver.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });

  revealItems.forEach((element, index) => {
    element.dataset.revealDelay = String((index % 3) * 80);
    revealObserver.observe(element);
  });
}

if (!prefersReducedMotion && canAnimate) {
  const interactiveCards = document.querySelectorAll(".mapper-row, .collaborator, .community-option");

  for (const card of interactiveCards) {
    let isRaised = false;
    let cardAnimation;

    function setRaised(raised) {
      if (isRaised === raised) return;
      isRaised = raised;
      cardAnimation?.cancel();
      cardAnimation = card.animate(
        [
          { transform: raised ? "translateY(0)" : "translateY(-3px)" },
          { transform: raised ? "translateY(-3px)" : "translateY(0)" },
        ],
        { duration: 180, easing: "ease-out", fill: "both" },
      );
    }

    card.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") setRaised(true);
    });
    card.addEventListener("pointerleave", () => setRaised(false));
    card.addEventListener("focusin", () => setRaised(true));
    card.addEventListener("focusout", (event) => {
      if (!card.contains(event.relatedTarget)) setRaised(false);
    });
  }

  const pressableControls = document.querySelectorAll(".guide-cta, .download-link, .browse-link, .collaborator-visit, .menu-toggle");
  const controlStates = {
    rest: { transform: "translateY(0) scale(1)", boxShadow: "0 0 0 rgba(0,0,0,0)" },
    hover: { transform: "translateY(1px) scale(.98)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.2)" },
    pressed: { transform: "translateY(2px) scale(.96)", boxShadow: "inset 0 2px 5px rgba(0,0,0,.3)" },
  };

  for (const control of pressableControls) {
    let currentState = "rest";
    let controlAnimation;

    function animateControl(nextState) {
      if (currentState === nextState) return;
      controlAnimation?.cancel();
      controlAnimation = control.animate(
        [controlStates[currentState], controlStates[nextState]],
        { duration: nextState === "pressed" ? 90 : 150, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" },
      );
      currentState = nextState;
    }

    control.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") animateControl("hover");
    });
    control.addEventListener("pointerleave", () => animateControl("rest"));
    control.addEventListener("pointerdown", () => animateControl("pressed"));
    control.addEventListener("pointerup", (event) => {
      animateControl(event.pointerType !== "touch" && control.matches(":hover") ? "hover" : "rest");
    });
    control.addEventListener("pointercancel", () => animateControl("rest"));
    control.addEventListener("focusin", () => animateControl("hover"));
    control.addEventListener("focusout", (event) => {
      if (!control.contains(event.relatedTarget)) animateControl("rest");
    });
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") animateControl("pressed");
    });
    control.addEventListener("keyup", () => animateControl("hover"));
  }
}
