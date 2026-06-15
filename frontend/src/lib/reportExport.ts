import type { SimulationRun } from '@/types'
import { computeSus, totalSimulatedSteps } from '@/lib/metrics'

/**
 * "Shareable Standalone Report" engine.
 *
 * Compiles a completed SimulationRun into a single self-contained HTML
 * document: Tailwind via CDN, run data embedded as JSON, and vanilla JS that
 * renders interactive SVG charts (frustration curve + efficiency bars), the
 * SUS metric card, the full persona feed log, and the UX issue register.
 * Recipients double-click the file — no server, no build step.
 */

export function downloadStandaloneReport(run: SimulationRun) {
  const html = buildStandaloneReportHtml(run)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'castinsight-report.html'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function buildStandaloneReportHtml(run: SimulationRun): string {
  const sus = computeSus(run.results)
  const exportData = {
    meta: {
      flowName: run.flowName,
      taskGoal: run.taskGoal,
      personaName: run.personaName,
      personaRole: run.personaRole,
      traits: run.traits,
      model: run.model,
      mock: run.mock,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt || null,
      status: run.status,
    },
    sus,
    optimalSteps: run.stepTexts.length,
    attemptedSteps: run.results.length,
    simulatedSteps: totalSimulatedSteps(run.results),
    results: run.results.map((r) => ({
      stepIndex: r.stepIndex,
      stepText: r.stepText,
      innerMonologue: r.innerMonologue,
      action: r.action,
      actionType: r.actionType,
      frustration: r.frustration,
      confidence: r.confidence,
      simulatedStepsTaken: r.simulatedStepsTaken,
      uxIssues: r.uxIssues,
      succeeded: r.succeeded,
      imagePreview: r.imagePreview || null,
    })),
  }

  // </script>-safe JSON embedding
  const dataJson = JSON.stringify(exportData).replace(/<\//g, '<\\/')

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>CastInsight Report — ${escapeHtml(run.flowName)}</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<script>
  tailwind.config = { darkMode: 'class', theme: { extend: { colors: {
    surface: '#0e0e13', card: '#16161d', edge: '#2a2a35',
    brand: '#a78bfa', danger: '#f87171', ok: '#34d399'
  } } } }
<\/script>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .chart-tip { pointer-events: none; transition: opacity .12s ease; }
  details summary::-webkit-details-marker { display: none; }
</style>
</head>
<body class="bg-surface text-zinc-100 min-h-screen">
<div class="max-w-6xl mx-auto px-6 py-10">

  <!-- Header -->
  <header class="mb-8">
    <div class="flex items-center gap-3 mb-2">
      <div class="w-10 h-10 rounded-xl bg-brand/20 border border-brand/40 flex items-center justify-center text-brand font-bold text-lg">Ci</div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">CastInsight Synthetic User Test Report</h1>
        <p class="text-sm text-zinc-400" id="meta-line"></p>
      </div>
    </div>
    <div class="mt-4 rounded-lg border border-edge bg-card p-4">
      <p class="text-xs uppercase tracking-widest text-zinc-500 mb-1">Task Goal</p>
      <p class="text-sm text-zinc-200" id="task-goal"></p>
    </div>
  </header>

  <!-- SUS + headline metrics -->
  <section class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8" id="metric-cards"></section>

  <!-- Tabs -->
  <nav class="flex gap-1 mb-4 bg-card border border-edge rounded-lg p-1 w-fit">
    <button data-tab="charts" class="tab-btn px-4 py-2 rounded-md text-sm font-medium">Analytics</button>
    <button data-tab="feed" class="tab-btn px-4 py-2 rounded-md text-sm font-medium">Simulation Feed</button>
    <button data-tab="issues" class="tab-btn px-4 py-2 rounded-md text-sm font-medium">UX Issues</button>
  </nav>

  <!-- Charts panel -->
  <section id="panel-charts" class="tab-panel space-y-6">
    <div class="rounded-lg border border-edge bg-card p-5">
      <h2 class="font-semibold mb-1">Frustration Curve</h2>
      <p class="text-xs text-zinc-500 mb-4">Persona confusion index (1–100) across consecutive flow steps. Hover points for detail.</p>
      <div id="line-chart" class="relative"></div>
    </div>
    <div class="rounded-lg border border-edge bg-card p-5">
      <h2 class="font-semibold mb-1">Efficiency: Optimal vs. AI Simulated Step Count</h2>
      <p class="text-xs text-zinc-500 mb-4">Bars above 1 reveal fumbling, loops, or back-tracking at that step.</p>
      <div id="bar-chart" class="relative"></div>
    </div>
  </section>

  <!-- Feed panel -->
  <section id="panel-feed" class="tab-panel hidden space-y-3"></section>

  <!-- Issues panel -->
  <section id="panel-issues" class="tab-panel hidden"></section>

  <footer class="mt-10 pt-6 border-t border-edge text-xs text-zinc-600">
    Generated by CastInsight · Synthetic User Testing Simulator for Casting Networks · This file is fully self-contained and safe to share.
  </footer>
</div>

<script id="run-data" type="application/json">${dataJson}<\/script>
<script>
(function () {
  var DATA = JSON.parse(document.getElementById('run-data').textContent);

  /* ---------- header ---------- */
  document.getElementById('meta-line').textContent =
    DATA.meta.flowName + ' · ' + DATA.meta.personaRole + ' ("' + DATA.meta.personaName + '") · model: ' +
    DATA.meta.model + (DATA.meta.mock ? ' (sandbox mock)' : '') + ' · ' + new Date(DATA.meta.startedAt).toLocaleString();
  document.getElementById('task-goal').textContent = DATA.meta.taskGoal;

  /* ---------- metric cards ---------- */
  var susColor = DATA.sus.score >= 72 ? 'text-ok' : DATA.sus.score >= 52 ? 'text-amber-400' : 'text-danger';
  var cards = [
    { label: 'SUS Score', value: DATA.sus.score, sub: 'Grade ' + DATA.sus.grade + ' — ' + DATA.sus.label, big: true, color: susColor },
    { label: 'Avg Frustration', value: DATA.sus.avgFrustration + '/100', sub: 'persona confusion index', color: DATA.sus.avgFrustration > 55 ? 'text-danger' : 'text-zinc-100' },
    { label: 'Completion Rate', value: DATA.sus.completionRate + '%', sub: 'steps succeeded', color: 'text-zinc-100' },
    { label: 'Step Efficiency', value: DATA.attemptedSteps + '/' + DATA.optimalSteps + ' steps',
      sub: (DATA.attemptedSteps < DATA.optimalSteps ? 'abandoned early · ' : 'all steps reached · ') + DATA.simulatedSteps + ' interactions',
      color: DATA.attemptedSteps < DATA.optimalSteps ? 'text-danger' : 'text-zinc-100' }
  ];
  document.getElementById('metric-cards').innerHTML = cards.map(function (c) {
    return '<div class="rounded-lg border border-edge bg-card p-5' + (c.big ? ' md:row-span-1 ring-1 ring-brand/30' : '') + '">' +
      '<p class="text-xs uppercase tracking-widest text-zinc-500 mb-2">' + c.label + '</p>' +
      '<p class="text-3xl font-bold ' + c.color + '">' + c.value + '</p>' +
      '<p class="text-xs text-zinc-500 mt-1">' + c.sub + '</p></div>';
  }).join('');

  /* ---------- tabs ---------- */
  var tabs = document.querySelectorAll('.tab-btn');
  function activate(name) {
    tabs.forEach(function (b) {
      var on = b.dataset.tab === name;
      b.className = 'tab-btn px-4 py-2 rounded-md text-sm font-medium ' + (on ? 'bg-brand/20 text-brand' : 'text-zinc-400 hover:text-zinc-200');
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('hidden', p.id !== 'panel-' + name);
    });
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { activate(b.dataset.tab); }); });
  activate('charts');

  /* ---------- SVG helpers ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var node = document.createElementNS(NS, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  /* ---------- frustration line chart ---------- */
  (function renderLine() {
    var W = 920, H = 280, PAD = { l: 44, r: 16, t: 16, b: 36 };
    var pts = DATA.results;
    if (!pts.length) return;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'w-full h-auto' });
    var iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    var x = function (i) { return PAD.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw); };
    var y = function (v) { return PAD.t + ih - (v / 100) * ih; };

    [0, 25, 50, 75, 100].forEach(function (g) {
      el('line', { x1: PAD.l, x2: W - PAD.r, y1: y(g), y2: y(g), stroke: '#2a2a35', 'stroke-width': 1 }, svg);
      var t = el('text', { x: PAD.l - 8, y: y(g) + 4, fill: '#71717a', 'font-size': 11, 'text-anchor': 'end' }, svg);
      t.textContent = g;
    });

    // danger zone band (>70)
    el('rect', { x: PAD.l, y: y(100), width: iw, height: y(70) - y(100), fill: '#f87171', opacity: 0.06 }, svg);

    var dFrus = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(p.frustration); }).join(' ');
    var dConf = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(p.confidence); }).join(' ');
    el('path', { d: dConf, fill: 'none', stroke: '#34d399', 'stroke-width': 2, 'stroke-dasharray': '5 4', opacity: 0.8 }, svg);
    el('path', { d: dFrus, fill: 'none', stroke: '#f87171', 'stroke-width': 2.5 }, svg);

    var tip = document.createElement('div');
    tip.className = 'chart-tip absolute opacity-0 bg-zinc-900 border border-edge rounded-md px-3 py-2 text-xs shadow-xl z-10';
    pts.forEach(function (p, i) {
      var c = el('circle', { cx: x(i), cy: y(p.frustration), r: 5, fill: '#f87171', stroke: '#0e0e13', 'stroke-width': 2, cursor: 'pointer' }, svg);
      c.addEventListener('mouseenter', function () {
        tip.innerHTML = '<b>Step ' + (p.stepIndex + 1) + '</b><br/>Frustration: <span class="text-danger">' + p.frustration +
          '</span> · Confidence: <span class="text-ok">' + p.confidence + '</span><br/><span class="text-zinc-400">' + p.action.replace(/</g, '&lt;') + '</span>';
        tip.style.opacity = 1;
        tip.style.left = (x(i) / W * 100) + '%';
        tip.style.top = (y(p.frustration) / H * 100 - 4) + '%';
      });
      c.addEventListener('mouseleave', function () { tip.style.opacity = 0; });
      var lbl = el('text', { x: x(i), y: H - 12, fill: '#a1a1aa', 'font-size': 11, 'text-anchor': 'middle' }, svg);
      lbl.textContent = 'S' + (p.stepIndex + 1);
    });

    var legend = document.createElement('div');
    legend.className = 'flex gap-5 text-xs text-zinc-400 mt-2';
    legend.innerHTML = '<span><span class="inline-block w-3 h-0.5 bg-danger align-middle mr-1.5"></span>Frustration</span>' +
      '<span><span class="inline-block w-3 h-0.5 bg-ok align-middle mr-1.5" style="border-top:2px dashed #34d399;background:none"></span>Confidence</span>';

    var host = document.getElementById('line-chart');
    host.appendChild(svg); host.appendChild(tip); host.appendChild(legend);
  })();

  /* ---------- efficiency bar chart ---------- */
  (function renderBars() {
    var pts = DATA.results;
    if (!pts.length) return;
    var W = 920, H = 260, PAD = { l: 44, r: 16, t: 16, b: 36 };
    var maxV = Math.max(4, Math.max.apply(null, pts.map(function (p) { return p.simulatedStepsTaken; })));
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'w-full h-auto' });
    var iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    var groupW = iw / pts.length, barW = Math.min(34, groupW * 0.32);
    var y = function (v) { return PAD.t + ih - (v / maxV) * ih; };

    for (var g = 0; g <= maxV; g++) {
      el('line', { x1: PAD.l, x2: W - PAD.r, y1: y(g), y2: y(g), stroke: '#2a2a35', 'stroke-width': 1 }, svg);
      var t = el('text', { x: PAD.l - 8, y: y(g) + 4, fill: '#71717a', 'font-size': 11, 'text-anchor': 'end' }, svg);
      t.textContent = g;
    }

    pts.forEach(function (p, i) {
      var cx = PAD.l + groupW * i + groupW / 2;
      el('rect', { x: cx - barW - 3, y: y(p.optimal || 1), width: barW, height: PAD.t + ih - y(p.optimal || 1), fill: '#34d399', rx: 3, opacity: 0.85 }, svg);
      var sim = el('rect', { x: cx + 3, y: y(p.simulatedStepsTaken), width: barW, height: PAD.t + ih - y(p.simulatedStepsTaken), fill: p.simulatedStepsTaken > 1 ? '#a78bfa' : '#6d28d9', rx: 3 }, svg);
      var title = el('title', {}, sim);
      title.textContent = 'Step ' + (p.stepIndex + 1) + ': simulated ' + p.simulatedStepsTaken + ' interactions (optimal 1)';
      var lbl = el('text', { x: cx, y: H - 12, fill: '#a1a1aa', 'font-size': 11, 'text-anchor': 'middle' }, svg);
      lbl.textContent = 'S' + (p.stepIndex + 1);
    });

    var legend = document.createElement('div');
    legend.className = 'flex gap-5 text-xs text-zinc-400 mt-2';
    legend.innerHTML = '<span><span class="inline-block w-3 h-3 rounded-sm align-middle mr-1.5" style="background:#34d399"></span>Optimal Path</span>' +
      '<span><span class="inline-block w-3 h-3 rounded-sm align-middle mr-1.5" style="background:#a78bfa"></span>AI Simulated</span>';

    var host = document.getElementById('bar-chart');
    host.appendChild(svg); host.appendChild(legend);
  })();

  /* ---------- feed log ---------- */
  (function renderFeed() {
    var host = document.getElementById('panel-feed');
    var ACTION_STYLE = {
      click: 'bg-brand/20 text-brand border-brand/40',
      type: 'bg-sky-400/15 text-sky-300 border-sky-400/40',
      scroll: 'bg-zinc-400/15 text-zinc-300 border-zinc-500/40',
      hesitate: 'bg-amber-400/15 text-amber-300 border-amber-400/40',
      backtrack: 'bg-orange-400/15 text-orange-300 border-orange-400/40',
      abandon: 'bg-danger/15 text-danger border-danger/40',
      complete: 'bg-ok/15 text-ok border-ok/40'
    };
    host.innerHTML = DATA.results.map(function (r) {
      var img = r.imagePreview
        ? '<img src="' + r.imagePreview + '" alt="Step ' + (r.stepIndex + 1) + ' screen" class="rounded-md border border-edge max-h-56 object-contain bg-black/30" />'
        : '<div class="rounded-md border border-dashed border-edge h-28 flex items-center justify-center text-xs text-zinc-600">No screenshot attached — text-only evaluation</div>';
      return '<details class="rounded-lg border border-edge bg-card overflow-hidden" ' + (r.frustration > 55 ? 'open' : '') + '>' +
        '<summary class="cursor-pointer select-none p-4 flex items-center gap-3 flex-wrap">' +
          '<span class="text-xs font-mono text-zinc-500">STEP ' + (r.stepIndex + 1) + '</span>' +
          '<span class="text-sm font-medium flex-1 min-w-[200px]">' + escapeH(r.stepText) + '</span>' +
          '<span class="text-[11px] px-2 py-0.5 rounded-full border ' + (ACTION_STYLE[r.actionType] || ACTION_STYLE.click) + ' font-semibold uppercase tracking-wide">' + r.actionType + '</span>' +
          '<span class="text-xs ' + (r.frustration > 55 ? 'text-danger' : 'text-zinc-400') + '">😤 ' + r.frustration + '</span>' +
        '</summary>' +
        '<div class="px-4 pb-4 grid md:grid-cols-2 gap-4">' +
          '<div><p class="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">The User\\'s Eyes</p>' + img + '</div>' +
          '<div class="space-y-3">' +
            '<div><p class="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Persona Inner Monologue</p>' +
              '<p class="text-sm text-zinc-300 italic leading-relaxed">“' + escapeH(r.innerMonologue) + '”</p></div>' +
            '<div><p class="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Action Taken</p>' +
              '<p class="text-sm font-mono text-zinc-200">' + escapeH(r.action) + '</p></div>' +
            (r.uxIssues.length ? '<div><p class="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Flagged Issues</p><ul class="text-xs text-amber-300/90 space-y-1 list-disc pl-4">' +
              r.uxIssues.map(function (i) { return '<li>' + escapeH(i) + '</li>'; }).join('') + '</ul></div>' : '') +
          '</div>' +
        '</div></details>';
    }).join('');
    function escapeH(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    window.__escapeH = escapeH;
  })();

  /* ---------- issues register ---------- */
  (function renderIssues() {
    var host = document.getElementById('panel-issues');
    var issues = [];
    DATA.results.forEach(function (r) {
      r.uxIssues.forEach(function (i) { issues.push({ step: r.stepIndex + 1, issue: i, frustration: r.frustration }); });
    });
    if (!issues.length) {
      host.innerHTML = '<div class="rounded-lg border border-edge bg-card p-8 text-center text-sm text-zinc-500">No UX issues were flagged in this run. 🎉</div>';
      return;
    }
    issues.sort(function (a, b) { return b.frustration - a.frustration; });
    host.innerHTML = '<div class="rounded-lg border border-edge bg-card overflow-hidden"><table class="w-full text-sm">' +
      '<thead><tr class="border-b border-edge text-left text-xs uppercase tracking-widest text-zinc-500">' +
      '<th class="p-3 w-16">Step</th><th class="p-3">Issue (actionable designer feedback)</th><th class="p-3 w-28 text-right">Frustration</th></tr></thead><tbody>' +
      issues.map(function (i) {
        return '<tr class="border-b border-edge/60 last:border-0">' +
          '<td class="p-3 font-mono text-zinc-400">S' + i.step + '</td>' +
          '<td class="p-3 text-zinc-200">' + window.__escapeH(i.issue) + '</td>' +
          '<td class="p-3 text-right ' + (i.frustration > 55 ? 'text-danger' : 'text-zinc-400') + '">' + i.frustration + '/100</td></tr>';
      }).join('') + '</tbody></table></div>';
  })();
})();
<\/script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
