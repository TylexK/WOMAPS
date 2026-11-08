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

const fallbackMusicTracks = [
  "Daniel Caesar - Superpowers (Official Audio) - DanielCaesarVEVO.mp3",
  "Nafeesisboujee - Stephanie.mp3",
  "Malcolm Todd - Earrings.mp3",
  "Tyler, The Creator - SEE YOU AGAIN.mp3",
  "Malcolm Todd - Sweet Boy.mp3",
  "Djo - End Of Beginning .mp3",
];
let musicTracks = [];
const musicStateKey = "gg-mapeadores-music";
const musicState = JSON.parse(localStorage.getItem(musicStateKey) || "{}");
const musicPlayer = document.createElement("section");
const musicAudio = document.createElement("audio");
let musicTrackIndex = 0;
let musicHasStarted = false;
let musicAutoplayPending = true;
let musicTrackRequest = 0;
let musicTrackChanging = false;
let musicPlaybackReachedEnd = false;

musicPlayer.className = "music-player";
musicPlayer.setAttribute("aria-label", "Reproductor de música");
musicAudio.muted = true;
musicAudio.preload = "auto";
musicAudio.setAttribute("playsinline", "");
musicPlayer.innerHTML = `
  <div class="music-player-info">
    <span class="music-player-title"></span>
    <div class="music-player-progress">
      <input class="music-progress" type="range" min="0" max="100" step="0.1" value="0" aria-label="Progreso de la canción">
      <span class="music-time">0:00</span>
    </div>
  </div>
  <div class="music-player-controls">
    <button class="music-player-button music-previous" type="button" aria-label="Canción anterior">⏮</button>
    <button class="music-player-button music-play" type="button" aria-label="Reproducir música">▶</button>
    <button class="music-player-button music-next" type="button" aria-label="Siguiente canción">⏭</button>
    <label class="music-volume-label">
      <button class="music-volume-toggle" type="button" aria-label="Activar sonido">🔊</button>
      <input class="music-volume" type="range" min="0" max="1" step="0.01" aria-label="Volumen de música">
    </label>
  </div>
`;
const topbarElement = document.querySelector(".topbar");
if (topbarElement) topbarElement.insertAdjacentElement("afterend", musicPlayer);
else document.body.append(musicPlayer);
musicPlayer.append(musicAudio);
const musicTitle = musicPlayer.querySelector(".music-player-title");
const musicPlayButton = musicPlayer.querySelector(".music-play");
const musicPreviousButton = musicPlayer.querySelector(".music-previous");
const musicNextButton = musicPlayer.querySelector(".music-next");
const musicVolume = musicPlayer.querySelector(".music-volume");
const musicVolumeToggle = musicPlayer.querySelector(".music-volume-toggle");
const musicProgress = musicPlayer.querySelector(".music-progress");
const musicTime = musicPlayer.querySelector(".music-time");

function formatMusicTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function saveMusicState() {
  localStorage.setItem(musicStateKey, JSON.stringify({
    trackIndex: musicTrackIndex,
    trackName: musicTracks[musicTrackIndex],
    currentTime: musicAudio.currentTime,
    volume: musicAudio.volume,
    isPlaying: !musicAudio.paused,
  }));
}

function setMusicTrack(index, shouldPlay = false) {
  if (musicTracks.length === 0) return;
  const requestId = musicTrackRequest + 1;
  musicTrackRequest = requestId;
  musicTrackChanging = true;
  musicPlaybackReachedEnd = false;
  musicTrackIndex = (index + musicTracks.length) % musicTracks.length;
  musicAudio.src = `Music/${encodeURIComponent(musicTracks[musicTrackIndex])}`;
  musicTitle.textContent = musicTracks[musicTrackIndex].replace(/\.(mp3|wav|ogg|m4a|aac|flac)$/i, "");
  musicAudio.addEventListener("loadedmetadata", () => {
    if (requestId !== musicTrackRequest) return;
    musicTrackChanging = false;
    musicProgress.value = "0";
    musicTime.textContent = `0:00 / ${formatMusicTime(musicAudio.duration)}`;
    const savedTime = musicState.trackName === musicTracks[musicTrackIndex] ? Number(musicState.currentTime) : 0;
    if (Number.isFinite(savedTime) && savedTime > 0 && savedTime < musicAudio.duration) {
      musicAudio.currentTime = savedTime;
    }
    if ((shouldPlay || musicAutoplayPending) && musicAudio.duration > 0) {
      musicAudio.play().catch(() => {
        musicPlayButton.textContent = "▶";
        musicPlayButton.setAttribute("aria-label", "Reproducir música");
      });
    }
  }, { once: true });
  musicAudio.load();
}

function setRandomMusicTrack(shouldPlay = false) {
  if (musicTracks.length < 2) {
    setMusicTrack(0, shouldPlay);
    return;
  }

  let nextIndex = musicTrackIndex;
  while (nextIndex === musicTrackIndex) {
    nextIndex = Math.floor(Math.random() * musicTracks.length);
  }
  setMusicTrack(nextIndex, shouldPlay);
}

async function loadMusicTracks() {
  try {
    const response = await fetch("music.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Music directory returned ${response.status}`);
    const manifestTracks = await response.json();
    if (!Array.isArray(manifestTracks)) throw new Error("music.json must contain an array");
    musicTracks = manifestTracks.filter((name) => typeof name === "string" && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name));
    if (musicTracks.length === 0) throw new Error("music.json contains no audio files");
  } catch (error) {
    console.error("No se pudo cargar music.json. Se usará la lista de respaldo.", error);
    musicTracks = fallbackMusicTracks;
  }

  const savedTrackIndex = musicTracks.indexOf(musicState.trackName);
  musicTrackIndex = savedTrackIndex >= 0 ? savedTrackIndex : Math.floor(Math.random() * musicTracks.length);
  setMusicTrack(musicTrackIndex, true);
}

function updateMusicButton() {
  const isPlaying = !musicAudio.paused;
  musicPlayer.classList.toggle("music-muted", musicAudio.muted);
  musicVolumeToggle.textContent = musicAudio.muted || musicAudio.volume === 0 ? "🔇" : "🔊";
  musicVolumeToggle.setAttribute("aria-label", musicAudio.muted ? "Activar sonido" : "Silenciar música");
  musicPlayButton.textContent = isPlaying ? "Ⅱ" : "▶";
  musicPlayButton.setAttribute(
    "aria-label",
    isPlaying && !musicAudio.muted ? "Pausar música" : "Activar música",
  );
}

function activateMusic() {
  musicAutoplayPending = false;
  musicAudio.muted = false;
  musicAudio.play().then(updateMusicButton).catch((error) => {
    console.error("No se pudo reproducir la música.", error);
    musicPlayButton.textContent = "▶";
    musicPlayButton.setAttribute("aria-label", "Reproducir música");
  });
}

function toggleMusic(event) {
  event.preventDefault();
  event.stopPropagation();
  if (musicAudio.paused || musicAudio.muted) activateMusic();
  else musicAudio.pause();
}

musicAudio.volume = Number.isFinite(musicState.volume) ? musicState.volume : 0.12;
musicVolume.value = String(musicAudio.volume);
loadMusicTracks();
musicPlayButton.addEventListener("click", toggleMusic);
musicPreviousButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!musicTrackChanging) setRandomMusicTrack(true);
});
musicNextButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!musicTrackChanging) setRandomMusicTrack(true);
});
musicVolume.addEventListener("input", () => {
  musicAudio.volume = Number(musicVolume.value);
  if (musicAudio.volume > 0) {
    musicAutoplayPending = false;
    musicAudio.muted = false;
    if (musicAudio.paused) musicAudio.play().catch(() => {});
  }
  updateMusicButton();
  saveMusicState();
});
musicVolumeToggle.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  musicAudio.muted = !musicAudio.muted;
  if (!musicAudio.muted && musicAudio.paused) musicAudio.play().catch(() => {});
  updateMusicButton();
  saveMusicState();
});
musicProgress.addEventListener("input", () => {
  if (!Number.isFinite(musicAudio.duration)) return;
  musicAudio.currentTime = (Number(musicProgress.value) / 100) * musicAudio.duration;
});
musicAudio.addEventListener("play", () => {
  musicHasStarted = true;
  updateMusicButton();
  saveMusicState();
});
musicAudio.addEventListener("pause", () => {
  updateMusicButton();
  saveMusicState();
});
musicAudio.addEventListener("timeupdate", () => {
  if (Number.isFinite(musicAudio.duration) && musicAudio.duration > 0) {
    musicProgress.value = String((musicAudio.currentTime / musicAudio.duration) * 100);
    musicTime.textContent = `${formatMusicTime(musicAudio.currentTime)} / ${formatMusicTime(musicAudio.duration)}`;
    if (musicAudio.currentTime >= musicAudio.duration - 0.5) musicPlaybackReachedEnd = true;
  }
  if (musicHasStarted) saveMusicState();
});
musicAudio.addEventListener("ended", () => {
  if (!musicTrackChanging && musicPlaybackReachedEnd) {
    setRandomMusicTrack(true);
  }
});
window.addEventListener("pagehide", saveMusicState);
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".music-player")) activateMusic();
}, { once: true });
updateMusicButton();

const hoverSoundTargets = document.querySelectorAll(
  ".mapper-row, .collaborator, .community-option, .guide-block, .fps-details, .collaborator-invite",
);
const folderSoundTargets = document.querySelectorAll(".mapper-folder-summary");
let hoverAudioContext;
let lastHoverSoundAt = 0;
let lastFolderSoundAt = 0;

function playHoverSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  if (!hoverAudioContext) hoverAudioContext = new AudioContext();
  if (hoverAudioContext.state === "suspended") {
    hoverAudioContext.resume().then(playHoverSound);
    return;
  }

  const now = performance.now();
  if (now - lastHoverSoundAt < 55) return;
  lastHoverSoundAt = now;

  const startTime = hoverAudioContext.currentTime;
  const oscillator = hoverAudioContext.createOscillator();
  const noise = hoverAudioContext.createBufferSource();
  const noiseBuffer = hoverAudioContext.createBuffer(1, Math.floor(hoverAudioContext.sampleRate * 0.045), hoverAudioContext.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  const gain = hoverAudioContext.createGain();
  const noiseGain = hoverAudioContext.createGain();

  for (let index = 0; index < noiseData.length; index += 1) {
    noiseData[index] = (Math.random() * 2 - 1) * (1 - index / noiseData.length);
  }

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(175, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(92, startTime + 0.07);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.09, startTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.08);

  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.035, startTime + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.035);

  oscillator.connect(gain).connect(hoverAudioContext.destination);
  noise.connect(noiseGain).connect(hoverAudioContext.destination);
  noise.buffer = noiseBuffer;
  oscillator.start(startTime);
  noise.start(startTime);
  oscillator.stop(startTime + 0.09);
  noise.stop(startTime + 0.045);
}

function playFolderSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  if (!hoverAudioContext) hoverAudioContext = new AudioContext();
  if (hoverAudioContext.state === "suspended") {
    hoverAudioContext.resume().then(playFolderSound);
    return;
  }

  const now = performance.now();
  if (now - lastFolderSoundAt < 55) return;
  lastFolderSoundAt = now;

  const startTime = hoverAudioContext.currentTime;
  const oscillator = hoverAudioContext.createOscillator();
  const gain = hoverAudioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(640, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(980, startTime + 0.06);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.07, startTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.09);

  oscillator.connect(gain).connect(hoverAudioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.1);
}

document.addEventListener("pointerdown", () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!hoverAudioContext) hoverAudioContext = new AudioContext();
  if (hoverAudioContext.state === "suspended") hoverAudioContext.resume();
}, { once: true });

for (const target of hoverSoundTargets) {
  target.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") playHoverSound();
  });
}

for (const target of folderSoundTargets) {
  target.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") playFolderSound();
  });
}

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
