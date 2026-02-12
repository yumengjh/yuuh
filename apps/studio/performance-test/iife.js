(() => {
  // ======= Minimal Perf HUD for Console (IIFE) =======
  const state = {
    running: true,
    container: null, // if null => whole document
    lastRAF: performance.now(),
    rafCount: 0,
    fps: 0,
    frameMs: 0,
    longTasks: 0,
    longTaskTotalMs: 0,
    longTaskMaxMs: 0,
    scrollFrames: 0,
    scrollFrameTotalMs: 0,
    scrollFrameMaxMs: 0,
    lastScrollAt: 0,
    domCount: 0,
    domDeepCount: 0,
    lastDomSampleAt: 0,
    memMB: null,
    memLimitMB: null,
    memUsedJSHeapMB: null,
    logSamples: false,
    sampleWindowMs: 5000,
    sampleStartAt: null,
    sample: {
      fpsMin: Infinity,
      fpsMax: -Infinity,
      fpsAvgSum: 0,
      fpsN: 0,
      longTasks: 0,
      longTaskTotalMs: 0,
      scrollFrameMaxMs: 0,
      scrollFrameAvgSum: 0,
      scrollFrameN: 0,
      domMax: 0,
    },
    timer: null,
    observer: null,
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "—");
  const now = () => performance.now();

  // --- UI ---
  const hud = document.createElement("div");
  hud.style.cssText = `
    position: fixed;
    right: 12px;
    bottom: 12px;
    z-index: 2147483647;
    font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #eaeaea;
    background: rgba(20,20,20,.92);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 10px;
    padding: 10px 10px 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
    width: 320px;
    user-select: none;
  `;
  hud.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <div style="font-weight:700;">Perf Self-Test HUD</div>
      <div style="display:flex;gap:6px;">
        <button data-act="toggle" style="cursor:pointer;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;padding:4px 8px;">Pause</button>
        <button data-act="close" style="cursor:pointer;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;padding:4px 8px;">X</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns: 1fr 1fr;gap:6px;">
      <div><span style="opacity:.75;">FPS</span> <span data-k="fps" style="font-weight:700;">—</span></div>
      <div><span style="opacity:.75;">Frame</span> <span data-k="frameMs" style="font-weight:700;">—</span> ms</div>

      <div><span style="opacity:.75;">DOM</span> <span data-k="domCount" style="font-weight:700;">—</span></div>
      <div><span style="opacity:.75;">DOM(deep)</span> <span data-k="domDeepCount" style="font-weight:700;">—</span></div>

      <div><span style="opacity:.75;">LongTasks</span> <span data-k="longTasks" style="font-weight:700;">—</span></div>
      <div><span style="opacity:.75;">LT max</span> <span data-k="longTaskMaxMs" style="font-weight:700;">—</span> ms</div>

      <div><span style="opacity:.75;">Scroll frame</span> <span data-k="scrollFrameMaxMs" style="font-weight:700;">—</span> ms max</div>
      <div><span style="opacity:.75;">Scroll avg</span> <span data-k="scrollFrameAvgMs" style="font-weight:700;">—</span> ms</div>

      <div style="grid-column:1 / span 2;">
        <span style="opacity:.75;">Memory</span>
        <span data-k="mem" style="font-weight:700;">—</span>
      </div>

      <div style="grid-column:1 / span 2; opacity:.85;">
        <span style="opacity:.75;">Container</span>
        <span data-k="container" style="font-weight:700;">document</span>
      </div>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
      <button data-act="use0" style="cursor:pointer;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;padding:4px 8px;">Use $0 as container</button>
      <button data-act="clearContainer" style="cursor:pointer;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;padding:4px 8px;">Whole document</button>
      <button data-act="highlight" style="cursor:pointer;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;padding:4px 8px;">Highlight container</button>
      <button data-act="sample" style="cursor:pointer;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;padding:4px 8px;">5s sample</button>
      <button data-act="toggleLog" style="cursor:pointer;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;padding:4px 8px;">Log: off</button>
    </div>

    <div style="margin-top:8px;opacity:.72;">
      Tips: 滚动时观察 FPS/LongTasks/Scroll frame；切换容器后 DOM 统计更贴近虚拟化效果。
    </div>
  `;
  document.documentElement.appendChild(hud);

  const $ = (sel) => hud.querySelector(sel);
  const ks = {
    fps: $('[data-k="fps"]'),
    frameMs: $('[data-k="frameMs"]'),
    domCount: $('[data-k="domCount"]'),
    domDeepCount: $('[data-k="domDeepCount"]'),
    longTasks: $('[data-k="longTasks"]'),
    longTaskMaxMs: $('[data-k="longTaskMaxMs"]'),
    scrollFrameMaxMs: $('[data-k="scrollFrameMaxMs"]'),
    scrollFrameAvgMs: $('[data-k="scrollFrameAvgMs"]'),
    mem: $('[data-k="mem"]'),
    container: $('[data-k="container"]'),
  };

  // --- Long Task observer ---
  try {
    state.observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        state.longTasks += 1;
        state.longTaskTotalMs += e.duration;
        state.longTaskMaxMs = Math.max(state.longTaskMaxMs, e.duration);

        if (state.sampleStartAt != null) {
          state.sample.longTasks += 1;
          state.sample.longTaskTotalMs += e.duration;
        }
      }
    });
    state.observer.observe({ entryTypes: ["longtask"] });
  } catch (e) {
    // some browsers disallow longtask
  }

  // --- Scroll instrumentation (captures "frame cost around scroll") ---
  let scheduled = false;
  const onScroll = () => {
    state.lastScrollAt = now();
    if (scheduled) return;
    scheduled = true;
    const t0 = now();
    requestAnimationFrame(() => {
      const dt = now() - t0;
      scheduled = false;

      state.scrollFrames += 1;
      state.scrollFrameTotalMs += dt;
      state.scrollFrameMaxMs = Math.max(state.scrollFrameMaxMs, dt);

      if (state.sampleStartAt != null) {
        state.sample.scrollFrameN += 1;
        state.sample.scrollFrameAvgSum += dt;
        state.sample.scrollFrameMaxMs = Math.max(state.sample.scrollFrameMaxMs, dt);
      }
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  // --- DOM counting ---
  const countDOM = () => {
    const root = state.container || document.documentElement;
    // cheap-ish count
    const all = root.getElementsByTagName("*");
    state.domCount = all.length;

    // "deep count" includes text nodes etc. More expensive; do it less often.
    // We'll approximate by counting childNodes recursively with a cap.
    let deep = 0;
    const CAP = 200000; // safety cap
    const stack = [root];
    while (stack.length && deep < CAP) {
      const n = stack.pop();
      deep += (n.childNodes ? n.childNodes.length : 0);
      if (n.children && n.children.length) {
        for (let i = 0; i < n.children.length; i++) stack.push(n.children[i]);
      }
    }
    state.domDeepCount = deep;

    if (state.sampleStartAt != null) state.sample.domMax = Math.max(state.sample.domMax, state.domCount);
  };

  // --- Memory (Chrome only) ---
  const sampleMemory = () => {
    const m = performance && performance.memory;
    if (!m) {
      state.memMB = null;
      return;
    }
    state.memLimitMB = m.jsHeapSizeLimit / 1048576;
    state.memUsedJSHeapMB = m.usedJSHeapSize / 1048576;
    state.memMB = state.memUsedJSHeapMB;
  };

  // --- Main RAF loop for FPS ---
  const rafLoop = () => {
    if (!state.running) return;
    const t = now();
    const dt = t - state.lastRAF;
    state.lastRAF = t;

    state.frameMs = dt;
    state.rafCount += 1;

    // update FPS about every 500ms for stability
    if (!state._fpsAcc) state._fpsAcc = { t0: t, n: 0 };
    state._fpsAcc.n += 1;
    if (t - state._fpsAcc.t0 >= 500) {
      state.fps = (state._fpsAcc.n * 1000) / (t - state._fpsAcc.t0);
      state._fpsAcc.t0 = t;
      state._fpsAcc.n = 0;

      if (state.sampleStartAt != null) {
        state.sample.fpsMin = Math.min(state.sample.fpsMin, state.fps);
        state.sample.fpsMax = Math.max(state.sample.fpsMax, state.fps);
        state.sample.fpsAvgSum += state.fps;
        state.sample.fpsN += 1;
      }
    }

    // periodic samples
    const tNow = now();
    if (tNow - state.lastDomSampleAt > 800) {
      state.lastDomSampleAt = tNow;
      countDOM();
    }
    if (tNow - (state._memAt || 0) > 1000) {
      state._memAt = tNow;
      sampleMemory();
    }

    // update UI
    ks.fps.textContent = fmt(state.fps, 0);
    ks.frameMs.textContent = fmt(state.frameMs, 1);
    ks.domCount.textContent = String(state.domCount);
    ks.domDeepCount.textContent = String(state.domDeepCount);
    ks.longTasks.textContent = String(state.longTasks);
    ks.longTaskMaxMs.textContent = fmt(state.longTaskMaxMs, 1);

    const scrollAvg = state.scrollFrames ? state.scrollFrameTotalMs / state.scrollFrames : 0;
    ks.scrollFrameMaxMs.textContent = fmt(state.scrollFrameMaxMs, 1);
    ks.scrollFrameAvgMs.textContent = fmt(scrollAvg, 1);

    if (state.memMB == null) {
      ks.mem.textContent = "— (performance.memory unsupported)";
    } else {
      ks.mem.textContent = `${fmt(state.memUsedJSHeapMB, 1)} MB / limit ${fmt(state.memLimitMB, 0)} MB`;
    }

    // sample window finish
    if (state.sampleStartAt != null && tNow - state.sampleStartAt >= state.sampleWindowMs) {
      const s = state.sample;
      const fpsAvg = s.fpsN ? s.fpsAvgSum / s.fpsN : NaN;
      const scrollAvg2 = s.scrollFrameN ? s.scrollFrameAvgSum / s.scrollFrameN : NaN;

      console.groupCollapsed(
        `%cPerf sample ${state.sampleWindowMs / 1000}s`,
        "color:#9ae6b4;font-weight:bold;"
      );
      console.log("container:", state.container || document);
      console.log("FPS min/avg/max:", fmt(s.fpsMin, 0), fmt(fpsAvg, 0), fmt(s.fpsMax, 0));
      console.log("LongTasks:", s.longTasks, "total ms:", fmt(s.longTaskTotalMs, 1));
      console.log("Scroll frame avg/max ms:", fmt(scrollAvg2, 1), fmt(s.scrollFrameMaxMs, 1));
      console.log("DOM max:", s.domMax);
      console.groupEnd();

      // reset sample
      state.sampleStartAt = null;
      state.sample = {
        fpsMin: Infinity,
        fpsMax: -Infinity,
        fpsAvgSum: 0,
        fpsN: 0,
        longTasks: 0,
        longTaskTotalMs: 0,
        scrollFrameMaxMs: 0,
        scrollFrameAvgSum: 0,
        scrollFrameN: 0,
        domMax: 0,
      };
    }

    // optional periodic logging
    if (state.logSamples && (!state._logAt || tNow - state._logAt > 1000)) {
      state._logAt = tNow;
      console.log(
        "[PerfHUD]",
        "FPS", fmt(state.fps, 0),
        "| DOM", state.domCount,
        "| LT", state.longTasks, "max", fmt(state.longTaskMaxMs, 1) + "ms",
        "| ScrollMax", fmt(state.scrollFrameMaxMs, 1) + "ms",
        "| Mem", state.memMB == null ? "—" : fmt(state.memUsedJSHeapMB, 1) + "MB"
      );
    }

    requestAnimationFrame(rafLoop);
  };

  // --- Buttons ---
  const highlightOnce = () => {
    const el = state.container;
    if (!el) return;
    const prev = el.style.outline;
    const prev2 = el.style.outlineOffset;
    el.style.outline = "3px solid rgba(80,200,255,.9)";
    el.style.outlineOffset = "2px";
    setTimeout(() => {
      el.style.outline = prev;
      el.style.outlineOffset = prev2;
    }, 1200);
  };

  hud.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.getAttribute("data-act");

    if (act === "toggle") {
      state.running = !state.running;
      btn.textContent = state.running ? "Pause" : "Resume";
      if (state.running) {
        state.lastRAF = now();
        requestAnimationFrame(rafLoop);
      }
    }

    if (act === "close") {
      cleanup();
    }

    if (act === "use0") {
      // DevTools selected element
      const el = window.$0;
      if (el && el.nodeType === 1) {
        state.container = el;
        ks.container.textContent = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "");
        highlightOnce();
        countDOM();
      } else {
        console.warn("No $0 element selected in DevTools Elements panel.");
      }
    }

    if (act === "clearContainer") {
      state.container = null;
      ks.container.textContent = "document";
      countDOM();
    }

    if (act === "highlight") {
      highlightOnce();
    }

    if (act === "sample") {
      state.sampleStartAt = now();
      console.log(
        `%cSampling for ${state.sampleWindowMs / 1000}s... scroll & interact now.`,
        "color:#90cdf4;font-weight:bold;"
      );
    }

    if (act === "toggleLog") {
      state.logSamples = !state.logSamples;
      btn.textContent = state.logSamples ? "Log: on" : "Log: off";
    }
  });

  // --- Global handle for manual control ---
  const api = {
    setContainer(el) {
      if (el && el.nodeType === 1) {
        state.container = el;
        ks.container.textContent = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "");
        highlightOnce();
        countDOM();
      } else if (el == null) {
        state.container = null;
        ks.container.textContent = "document";
        countDOM();
      } else {
        throw new Error("setContainer expects an Element or null");
      }
    },
    sample(ms = 5000) {
      state.sampleWindowMs = clamp(ms, 1000, 60000);
      state.sampleStartAt = now();
      console.log(
        `%cSampling for ${state.sampleWindowMs / 1000}s...`,
        "color:#90cdf4;font-weight:bold;"
      );
    },
    stop() {
      cleanup();
    },
  };
  window.__PerfHUD__ = api;

  function cleanup() {
    state.running = false;
    window.removeEventListener("scroll", onScroll);
    try { state.observer && state.observer.disconnect(); } catch {}
    try { hud.remove(); } catch {}
    try { delete window.__PerfHUD__; } catch { window.__PerfHUD__ = undefined; }
    console.log("%cPerfHUD stopped.", "color:#fbb6ce;font-weight:bold;");
  }

  // kickoff
  countDOM();
  sampleMemory();
  requestAnimationFrame(rafLoop);
  console.log(
    "%cPerfHUD running. API: window.__PerfHUD__ { setContainer(el|null), sample(ms), stop() }",
    "color:#9ae6b4;font-weight:bold;"
  );
})();
