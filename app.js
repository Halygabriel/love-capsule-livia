(() => {
  'use strict';

  const STORAGE_KEY = 'livia-romantic-site-v9';
  const SETTINGS_KEY = 'livia-experience-settings-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loadExperienceSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return {
        theme: saved.theme === 'dark' ? 'dark' : 'light',
        reduceMotion: Boolean(saved.reduceMotion),
        musicVolume: Number.isFinite(Number(saved.musicVolume)) ? Math.max(0, Math.min(1, Number(saved.musicVolume))) : 0.42,
        lastSection: typeof saved.lastSection === 'string' ? saved.lastSection : '',
        secretLetterOpened: Boolean(saved.secretLetterOpened)
      };
    } catch {
      return { theme:'light', reduceMotion:false, musicVolume:0.42, lastSection:'', secretLetterOpened:false };
    }
  }
  const experienceSettings = loadExperienceSettings();
  let prefersReducedMotion = systemReducedMotion || experienceSettings.reduceMotion;
  function saveExperienceSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(experienceSettings)); } catch {}
  }
  function sessionGet(key) { try { return sessionStorage.getItem(key); } catch { return null; } }
  function sessionSet(key, value) { try { sessionStorage.setItem(key, value); } catch {} }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        discovered: Array.isArray(saved.discovered) ? saved.discovered : [],
        reasons: Array.isArray(saved.reasons) ? saved.reasons : [],
        boxes: Array.isArray(saved.boxes) ? saved.boxes : [],
        boxDates: saved.boxDates && typeof saved.boxDates === 'object' ? saved.boxDates : {},
        finalOpened: Boolean(saved.finalOpened)
      };
    } catch {
      return { discovered: [], reasons: [], boxes: [], boxDates: {}, finalOpened: false };
    }
  }

  const state = loadState();
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The experience must keep working even when storage is unavailable.
    }
  }

  const ICONS = {
    'icon-play': '<path d="m8 5 11 7-11 7V5Z"></path>',
    'icon-pause': '<path d="M9 5v14M15 5v14"></path>',
    'icon-star': '<path d="m12 2.8 2.8 5.68 6.27.91-4.53 4.42 1.07 6.24L12 17.1l-5.61 2.95 1.07-6.24-4.53-4.42 6.27-.91L12 2.8Z"></path>'
  };

  function setIcon(button, id) {
    const svg = button?.querySelector('svg');
    if (!svg || !ICONS[id]) return;
    svg.setAttribute('viewBox','0 0 24 24');
    svg.innerHTML = ICONS[id];
  }

  /* ---------- photo preload: all visual assets settle before reveal ---------- */
  function preloadSite() {
    const loaderBar = $('#loaderBar');
    const loaderPercent = $('#loaderPercent');
    const images = $$('img[src]').filter((img) => Boolean(img.getAttribute('src')));
    const jobs = [];
    let settled = 0;
    const total = images.length + 1;

    function update() {
      const percent = Math.round((settled / total) * 100);
      if (loaderBar) loaderBar.style.width = `${Math.min(percent, 100)}%`;
      if (loaderPercent) loaderPercent.textContent = `${Math.min(percent, 100)}%`;
    }

    function settleImage(img) {
      return new Promise((resolve) => {
        let finished = false;
        const timeoutId = window.setTimeout(() => done(false), 12000);
        const done = (ok) => {
          if (finished) return;
          finished = true;
          window.clearTimeout(timeoutId);
          if (!ok) {
            const frame = img.closest('.photo-frame');
            if (frame) frame.classList.add('image-failed');
            img.hidden = true;
            img.removeAttribute('src');
          }
          settled += 1;
          update();
          resolve();
        };

        if (img.complete) {
          if (img.naturalWidth > 0) {
            if (img.decode) img.decode().then(() => done(true)).catch(() => done(true));
            else done(true);
          } else done(false);
          return;
        }

        img.addEventListener('load', () => {
          if (img.decode) img.decode().then(() => done(true)).catch(() => done(true));
          else done(true);
        }, { once: true });
        img.addEventListener('error', () => done(false), { once: true });
      });
    }

    images.forEach((img) => {
      img.loading = 'eager';
      img.decoding = 'async';
      jobs.push(settleImage(img));
    });

    const fontReady = document.fonts?.ready || Promise.resolve();
    const fontJob = Promise.race([
      fontReady,
      new Promise((resolve) => setTimeout(resolve, 6500))
    ]).finally(() => {
      settled += 1;
      update();
    });
    jobs.push(fontJob);

    Promise.allSettled(jobs).then(() => {
      if (loaderBar) loaderBar.style.width = '100%';
      if (loaderPercent) loaderPercent.textContent = '100%';
      window.setTimeout(() => {
        document.documentElement.classList.add('assets-ready');
        document.documentElement.classList.remove('is-loading');
      }, 220);
    });
  }

  /* ---------- live memory tracker ---------- */
  class MemoryTracker {
    constructor() {
      this.discovered = new Set(state.discovered);
      this.nodes = [];
      this.bar = $('#progressBar');
      this.count = $('#memoryCount');
      this.observer = null;
    }

    init() {
      this.nodes = $$('[data-memory]');
      const valid = new Set(this.nodes.map((node) => node.dataset.memory));
      this.discovered = new Set([...this.discovered].filter((id) => valid.has(id)));
      state.discovered = [...this.discovered];
      saveState();
      this.update();

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (entry.target.dataset.memoryMode === 'view') {
            this.mark(entry.target.dataset.memory);
            this.observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.58, rootMargin: '0px 0px -6% 0px' });

      this.nodes.forEach((node) => {
        if (node.dataset.memoryMode === 'view' && !this.discovered.has(node.dataset.memory)) {
          this.observer.observe(node);
        }
      });
    }

    mark(id) {
      if (!id || this.discovered.has(id)) return;
      this.discovered.add(id);
      state.discovered = [...this.discovered];
      saveState();
      this.update(true);
    }

    update(animate = false) {
      const total = this.nodes.length;
      const current = this.discovered.size;
      const percent = total ? (current / total) * 100 : 0;
      if (this.bar) this.bar.style.width = `${percent}%`;
      if (this.count) {
        this.count.textContent = `${current} / ${total}`;
        if (animate && !prefersReducedMotion) {
          this.count.animate([
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-3px)', opacity: .6 },
            { transform: 'translateY(0)', opacity: 1 }
          ], { duration: 320, easing: 'ease-out' });
        }
      }
      syncExperienceProgress(current, total);
      updateSecretUnlock(current, total, animate);
    }
  }

  let memoryTracker;

  /* ---------- reveal motion ---------- */
  function initRevealMotion() {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
    $$('.reveal-item').forEach((item) => revealObserver.observe(item));
  }

  /* ---------- relationship counter ---------- */
  function initCounter() {
    const start = new Date(2024, 5, 12, 0, 0, 0);
    const els = ['years','months','days','hours','minutes','seconds'].map((id) => $(`#${id}`));

    function addYears(date, years) {
      const d = new Date(date);
      const month = d.getMonth();
      d.setFullYear(d.getFullYear() + years);
      if (d.getMonth() !== month) d.setDate(0);
      return d;
    }
    function addMonths(date, months) {
      const d = new Date(date);
      const originalDay = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + months);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(originalDay, last));
      return d;
    }
    function difference(end) {
      if (end < start) return { years:0, months:0, days:0, hours:0, minutes:0, seconds:0 };
      let cursor = new Date(start);
      let years = end.getFullYear() - cursor.getFullYear();
      let candidate = addYears(cursor, years);
      if (candidate > end) candidate = addYears(cursor, --years);
      cursor = candidate;
      let months = (end.getFullYear()-cursor.getFullYear())*12 + end.getMonth()-cursor.getMonth();
      candidate = addMonths(cursor, months);
      if (candidate > end) candidate = addMonths(cursor, --months);
      cursor = candidate;
      const dayMs = 86400000;
      let days = Math.floor((end - cursor) / dayMs);
      cursor = new Date(cursor.getTime() + days * dayMs);
      while (cursor > end) { days -= 1; cursor = new Date(cursor.getTime() - dayMs); }
      let ms = end - cursor;
      const hours = Math.floor(ms / 3600000); ms %= 3600000;
      const minutes = Math.floor(ms / 60000); ms %= 60000;
      const seconds = Math.floor(ms / 1000);
      return { years, months, days, hours, minutes, seconds };
    }
    function render() {
      const d = difference(new Date());
      const values = [d.years,d.months,d.days,d.hours,d.minutes,d.seconds];
      values.forEach((value,index) => { if (els[index]) els[index].textContent = index >= 3 ? String(value).padStart(2,'0') : String(value); });
    }
    render();
    setInterval(render, 1000);
  }


  function sparkBurst(target, amount = 10) {
    if (prefersReducedMotion) return;
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + Math.min(rect.height / 2, 80);
    for (let i = 0; i < amount; i += 1) {
      const spark = document.createElement('span');
      spark.className = 'spark-burst';
      const angle = (Math.PI * 2 * i) / amount + Math.random() * .3;
      const distance = 42 + Math.random() * 58;
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      spark.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
      spark.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
      document.body.appendChild(spark);
      setTimeout(() => spark.remove(), 850);
    }
  }

  /* ---------- surprises ---------- */
  function initSurpriseBoxes() {
    $$('.surprise-box').forEach((box, index) => {
      const message = box.dataset.message || '';
      const output = $('.surprise-message', box);
      const hint = $('.surprise-hint', box);
      const discovered = state.boxes.includes(index);
      if (output) output.innerHTML = `<span>${message}</span>`;
      const dateNode = document.createElement('span');
      dateNode.className = 'surprise-date';
      if (discovered && !state.boxDates[index]) {
        state.boxDates[index] = new Date().toISOString();
        saveState();
      }
      const renderDate = () => {
        if (!state.boxDates[index]) { dateNode.hidden = true; return; }
        dateNode.hidden = false;
        const date = new Date(state.boxDates[index]);
        dateNode.textContent = `Descoberta em ${new Intl.DateTimeFormat('pt-BR').format(date)}`;
      };
      renderDate();
      box.appendChild(dateNode);
      if (discovered) box.classList.add('is-discovered');
      if (hint) hint.textContent = 'toque para abrir';

      box.addEventListener('click', () => {
        const opening = !box.classList.contains('is-open');
        box.classList.toggle('is-open', opening);
        if (hint) hint.textContent = opening ? 'toque para fechar' : 'toque para abrir';

        if (opening) {
          sparkBurst(box, 8);
          if (!state.boxes.includes(index)) {
            state.boxes.push(index);
            state.boxDates[index] = new Date().toISOString();
            saveState();
            box.classList.add('is-discovered');
            renderDate();
          }
          memoryTracker?.mark(`box-${index + 1}`);
        }
      });
    });
  }

  /* ---------- capsule machine ---------- */

  function initMachine() {
    const gameRoot = document.getElementById("clawGame");
    const glass = document.getElementById("clawGameGlass");
    const carriage = document.getElementById("clawGameCarriage");
    const cable = document.getElementById("clawGameCable");
    const assembly = document.getElementById("clawGameAssembly");
    const claw = document.getElementById("clawGameClaw");
    const ballsArea = document.getElementById("clawGameBallsArea");
    const status = document.getElementById("clawGameStatus");
    const joystick = document.getElementById("clawGameJoystick");
    const btnLeft = document.getElementById("clawGameBtnLeft");
    const btnRight = document.getElementById("clawGameBtnRight");
    const btnGrab = document.getElementById("clawGameBtnGrab");
    const modal = document.getElementById("clawGameModal");
    const modalLabel = document.getElementById("clawGameModalLabel");
    const modalSender = document.getElementById("clawGameMessageSender");
    const modalText = document.getElementById("clawGameMessageText");
    const btnTryAgain = document.getElementById("clawGameTryAgain");
    const btnCloseModal = document.getElementById("clawGameCloseModal");
    const messageList = document.getElementById("clawGameMessageList");
    const emptyState = document.getElementById("clawGameEmptyState");
    const counter = document.getElementById("clawGameCounter");

    if (!gameRoot || !glass || !carriage || !cable || !assembly || !claw || !ballsArea) return;
    const messageCapsules = [
      { type: "message", from: "Ana", text: "Que este novo ciclo seja leve, bonito e cheio de motivos sinceros para sorrir." },
      { type: "message", from: "Beatriz", text: "Que nunca faltem coragem para os seus sonhos e calma para aproveitar cada etapa do caminho." },
      { type: "message", from: "Camila", text: "Desejo risadas sinceras, bons encontros e lembranças que você tenha vontade de guardar por muito tempo." },
      { type: "message", from: "Daniel", text: "Eu amo dividir a vida com você. Quero continuar celebrando suas conquistas e construindo novos capítulos ao seu lado." },
      { type: "message", from: "Helena", text: "Que seus planos ganhem forma no tempo certo e que você reconheça a própria força em cada conquista." },
      { type: "message", from: "Laura", text: "Continue encontrando beleza nas pequenas coisas e protegendo tudo aquilo que faz você feliz." },
      { type: "message", from: "Marina", text: "Você merece carinho, respeito, paz e pessoas que façam questão de estar por perto também nos dias simples." },
      { type: "message", from: "Nina", text: "Desejo um ciclo com mais leveza, mais tempo para você e muitos momentos em que se sinta orgulhosa de si." },
      { type: "message", from: "Rafaela", text: "Espero que você se orgulhe cada vez mais da pessoa que está se tornando e dos caminhos que está escolhendo." },
      { type: "message", from: "Vitória", text: "Que você tenha muitos motivos para sorrir hoje e muitos outros para lembrar com carinho quando o ano terminar." }
    ];

    const revealQueue = [...messageCapsules];
    for (let index = revealQueue.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [revealQueue[index], revealQueue[randomIndex]] = [revealQueue[randomIndex], revealQueue[index]];
    }

    const totalCapsuleCount = messageCapsules.length;
    const machineSounds = {
      move: new Audio("assets/audio/sfx/move.wav"),
      drop: new Audio("assets/audio/sfx/drop.wav"),
      grab: new Audio("assets/audio/sfx/grab.wav"),
      reveal: new Audio("assets/audio/sfx/reveal.wav")
    };

    Object.values(machineSounds).forEach((sound) => {
      sound.preload = "auto";
      sound.volume = 0.08;
    });

    function playMachineSound(name, volume = 0.08) {
      const source = machineSounds[name];
      if (!source) return;
      const sound = source.cloneNode();
      sound.volume = volume;
      sound.play().catch(() => {});
    }

    function renderCapsuleContent(container, capsule) {
      container.replaceChildren();
      container.textContent = capsule.text;
    }

    const capsuleColors = ["#d989a7", "#b65f79", "#f0b8c8", "#9f667c", "#e3a2b5"];
    const ballRadius = 29;
    function getIdleCableLength() {
      return window.innerWidth <= 560 ? 42 : 62;
    }
    let idleCableLength = getIdleCableLength();
    const gravity = 1120;
    const horizontalSpeed = 235;
    const verticalSpeed = 345;
    const ballRestitution = 0.34;
    const wallRestitution = 0.25;
    const floorFriction = 5.4;
    const rollingGrip = 8.5;
    const rollingResistance = 1.25;
    const angularDamping = 0.32;
    const armCollisionRadius = 6.2;
    const physicsSubsteps = 5;

    let balls = [];
    let state = "IDLE";
    let carriageX = 0;
    let cableLength = idleCableLength;
    let heldBall = null;
    let pendingBall = null;
    let movingLeft = false;
    let movingRight = false;
    let lastFrame = performance.now();
    let revealedMessages = 0;
    let firstCapsuleCollected = false;
    let closingTimer = null;
    let resultTimer = null;
    let clawClosure = 0;
    let clawTargetClosure = 0;
    let gameInViewport = false;
    let animationFrameId = 0;

    function getGlassSize() {
      return {
        width: glass.clientWidth,
        height: glass.clientHeight,
        floor: glass.clientHeight - 14
      };
    }

    function setClawOpen() {
      clawTargetClosure = 0;
      claw.classList.remove("is-closed");
    }

    function setClawClosed() {
      clawTargetClosure = 1;
      claw.classList.add("is-closed");
    }

    function updateControls() {
      const locked = state !== "IDLE";
      btnLeft.disabled = locked;
      btnRight.disabled = locked;
      btnGrab.disabled = locked;
    }

    function setStatus(message) {
      status.textContent = message;
    }

    function renderCarriage() {
      carriage.style.left = `${carriageX}px`;
      cable.style.height = `${cableLength}px`;
    }

    function renderBalls() {
      balls.forEach((ball) => {
        if (!ball.active) {
          ball.element.style.display = "none";
          ball.element.classList.remove("is-held");
          return;
        }

        ball.element.style.display = "block";
        const rotationDegrees = ball.angle * 180 / Math.PI;
        ball.element.style.transform = `translate3d(${ball.x - ballRadius}px, ${ball.y - ballRadius}px, 0) rotate(${rotationDegrees}deg)`;
        ball.element.classList.toggle("is-held", ball.held);
      });
    }

    function createBalls() {
      ballsArea.innerHTML = "";
      balls = [];
      const { width, floor } = getGlassSize();
      const diameter = ballRadius * 2;
      const sidePadding = 8;
      const preferredGap = 5;
      const maximumColumns = Math.max(
        3,
        Math.floor((width - sidePadding * 2 + preferredGap) / (diameter + preferredGap))
      );
      const verticalGap = diameter * 0.87;
      const availableWidth = width - (ballRadius + sidePadding) * 2;
      const horizontalGap = maximumColumns > 1
        ? Math.min(diameter + preferredGap, availableWidth / (maximumColumns - 1))
        : 0;
      const baseStartX = width / 2 - horizontalGap * (maximumColumns - 1) / 2;
      const positions = [];
      let remaining = totalCapsuleCount;
      let row = 0;

      while (remaining > 0) {
        const rowCapacity = Math.max(2, maximumColumns - (row % 2));
        const rowCount = Math.min(rowCapacity, remaining);
        const slotOffset = Math.floor((rowCapacity - rowCount) / 2);
        const startX = baseStartX + (row % 2 ? horizontalGap / 2 : 0);
        const y = Math.max(
          78 + ballRadius,
          floor - ballRadius - 18 - row * verticalGap
        );

        for (let column = 0; column < rowCount; column += 1) {
          positions.push({
            x: clamp(
              startX + (slotOffset + column) * horizontalGap,
              ballRadius + sidePadding,
              width - ballRadius - sidePadding
            ),
            y
          });
        }

        remaining -= rowCount;
        row += 1;
      }

      positions.forEach((position, index) => {
        const element = document.createElement("div");
        element.className = "claw-game-ball";
        element.style.setProperty("--capsule-color", capsuleColors[index % capsuleColors.length]);
        ballsArea.appendChild(element);

        balls.push({
          element,
          x: position.x,
          y: position.y,
          vx: (index % 2 === 0 ? -1 : 1) * (4 + Math.random() * 5),
          vy: Math.random() * 5,
          angle: (Math.random() - 0.5) * 0.18,
          angularVelocity: (Math.random() - 0.5) * 0.45,
          active: true,
          held: false,
          captured: false
        });
      });

      carriageX = width / 2;
      renderCarriage();
      renderBalls();
    }

    function clamp(value, minimum, maximum) {
      return Math.max(minimum, Math.min(maximum, value));
    }

    function resolveBallCollision(first, second) {
      if (
        !first.active ||
        !second.active ||
        first.held ||
        second.held ||
        first.captured ||
        second.captured
      ) return;

      let deltaX = second.x - first.x;
      let deltaY = second.y - first.y;
      let distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const minimumDistance = ballRadius * 2;

      if (distanceSquared >= minimumDistance * minimumDistance) return;

      if (distanceSquared < 0.0001) {
        deltaX = 0.01;
        deltaY = 0;
        distanceSquared = deltaX * deltaX;
      }

      const distance = Math.sqrt(distanceSquared);
      const normalX = deltaX / distance;
      const normalY = deltaY / distance;
      const overlap = minimumDistance - distance;
      const correction = Math.max(overlap - 0.02, 0) * 0.52;
      first.x -= normalX * correction;
      first.y -= normalY * correction;
      second.x += normalX * correction;
      second.y += normalY * correction;

      const relativeVelocityX = second.vx - first.vx;
      const relativeVelocityY = second.vy - first.vy;
      const velocityAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY;

      if (velocityAlongNormal >= 0) return;
      const normalImpulse = -((1 + ballRestitution) * velocityAlongNormal) / 2;
      first.vx -= normalImpulse * normalX;
      first.vy -= normalImpulse * normalY;
      second.vx += normalImpulse * normalX;
      second.vy += normalImpulse * normalY;
      const tangentXRaw = relativeVelocityX - velocityAlongNormal * normalX;
      const tangentYRaw = relativeVelocityY - velocityAlongNormal * normalY;
      const tangentLength = Math.hypot(tangentXRaw, tangentYRaw);

      if (tangentLength > 0.0001) {
        const tangentX = tangentXRaw / tangentLength;
        const tangentY = tangentYRaw / tangentLength;
        const tangentialVelocity = relativeVelocityX * tangentX + relativeVelocityY * tangentY;
        const maximumFrictionImpulse = normalImpulse * 0.22;
        const frictionImpulse = clamp(-tangentialVelocity / 2, -maximumFrictionImpulse, maximumFrictionImpulse);

        first.vx -= frictionImpulse * tangentX;
        first.vy -= frictionImpulse * tangentY;
        second.vx += frictionImpulse * tangentX;
        second.vy += frictionImpulse * tangentY;
        const inverseMoment = 2 / (ballRadius * ballRadius);
        first.angularVelocity -= frictionImpulse * ballRadius * inverseMoment;
        second.angularVelocity -= frictionImpulse * ballRadius * inverseMoment;
      }

      first.angularVelocity *= 0.997;
      second.angularVelocity *= 0.997;
    }

    function rotateSvgPoint(point, pivot, angleDegrees) {
      const angle = angleDegrees * Math.PI / 180;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const deltaX = point.x - pivot.x;
      const deltaY = point.y - pivot.y;

      return {
        x: pivot.x + deltaX * cosine - deltaY * sine,
        y: pivot.y + deltaX * sine + deltaY * cosine
      };
    }

    function cubicBezierPoint(startPoint, controlOne, controlTwo, endPoint, amount) {
      const inverse = 1 - amount;
      const inverseSquared = inverse * inverse;
      const amountSquared = amount * amount;

      return {
        x:
          inverseSquared * inverse * startPoint.x +
          3 * inverseSquared * amount * controlOne.x +
          3 * inverse * amountSquared * controlTwo.x +
          amountSquared * amount * endPoint.x,
        y:
          inverseSquared * inverse * startPoint.y +
          3 * inverseSquared * amount * controlOne.y +
          3 * inverse * amountSquared * controlTwo.y +
          amountSquared * amount * endPoint.y
      };
    }

    function sampleArmPath(side) {
      const isLeft = side === "left";
      const startPoint = isLeft ? { x: 46, y: 22 } : { x: 94, y: 22 };
      const firstControlOne = isLeft ? { x: 25, y: 40 } : { x: 115, y: 40 };
      const firstControlTwo = isLeft ? { x: 18, y: 73 } : { x: 122, y: 73 };
      const firstEnd = isLeft ? { x: 24, y: 100 } : { x: 116, y: 100 };
      const secondControlOne = isLeft ? { x: 27, y: 117 } : { x: 113, y: 117 };
      const secondControlTwo = isLeft ? { x: 34, y: 128 } : { x: 106, y: 128 };
      const secondEnd = isLeft ? { x: 43, y: 137 } : { x: 97, y: 137 };
      const tipEnd = isLeft ? { x: 57, y: 140 } : { x: 83, y: 140 };
      const points = [];

      for (let index = 0; index <= 7; index += 1) {
        points.push(cubicBezierPoint(startPoint, firstControlOne, firstControlTwo, firstEnd, index / 7));
      }

      for (let index = 1; index <= 6; index += 1) {
        points.push(cubicBezierPoint(firstEnd, secondControlOne, secondControlTwo, secondEnd, index / 6));
      }

      points.push(tipEnd);
      return points;
    }

    function getClawGeometry() {
      const assemblyWidth = assembly.clientWidth || 122;
      const assemblyHeight = assembly.clientHeight || 131;
      const scaleX = assemblyWidth / 140;
      const scaleY = assemblyHeight / 150;
      const assemblyLeft = carriageX - assemblyWidth / 2;
      const assemblyTop = 8 + 36 + cableLength;
      const leftAngle = 14 + (-13 - 14) * clawClosure;
      const rightAngle = -14 + (13 - (-14)) * clawClosure;
      const leftPivot = { x: 46, y: 22 };
      const rightPivot = { x: 94, y: 22 };

      function convert(point, pivot, angle) {
        const rotated = rotateSvgPoint(point, pivot, angle);
        return {
          x: assemblyLeft + rotated.x * scaleX,
          y: assemblyTop + rotated.y * scaleY
        };
      }

      const leftPoints = sampleArmPath("left").map((point) => convert(point, leftPivot, leftAngle));
      const rightPoints = sampleArmPath("right").map((point) => convert(point, rightPivot, rightAngle));
      const leftTip = leftPoints[leftPoints.length - 1];
      const rightTip = rightPoints[rightPoints.length - 1];

      return {
        hub: {
          left: assemblyLeft + 37 * scaleX,
          right: assemblyLeft + 103 * scaleX,
          top: assemblyTop,
          bottom: assemblyTop + 30 * scaleY
        },
        leftPoints,
        rightPoints,
        leftTip,
        rightTip,
        centerX: (leftTip.x + rightTip.x) / 2,
        tipY: (leftTip.y + rightTip.y) / 2
      };
    }

    function closestPointOnSegment(pointX, pointY, startPoint, endPoint) {
      const segmentX = endPoint.x - startPoint.x;
      const segmentY = endPoint.y - startPoint.y;
      const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
      const amount = segmentLengthSquared > 0
        ? clamp(((pointX - startPoint.x) * segmentX + (pointY - startPoint.y) * segmentY) / segmentLengthSquared, 0, 1)
        : 0;

      return {
        x: startPoint.x + segmentX * amount,
        y: startPoint.y + segmentY * amount
      };
    }

    function applyStaticCollisionResponse(ball, normalX, normalY, overlap, surfaceVelocity) {
      ball.x += normalX * overlap;
      ball.y += normalY * overlap;

      const relativeVelocityX = ball.vx - surfaceVelocity.x;
      const relativeVelocityY = ball.vy - surfaceVelocity.y;
      const velocityAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY;

      if (velocityAlongNormal < 0) {
        const impulse = -(1 + 0.2) * velocityAlongNormal;
        ball.vx += impulse * normalX;
        ball.vy += impulse * normalY;
      }
      const tangentX = -normalY;
      const tangentY = normalX;
      const contactTangentialSpeed =
        relativeVelocityX * tangentX +
        relativeVelocityY * tangentY -
        ball.angularVelocity * ballRadius;
      const tangentialImpulse = clamp(-contactTangentialSpeed * 0.24, -68, 68);

      ball.vx += tangentialImpulse * tangentX;
      ball.vy += tangentialImpulse * tangentY;
      ball.angularVelocity -= tangentialImpulse * 2 / ballRadius;
      ball.vx += surfaceVelocity.x * 0.075;
      ball.vy += surfaceVelocity.y * 0.045;
    }

    function resolveBallAgainstHub(ball, hub, clawVelocity) {
      const closestX = clamp(ball.x, hub.left, hub.right);
      const closestY = clamp(ball.y, hub.top, hub.bottom);
      let deltaX = ball.x - closestX;
      let deltaY = ball.y - closestY;
      let distance = Math.hypot(deltaX, deltaY);

      if (distance >= ballRadius + 1.5) return;

      if (distance < 0.0001) {
        const distances = [
          { value: Math.abs(ball.x - hub.left), x: -1, y: 0 },
          { value: Math.abs(hub.right - ball.x), x: 1, y: 0 },
          { value: Math.abs(ball.y - hub.top), x: 0, y: -1 },
          { value: Math.abs(hub.bottom - ball.y), x: 0, y: 1 }
        ].sort((first, second) => first.value - second.value);
        deltaX = distances[0].x;
        deltaY = distances[0].y;
        distance = 1;
      }

      const normalX = deltaX / distance;
      const normalY = deltaY / distance;
      applyStaticCollisionResponse(ball, normalX, normalY, ballRadius + 1.5 - distance, clawVelocity);
    }

    function resolveBallAgainstArm(ball, points, clawVelocity) {
      let closestCollision = null;

      for (let index = 0; index < points.length - 1; index += 1) {
        const closest = closestPointOnSegment(ball.x, ball.y, points[index], points[index + 1]);
        const deltaX = ball.x - closest.x;
        const deltaY = ball.y - closest.y;
        const distance = Math.hypot(deltaX, deltaY);

        if (!closestCollision || distance < closestCollision.distance) {
          closestCollision = { deltaX, deltaY, distance, start: points[index], end: points[index + 1] };
        }
      }

      if (!closestCollision || closestCollision.distance >= ballRadius + armCollisionRadius) return;

      let { deltaX, deltaY, distance } = closestCollision;

      if (distance < 0.0001) {
        const segmentX = closestCollision.end.x - closestCollision.start.x;
        const segmentY = closestCollision.end.y - closestCollision.start.y;
        deltaX = -segmentY;
        deltaY = segmentX;
        distance = Math.hypot(deltaX, deltaY) || 1;
      }

      const normalX = deltaX / distance;
      const normalY = deltaY / distance;
      applyStaticCollisionResponse(
        ball,
        normalX,
        normalY,
        ballRadius + armCollisionRadius - distance,
        clawVelocity
      );
    }

    function resolveBallAgainstClaw(ball, clawGeometry, clawVelocity) {
      if (!ball.active || ball.held || ball.captured) return;
      resolveBallAgainstHub(ball, clawGeometry.hub, clawVelocity);
      resolveBallAgainstArm(ball, clawGeometry.leftPoints, clawVelocity);
      resolveBallAgainstArm(ball, clawGeometry.rightPoints, clawVelocity);
    }

    function keepBallInsideMachine(ball, width, floor, deltaTime = 0.016) {
      if (ball.x - ballRadius < 5) {
        ball.x = ballRadius + 5;
        if (ball.vx < 0) ball.vx = -ball.vx * wallRestitution;
        ball.angularVelocity *= 0.82;
      }

      if (ball.x + ballRadius > width - 5) {
        ball.x = width - ballRadius - 5;
        if (ball.vx > 0) ball.vx = -ball.vx * wallRestitution;
        ball.angularVelocity *= 0.82;
      }

      if (ball.y - ballRadius < 5) {
        ball.y = ballRadius + 5;
        if (ball.vy < 0) ball.vy = -ball.vy * wallRestitution;
      }

      if (ball.y + ballRadius > floor) {
        ball.y = floor - ballRadius;

        if (ball.vy > 0) {
          ball.vy = -ball.vy * 0.2;
        }
        const rollingSurfaceSpeed = ball.angularVelocity * ballRadius;
        const slipSpeed = ball.vx - rollingSurfaceSpeed;
        const gripAmount = clamp(slipSpeed * rollingGrip * deltaTime, -38, 38);
        ball.vx -= gripAmount * 0.42;
        ball.angularVelocity += gripAmount * 0.58 / ballRadius;

        const linearDamping = Math.exp(-floorFriction * deltaTime * 0.18);
        const rotationalDamping = Math.exp(-rollingResistance * deltaTime);
        ball.vx *= linearDamping;
        ball.angularVelocity *= rotationalDamping;

        if (Math.abs(ball.vy) < 10) ball.vy = 0;
        if (Math.abs(ball.vx) < 0.8) ball.vx = 0;
        if (Math.abs(ball.angularVelocity) < 0.025) ball.angularVelocity = 0;
      } else {
        ball.angularVelocity *= Math.exp(-angularDamping * deltaTime);
      }
    }

    function updateBallsPhysics(deltaTime, clawVelocity) {
      const { width, floor } = getGlassSize();
      const substepTime = deltaTime / physicsSubsteps;

      for (let substep = 0; substep < physicsSubsteps; substep += 1) {
        balls.forEach((ball) => {
          if (!ball.active || ball.held || ball.captured) return;

          ball.vy += gravity * substepTime;
          ball.x += ball.vx * substepTime;
          ball.y += ball.vy * substepTime;
          ball.angle += ball.angularVelocity * substepTime;
          keepBallInsideMachine(ball, width, floor, substepTime);
        });

        const clawGeometry = getClawGeometry();

        for (let iteration = 0; iteration < 4; iteration += 1) {
          for (let firstIndex = 0; firstIndex < balls.length; firstIndex += 1) {
            for (let secondIndex = firstIndex + 1; secondIndex < balls.length; secondIndex += 1) {
              resolveBallCollision(balls[firstIndex], balls[secondIndex]);
            }
          }

          balls.forEach((ball) => {
            resolveBallAgainstClaw(ball, clawGeometry, clawVelocity);
            if (ball.active && !ball.held && !ball.captured) {
              keepBallInsideMachine(ball, width, floor, substepTime);
            }
          });
        }
      }
    }

    function getGripPosition() {
      const geometry = getClawGeometry();
      return {
        x: geometry.centerX,
        y: geometry.tipY - ballRadius * 0.32
      };
    }

    function findContactBall() {
      const geometry = getClawGeometry();
      const openingLeft = Math.min(geometry.leftTip.x, geometry.rightTip.x);
      const openingRight = Math.max(geometry.leftTip.x, geometry.rightTip.x);
      const openingWidth = openingRight - openingLeft;
      const centerX = (openingLeft + openingRight) / 2;
      let bestBall = null;
      let bestScore = Number.POSITIVE_INFINITY;

      balls.forEach((ball) => {
        if (!ball.active || ball.held || ball.captured) return;

        const horizontalDistance = Math.abs(ball.x - centerX);
        const verticalDistance = Math.abs(ball.y - (geometry.tipY - 2));
        const horizontalTolerance = Math.max(14, Math.min(ballRadius * 0.78, openingWidth / 2 - ballRadius * 0.45));
        const verticallyReachable = verticalDistance <= ballRadius * 0.92;
        const centeredInOpening = horizontalDistance <= horizontalTolerance;

        if (centeredInOpening && verticallyReachable) {
          const score = horizontalDistance * 1.65 + verticalDistance;
          if (score < bestScore) {
            bestBall = ball;
            bestScore = score;
          }
        }
      });

      return bestBall;
    }

    function beginClosing(ball) {
      if (state !== "DROPPING") return;

      pendingBall = ball;
      if (pendingBall) {
        pendingBall.captured = true;
        pendingBall.vx = 0;
        pendingBall.vy = 0;
        pendingBall.angularVelocity = 0;
      }
      state = "CLOSING";
      setClawClosed();
      playMachineSound("grab", 0.07);
      setStatus(ball ? "A garra encontrou uma cápsula..." : "A garra chegou ao fundo sem encontrar uma cápsula.");

      closingTimer = window.setTimeout(() => {
        if (pendingBall && pendingBall.active) {
          heldBall = pendingBall;
          heldBall.captured = false;
          heldBall.held = true;
          heldBall.vx = 0;
          heldBall.vy = 0;
          heldBall.angularVelocity = 0;
        }

        pendingBall = null;
        state = "RISING";
        setStatus(heldBall ? "Cápsula capturada! Subindo..." : "Subindo para tentar novamente...");
      }, 300);
    }

    function triggerDrop() {
      if (state !== "IDLE") return;

      setClawOpen();
      state = "DROPPING";
      playMachineSound("drop", 0.065);
      movingLeft = false;
      movingRight = false;
      joystick.classList.remove("is-left", "is-right");
      setStatus("A garra está descendo aberta...");
      updateControls();
    }

    function showResult() {
      state = "SHOWING";
      modal.classList.remove("is-prize");

      if (heldBall) {
        const selectedCapsule = revealQueue.shift();
        heldBall.active = false;
        heldBall.held = false;
        heldBall.captured = false;
        heldBall.element.style.display = "none";

        modalLabel.textContent = "Mensagem desbloqueada";
        modalSender.textContent = `Mensagem de ${selectedCapsule.from}`;
        renderCapsuleContent(modalText, selectedCapsule);
        addMessageToList(selectedCapsule);
        setStatus(`Você encontrou uma mensagem de ${selectedCapsule.from}.`);
        playMachineSound("reveal", 0.07);

        if (!firstCapsuleCollected) {
          firstCapsuleCollected = true;
          memoryTracker?.mark("machine");
        }
      } else {
        modalLabel.textContent = "Nada capturado";
        modalSender.textContent = "A garra não pegou nenhuma cápsula.";
        modalText.textContent = "Reposicione a garra e tente novamente.";
        setStatus("Nada foi capturado. Reposicione a garra e tente novamente.");
      }

      modal.classList.add("is-active");
      modal.setAttribute("aria-hidden", "false");
      heldBall = null;
      setClawOpen();
    }

    function resetRound() {
      if (closingTimer) window.clearTimeout(closingTimer);
      if (resultTimer) window.clearTimeout(resultTimer);
      modal.classList.remove("is-active", "is-prize");
      modal.setAttribute("aria-hidden", "true");
      if (pendingBall && pendingBall.active) pendingBall.captured = false;
      if (heldBall && heldBall.active) {
        heldBall.held = false;
        heldBall.captured = false;
      }
      heldBall = null;
      pendingBall = null;
      cableLength = idleCableLength;
      state = "IDLE";
      clawClosure = 0;
      clawTargetClosure = 0;
      setClawOpen();
      setStatus("Posicione a garra sobre uma cápsula e aperte PEGAR ou a tecla Espaço.");
      updateControls();
      renderCarriage();
    }

    function addMessageToList(capsule) {
      const existingEmptyState = document.getElementById("clawGameEmptyState");
      if (existingEmptyState) existingEmptyState.remove();

      const item = document.createElement("li");
      item.className = "claw-game-message-item";

      const sender = document.createElement("strong");
      sender.textContent = capsule.from;

      const content = document.createElement("div");
      content.className = "claw-game-message-body";
      renderCapsuleContent(content, capsule);

      item.append(sender, content);
      messageList.appendChild(item);
      messageList.scrollTop = messageList.scrollHeight;

      revealedMessages += 1;
      counter.textContent = `${revealedMessages} ${revealedMessages === 1 ? "descoberta encontrada" : "descobertas encontradas"}`;
    }

    function updateGame(deltaTime) {
      const { width, floor } = getGlassSize();
      const minimumX = 70;
      const maximumX = width - 70;
      const previousCarriageX = carriageX;
      const previousCableLength = cableLength;

      const closureStep = deltaTime / 0.28;
      if (clawClosure < clawTargetClosure) {
        clawClosure = Math.min(clawTargetClosure, clawClosure + closureStep);
      } else if (clawClosure > clawTargetClosure) {
        clawClosure = Math.max(clawTargetClosure, clawClosure - closureStep);
      }

      if (state === "IDLE") {
        const direction = Number(movingRight) - Number(movingLeft);
        carriageX += direction * horizontalSpeed * deltaTime;
        carriageX = Math.max(minimumX, Math.min(maximumX, carriageX));
      } else if (state === "DROPPING") {
        cableLength += verticalSpeed * deltaTime;

        const contactBall = findContactBall();
        if (contactBall) {
          beginClosing(contactBall);
        } else {
          const maximumCableLength = Math.max(idleCableLength, floor - 8 - 36 - 112 - 8);
          if (cableLength >= maximumCableLength) {
            cableLength = maximumCableLength;
            beginClosing(null);
          }
        }
      } else if (state === "RISING") {
        cableLength -= verticalSpeed * deltaTime;

        if (heldBall) {
          const grip = getGripPosition();
          heldBall.x = grip.x;
          heldBall.y = grip.y;
          heldBall.vx = 0;
          heldBall.vy = 0;
          heldBall.angularVelocity = 0;
        }

        if (cableLength <= idleCableLength) {
          cableLength = idleCableLength;
          state = "WAITING_RESULT";
          resultTimer = window.setTimeout(showResult, 180);
        }
      }

      const safeDeltaTime = Math.max(deltaTime, 0.001);
      const clawVelocity = {
        x: (carriageX - previousCarriageX) / safeDeltaTime,
        y: (cableLength - previousCableLength) / safeDeltaTime
      };

      updateBallsPhysics(deltaTime, clawVelocity);

      if (pendingBall && pendingBall.active && state === "CLOSING") {
        const grip = getGripPosition();
        const attraction = Math.min(1, deltaTime * 11);
        pendingBall.x += (grip.x - pendingBall.x) * attraction;
        pendingBall.y += (grip.y - pendingBall.y) * attraction;
        pendingBall.vx = 0;
        pendingBall.vy = 0;
        pendingBall.angularVelocity = 0;
      }

      if (heldBall && heldBall.active && state === "RISING") {
        const grip = getGripPosition();
        heldBall.x = grip.x;
        heldBall.y = grip.y;
      }

      renderCarriage();
      renderBalls();
    }

    function animationLoop(currentTime) {
      animationFrameId = 0;
      if (!gameInViewport || document.hidden) return;

      const deltaTime = Math.min((currentTime - lastFrame) / 1000, 0.03);
      lastFrame = currentTime;
      updateGame(deltaTime);
      animationFrameId = window.requestAnimationFrame(animationLoop);
    }

    function startGameLoop() {
      if (animationFrameId || !gameInViewport || document.hidden) return;
      lastFrame = performance.now();
      animationFrameId = window.requestAnimationFrame(animationLoop);
    }

    function startMoving(direction, event) {
      if (event) event.preventDefault();
      if (state !== "IDLE") return;

      const wasMoving = movingLeft || movingRight;
      movingLeft = direction === "left";
      movingRight = direction === "right";
      if (!wasMoving) playMachineSound("move", 0.055);
      joystick.classList.toggle("is-left", movingLeft);
      joystick.classList.toggle("is-right", movingRight);
    }

    function stopMoving(event) {
      if (event && event.cancelable) event.preventDefault();
      movingLeft = false;
      movingRight = false;
      joystick.classList.remove("is-left", "is-right");
    }

    function gameIsVisible() {
      const rectangle = gameRoot.getBoundingClientRect();
      return rectangle.top < window.innerHeight * 0.85 && rectangle.bottom > window.innerHeight * 0.15;
    }

    btnLeft.addEventListener("pointerdown", (event) => startMoving("left", event));
    btnRight.addEventListener("pointerdown", (event) => startMoving("right", event));
    window.addEventListener("pointerup", stopMoving);
    window.addEventListener("pointercancel", stopMoving);
    btnLeft.addEventListener("pointerleave", stopMoving);
    btnRight.addEventListener("pointerleave", stopMoving);
    btnGrab.addEventListener("click", triggerDrop);
    btnTryAgain.addEventListener("click", resetRound);
    btnCloseModal.addEventListener("click", resetRound);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) resetRound();
    });

    window.addEventListener("keydown", (event) => {
      if (!gameIsVisible()) return;

      if (event.key === "ArrowLeft" && state === "IDLE") {
        event.preventDefault();
        startMoving("left");
      }

      if (event.key === "ArrowRight" && state === "IDLE") {
        event.preventDefault();
        startMoving("right");
      }

      if (event.code === "Space" && state === "IDLE") {
        event.preventDefault();
        triggerDrop();
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        stopMoving();
      }
    });

    window.addEventListener("resize", () => {
      const { width } = getGlassSize();
      const nextIdleCableLength = getIdleCableLength();
      if (state === "IDLE") {
        idleCableLength = nextIdleCableLength;
        cableLength = idleCableLength;
      }
      carriageX = Math.max(70, Math.min(width - 70, carriageX));
      renderCarriage();
    });

    const gameVisibilityObserver = new IntersectionObserver(
      ([entry]) => {
        gameInViewport = entry.isIntersecting;
        if (gameInViewport) startGameLoop();
      },
      { rootMargin: "180px 0px", threshold: 0 }
    );

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      } else {
        startGameLoop();
      }
    });

    createBalls();
    setClawOpen();
    updateControls();
    gameVisibilityObserver.observe(gameRoot);
  }

  /* ---------- exactly 20 reasons ---------- */
  const reasons = [
    'Porque seu sorriso muda o clima do meu dia.',
    'Porque você transforma momentos simples em lembranças importantes.',
    'Porque eu admiro a pessoa que você é.',
    'Porque conversar com você sempre parece mais fácil.',
    'Porque você me incentiva a querer crescer.',
    'Porque seu abraço é um dos meus lugares favoritos.',
    'Porque sua risada melhora qualquer ambiente.',
    'Porque você percebe detalhes que muita gente deixaria passar.',
    'Porque eu gosto de dividir planos, ideias e bobagens com você.',
    'Porque você é minha companhia favorita para qualquer programa.',
    'Porque até os dias sem planos ficam melhores ao seu lado.',
    'Porque você me conhece de um jeito que poucas pessoas conhecem.',
    'Porque admiro sua coragem para continuar tentando.',
    'Porque você tem um jeito único de cuidar de quem ama.',
    'Porque eu adoro descobrir coisas novas sobre você.',
    'Porque você faz parte de algumas das minhas memórias favoritas.',
    'Porque eu gosto de imaginar os próximos capítulos ao seu lado.',
    'Porque seus sonhos também se tornaram importantes para mim.',
    'Porque ainda temos muitos lugares, risadas e histórias para viver.',
    'Porque eu amo exatamente quem você é.'
  ];

  function initReasons() {
    const grid = $('#starsGrid');
    const panel = $('#reasonPanel');
    const number = $('#reasonNumber');
    const text = $('#reasonText');
    if (!grid) return;
    reasons.forEach((reason,index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'star-button';
      button.dataset.memory = `reason-${index + 1}`;
      button.dataset.memoryMode = 'interaction';
      button.setAttribute('aria-label', `Revelar motivo ${index + 1}`);
      button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.68 6.27.91-4.53 4.42 1.07 6.24L12 17.1l-5.61 2.95 1.07-6.24-4.53-4.42 6.27-.91L12 2.8Z"></path></svg>';
      if (state.reasons.includes(index)) button.classList.add('is-open');
      button.addEventListener('click', () => {
        button.classList.add('is-open');
        number.textContent = String(index + 1).padStart(2,'0');
        text.textContent = reason;
        panel.classList.remove('is-changing');
        void panel.offsetWidth;
        panel.classList.add('is-changing');
        if (!state.reasons.includes(index)) {
          state.reasons.push(index);
          saveState();
        }
        memoryTracker?.mark(button.dataset.memory);
      });
      grid.appendChild(button);
    });
  }

  /* ---------- full photo viewer ---------- */
  function initPhotoViewer() {
    const viewer = $('#photoViewer');
    const viewerImg = $('#photoViewerImage');
    const viewerCaption = $('#photoViewerCaption');
    const close = $('#photoViewerClose');
    if (!viewer) return;

    function open(button) {
      const img = $('img', button);
      const figure = button.closest('figure');
      const caption = $('figcaption', figure)?.textContent.trim() || '';
      viewerImg.src = img.currentSrc || img.src;
      viewerImg.alt = img.alt;
      viewerCaption.textContent = caption;
      viewer.classList.add('is-open');
      viewer.setAttribute('aria-hidden','false');
      document.body.classList.add('modal-open');
      close.focus({ preventScroll:true });
    }
    function shut() {
      viewer.classList.remove('is-open');
      viewer.setAttribute('aria-hidden','true');
      document.body.classList.remove('modal-open');
    }
    $$('.photo-button').forEach((button) => button.addEventListener('click', () => open(button)));
    close.addEventListener('click', shut);
    viewer.addEventListener('click', (event) => { if (event.target === viewer) shut(); });
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && viewer.classList.contains('is-open')) shut(); });
  }

  /* ---------- final ---------- */
  function initFinalModal() {
    const button = $('#finalButton');
    const modal = $('#finalModal');
    if (!button || !modal) return;
    function open() {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden','false');
      document.body.classList.add('modal-open');
      state.finalOpened = true;
      saveState();
      sparkBurst(button, 16);
    }
    function close() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden','true');
      document.body.classList.remove('modal-open');
    }
    button.addEventListener('click', open);
    $$('[data-close-final]', modal).forEach((node) => node.addEventListener('click', close));
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal.classList.contains('is-open')) close(); });
  }

  /* ---------- ambient original soundtrack ---------- */
  function initAmbientPlayer() {
    const toggle = $('#ambientToggle');
    const panel = $('#ambientPanel');
    const play = $('#ambientPlay');
    const audio = $('#ambientAudio');
    const volume = $('#ambientVolume');
    if (!toggle || !audio) return;
    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      panel.setAttribute('aria-hidden', String(!open));
    });
    play.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });
    audio.addEventListener('play', () => { setIcon(play,'icon-pause'); play.setAttribute('aria-label','Pausar trilha'); });
    audio.addEventListener('pause', () => { setIcon(play,'icon-play'); play.setAttribute('aria-label','Tocar trilha'); });
    audio.volume = Number(volume.value);
    volume.addEventListener('input', () => { audio.volume = Number(volume.value); });
  }

  /* ---------- navigation and reset ---------- */
  function initGlobalActions() {
    $('#startButton')?.addEventListener('click', () => {
      $('#carta')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      sparkBurst($('#startButton'), 10);
    });
    $('#resetProgress')?.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    });
  }



  /* ---------- experience menu, themes, chapter navigation ---------- */
  const chapterNames = {
    carta: 'Uma carta para começar',
    tempo: 'O tempo que a gente já viveu',
    'livia-pelos-meus-olhos': 'Lívia pelos meus olhos',
    caixinhas: 'Caixinhas-surpresa',
    maquina: 'A máquina de mensagens',
    motivos: '20 motivos para sorrir',
    historias: 'Fotos que contam histórias',
    final: 'Ainda temos muito para viver',
    'carta-secreta': 'A carta secreta de Daniel'
  };

  function syncExperienceProgress(current, total) {
    const count = $('#panelMemoryCount');
    const bar = $('#panelProgressBar');
    if (count) count.textContent = `${current} / ${total}`;
    if (bar) bar.style.width = `${total ? (current / total) * 100 : 0}%`;
  }

  function applyTheme(theme, animate = true) {
    const next = theme === 'dark' ? 'dark' : 'light';
    experienceSettings.theme = next;
    if (animate) {
      document.documentElement.classList.add('theme-transition');
      window.setTimeout(() => document.documentElement.classList.remove('theme-transition'), 620);
    }
    if (next === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    $$('[data-theme-choice]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === next)));
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#171015' : '#7a2948');
    saveExperienceSettings();
  }

  function setReducedMotion(enabled) {
    experienceSettings.reduceMotion = Boolean(enabled);
    prefersReducedMotion = systemReducedMotion || experienceSettings.reduceMotion;
    document.documentElement.classList.toggle('user-reduce-motion', experienceSettings.reduceMotion);
    saveExperienceSettings();
  }

  function initExperiencePanel() {
    const toggle = $('#experienceMenuToggle');
    const panel = $('#experiencePanel');
    const close = $('#experiencePanelClose');
    const backdrop = $('#experiencePanelBackdrop');
    const musicToggle = $('#panelMusicToggle');
    const panelVolume = $('#panelMusicVolume');
    const audio = $('#ambientAudio');
    const mainVolume = $('#ambientVolume');
    const reduce = $('#panelReduceMotion');
    if (!toggle || !panel) return;

    const setOpen = (open) => {
      toggle.classList.toggle('is-open', open);
      panel.classList.toggle('is-open', open);
      backdrop?.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      panel.setAttribute('aria-hidden', String(!open));
      panel.inert = !open;
      document.body.classList.toggle('options-open', open);
      if (open) close?.focus({preventScroll:true});
      else toggle.focus({preventScroll:true});
      backdrop?.setAttribute('aria-hidden', String(!open));
    };
    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll('button, a[href], input')).filter(el => !el.disabled && el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
    });
    toggle.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
    close?.addEventListener('click', () => setOpen(false));
    backdrop?.addEventListener('click', () => setOpen(false));
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false); });

    $$('[data-theme-choice]').forEach((button) => button.addEventListener('click', () => applyTheme(button.dataset.themeChoice, true)));
    applyTheme(experienceSettings.theme, false);

    if (reduce) {
      reduce.checked = experienceSettings.reduceMotion;
      reduce.addEventListener('change', () => setReducedMotion(reduce.checked));
    }
    setReducedMotion(experienceSettings.reduceMotion);

    if (audio && panelVolume && mainVolume) {
      panelVolume.value = String(experienceSettings.musicVolume);
      mainVolume.value = String(experienceSettings.musicVolume);
      audio.volume = experienceSettings.musicVolume;
      const syncVolume = (value) => {
        const normalized = Math.max(0, Math.min(1, Number(value)));
        audio.volume = normalized;
        mainVolume.value = String(normalized);
        panelVolume.value = String(normalized);
        experienceSettings.musicVolume = normalized;
        saveExperienceSettings();
      };
      panelVolume.addEventListener('input', () => syncVolume(panelVolume.value));
      mainVolume.addEventListener('input', () => syncVolume(mainVolume.value));
      if (musicToggle) {
        musicToggle.checked = !audio.paused;
        musicToggle.addEventListener('change', () => {
          if (musicToggle.checked) audio.play().catch(() => { musicToggle.checked = false; });
          else audio.pause();
        });
        audio.addEventListener('play', () => { musicToggle.checked = true; });
        audio.addEventListener('pause', () => { musicToggle.checked = false; });
      }
    }

    $$('[data-chapter-target]', panel).forEach((link) => link.addEventListener('click', () => setOpen(false)));
    $('#panelResetExperience')?.addEventListener('click', () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      experienceSettings.lastSection = 'carta';
      experienceSettings.secretLetterOpened = false;
      saveExperienceSettings();
      window.location.reload();
    });
  }

  function initContinuePrompt() {
    const card = $('#continueCard');
    const button = $('#continueButton');
    const close = $('#continueClose');
    const title = $('#continueTitle');
    const targetId = experienceSettings.lastSection;
    const hasProgress = Array.isArray(state.discovered) && state.discovered.length > 2;
    if (!card || !button || !targetId || targetId === 'carta' || !hasProgress || sessionGet('livia-continue-dismissed')) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    if (title) title.textContent = `Continuar em “${chapterNames[targetId] || 'onde você parou'}”?`;
    card.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-visible')));
    const dismiss = () => {
      card.classList.remove('is-visible');
      sessionSet('livia-continue-dismissed','1');
      window.setTimeout(() => { card.hidden = true; }, 330);
    };
    close?.addEventListener('click', dismiss);
    button.addEventListener('click', () => {
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block:'start' });
      dismiss();
    });
  }

  function initChapterNavigation() {
    const ids = ['carta','tempo','livia-pelos-meus-olhos','caixinhas','maquina','motivos','historias','final','carta-secreta'];
    const targets = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const setActive = (id) => {
      $$('[data-chapter-target]').forEach((link) => link.classList.toggle('is-active', link.dataset.chapterTarget === id));
      if (id !== 'carta-secreta' || !document.getElementById(id)?.hidden) {
        experienceSettings.lastSection = id;
        saveExperienceSettings();
      }
    };
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActive(visible.target.id);
    }, { rootMargin:'-32% 0px -48% 0px', threshold:[0,.08,.25,.5] });
    targets.forEach((section) => observer.observe(section));
    $$('[data-chapter-target]').forEach((link) => link.addEventListener('click', (event) => {
      const target = document.getElementById(link.dataset.chapterTarget);
      if (!target || target.hidden) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block:'start' });
    }));
  }

  function updateSecretUnlock(current, total, animate = false) {
    const section = $('#carta-secreta');
    if (!section || !total) return;
    const unlocked = current >= total;
    section.hidden = !unlocked;
    const hint = $('#secretLetterHint');
    if (hint) hint.hidden = unlocked;
    $$('.secret-nav-link').forEach((link) => { link.hidden = !unlocked; });
    if (!unlocked) return;
    if (experienceSettings.secretLetterOpened) {
      $('#secretLetterPaper')?.classList.add('is-open');
      $('#secretLetterPaper')?.setAttribute('aria-hidden','false');
      const button = $('#secretLetterButton');
      if (button) { button.textContent = 'Fechar a carta'; button.setAttribute('aria-expanded', 'true'); }
    }
    if (animate && !sessionGet('livia-secret-unlock-shown')) {
      const toast = $('#unlockToast');
      if (toast) {
        toast.hidden = false;
        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('is-visible')));
        sessionSet('livia-secret-unlock-shown','1');
      }
    }
  }

  function initSecretLetter() {
    const button = $('#secretLetterButton');
    const paper = $('#secretLetterPaper');
    const toast = $('#unlockToast');
    const go = $('#unlockGo');
    const section = $('#carta-secreta');
    if (!button || !paper || !section) return;
    let pendingOpen = 0;
    const setOpen = (open) => {
      window.clearTimeout(pendingOpen);
      paper.classList.toggle('is-open', open);
      paper.setAttribute('aria-hidden', String(!open));
      button.textContent = open ? 'Fechar a carta' : 'Abrir a carta';
      button.setAttribute('aria-expanded', String(open));
      experienceSettings.secretLetterOpened = open;
      saveExperienceSettings();
    };
    button.addEventListener('click', () => setOpen(!paper.classList.contains('is-open')));
    go?.addEventListener('click', () => {
      toast?.classList.remove('is-visible');
      window.setTimeout(() => { if (toast) toast.hidden = true; }, 350);
      section.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block:'start' });
      window.clearTimeout(pendingOpen);
      pendingOpen = window.setTimeout(() => setOpen(true), prefersReducedMotion ? 0 : 400);
    });
  }

  function initFinalFocus() {
    const final = $('#final');
    if (!final) return;
    const observer = new IntersectionObserver(([entry]) => {
      document.body.classList.toggle('final-focus', entry.isIntersecting && entry.intersectionRatio > .34);
    }, { threshold:[0,.34,.6] });
    observer.observe(final);
  }


  function initFloatingOrbs() {
    const orbs = $$('.floating-orbs .orb');
    if (!orbs.length) return;
    const factors = [0.08, -0.05, 0.11, -0.07, 0.06, -0.09, 0.04, -0.06];
    let ticking = false;
    const update = () => {
      const y = window.scrollY || window.pageYOffset;
      orbs.forEach((orb, index) => {
        const drift = y * (factors[index] || 0.05);
        orb.style.transform = `translate3d(0, ${drift}px, 0)`;
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  function initAmbientDock() {
    const player = $('#ambientPlayer');
    const footer = $('.footer');
    if (!player || !footer) return;
    const update = () => {
      const footerTop = footer.getBoundingClientRect().top;
      const overlap = Math.max(0, window.innerHeight - footerTop - 6);
      player.style.transform = overlap > 0 ? `translateY(-${overlap}px)` : '';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const safeInit = (fn) => {
      try { fn(); } catch (error) { console.error('[UI init]', error); }
    };

    // Core UI first, so galleries, music and navigation remain functional even if a complex section fails.
    safeInit(preloadSite);
    safeInit(initRevealMotion);
    safeInit(initCounter);
    safeInit(initPhotoViewer);
    safeInit(initAmbientPlayer);
    safeInit(initGlobalActions);
    safeInit(initFloatingOrbs);
    safeInit(initAmbientDock);
    safeInit(initSurpriseBoxes);
    safeInit(initReasons);
    safeInit(initExperiencePanel);
    safeInit(initContinuePrompt);
    safeInit(initChapterNavigation);
    safeInit(initSecretLetter);
    safeInit(initFinalFocus);

    memoryTracker = new MemoryTracker();
    safeInit(() => memoryTracker.init());

    safeInit(initMachine);

    state.boxes.forEach((index) => memoryTracker?.mark(`box-${index + 1}`));
    state.reasons.forEach((index) => memoryTracker?.mark(`reason-${index + 1}`));
    safeInit(initFinalModal);
  });
})();
