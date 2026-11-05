/* ============================================================
   Focus Mode Pro, onboarding controller (Zovo serif design)
   7-step flow. Works in the extension (chrome.*) and standalone
   (graceful mock fallback for manual preview). NASA-clean:
   bounded loops, guarded returns, no globals leaked.
   ============================================================ */
(function () {
  'use strict';

  const TOTAL = 7;
  const UPGRADE_URL = 'https://zovo.one/pricing?ext=focus_mode_blocker&ref=onboarding';
  const hasChrome = typeof chrome !== 'undefined' && chrome.tabs && chrome.storage;

  let current = 1;
  let plan = 'lifetime';

  const $ = (id) => document.getElementById(id);
  const steps = Array.from(document.querySelectorAll('.step'));
  const dots = Array.from(document.querySelectorAll('.dot'));
  const nextBtn = $('nextBtn'), backBtn = $('backBtn'), nextLabel = $('nextLabel');
  const counter = $('counter'), fill = $('progressFill');

  const GENERIC = {1:'Show me',2:'Looks great, next',3:'Save and continue',4:'See who built it',5:'See what Pro adds',6:'See the Pro plan',7:'Start using it'};
  function nextLabelFor(n){ const s=steps.find(x=>+x.dataset.step===n); if(s&&s.dataset.next) return s.dataset.next; if(n===6) return (plan==='lifetime'?'Get Lifetime for $99':'Get Pro for $4.99 a month'); return GENERIC[n]||'Next'; }
  const NEXT = {1:()=>nextLabelFor(1),2:()=>nextLabelFor(2),3:()=>nextLabelFor(3),4:()=>nextLabelFor(4),5:()=>nextLabelFor(5),6:()=>nextLabelFor(6),7:()=>nextLabelFor(7)};

  /* ---------- render ---------- */
  function render() {
    steps.forEach((s) => s.classList.toggle('active', +s.dataset.step === current));
    dots.forEach((d) => {
      const n = +d.dataset.step;
      d.classList.toggle('active', n === current);
      d.classList.toggle('done', n < current);
    });
    counter.textContent = String(current).padStart(2, '0') + ' / ' + String(TOTAL).padStart(2, '0');
    fill.style.width = (current / TOTAL) * 100 + '%';
    backBtn.hidden = current === 1;
    nextLabel.textContent = NEXT[current]();
    const svg = nextBtn.querySelector('svg');
    if (svg) svg.style.display = current === 6 ? 'none' : '';
    if (current === 2) startDemo();
    else resetDemo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function go(n) { current = Math.max(1, Math.min(TOTAL, n)); render(); }

  nextBtn.addEventListener('click', () => {
    if (current === 3) persistSetup();
    if (current === 6) { convert(); return; }
    if (current === 7) { finish(); return; }
    go(current + 1);
  });
  backBtn.addEventListener('click', () => go(current - 1));
  dots.forEach((d) => d.addEventListener('click', () => go(+d.dataset.step)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && current < TOTAL) go(current + 1);
    if (e.key === 'ArrowLeft' && current > 1) go(current - 1);
  });

  /* ---------- messaging helper ---------- */
  function send(action, payload) {
    return new Promise((resolve) => {
      if (!hasChrome || !chrome.runtime || !chrome.runtime.sendMessage) { resolve(null); return; }
      try {
        chrome.runtime.sendMessage({ action, payload }, (res) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(res || null);
        });
      } catch (_) { resolve(null); }
    });
  }

  /* ---------- Step 2: focus-session demo (self-contained, no permissions) ---------- */
  const demoTimer = $('demoTimer'), demoCap = $('demoCap'), demoBtn = $('demoBtn'), demoTabs = $('demoTabs');
  let demoJobs = [];
  let demoTick = null;
  let demoPlaying = false;
  function clearDemoJobs() {
    for (let i = 0; i < demoJobs.length; i++) clearTimeout(demoJobs[i]);
    demoJobs = [];
    if (demoTick) { clearInterval(demoTick); demoTick = null; }
  }
  function resetDemo() {
    clearDemoJobs();
    demoPlaying = false;
    if (demoTimer) demoTimer.innerHTML = '25<small>:00</small>';
    if (demoCap) demoCap.textContent = 'press start to see a session';
    if (demoBtn) { demoBtn.disabled = false; demoBtn.style.opacity = ''; demoBtn.textContent = 'Start the session'; }
    if (!demoTabs) return;
    Array.from(demoTabs.querySelectorAll('.dtab[data-block]')).forEach((t) => {
      t.classList.remove('suspended');
      const fav = t.querySelector('.fav'); if (fav) fav.style.background = '';
      const idle = t.querySelector('.idle'); if (idle) idle.textContent = 'open';
      const badge = t.querySelector('.badge'); if (badge) badge.remove();
    });
  }
  function runDemo() {
    if (!demoTabs || demoPlaying) return;
    demoPlaying = true;
    if (demoCap) demoCap.textContent = 'focus session running';
    if (demoBtn) { demoBtn.disabled = true; demoBtn.style.opacity = '.55'; demoBtn.textContent = 'Focus mode active'; }
    // Tick the clock down a few seconds. Purely visual, never touches your real tabs.
    let secs = 25 * 60;
    const floor = secs - 6;
    demoTick = setInterval(() => {
      secs -= 1;
      if (secs <= floor) { clearInterval(demoTick); demoTick = null; return; }
      const m = Math.floor(secs / 60), s = secs % 60;
      if (demoTimer) demoTimer.innerHTML = m + '<small>:' + String(s).padStart(2, '0') + '</small>';
    }, 300);
    // Block the distracting tabs one at a time.
    const blocked = Array.from(demoTabs.querySelectorAll('.dtab[data-block]'));
    blocked.forEach((t, i) => {
      const job = setTimeout(() => {
        t.classList.add('suspended');
        const fav = t.querySelector('.fav'); if (fav) fav.style.background = 'var(--text-4)';
        const idle = t.querySelector('.idle'); if (idle) idle.textContent = 'redirected';
        if (!t.querySelector('.badge')) {
          const b = document.createElement('span');
          b.className = 'badge';
          b.textContent = 'Blocked';
          b.style.background = 'rgba(255,107,107,.14)';
          b.style.color = '#ff8f8f';
          t.appendChild(b);
        }
      }, 520 * (i + 1));
      demoJobs.push(job);
    });
    const done = setTimeout(() => {
      if (demoCap) demoCap.textContent = 'noise blocked, work stays open';
    }, 520 * (blocked.length + 1));
    demoJobs.push(done);
  }
  function startDemo() {
    resetDemo();
    const kick = setTimeout(runDemo, 650);
    demoJobs.push(kick);
  }
  if (demoBtn) demoBtn.addEventListener('click', () => { resetDemo(); runDemo(); });

  /* ---------- Step 3: setup ---------- */
  const tv = $('setupTimeout'), tvv = $('setupTimeoutValue');
  if (tv && tvv) tv.addEventListener('input', () => {
    const m = +tv.value;
    tvv.textContent = m >= 60 ? (m / 60 % 1 === 0 ? m / 60 + ' hr' : (m / 60).toFixed(1) + ' hr') : m + ' min';
  });
  async function persistSetup() {
    if (!hasChrome) return;
    const minutes = tv ? Math.max(15, Math.min(120, +tv.value || 25)) : 25;
    const want = {};
    Array.from(document.querySelectorAll('.chips .chip input[data-cat]')).forEach((c) => {
      if (c.dataset.cat) want[c.dataset.cat] = !!c.checked;
    });
    try {
      const res = await send('GET_SETTINGS');
      const s = res && res.data ? res.data : null;
      if (!s) return;
      const payload = {};
      if (s.pomodoro && typeof s.pomodoro === 'object') {
        payload.pomodoro = Object.assign({}, s.pomodoro, { focusDuration: minutes });
      }
      if (Array.isArray(s.categories)) {
        payload.categories = s.categories.map((c) => {
          const v = want[c.id];
          return (typeof v === 'boolean') ? Object.assign({}, c, { enabled: v }) : c;
        });
      }
      if (Object.keys(payload).length) await send('UPDATE_SETTINGS', payload);
    } catch (e) { /* best effort, never blocks the flow */ }
  }

  /* ---------- Step 6: pricing toggle + FAQ + convert ---------- */
  const PLANS = {
    monthly: { amt: '$4.99', per: '/ month', sub: 'Billed monthly, cancel anytime', r1: 'Cancel anytime' },
    lifetime: { amt: '$99', per: 'once', sub: 'One payment, Pro unlocked for good', r1: 'One-time payment' }
  };
  const seg = $('planSeg');
  if (seg) seg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-plan]'); if (!btn) return;
    plan = btn.dataset.plan;
    Array.from(seg.querySelectorAll('button')).forEach((b) => b.classList.toggle('on', b === btn));
    const p = PLANS[plan] || PLANS.monthly;
    if ($('priceAmt')) $('priceAmt').textContent = p.amt;
    if ($('pricePer')) $('pricePer').textContent = p.per;
    if ($('priceSub')) $('priceSub').textContent = p.sub;
    if ($('reassure1')) $('reassure1').textContent = p.r1;
    if (current === 6) nextLabel.textContent = NEXT[6]();
  });
  // FAQ accordion (bounded to the items present)
  Array.from(document.querySelectorAll('#faq .faq-item')).forEach((item) => {
    const q = item.querySelector('.faq-q'), a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', () => {
      const open = item.classList.toggle('open');
      a.style.maxHeight = open ? a.scrollHeight + 'px' : '0';
    });
  });
  const skip = $('skipUpgrade');
  if (skip) skip.addEventListener('click', () => {
    if (hasChrome) { try { chrome.storage.local.set({ upgradeDeclinedAt: Date.now() }); } catch (_) {} }
    go(7);
  });
  function convert() {
    if (hasChrome) { try { chrome.storage.local.set({ upgradeIntentAt: Date.now(), upgradePlan: plan }); } catch (_) {} }
    openUpgrade();
    go(7);
  }
  function openUpgrade() {
    const url = UPGRADE_URL + '&plan=' + encodeURIComponent(plan);
    if (hasChrome && chrome.tabs && chrome.tabs.create) { try { chrome.tabs.create({ url }); return; } catch (_) {} }
    window.open(url, '_blank');
  }

  /* ---------- Step 7: finish ---------- */
  function finish() {
    if (!hasChrome) { nextLabel.textContent = 'Done'; return; }
    try {
      chrome.storage.local.set({ onboardingComplete: true, onboardingAt: Date.now() });
      window.close();
    } catch (_) {}
  }

  /* ---------- deep-link a step (preview/screenshots): ?step=4 ---------- */
  try {
    const q = +new URLSearchParams(location.search).get('step');
    if (q >= 1 && q <= TOTAL) current = q;
  } catch (_) {}

  render();
})();
