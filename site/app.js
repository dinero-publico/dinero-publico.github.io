/* Dinero Público — web estática. Los datos los prepara la herramienta del repositorio
   dinero-publico/datos y se publican en /datos/v1/ (mismo dominio). */
"use strict";

const DATA = "/datos/v1/";
const fmt0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf = (v) => (v == null || isNaN(v) ? "—" : fmt0.format(v));
const pf = (v) => (v == null || isNaN(v) ? "—" : fmt1.format(v) + " %");
const sgn = (v) => (v == null || isNaN(v) ? "—" : (v > 0 ? "+" : "") + fmt1.format(v) + " %");
const nfs = (v) => (v == null || isNaN(v) ? "—" : (v > 0 ? "+" : "") + fmt0.format(v));
/* Variación porcentual de b a v; null si no se puede calcular. */
const pct = (v, b) => (v == null || b == null || !b || isNaN(v) || isNaN(b) ? null : (100 * (v - b)) / Math.abs(b));
/* Texto corto de una variación: «▲ 3,2 %», «▼ 1,0 %» o «= igual». */
const flecha = (d) => (d == null ? "" : Math.abs(d) < 0.05 ? "= igual" : (d > 0 ? "▲ " : "▼ ") + fmt1.format(Math.abs(d)) + " %");
const tag = (txt, title) => { const t = el("span", { class: "tag" }, txt); if (title) t.title = title; return t; };
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
};
const fecha = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
};

/* Nombres comprensibles para las partidas de contabilidad nacional. */
const NOMBRES = {
  empleos: {
    "D.73": "Transferencias corrientes a otras administraciones (Seguridad Social, CCAA, ayuntamientos)",
    "D.41": "Intereses de la deuda",
    "D.62": "Prestaciones sociales (pensiones de clases pasivas y otras)",
    "D.1": "Sueldos del personal",
    "D.76": "Aportación a la Unión Europea",
    "D.9_S.13": "Transferencias de capital a otras administraciones",
    "P.2": "Compras de bienes y servicios",
    "P.51g": "Inversión pública",
    "D.92 (exc. D.9_S.13)": "Ayudas a la inversión",
    "D.31": "Subvenciones a productos",
    "D.99 (exc. D.9_S.13)": "Otras transferencias de capital",
    "D.75": "Transferencias corrientes diversas",
    "D.39": "Otras subvenciones a la producción",
    "D.74": "Cooperación internacional",
    "D.632": "Transferencias sociales en especie",
  },
  recursos: {
    "D.211": "IVA",
    "D.51": "Impuestos sobre la renta (IRPF, Sociedades…)",
    "D.214": "Impuestos especiales y otros sobre productos",
    "D.73": "Transferencias de otras administraciones",
    "D.92 (exc. D.9_S.13)": "Ayudas a la inversión recibidas (fondos europeos)",
    "D.41": "Intereses cobrados",
    "D.612": "Cotizaciones sociales imputadas",
    "D.29": "Otros impuestos sobre la producción",
    "D.75": "Transferencias corrientes diversas",
    "D.74": "Cooperación internacional",
    "P.131": "Pagos por otra producción no de mercado",
  },
};

const tip = $("#tip");
function showTip(ev, html) {
  tip.innerHTML = "";
  html.forEach((l, i) => tip.append(i ? el("div", {}, l) : el("strong", {}, l)));
  tip.hidden = false;
  const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
  if (y + h > innerHeight - 8) y = ev.clientY - h - pad;
  tip.style.left = x + "px";
  tip.style.top = y + "px";
}
const hideTip = () => (tip.hidden = true);

/* ---------- Gráfico de barras horizontales reutilizable ---------- */
function barras(container, rows, opts = {}) {
  const node = typeof container === "string" ? $(container) : container;
  const W = Math.max(300, node.clientWidth);
  const narrow = W < 560;
  const rh = narrow ? 38 : 26;
  const labW = narrow ? 0 : Math.min(opts.labW || 260, W * 0.42);
  const valW = 74;
  // Columna opcional a la derecha con la variación frente a otro año.
  const dW = opts.delta ? 70 : 0;
  const max = d3.max(rows, (r) => Math.max(0, r.v)) || 1;
  const min = Math.min(0, d3.min(rows, (r) => r.v) || 0);
  const x = d3.scaleLinear([min, max], [labW, W - valW - dW]);
  const H = rows.length * rh + 4;
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", opts.aria || "");
  const g = svg.selectAll("g").data(rows).join("g")
    .attr("class", (r) => "row" + (opts.onClick ? " click" : "") + (opts.selected && opts.selected === r.key ? " sel" : ""))
    .attr("transform", (r, i) => `translate(0,${i * rh})`);
  const by = narrow ? 18 : 5, bh = narrow ? 14 : 16;
  g.append("text").attr("class", "lbl").attr("x", narrow ? 0 : labW - 8).attr("y", narrow ? 13 : 17)
    .attr("text-anchor", narrow ? "start" : "end")
    .text((r) => trunc(r.label, narrow ? 60 : Math.floor(labW / 6.4)));
  g.append("rect").attr("class", "bar").attr("rx", 2).attr("y", by).attr("height", bh)
    .attr("x", (r) => x(Math.min(0, r.v))).attr("width", (r) => Math.max(1, Math.abs(x(r.v) - x(0))))
    .style("fill", (r) => r.color || (opts.selected === r.key ? css("--sel") : css("--c1")));
  g.append("text").attr("class", "val").attr("y", by + bh - 3)
    .attr("x", (r) => x(Math.max(0, r.v)) + 6).text((r) => (opts.valFmt || nf)(r.v));
  if (opts.delta) {
    g.append("text").attr("class", (r) => { const d = opts.delta(r); return "delta" + (d == null || Math.abs(d) < 0.05 ? "" : d > 0 ? " sube" : " baja"); })
      .attr("y", by + bh - 3).attr("x", W).attr("text-anchor", "end").text((r) => flecha(opts.delta(r)));
  }
  g.append("rect").attr("width", W).attr("height", rh).style("fill", "transparent")
    .on("pointermove pointerdown", (ev, r) => showTip(ev, r.tip || [r.label, nf(r.v) + " M€"]))
    .on("mouseleave", hideTip)
    .on("click", (ev, r) => opts.onClick && opts.onClick(r));
  if (opts.onClick) g.each(function (r) {
    const d = opts.delta ? opts.delta(r) : null;
    pulsable(this, () => opts.onClick(r), `${r.label}: ${(opts.valFmt || nf)(r.v)}${d != null ? `, ${sgn(d)}${opts.deltaTit ? " " + opts.deltaTit : ""}` : ""}`);
  });
  node.replaceChildren(svg.node());
}
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* ---------- Gráfico de líneas por año reutilizable ---------- */
function lineas(container, xs, series, opts = {}) {
  const node = typeof container === "string" ? $(container) : container;
  const W = Math.max(300, node.clientWidth), H = opts.H || 260, m = { t: 10, r: 22, b: 26, l: 58 };
  const x = d3.scalePoint(xs, [m.l, W - m.r]).padding(0.2);
  const vals = series.flatMap((s) => s.vals.filter((v) => v != null));
  const y = d3.scaleLinear().domain([Math.min(0, d3.min(vals) ?? 0), d3.max(vals) || 1]).nice().range([H - m.b, m.t]);
  const big = y.domain()[1] >= 10000;
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", opts.aria || "");
  svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(5)).join("line")
    .attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y).style("stroke", (d) => (d === 0 ? css("--muted") : null));
  svg.append("g").selectAll("text").data(y.ticks(5)).join("text").attr("x", m.l - 6).attr("y", (d) => y(d) + 4)
    .attr("text-anchor", "end").text((d) => (big && d ? fmt0.format(d / 1000) + " mil" : fmt0.format(d)));
  const paso = Math.ceil(xs.length / Math.max(2, Math.floor((W - m.l) / 46)));
  svg.append("g").selectAll("text").data(xs).join("text").attr("x", x).attr("y", H - 6)
    .attr("text-anchor", "middle").text((d, i) => ((xs.length - 1 - i) % paso ? "" : d));
  for (const s of series) {
    const pts = s.vals.map((v, i) => ({ v, x: xs[i] })).filter((d) => d.v != null);
    const line = d3.line().x((d) => x(d.x)).y((d) => y(d.v));
    svg.append("path").attr("d", line(pts)).attr("fill", "none").attr("stroke", s.color)
      .attr("stroke-width", s.dash ? 1.8 : 2.4).attr("stroke-dasharray", s.dash ? "5 4" : null);
    // Los años marcados (presupuestos prorrogados) se dibujan con un círculo hueco.
    const mk = (d) => (opts.marca ? opts.marca(d.x, s) : null);
    svg.append("g").selectAll("circle").data(pts).join("circle").attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.v))
      .attr("r", (d) => (mk(d) ? 4 : 2.6)).attr("fill", (d) => (mk(d) ? css("--bg") : s.color))
      .attr("stroke", s.color).attr("stroke-width", (d) => (mk(d) ? 1.8 : 0));
    svg.append("g").selectAll("circle").data(pts).join("circle").attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.v))
      .attr("r", 10).attr("fill", "transparent")
      .on("pointermove pointerdown", (ev, d) => {
        const i = xs.indexOf(d.x), prev = i > 0 ? s.vals[i - 1] : null;
        showTip(ev, [`${s.name} · ${d.x}`, opts.fmt ? opts.fmt(d.v) : nf(d.v) + " M€",
          ...(prev != null && opts.yoy !== false ? [`${sgn(pct(d.v, prev))} frente a ${xs[i - 1]}`] : []),
          ...(mk(d) ? [mk(d)] : []), ...(s.tip ? s.tip(d.x, d.v) : [])]);
      })
      .on("mouseleave", hideTip);
  }
  node.replaceChildren(svg.node());
}
function leyenda(sel, series) {
  $(sel).replaceChildren(...series.map((s) => el("span", {},
    el("i", { style: s.dash ? `background:none;height:0;border-top:2px dashed ${s.color}` : `background:${s.color}` }), s.name)));
}

/* ---------- Barras horizontales apiladas (una barra por fila, un tramo por clave) ---------- */
function apiladas(container, rows, claves, opts = {}) {
  const node = typeof container === "string" ? $(container) : container;
  const W = Math.max(300, node.clientWidth);
  const narrow = W < 560;
  const rh = narrow ? 38 : 28, labW = narrow ? 0 : Math.min(opts.labW || 250, W * 0.4), valW = 74;
  const max = d3.max(rows, (r) => d3.sum(claves, (c) => Math.max(0, r.parts[c.k] || 0))) || 1;
  const x = d3.scaleLinear([0, max], [labW, W - valW]);
  const H = rows.length * rh + 4, by = narrow ? 18 : 5, bh = narrow ? 14 : 18;
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", opts.aria || "");
  rows.forEach((r, i) => {
    const g = svg.append("g").attr("class", "row").attr("transform", `translate(0,${i * rh})`);
    g.append("text").attr("class", "lbl").attr("x", narrow ? 0 : labW - 8).attr("y", narrow ? 13 : 18)
      .attr("text-anchor", narrow ? "start" : "end").text(trunc(r.label, narrow ? 60 : Math.floor(labW / 6.4)));
    let acc = 0;
    const tot = d3.sum(claves, (c) => Math.max(0, r.parts[c.k] || 0));
    for (const c of claves) {
      const v = Math.max(0, r.parts[c.k] || 0);
      if (!v) continue;
      g.append("rect").attr("class", "bar").attr("y", by).attr("height", bh).attr("x", x(acc))
        .attr("width", Math.max(0.5, x(acc + v) - x(acc))).style("fill", c.color);
      acc += v;
    }
    g.append("text").attr("class", "val").attr("y", by + bh - 4).attr("x", x(acc) + 6).text(nf(tot));
    g.append("rect").attr("width", W).attr("height", rh).style("fill", "transparent")
      .on("pointermove pointerdown", (ev) => showTip(ev, [r.label, `${nf(tot)} M€ en total`,
        ...claves.filter((c) => r.parts[c.k]).map((c) => `${c.name}: ${nf(r.parts[c.k])} M€ (${pf((100 * r.parts[c.k]) / tot)})`)]))
      .on("mouseleave", hideTip);
  });
  node.replaceChildren(svg.node());
}

/* ---------- Estado ---------- */
function partida(anio, bloque, codigo) {
  return anio.partidas.find((p) => p.bloque === bloque && p.codigo === codigo);
}
function totalBloque(anio, bloque) {
  return anio.partidas.find((p) => p.bloque === bloque && p.nivel === 0);
}

function renderEstado(estado) {
  const [act, ant] = estado.anios;
  const n = act.meses.length;
  const mes = act.meses[n - 1];
  $("#estado-periodo").textContent = `· enero–${mes.toLowerCase()} ${act.anio}`;
  const rec = totalBloque(act, "recursos").valores[n - 1];
  const emp = totalBloque(act, "empleos").valores[n - 1];
  const sal = partida(act, "saldos", "B.9").valores[n - 1];
  const recA = ant && totalBloque(ant, "recursos").valores[n - 1];
  const empA = ant && totalBloque(ant, "empleos").valores[n - 1];
  const salA = ant && partida(ant, "saldos", "B.9").valores[n - 1];
  const vr = recA ? (100 * (rec - recA)) / recA : null;
  const ve = empA ? (100 * (emp - empA)) / empA : null;

  $("#lead").textContent =
    `Hasta ${mes.toLowerCase()} de ${act.anio} el Estado ha ingresado ${nf(rec)} millones de euros y ha gastado ${nf(emp)}, ` +
    `con un ${sal < 0 ? "déficit" : "superávit"} de ${nf(Math.abs(sal))} millones` +
    (act.pib ? ` (${fmt1.format((100 * Math.abs(sal)) / act.pib)} % del PIB).` : ".");

  const kpi = (t, v, sub, cls = "") =>
    el("div", { class: "kpi" }, el("h4", {}, t), el("div", { class: "big" }, nf(v)), el("div", { class: "sub " + cls }, sub));
  $("#kpis").replaceChildren(
    kpi("Ingresos acumulados (M€)", rec, ant ? `${sgn(vr)} frente a ${mes.toLowerCase()} ${ant.anio}` : "", vr > 0 ? "inc-good" : "inc-bad"),
    kpi("Gasto acumulado (M€)", emp, ant ? `${sgn(ve)} frente a ${mes.toLowerCase()} ${ant.anio}` : "", "muted"),
    kpi("Saldo (M€)", sal, ant ? `${nf(salA)} M€ en ${mes.toLowerCase()} ${ant.anio}` : "", sal >= (salA ?? sal) ? "inc-good" : "inc-bad")
  );

  // Evolución
  const series = [];
  const add = (anio, bloque, color, dash) =>
    anio && series.push({ name: `${bloque === "recursos" ? "Ingresos" : "Gastos"} ${anio.anio}`, color, dash,
      vals: totalBloque(anio, bloque).valores.map((v, i) => ({ i, v, mes: anio.meses[i] })) });
  add(act, "empleos", css("--c1"), false);
  add(act, "recursos", css("--c2"), false);
  add(ant, "empleos", css("--c1"), true);
  add(ant, "recursos", css("--c2"), true);
  $("#leg-evol").replaceChildren(...series.map((s) => el("span", {}, el("i", { style: s.dash ? `background:none;height:0;border-top:2px dashed ${s.color}` : `background:${s.color}` }), s.name)));
  const draw = () => {
    const node = $("#ch-evol"), W = Math.max(300, node.clientWidth), H = 280, m = { t: 10, r: 14, b: 26, l: 54 };
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const x = d3.scalePoint(d3.range(12), [m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(series, (s) => d3.max(s.vals, (d) => d.v))]).nice().range([H - m.b, m.t]);
    const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`);
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(5)).join("line")
      .attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").selectAll("text").data(y.ticks(5)).join("text").attr("x", m.l - 6).attr("y", (d) => y(d) + 4)
      .attr("text-anchor", "end").text((d) => fmt0.format(d / 1000) + " mil");
    svg.append("g").selectAll("text").data(d3.range(12)).join("text").attr("x", x).attr("y", H - 6)
      .attr("text-anchor", "middle").text((i) => (W < 500 && i % 2 ? "" : meses[i]));
    const line = d3.line().x((d) => x(d.i)).y((d) => y(d.v));
    for (const s of series) {
      svg.append("path").attr("d", line(s.vals.filter((d) => d.v != null))).attr("fill", "none")
        .attr("stroke", s.color).attr("stroke-width", s.dash ? 1.6 : 2.4).attr("stroke-dasharray", s.dash ? "5 4" : null);
      svg.append("g").selectAll("circle").data(s.vals.filter((d) => d.v != null)).join("circle")
        .attr("cx", (d) => x(d.i)).attr("cy", (d) => y(d.v)).attr("r", 9).attr("fill", "transparent")
        .on("pointermove pointerdown", (ev, d) => showTip(ev, [`${s.name} · ${d.mes}`, nf(d.v) + " M€ acumulados"]))
        .on("mouseleave", hideTip);
    }
    node.replaceChildren(svg.node());
  };
  draw();
  onResize(draw);

  // Desglose de gasto e ingresos
  const desglose = (bloque, sel, color) => {
    const rows = act.partidas.filter((p) => p.bloque === bloque && p.nivel === 2 && (p.valores[n - 1] || 0) > 0)
      .map((p) => {
        const v = p.valores[n - 1];
        const prev = ant && ant.partidas.find((q) => q.bloque === bloque && q.codigo === p.codigo);
        const va = prev ? prev.valores[n - 1] : null;
        const label = NOMBRES[bloque][p.codigo] || p.concepto;
        const tipTxt = [label, `${nf(v)} M€ hasta ${mes.toLowerCase()}`, `${p.codigo} · ${p.concepto}`];
        if (va) tipTxt.push(`${nf(va)} M€ hasta ${mes.toLowerCase()} de ${ant.anio} (${sgn(pct(v, va))})`);
        return { key: p.codigo, label, v, va, tip: tipTxt, color };
      })
      .sort((a, b) => b.v - a.v);
    const top = rows.slice(0, 10);
    const resto = rows.slice(10);
    if (resto.length) {
      const v = d3.sum(resto, (r) => r.v), va = d3.sum(resto, (r) => r.va || 0);
      top.push({ key: "resto", label: `Resto (${resto.length} partidas)`, v, va: va || null, color: css("--c6"),
        tip: ["Resto", ...resto.map((r) => `${r.label}: ${nf(r.v)}`)] });
    }
    const d = () => barras(sel, top, { aria: `${bloque} del Estado por partida`, labW: 230,
      delta: ant ? (r) => pct(r.v, r.va) : null, deltaTit: ant ? `frente a ${ant.anio}` : "" });
    d();
    onResize(d);
  };
  desglose("empleos", "#ch-empleos", css("--c1"));
  desglose("recursos", "#ch-recursos", css("--c2"));

  // Serie anual: años cerrados (12 meses publicados).
  const cerrados = estado.anios.filter((a) => a.meses.length === 12).sort((a, b) => a.anio - b.anio);
  if (cerrados.length > 1) {
    const xs = cerrados.map((a) => String(a.anio));
    const pib = (a, v) => (a.pib ? [`${fmt1.format((100 * v) / a.pib)} % del PIB`] : []);
    const byYear = Object.fromEntries(cerrados.map((a) => [String(a.anio), a]));
    const series = [
      { name: "Gastos", color: css("--c1"), vals: cerrados.map((a) => totalBloque(a, "empleos").valores[11]) },
      { name: "Ingresos", color: css("--c2"), vals: cerrados.map((a) => totalBloque(a, "recursos").valores[11]) },
      { name: "Saldo (déficit si es negativo)", color: css("--c5"), dash: true, vals: cerrados.map((a) => (partida(a, "saldos", "B.9") || { valores: [] }).valores[11]) },
    ].map((s) => ({ ...s, tip: (x, v) => pib(byYear[x], v) }));
    $("#estado-anual-tit").textContent = `Año a año: ${xs[0]}–${xs[xs.length - 1]}`;
    leyenda("#leg-anual", series);
    const d = () => lineas("#ch-anual", xs, series, { aria: "Ingresos, gastos y saldo anuales del Estado" });
    d();
    onResize(d);
  } else {
    $("#estado-anual").hidden = true;
  }
}

/* ---------- PGE ---------- */
/* Año en que rige cada columna de la SEPG («2025-P» rige en 2026), calculado por la herramienta de datos. */
function pgeAnios(pge) {
  return pge.ejercicios.map((e) => ({ col: e.columna, anio: e.anio, prorr: e.prorrogado, base: e.base }));
}
const pgeEtq = (a) => (a.prorr ? `${a.anio} (prorrogado de ${a.base})` : String(a.anio));
const PRORR_TXT = (a) => `Presupuesto prorrogado: siguen en vigor los de ${a.base}`;

function renderPge(pge, cofog, entregas) {
  const A = pgeAnios(pge);
  // Por defecto se compara con el último año que tuvo un presupuesto distinto (no otra prórroga del mismo).
  const origen = (q) => (q.prorr ? q.base : q.anio);
  const ibDefecto = (k) => { for (let j = k - 1; j >= 0; j--) if (origen(A[j]) !== origen(A[k])) return j; return k - 1; };
  let i = A.length - 1, ib = ibDefecto(i); // ejercicio elegido y ejercicio con el que se compara
  const selCol = $("#sel-pge"), selBase = $("#sel-pge-base"), selVar = $("#sel-pge-var");
  selCol.replaceChildren(...A.map((a, k) => new Option(pgeEtq(a), k)).reverse());
  selCol.value = i;
  const llenarBase = () => {
    selBase.replaceChildren(...A.slice(0, i).map((a, k) => new Option(pgeEtq(a), k)).reverse());
    if (ib >= i || ib < 0) ib = i - 1;
    selBase.disabled = i === 0;
    if (ib >= 0) selBase.value = ib;
  };
  llenarBase();
  selCol.onchange = () => { i = +selCol.value; ib = ibDefecto(i); llenarBase(); all(); };
  selBase.onchange = () => { ib = +selBase.value; all(); };
  selVar.onchange = () => drawVar();
  const col = () => A[i].col;
  const colB = () => (ib >= 0 ? A[ib].col : null);
  const total = (c) => (pge.total ? pge.total[c] : d3.sum(pge.politicas, (p) => p.valores[c]));
  const marca = (x) => { const a = A.find((q) => String(q.anio) === x); return a && a.prorr ? PRORR_TXT(a) : null; };
  const xs = A.map((a) => String(a.anio));
  let sel = null;
  let rows = [];
  const pol = (cod) => pge.politicas.find((p) => p.codigo === cod);

  function nota() {
    const a = A[i], b = ib >= 0 ? A[ib] : null;
    $("#pge-etq").replaceChildren(`· ${a.anio}`, a.prorr ? tag("prorrogado", PRORR_TXT(a)) : "");
    $("#pge-nota").replaceChildren(
      `Créditos iniciales de los Presupuestos Generales del Estado consolidados (capítulos 1 a 8) para ${a.anio}` +
      (a.prorr ? `. No se aprobaron presupuestos nuevos: siguen en vigor los de ${a.base}, prorrogados (la SEPG los publica como «${a.col}»)` : "") +
      (i === A.length - 1 ? ". Es el presupuesto en vigor" : "") + `. Total: `,
      el("strong", {}, `${nf(total(a.col))} M€`),
      b ? `, ${sgn(pct(total(a.col), total(b.col)))} frente a ${b.anio}.` : ".",
      " A la derecha de cada barra, la variación frente al ejercicio elegido en «Comparar con». Pulsa una política para ver sus programas y su evolución."
    );
  }

  // Aviso: Sanidad y Educación «parecen» pequeñas porque las gestionan las comunidades.
  function aviso() {
    const box = $("#pge-aviso");
    const reg = cofog && cofog.subsectores.regional;
    const cen = cofog && cofog.subsectores.central;
    if (!reg || !cen) { box.hidden = true; return; }
    const ur = reg[reg.length - 1], uc = cen.find((a) => a.anio === ur.anio) || cen[cen.length - 1];
    const v = (c) => (pol(c) || { valores: {} }).valores[col()];
    const ea = entregas && entregas.anios.find((a) => a.anio === A[i].anio);
    const cedidos = ea ? d3.sum(ea.filas, (f) => (f.irpf || 0) + (f.iva || 0) + (f.impuestos_especiales || 0)) : null;
    const p = (...kids) => el("p", {}, ...kids);
    const b = (t) => el("strong", {}, t);
    box.hidden = false;
    box.replaceChildren(
      el("h4", {}, "¿Por qué Sanidad y Educación parecen tan pequeñas?"),
      p(`En estos Presupuestos del Estado, Sanidad suma `, b(`${nf(v("31"))} M€`), ` y Educación `, b(`${nf(v("32"))} M€`),
        `. No es lo que España gasta en ellas: desde principios de los 2000 las gestionan las comunidades autónomas, y su gasto no aparece en esta lista.`),
      p(`En ${ur.anio}${ur.provisional ? " (dato provisional)" : ""}, las comunidades gastaron `, b(`${nf(ur.divisiones["07"])} M€ en sanidad`), ` y `,
        b(`${nf(ur.divisiones["09"])} M€ en educación`), `; el Estado, ${nf(uc.divisiones["07"])} y ${nf(uc.divisiones["09"])} M€ (gasto ejecutado según la IGAE).`),
      p(`El Estado contribuye a pagarlo de dos formas: con la política «Transferencias a otras Administraciones Públicas» (${nf(v("94"))} M€, que incluye los fondos de financiación autonómica y la participación de los ayuntamientos)`,
        cedidos ? `, y sobre todo cediendo a las comunidades una parte del IRPF, el IVA y los impuestos especiales (${nf(cedidos)} M€ en entregas a cuenta en ${ea.anio}), que ni siquiera figura como gasto del Estado.` : ", y cediéndoles una parte del IRPF, el IVA y los impuestos especiales, que no figura como gasto del Estado."),
      el("p", { class: "note" }, el("a", { href: "quien-gasta.html" }, "Ver quién gasta en cada función →"))
    );
  }

  function draw() {
    const c = col(), cb = colB(), b = ib >= 0 ? A[ib] : null;
    rows = pge.politicas.map((p) => ({
      key: p.codigo, label: p.politica, v: p.valores[c] || 0, vb: cb ? p.valores[cb] : null, p,
      tip: [p.politica, `${nf(p.valores[c])} M€ en ${A[i].anio}`, b ? `${nf(p.valores[cb])} M€ en ${b.anio} (${sgn(pct(p.valores[c], p.valores[cb]))})` : "", `${p.programas.length} programas`].filter(Boolean),
    })).sort((x, y) => y.v - x.v);
    barras("#ch-pge", rows, { aria: "Presupuesto por política de gasto", selected: sel, delta: b ? (r) => pct(r.v, r.vb) : null, deltaTit: b ? `frente a ${b.anio}` : "",
      onClick: (r) => { sel = sel === r.key ? null : r.key; draw(); detalle(); } });
  }

  function detalle() {
    const box = $("#pge-detalle");
    const r = rows.find((x) => x.key === sel);
    if (!r) { box.hidden = true; return; }
    box.hidden = false;
    const c = col(), cb = colB(), a = A[i], b = ib >= 0 ? A[ib] : null;
    const progs = r.p.programas.filter((g) => g.valores[c] || (cb && g.valores[cb])).sort((x, y) => (y.valores[c] || 0) - (x.valores[c] || 0));
    const tb = el("tbody");
    progs.forEach((g) => tb.append(el("tr", {}, el("td", {}, g.codigo), el("td", {}, g.programa),
      el("td", { class: "num" }, nf(g.valores[c])), el("td", { class: "num" }, pf((100 * (g.valores[c] || 0)) / r.v)),
      ...(b ? [el("td", { class: "num" }, nf(g.valores[cb])), el("td", { class: "num" }, g.valores[c] && g.valores[cb] ? sgn(pct(g.valores[c], g.valores[cb])) : g.valores[c] ? "nuevo" : "desaparece")] : []))));
    const evol = el("div", { class: "chart" });
    const v0 = r.p.valores[A[0].col];
    box.replaceChildren(
      el("h4", {}, `${r.p.codigo} · ${r.label}: ${nf(r.v)} M€ en ${a.anio}`),
      el("p", {}, b ? `Frente a ${b.anio}: ${sgn(pct(r.v, r.vb))} (${nfs(r.v - (r.vb || 0))} M€). ` : "",
        v0 ? `Desde ${A[0].anio}: ${sgn(pct(r.v, v0))}.` : ""),
      el("p", { class: "note" }, `Evolución ${xs[0]}–${xs[xs.length - 1]} en créditos iniciales. Los círculos huecos son años con presupuesto prorrogado.`),
      evol,
      el("div", { class: "scroll" }, el("table", { class: "tbl" }, el("thead", {}, el("tr", {}, el("th", {}, "Programa"), el("th", {}, "Nombre"),
        el("th", { class: "num" }, `M€ ${a.anio}`), el("th", { class: "num" }, "% de la política"),
        ...(b ? [el("th", { class: "num" }, `M€ ${b.anio}`), el("th", { class: "num" }, "Variación")] : []))), tb))
    );
    lineas(evol, xs, [{ name: r.label, color: css("--c1"), vals: A.map((q) => r.p.valores[q.col]) }], { H: 200, aria: `Evolución de ${r.label}`, marca });
  }

  // Tendencia: total y qué políticas suben o bajan frente al ejercicio de comparación.
  function drawTotal() {
    lineas("#ch-pge-total", xs, [{ name: "Presupuesto total consolidado", color: css("--c1"), vals: A.map((a) => total(a.col)) }],
      { H: 220, aria: "Evolución del presupuesto total del Estado", marca });
  }
  function drawVar() {
    const box = $("#pge-var-nota");
    if (ib < 0) { $("#ch-pge-var").replaceChildren(); box.textContent = "No hay un ejercicio anterior con el que comparar."; return; }
    const a = A[i], b = A[ib], c = a.col, cb = b.col, enPct = selVar.value === "pct";
    const tot = total(c);
    // Se omiten las políticas muy pequeñas: un cambio de pocos millones daría porcentajes enormes.
    const vr = pge.politicas.filter((p) => Math.max(p.valores[c] || 0, p.valores[cb] || 0) >= tot * 0.005).map((p) => {
      const v = p.valores[c] || 0, vb = p.valores[cb] || 0, d = enPct ? pct(v, vb) : v - vb;
      return { key: p.codigo, label: p.politica, v: d, color: css(d >= 0 ? "--c2" : "--c1"),
        tip: [p.politica, `${nf(v)} M€ en ${a.anio}`, `${nf(vb)} M€ en ${b.anio}`, `${nfs(v - vb)} M€ (${sgn(pct(v, vb))})`] };
    }).filter((r) => r.v != null).sort((x, y) => y.v - x.v);
    const mismaBase = a.prorr && (b.prorr ? b.base === a.base : b.anio === a.base);
    box.textContent = `${a.anio} frente a ${b.anio}, en ${enPct ? "porcentaje" : "millones de euros"}. ` +
      (a.prorr && ib === ibDefecto(i) && ib < i - 1 ? `${b.anio} es el último año con un presupuesto distinto del vigente en ${a.anio}. ` : "") +
      (mismaBase ? `Los dos ejercicios corresponden al mismo presupuesto (${a.base}, prorrogado): las diferencias son solo ajustes técnicos de la prórroga. ` : "") +
      "Euros corrientes, sin descontar la inflación. Se omiten las políticas de menos del 0,5 % del presupuesto.";
    barras("#ch-pge-var", vr, { aria: `Variación de cada política entre ${b.anio} y ${a.anio}`, labW: 260, valFmt: enPct ? sgn : (v) => nfs(v) + " M€" });
  }
  function all() { nota(); aviso(); draw(); detalle(); drawTotal(); drawVar(); }
  all();
  onResize(() => { draw(); detalle(); drawTotal(); drawVar(); });
}

/* ---------- ¿Quién gasta en cada función? (COFOG) ---------- */
const SUBSECTORES = [
  { k: "central", name: "Estado y organismos centrales", color: "--c1" },
  { k: "regional", name: "Comunidades autónomas", color: "--c3" },
  { k: "local", name: "Ayuntamientos, diputaciones…", color: "--c2" },
  { k: "seguridad_social", name: "Seguridad Social", color: "--c4" },
];
function renderFunciones(cofog) {
  const subs = SUBSECTORES.filter((s) => cofog.subsectores[s.k]).map((s) => ({ ...s, color: css(s.color) }));
  const reg = cofog.subsectores.regional;
  const anios = reg.map((a) => a.anio);
  let anio = anios[anios.length - 1];
  const selA = $("#sel-fun-anio");
  selA.replaceChildren(...[...anios].reverse().map((a) => new Option(a, a)));
  selA.onchange = () => { anio = +selA.value; draw(); };
  const de = (k, y) => (cofog.subsectores[k] || []).find((a) => a.anio === y);

  function draw() {
    const fila = Object.fromEntries(subs.map((s) => [s.k, de(s.k, anio)]));
    const r = fila.regional;
    $("#fun-tit-anio").textContent = `· ${anio}${r && r.provisional ? " (provisional)" : ""}`;
    // Cuota de cada función que ejecutan las comunidades (sin contar transferencias entre administraciones).
    const cuota = (div) => {
      const tot = d3.sum(subs, (s) => (fila[s.k] ? fila[s.k].divisiones[div] || 0 : 0));
      return tot ? (100 * (r.divisiones[div] || 0)) / tot : null;
    };
    const kpi = (t, v, sub) => el("div", { class: "kpi" }, el("h4", {}, t), el("div", { class: "big" }, pf(v)), el("div", { class: "sub" }, sub));
    const sp = r.divisiones["07"] + r.divisiones["09"] + r.divisiones["10"];
    $("#fun-kpis").replaceChildren(
      kpi("Gasto público en sanidad que hacen las comunidades", cuota("07"), `${nf(r.divisiones["07"])} M€ en ${anio}`),
      kpi("Gasto público en educación que hacen las comunidades", cuota("09"), `${nf(r.divisiones["09"])} M€ en ${anio}`),
      kpi("Gasto de las comunidades que va a sanidad, educación y protección social", (100 * sp) / r.total, `${nf(sp)} de ${nf(r.total)} M€`),
    );
    const rows = Object.entries(cofog.divisiones).map(([div, nombre]) => {
      const parts = {};
      for (const s of subs) {
        const f = fila[s.k];
        if (!f) continue;
        parts[s.k] = (f.divisiones[div] || 0) - (div === "01" ? f.transferencias_aapp || 0 : 0);
      }
      return { label: div === "01" ? "Servicios generales (sin transferencias)" : nombre, parts };
    });
    rows.push({ label: "Transferencias a otras administraciones", parts: Object.fromEntries(subs.map((s) => [s.k, fila[s.k] ? fila[s.k].transferencias_aapp || 0 : 0])) });
    rows.sort((a, b) => d3.sum(Object.values(b.parts)) - d3.sum(Object.values(a.parts)));
    leyenda("#leg-fun", subs);
    apiladas("#ch-fun", rows, subs, { aria: `Gasto público por función y administración en ${anio}`, labW: 270 });
  }

  // Evolución del gasto de las comunidades en servicios básicos frente al del Estado.
  const xs = anios.map(String);
  const cen = cofog.subsectores.central;
  const serie = (arr, divs) => anios.map((y) => { const a = arr.find((q) => q.anio === y); return a ? d3.sum(divs, (d) => a.divisiones[d] || 0) : null; });
  const series = [
    { name: "Comunidades: sanidad", color: css("--c3"), vals: serie(reg, ["07"]) },
    { name: "Comunidades: educación", color: css("--c1"), vals: serie(reg, ["09"]) },
    { name: "Comunidades: protección social", color: css("--c4"), vals: serie(reg, ["10"]) },
    { name: "Estado: sanidad + educación", color: css("--c5"), dash: true, vals: serie(cen, ["07", "09"]) },
    { name: "Estado: transferencias a otras administraciones", color: css("--c6"), dash: true, vals: anios.map((y) => (cen.find((q) => q.anio === y) || {}).transferencias_aapp ?? null) },
  ];
  leyenda("#leg-fun-evol", series);
  const ev = () => lineas("#ch-fun-evol", xs, series, { aria: "Evolución del gasto en sanidad, educación y protección social", H: 300 });
  draw();
  ev();
  onResize(() => { draw(); ev(); });
}

/* ---------- Comunidades ---------- */
/* Sanidad (31), educación (32) y servicios sociales (23) en el presupuesto de una comunidad. */
const SPF = [["31", "sanidad"], ["32", "educación"], ["23", "servicios sociales"]];
const polImporte = (c, cod) => (c.politicas.find((p) => p.codigo === cod) || {}).importe || 0;
const spfDe = (c) => d3.sum(SPF, ([cod]) => polImporte(c, cod));

/* Presupuestos autonómicos prorrogados: los detecta la herramienta de datos (ccaa.json → prorrogados). */
const prorrTxt = (pr, y) => "Presupuesto prorrogado: " +
  (pr.iguales === pr.politicas ? `idéntico al de ${y - 1}` : pr.iguales >= 5 ? `repite al céntimo ${pr.iguales} de sus ${pr.politicas} políticas del de ${y - 1}` : `mismo total que en ${y - 1}`) +
  (pr.base < y - 1 ? `; sin presupuesto nuevo desde ${pr.base}` : "") + ".";

function renderCcaa(entregas, ccaa, cofog, pob) {
  // Población a 1 de enero del año (o la última publicada antes).
  const hab = (com, y) => {
    const t = pob && pob.territorios[com];
    if (!t) return null;
    const ys = Object.keys(t).map(Number).filter((x) => x <= y).sort((a, b) => b - a);
    return ys.length ? t[ys[0]] : null;
  };
  const porHab = (meur, com, y) => { const h = hab(com, y); return h && meur != null ? (meur * 1e6) / h : null; };
  const ef = (v) => (v == null || isNaN(v) ? "—" : fmt0.format(v) + " €");
  const ph = () => pob && $("#sel-modo").value === "ph";
  if (!pob) $("#sel-modo").closest("label").hidden = true;
  $("#sel-modo").onchange = () => all();
  const prorr = (com, y) => ((ccaa.prorrogados || {})[com] || {})[y] || null;
  const anios = ccaa.anios.map((a) => a.anio).sort((a, b) => b - a);
  const state = {
    ea: entregas.anios[0].anio,
    anio: anios[0],
    base: anios[1] ?? null,
    com: decodeURIComponent((location.hash.match(/ccaa=([^&]+)/) || [])[1] || "Andalucía"),
    sortK: "total", sortDir: -1,
    pol: "31",
    abiertos: new Set(),
  };
  const eaAnio = () => entregas.anios.find((a) => a.anio === state.ea);
  const caDe = (y) => ccaa.anios.find((a) => a.anio === y);
  const caAnio = () => caDe(state.anio);
  const comDe = (y, com) => { const a = caDe(y); return a && a.comunidades.find((c) => c.comunidad === com); };
  const polDe = (c, cod) => (c ? (c.politicas.find((p) => p.codigo === cod) || {}).importe ?? null : null);

  const selEa = $("#sel-ea"), selC = $("#sel-ccaa"), selA = $("#sel-ccaa-anio"), selB = $("#sel-ccaa-base"), selV = $("#sel-ccaa-var");
  selEa.replaceChildren(...entregas.anios.map((a) => new Option(a.anio, a.anio)));
  const llenarBase = () => {
    selB.replaceChildren(...anios.filter((y) => y < state.anio).map((y) => new Option(y, y)));
    if (state.base == null || state.base >= state.anio) state.base = anios.find((y) => y < state.anio) ?? null;
    selB.disabled = state.base == null;
    if (state.base != null) selB.value = state.base;
  };
  // Las opciones de año indican si el presupuesto de la comunidad elegida está prorrogado.
  const llenarAnios = () => {
    selA.replaceChildren(...anios.map((y) => new Option(prorr(state.com, y) ? `${y} (prorrogado)` : String(y), y)));
    selA.value = state.anio;
  };
  const nombres = [...new Set([...ccaa.anios[0].comunidades.map((c) => c.comunidad), ...entregas.anios[0].filas.map((f) => f.comunidad)])].sort((a, b) => a.localeCompare(b, "es"));
  selC.replaceChildren(...nombres.map((n) => new Option(n, n)));
  selEa.onchange = () => { state.ea = +selEa.value; all(); };
  selA.onchange = () => { state.anio = +selA.value; state.base = null; llenarBase(); all(); };
  selB.onchange = () => { state.base = +selB.value; all(); };
  selV.onchange = () => drawVar();
  selC.onchange = () => setCom(selC.value);
  llenarBase();

  function setCom(c) {
    state.com = c;
    history.replaceState(null, "", "#ccaa=" + encodeURIComponent(c));
    all();
  }

  function drawEa() {
    const a = eaAnio();
    const prevEa = entregas.anios.find((q) => q.anio === a.anio - 1);
    const tot = d3.sum(a.filas, (f) => f.total);
    $("#ea-total").textContent = `Total ${a.anio}: ${nf(tot)} M€` + (prevEa ? ` (${sgn(pct(tot, d3.sum(prevEa.filas, (f) => f.total)))} frente a ${prevEa.anio})` : "") + (a.norma ? " · " + a.norma : "");
    // Conjunto de comunidades de régimen común: lo que reciben frente a lo que presupuestan en servicios básicos.
    const pres = caDe(a.anio);
    const comunes = pres ? pres.comunidades.filter((c) => !c.foral && a.filas.some((f) => f.comunidad === c.comunidad)) : [];
    const box = $("#ea-destino");
    if (comunes.length) {
      const recibe = d3.sum(comunes, (c) => a.filas.find((f) => f.comunidad === c.comunidad).total);
      const spf = d3.sum(comunes, spfDe), presu = d3.sum(comunes, (c) => c.total);
      box.hidden = false;
      box.replaceChildren(
        el("h4", {}, `¿Adónde va este dinero? · ${a.anio}`),
        el("p", {}, `Las ${comunes.length} comunidades de régimen común reciben `, el("strong", {}, `${nf(recibe)} M€`),
          ` en entregas a cuenta y presupuestan `, el("strong", {}, `${nf(spf)} M€ para sanidad, educación y servicios sociales`),
          `: el ${pf((100 * spf) / presu)} de sus presupuestos. Lo que reciben del sistema equivale al `, el("strong", {}, pf((100 * recibe) / spf)), ` de ese gasto.`),
        el("p", { class: "note" }, "La financiación autonómica no es finalista: la ley no obliga a dedicar cada euro a una política concreta, y cada parlamento autonómico decide su presupuesto. " +
          "Pero el sistema se calcula para cubrir los servicios públicos fundamentales, y la sanidad, la educación y los servicios sociales son, con diferencia, el mayor gasto de las comunidades.")
      );
    } else {
      box.hidden = true;
    }
    const habComun = d3.sum(a.filas, (f) => hab(f.comunidad, a.anio) || 0);
    if (habComun) $("#ea-total").textContent += ` · ${ef((tot * 1e6) / habComun)} por habitante de media`;
    const val = (f, y) => (f ? (ph() ? porHab(f.total, f.comunidad, y) : f.total) : null);
    const rows = a.filas.map((f) => {
      const fp = prevEa && prevEa.filas.find((q) => q.comunidad === f.comunidad);
      return {
        key: f.comunidad, label: f.comunidad, v: val(f, a.anio), vb: val(fp, a.anio - 1),
        tip: [f.comunidad, `${nf(f.total)} M€ en ${a.anio}`, fp ? `${nf(fp.total)} M€ en ${prevEa.anio} (${sgn(pct(f.total, fp.total))})` : "", `${ef(porHab(f.total, f.comunidad, a.anio))} por habitante`,
          `IRPF ${nf(f.irpf)} · IVA ${nf(f.iva)} · II.EE. ${nf(f.impuestos_especiales)}`,
          `F. Suficiencia ${nf(f.fondo_suficiencia)} · F. Garantía ${nf(f.fondo_garantia)}`, "Pulsa para ver su gasto"].filter(Boolean),
      };
    }).filter((r) => r.v != null).sort((x, y) => y.v - x.v);
    barras("#ch-ea", rows, { aria: "Entregas a cuenta por comunidad", selected: state.com, labW: 170, valFmt: ph() ? ef : nf, onClick: (r) => setCom(r.key),
      delta: prevEa ? (r) => pct(r.v, r.vb) : null, deltaTit: prevEa ? `frente a ${prevEa.anio}` : "" });
  }

  function drawDetalle() {
    const a = caAnio();
    const c = a.comunidades.find((x) => x.comunidad === state.com);
    const cb = state.base != null ? comDe(state.base, state.com) : null;
    const ea = eaAnio().filas.find((f) => f.comunidad === state.com);
    selC.value = state.com;
    llenarAnios();
    const pr = prorr(state.com, a.anio);
    $("#ccaa-tit").textContent = `¿En qué gasta ${state.com}?`;
    const res = $("#ccaa-resumen");
    if (c) {
      const pol = (cod) => polImporte(c, cod);
      const peso = ea ? (100 * ea.total) / c.total : null;
      // Para comparar lo que recibe con lo que gasta, se usa el presupuesto del mismo año que las entregas.
      const cMismo = comDe(state.ea, state.com);
      const spf = cMismo ? spfDe(cMismo) : null;
      const phc = (v) => ef(porHab(v, state.com, a.anio));
      res.replaceChildren(
        el("h4", {}, `Presupuesto ${a.anio}`, pr ? tag("prorrogado", prorrTxt(pr, a.anio)) : ""),
        el("div", { class: "big kpi-num" }, nf(c.total) + " M€"),
        cb ? el("p", { class: "sub" }, `${sgn(pct(c.total, cb.total))} frente a ${state.base} (${nfs(c.total - cb.total)} M€)` +
          (prorr(state.com, state.base) ? `; el de ${state.base} también estaba prorrogado` : "")) : "",
        pr ? el("p", { class: "note" }, prorrTxt(pr, a.anio)) : "",
        pob ? el("p", {}, el("strong", {}, `${phc(c.total)} por habitante`), ` · Sanidad ${phc(pol("31"))} · Educación ${phc(pol("32"))} · Servicios sociales ${phc(pol("23"))}`) : "",
        el("p", {}, `Sanidad ${pf((100 * pol("31")) / c.total)} · Educación ${pf((100 * pol("32")) / c.total)} · Servicios sociales ${pf((100 * pol("23")) / c.total)} · Deuda ${pf((100 * pol("95")) / c.total)}`),
        ea && spf ? el("p", {}, `En ${state.ea} recibe `, el("strong", {}, `${nf(ea.total)} M€`), ` en entregas a cuenta y presupuesta `,
          el("strong", {}, `${nf(spf)} M€`), ` para sanidad, educación y servicios sociales: lo que recibe equivale al `, el("strong", {}, pf((100 * ea.total) / spf)), ` de ese gasto.`) : "",
        el("p", { class: "note" }, c.foral ? "Régimen foral: recauda sus propios impuestos y paga al Estado un cupo o aportación." :
          peso != null ? `Las entregas a cuenta de ${state.ea} equivalen al ${pf(peso)} de este presupuesto.` : "")
      );
    } else {
      res.replaceChildren(el("p", { class: "note" }, `Hacienda no publica el presupuesto por políticas de ${state.com} para ${a.anio}.`));
    }
    const box = $("#ccaa-ea");
    if (ea) {
      const tb = el("tbody");
      [["Tramo autonómico del IRPF", "irpf"], ["IVA cedido", "iva"], ["Impuestos especiales", "impuestos_especiales"],
        ["Fondo de Suficiencia Global", "fondo_suficiencia"], ["Fondo de Garantía", "fondo_garantia"], ["Total", "total"]]
        .forEach(([l, k]) => tb.append(el("tr", { class: k === "total" ? "tot" : "" }, el("td", {}, l), el("td", { class: "num" }, nf(ea[k]) + " M€"))));
      box.replaceChildren(el("h4", {}, `Entregas a cuenta ${state.ea}`), el("table", { class: "tbl" }, tb),
        el("p", { class: "note" }, "Un fondo negativo significa que la comunidad aporta a ese fondo en lugar de recibir."));
    } else {
      box.replaceChildren(el("h4", {}, "Entregas a cuenta"), el("p", { class: "note" }, `${state.com} no recibe entregas a cuenta del sistema común (régimen foral).`));
    }
    if (!c) { $("#ch-ccaa").replaceChildren(); $("#ccaa-pol").hidden = true; $("#ccaa-econ").hidden = true; $("#ccaa-var").hidden = true; return; }
    const areas = [...new Set(c.politicas.map((p) => p.area))];
    const colores = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6"].map(css);
    $("#ccaa-pol-nota").textContent = "Pulsa una política para ver en qué se gasta: por tipo de gasto, su evolución y su peso en cada comunidad." +
      (cb ? ` A la derecha, la variación frente a ${state.base}.` : "");
    const rows = c.politicas.filter((p) => p.importe > 0).map((p) => {
      const vb = polDe(cb, p.codigo);
      return {
        key: p.codigo, label: p.politica, v: p.importe, vb, color: p.codigo === state.pol ? css("--sel") : colores[areas.indexOf(p.area) % colores.length],
        tip: [p.politica, `${nf(p.importe)} M€ · ${pf((100 * p.importe) / c.total)} del presupuesto`, cb ? `${nf(vb)} M€ en ${state.base} (${sgn(pct(p.importe, vb))})` : "", p.area, "Pulsa para ver en qué se gasta"].filter(Boolean),
      };
    }).sort((x, y) => y.v - x.v);
    if (!rows.some((r) => r.key === state.pol)) state.pol = rows[0].key;
    barras("#ch-ccaa", rows, { aria: `Presupuesto de ${state.com} por política`, labW: 300, selected: state.pol,
      delta: cb ? (r) => pct(r.v, r.vb) : null, deltaTit: cb ? `frente a ${state.base}` : "",
      onClick: (r) => { state.pol = r.key; drawDetalle(); $("#ccaa-pol").scrollIntoView({ behavior: "smooth", block: "nearest" }); } });
    drawPolitica(a, c, cb);
    drawEconomica(a, c, cb);
    drawVar();
  }

  // Detalle de una política: capítulos, evolución y comparación con las demás comunidades.
  function drawPolitica(a, c, cb) {
    const box = $("#ccaa-pol");
    const p = c.politicas.find((x) => x.codigo === state.pol);
    if (!p) { box.hidden = true; return; }
    box.hidden = false;
    const caps = ccaa.capitulos || [];
    const capChart = el("div", { class: "chart" }), evol = el("div", { class: "chart" }), rank = el("div", { class: "chart" });
    const pb = cb && cb.politicas.find((x) => x.codigo === state.pol);
    const capRows = p.capitulos ? caps.map((nombre, i) => ({ key: String(i + 1), label: `${i + 1}. ${nombre}`, v: p.capitulos[i] || 0,
      vb: pb && pb.capitulos ? pb.capitulos[i] || 0 : null,
      tip: [nombre, `${nf(p.capitulos[i])} M€ · ${pf((100 * (p.capitulos[i] || 0)) / p.importe)} de ${p.politica.toLowerCase()}`,
        ...(pb && pb.capitulos ? [`${nf(pb.capitulos[i])} M€ en ${state.base}`] : [])] }))
      .filter((r) => r.v) : [];
    const principales = [...capRows].sort((x, y) => y.v - x.v).slice(0, 3).map((r) => `${pf((100 * r.v) / p.importe)} ${r.label.replace(/^\d\. /, "").toLowerCase()}`);
    const ys = [...anios].sort((x, y) => x - y);
    const serie = ys.map((y) => polDe(comDe(y, state.com), state.pol));
    const v0 = serie.find((v) => v != null), y0 = ys[serie.findIndex((v) => v != null)];
    const pesos = a.comunidades.map((cc) => { const pp = cc.politicas.find((q) => q.codigo === state.pol); const imp = pp ? pp.importe : 0;
      const prc = prorr(cc.comunidad, a.anio);
      return { key: cc.comunidad, label: cc.comunidad + (prc ? " (prorrogado)" : ""), v: ph() ? porHab(imp, cc.comunidad, a.anio) : (100 * imp) / cc.total,
        tip: [cc.comunidad, `${nf(imp)} M€ · ${pf((100 * imp) / cc.total)} de su presupuesto`, `${ef(porHab(imp, cc.comunidad, a.anio))} por habitante`, ...(prc ? [prorrTxt(prc, a.anio)] : [])] }; })
      .filter((r) => r.v != null).sort((x, y) => y.v - x.v);
    box.replaceChildren(
      el("h4", {}, `${p.politica} en ${state.com} · ${a.anio}: ${nf(p.importe)} M€ (${pf((100 * p.importe) / c.total)} del presupuesto` +
        (pob ? `, ${ef(porHab(p.importe, state.com, a.anio))} por habitante)` : ")")),
      el("p", {}, pb ? `Frente a ${state.base}: ${sgn(pct(p.importe, pb.importe))} (${nfs(p.importe - pb.importe)} M€). ` : "",
        v0 && y0 < a.anio ? `Desde ${y0}: ${sgn(pct(p.importe, v0))}. ` : "",
        principales.length ? `Se reparte así: ${principales.join(", ")}.` : ""),
      el("div", { class: "cols" },
        el("div", {}, el("h5", {}, "Por tipo de gasto (capítulos)"), capChart),
        el("div", {}, el("h5", {}, `Evolución ${ys[0]}–${ys[ys.length - 1]} (${ph() ? "€ por habitante" : "M€"})`), evol,
          el("p", { class: "note" }, el("span", { class: "hueco", "aria-hidden": "true" }), "Año con el presupuesto prorrogado."))),
      el("h5", {}, ph() ? `${p.politica} por habitante en cada comunidad · ${a.anio}` : `Peso de ${p.politica.toLowerCase()} en el presupuesto de cada comunidad · ${a.anio}`),
      rank
    );
    if (capRows.length) barras(capChart, capRows, { aria: `Capítulos de ${p.politica}`, labW: 220, delta: pb && pb.capitulos ? (r) => pct(r.v, r.vb) : null, deltaTit: `frente a ${state.base}` });
    else capChart.replaceChildren(el("p", { class: "note" }, "Sin desglose por capítulos para este año."));
    const serieV = ph() ? serie.map((v, i) => porHab(v, state.com, ys[i])) : serie;
    lineas(evol, ys.map(String), [{ name: p.politica, color: css("--c1"), vals: serieV }], { H: 200, aria: `Evolución de ${p.politica} en ${state.com}`,
      fmt: ph() ? (v) => ef(v) + " por habitante" : undefined,
      marca: (x) => { const q = prorr(state.com, +x); return q ? prorrTxt(q, +x) : null; } });
    barras(rank, pesos, { aria: `${p.politica} por comunidad`, labW: 190, selected: state.com, valFmt: ph() ? ef : pf, onClick: (r) => setCom(r.key) });
  }

  // Desglose económico: capítulo > artículo > concepto, desplegable, con el año de comparación.
  function drawEconomica(a, c, cb) {
    const box = $("#ccaa-econ");
    if (!c.gastos) { box.hidden = true; return; }
    box.hidden = false;
    const nombres = ccaa.economica || {};
    const gb = cb && cb.gastos;
    const cods = Object.keys(c.gastos).sort((x, y) => x.replace("t", "~").localeCompare(y.replace("t", "~")));
    const hijos = (cod) => cods.filter((k) => k.length === cod.length + 1 && k.startsWith(cod) && !k.endsWith("t"));
    const tb = el("tbody");
    const fila = (cod, nivel) => {
      const v = c.gastos[cod], hs = hijos(cod), abierto = state.abiertos.has(cod);
      const vb = gb ? gb[cod] : null;
      const tr = el("tr", { class: (nivel === 0 ? "cap" : "") + (hs.length ? " exp" : "") },
        el("td", { style: `padding-left:${9 + nivel * 18}px` }, hs.length ? (abierto ? "▾ " : "▸ ") : "  ", `${cod}. ${nombres[cod] || ""}`),
        el("td", { class: "num" }, nf(v)), el("td", { class: "num" }, pf((100 * v) / c.total)),
        ...(gb ? [el("td", { class: "num" }, nf(vb)), varCelda(v, vb)] : []));
      if (hs.length) {
        const alternar = () => { abierto ? state.abiertos.delete(cod) : state.abiertos.add(cod); drawEconomica(a, c, cb); $(`#ccaa-econ tr[data-cod="${cod}"]`)?.focus(); };
        tr.dataset.cod = cod;
        tr.setAttribute("aria-expanded", abierto ? "true" : "false");
        tr.addEventListener("click", alternar);
        pulsable(tr, alternar);
      }
      tb.append(tr);
      if (abierto) hs.forEach((h) => fila(h, nivel + 1));
    };
    cods.filter((k) => k.length === 1).forEach((k) => fila(k, 0));
    box.replaceChildren(
      el("h4", {}, `Desglose económico del presupuesto de ${state.com} · ${a.anio}`),
      el("p", { class: "note" }, "En qué se gasta, sea cual sea la política: sueldos, compras, recetas, transferencias a ayuntamientos, inversiones, deuda… Pulsa una fila para desplegar sus partidas." +
        (gb ? ` Las dos últimas columnas comparan cada partida con ${state.base}.` : "")),
      el("div", { class: "scroll" }, el("table", { class: "tbl econ" },
        el("thead", {}, el("tr", {}, el("th", {}, "Partida"), el("th", { class: "num" }, `M€ ${a.anio}`), el("th", { class: "num" }, "% del total"),
          ...(gb ? [el("th", { class: "num" }, `M€ ${state.base}`), el("th", { class: "num" }, "Variación")] : []))), tb))
    );
  }
  const varCelda = (v, vb) => {
    const d = v != null && vb ? pct(v, vb) : null;
    return el("td", { class: "num " + (d == null || Math.abs(d) < 0.05 ? "" : d > 0 ? "var-up" : "var-down") },
      d != null ? flecha(d) : v && !vb ? "nueva" : !v && vb ? "desaparece" : "—");
  };

  // Qué políticas suben y cuáles bajan en la comunidad frente al año de comparación.
  function drawVar() {
    const box = $("#ccaa-var");
    const c = comDe(state.anio, state.com), cb = state.base != null ? comDe(state.base, state.com) : null;
    if (!c || !cb) { box.hidden = true; return; }
    box.hidden = false;
    const enPct = selV.value === "pct";
    const vr = c.politicas.filter((p) => Math.max(p.importe, polDe(cb, p.codigo) || 0) >= c.total * 0.005).map((p) => {
      const vb = polDe(cb, p.codigo) || 0, d = enPct ? pct(p.importe, vb) : p.importe - vb;
      return { key: p.codigo, label: p.politica, v: d, color: css(d >= 0 ? "--c2" : "--c1"),
        tip: [p.politica, `${nf(p.importe)} M€ en ${state.anio}`, `${nf(vb)} M€ en ${state.base}`, `${nfs(p.importe - vb)} M€ (${sgn(pct(p.importe, vb))})`] };
    }).filter((r) => r.v != null).sort((x, y) => y.v - x.v);
    const pa = prorr(state.com, state.anio);
    $("#ccaa-var-tit").textContent = `Qué sube y qué baja en ${state.com}: ${state.anio} frente a ${state.base}`;
    $("#ccaa-var-nota").textContent = `Variación de cada política, en ${enPct ? "porcentaje" : "millones de euros"}. ` +
      (pa && pa.base <= state.base ? `Ojo: ${state.com} no tiene presupuesto nuevo desde ${pa.base}, así que las diferencias son solo ajustes de la prórroga. ` : "") +
      "Euros corrientes, sin descontar la inflación. Se omiten las políticas de menos del 0,5 % del presupuesto.";
    barras("#ch-ccaa-var", vr, { aria: `Variación de cada política de ${state.com}`, labW: 260, valFmt: enPct ? sgn : (v) => nfs(v) + " M€" });
  }

  // Evolución de la comunidad: lo que recibe frente a lo que dedica a sanidad, educación y servicios sociales.
  function drawEvol() {
    const ys = [...new Set([...entregas.anios.map((a) => a.anio), ...ccaa.anios.map((a) => a.anio),
      ...(cofog ? cofog.comunidades.map((a) => a.anio) : [])])].sort((a, b) => a - b);
    const xs = ys.map(String);
    const fEa = (y) => { const a = entregas.anios.find((q) => q.anio === y); const f = a && a.filas.find((q) => q.comunidad === state.com); return f ? f.total : null; };
    const fPres = (y) => { const c = comDe(y, state.com); return c ? spfDe(c) : null; };
    const fEje = (y) => { const a = cofog && cofog.comunidades.find((q) => q.anio === y); const c = a && a.filas.find((q) => q.comunidad === state.com); return c ? (c.divisiones["07"] || 0) + (c.divisiones["09"] || 0) + (c.divisiones["10"] || 0) : null; };
    const conv = (f) => ys.map((y) => (ph() ? porHab(f(y), state.com, y) : f(y)));
    const fmtV = (v) => (ph() ? ef(v) + " por habitante" : nf(v) + " M€");
    const series = [
      { name: "Entregas a cuenta recibidas", color: css("--c2"), vals: conv(fEa), tip: (x, v) => { const p = fPres(+x), e = fEa(+x); return p ? [`Equivale al ${pf((100 * e) / p)} de su presupuesto en sanidad, educación y servicios sociales`] : []; } },
      { name: "Presupuesto en sanidad, educación y servicios sociales", pres: true, color: css("--c3"), vals: conv(fPres) },
      { name: "Gasto ejecutado en sanidad, educación y protección social (IGAE)", color: css("--c3"), dash: true, vals: conv(fEje) },
    ].filter((s) => s.vals.some((v) => v != null));
    $("#ccaa-evol-tit").textContent = `${state.com}: lo que recibe y lo que gasta en servicios básicos${ph() ? " (€ por habitante)" : ""}`;
    leyenda("#leg-ccaa-evol", series);
    lineas("#ch-ccaa-evol", xs, series, { aria: `Evolución de ${state.com}`, H: 280, fmt: fmtV,
      marca: (x, s) => { if (!s.pres) return null; const q = prorr(state.com, +x); return q ? prorrTxt(q, +x) : null; } });
  }

  function drawTabla() {
    const a = caAnio(), ea = eaAnio();
    const enHab = ph();
    $("#tbl-unidad").textContent = (enHab
      ? `Presupuesto y políticas de ${a.anio} y entregas de ${ea.anio}, en euros por habitante. «Peso» y «Entregas / servicios básicos» siguen en %.`
      : `Presupuesto ${a.anio} y entregas ${ea.anio} en millones de euros; las políticas, en % del presupuesto.`) +
      (state.base != null ? ` «Variación»: presupuesto total de ${a.anio} frente al de ${state.base}.` : "");
    const data = a.comunidades.map((c) => {
      const pol = (cod) => (c.politicas.find((p) => p.codigo === cod) || {}).importe || 0;
      const e = ea.filas.find((f) => f.comunidad === c.comunidad);
      const v = (m, y = a.anio) => (enHab ? porHab(m, c.comunidad, y) : m);
      const p = (cod) => (enHab ? porHab(pol(cod), c.comunidad, a.anio) : (100 * pol(cod)) / c.total);
      const cb = state.base != null ? comDe(state.base, c.comunidad) : null;
      return { comunidad: c.comunidad, pr: prorr(c.comunidad, a.anio), total: v(c.total), var: cb ? pct(c.total, cb.total) : null,
        entregas: e ? v(e.total, ea.anio) : null, peso: e ? (100 * e.total) / c.total : null,
        cob: e && spfDe(c) ? (100 * e.total) / spfDe(c) : null,
        p31: p("31"), p32: p("32"), p23: p("23"), p95: p("95") };
    });
    const fm = enHab ? ef : nf, fp = enHab ? ef : pf;
    const k = state.sortK, dir = state.sortDir;
    data.sort((x, y) => (typeof x[k] === "string" ? x[k].localeCompare(y[k], "es") : (x[k] ?? -1e9) - (y[k] ?? -1e9)) * dir);
    const tb = $("#tbl-ccaa tbody");
    tb.replaceChildren(...data.map((r) => el("tr", { class: r.comunidad === state.com ? "sel" : "", onclick: () => { setCom(r.comunidad); $("#ccaa-tit").scrollIntoView({ behavior: "smooth" }); } },
      el("td", {}, r.comunidad, r.pr ? tag("prorrogado", prorrTxt(r.pr, a.anio)) : ""), el("td", { class: "num" }, fm(r.total)),
      el("td", { class: "num " + (r.var == null || Math.abs(r.var) < 0.05 ? "" : r.var > 0 ? "var-up" : "var-down") }, r.var == null ? "—" : flecha(r.var)),
      el("td", { class: "num" }, r.entregas == null ? "foral" : fm(r.entregas)),
      el("td", { class: "num" }, pf(r.peso)), el("td", { class: "num" }, pf(r.cob)), el("td", { class: "num" }, fp(r.p31)), el("td", { class: "num" }, fp(r.p32)),
      el("td", { class: "num" }, fp(r.p23)), el("td", { class: "num" }, fp(r.p95)))));
    tb.querySelectorAll("tr").forEach((tr, i) => pulsable(tr, () => tr.click(), `Ver ${data[i].comunidad}${data[i].pr ? " (presupuesto prorrogado)" : ""}`));
    document.querySelectorAll("#tbl-ccaa th").forEach((th) => th.setAttribute("aria-sort",
      th.dataset.k === state.sortK ? (state.sortDir > 0 ? "ascending" : "descending") : "none"));
  }
  document.querySelectorAll("#tbl-ccaa th").forEach((th) => {
    const ordenar = () => {
      const k = th.dataset.k;
      state.sortDir = state.sortK === k ? -state.sortDir : (k === "comunidad" ? 1 : -1);
      state.sortK = k;
      drawTabla();
    };
    th.addEventListener("click", ordenar);
    pulsable(th, ordenar, `Ordenar por ${th.textContent}`);
  });

  function all() { drawEa(); drawDetalle(); drawEvol(); drawTabla(); }
  if (!nombres.includes(state.com)) state.com = "Andalucía";
  all();
  onResize(() => { drawEa(); drawDetalle(); drawEvol(); });
}

/* ---------- Estado de cada fuente (página de fuentes) y fecha de actualización (todas) ---------- */
function renderMeta(meta, estado) {
  const fuentes = meta.fuentes || {};
  document.querySelectorAll("[data-fuente]").forEach((dd) => {
    const k = dd.dataset.fuente, m = fuentes[k] || {};
    dd.replaceChildren();
    if (k === "estado" && estado) dd.append(`Último dato publicado por la IGAE el ${fecha(estado.anios[0].actualizado)}. `);
    dd.append(m.descargado ? `Datos nuevos incorporados el ${fecha(m.descargado)}.` : "Sin datos todavía.");
    if (m.error) dd.append(el("span", { class: "err" }, ` Último intento de descarga fallido (${fecha(m.error_fecha)}): se muestran los datos anteriores.`));
  });
  const ult = d3.max(Object.values(fuentes), (f) => f.descargado);
  const b = $("#badge-act");
  if (b) b.textContent = ult ? `Datos actualizados el ${fecha(ult)}` : "";
}

/* ---------- Subvenciones: grandes beneficiarios y partidos (BDNS) ---------- */
const eurM = (v) => (v == null || isNaN(v) ? "—" : (v >= 1e8 ? fmt0 : fmt1).format(v / 1e6) + " M€");
const sinTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const NIVELES = { ESTADO: "Estado", AUTONOMICA: "Comunidades autónomas", LOCAL: "Entidades locales", OTROS: "Otros" };
function renderSubvenciones(sub) {
  const anios = Object.keys(sub.grandes).sort().reverse();
  const curso = (a) => (sub.en_curso || []).includes(a);
  const tipoNom = (k) => sub.tipos[k] || k;
  const tipoDe = (nif) => { if (!nif) return "fisica"; const c = nif[0]; return sub.tipos[c] && !/\d/.test(c) ? c : "otro"; };
  // Por defecto, el último año completo; el año en curso sigue disponible en el selector.
  const state = { anio: anios.find((a) => !curso(a)) || anios[0], q: "", tipo: "" };
  const listas = {};
  const sel = $("#sel-sub-anio");
  sel.replaceChildren(...anios.map((a) => el("option", { value: a }, a + (curso(a) ? " (en curso)" : ""))));
  sel.value = state.anio;
  sel.addEventListener("change", () => { state.anio = sel.value; draw(); });
  const selT = $("#sel-sub-tipo");
  selT.append(...Object.keys(sub.tipos).map((k) => el("option", { value: k }, sub.tipos[k])));
  selT.addEventListener("change", () => { state.tipo = selT.value; drawBuscar(); });
  let qt;
  $("#sub-q").addEventListener("input", (ev) => { clearTimeout(qt); qt = setTimeout(() => { state.q = ev.target.value.trim(); drawBuscar(); }, 200); });

  const prev = (a) => { const p = String(+a - 1); return sub.grandes[p] ? p : null; };

  function draw() {
    const a = state.anio, g = sub.grandes[a], pa = sub.partidos[a], p = prev(a), gp = p ? sub.grandes[p] : null;
    $("#sub-tit-anio").textContent = `(${a})`;
    const nc = $("#sub-curso");
    nc.hidden = !curso(a);
    nc.textContent = curso(a) ? `${a} está en curso: las administraciones registran las concesiones durante todo el año y después, así que las cifras aún crecerán y no son comparables con años completos.` : "";
    const top10 = d3.sum(g.top.slice(0, 10), (b) => b[2]);
    const kpi = (t, v, s) => el("div", { class: "kpi" }, el("h4", {}, t), el("div", { class: "big" }, v), el("div", { class: "sub muted" }, s));
    $("#sub-kpis").replaceChildren(
      kpi(`Ayudas a grandes beneficiarios (${a})`, eurM(g.total), gp && !curso(a) ? `${flecha(pct(g.total, gp.total))} frente a ${p}` : "Ayuda equivalente total"),
      kpi("Grandes beneficiarios", fmt0.format(g.beneficiarios), "con 100.000 € o más en el año"),
      kpi("Lo que reciben los diez mayores", pf((100 * top10) / g.total), `${eurM(top10)} del total`),
      kpi(`Subvenciones a partidos y grupos (${a})`, pa ? eurM(pa.total) : "—", pa ? `${fmt0.format(pa.concesiones)} concesiones` : ""));

    const deltaT = gp && !curso(a) ? (r) => pct(r.v * 1e6, (gp.por_tipo[r.key] || [])[1]) : null;
    // En pantallas estrechas la etiqueta va sobre la barra: se recorta a lo que cabe (el nombre completo, en el tooltip).
    const corto = (sel, s) => { const w = $(sel).clientWidth; return w < 560 ? trunc(s, Math.max(20, Math.floor(w / 7.4))) : s; };
    barras("#ch-sub-tipos", Object.entries(g.por_tipo).map(([k, [n, v]]) => ({
      key: k, label: tipoNom(k), v: v / 1e6,
      tip: [tipoNom(k), `${eurM(v)} · ${fmt0.format(n)} beneficiarios`, `${pf((100 * v) / g.total)} del total`,
        ...(gp && gp.por_tipo[k] ? [`${p}: ${eurM(gp.por_tipo[k][1])} (${sgn(pct(v, gp.por_tipo[k][1]))})`] : [])],
    })), { aria: `Ayudas a grandes beneficiarios por tipo de entidad en ${a}`, valFmt: (v) => fmt0.format(v) + " M€", delta: deltaT, deltaTit: p ? `frente a ${p}` : "" });

    barras("#ch-sub-top", g.top.slice(0, 25).map((b, i) => ({
      key: b[0] + i, label: corto("#ch-sub-top", b[1]), v: b[2] / 1e6, color: css(b[0] ? "--c1" : "--muted"),
      tip: [b[1], `${fmt0.format(b[2])} €`, `${tipoNom(tipoDe(b[0]))}${b[0] ? " · NIF " + b[0] : ""}`],
    })), { aria: `Los 25 mayores beneficiarios de subvenciones en ${a}`, labW: 320, valFmt: (v) => fmt1.format(v) + " M€" });

    if (pa) {
      const ppa = p ? sub.partidos[p] : null;
      $("#sub-partidos-lead").textContent = `En ${a} se registraron ${fmt0.format(pa.concesiones)} subvenciones a partidos y grupos políticos por ${eurM(pa.total)}` +
        (ppa && !curso(a) ? ` (${sgn(pct(pa.total, ppa.total))} frente a ${p}).` : ".") + " Quién las concede:";
      barras("#ch-sub-nivel", Object.entries(pa.por_nivel).map(([k, v]) => ({ key: k, label: NIVELES[k] || k, v: v / 1e6,
        tip: [NIVELES[k] || k, eurM(v), `${pf((100 * v) / pa.total)} del total`] })), { aria: `Subvenciones a partidos por administración en ${a}`, valFmt: (v) => fmt1.format(v) + " M€" });
      barras("#ch-sub-partidos", pa.beneficiarios.slice(0, 20).map((b) => ({ key: b[0] || b[1], label: corto("#ch-sub-partidos", b[1]), v: b[2] / 1e6,
        tip: [b[1], `${fmt0.format(b[2])} €`, `${fmt0.format(b[3])} concesiones${b[0] ? " · NIF " + b[0] : ""}`] })),
        { aria: `Partidos y grupos que más subvenciones recibieron en ${a}`, labW: 320, valFmt: (v) => fmt1.format(v) + " M€" });
    }
    $("#sub-lista").href = DATA + g.lista;
    $("#sub-lista").textContent = g.lista;
    drawBuscar();
  }

  async function lista(a) {
    if (!listas[a]) listas[a] = getJSON(sub.grandes[a].lista).then((d) => d.beneficiarios.map((b, i) => [...b, i + 1, sinTildes(b[0] + " " + b[1])]));
    return listas[a];
  }

  async function drawBuscar() {
    const a = state.anio, g = sub.grandes[a], q = sinTildes(state.q), t = state.tipo;
    const res = $("#sub-res"), tb = $("#tbl-sub tbody");
    let filas, total = null;
    if (!q && !t) {
      filas = g.top.map((b, i) => [...b, i + 1]);
      res.textContent = `Los ${fmt0.format(filas.length)} mayores de ${fmt0.format(g.beneficiarios)} grandes beneficiarios de ${a}. Escribe un nombre o un NIF, o elige un tipo, para buscar en la lista completa.`;
    } else {
      res.textContent = "Cargando la lista completa…";
      let todos;
      try { todos = await lista(a); } catch (e) { res.replaceChildren(el("span", { class: "err" }, "No se pudo cargar la lista completa.")); return; }
      if (a !== state.anio || sinTildes(state.q) !== q || state.tipo !== t) return; // ya hay otra búsqueda
      const palabras = q.split(/\s+/).filter(Boolean);
      const hall = todos.filter((b) => (!t || tipoDe(b[0]) === t) && palabras.every((w) => b[4].includes(w)));
      total = d3.sum(hall, (b) => b[2]);
      filas = hall.slice(0, 200);
      res.textContent = hall.length
        ? `${fmt0.format(hall.length)} ${hall.length === 1 ? "beneficiario" : "beneficiarios"} en ${a}, con ${eurM(total)} en total` + (hall.length > filas.length ? `. Se muestran los ${filas.length} mayores.` : ".")
        : `Ningún gran beneficiario de ${a} coincide con la búsqueda. Solo figuran quienes recibieron 100.000 € o más en el año.`;
    }
    tb.replaceChildren(...filas.map((b) => el("tr", {},
      el("td", { class: "num muted" }, fmt0.format(b[3])), el("td", { class: "wrap-cell" }, b[1]), el("td", {}, b[0] || "—"),
      el("td", { class: "muted" }, tipoNom(tipoDe(b[0]))), el("td", { class: "num" }, fmt0.format(b[2])))));
  }

  // Evolución: una fila por año, del más reciente al más antiguo.
  $("#tbl-sub-evol tbody").replaceChildren(...anios.map((a) => {
    const g = sub.grandes[a], p = prev(a), v = p && !curso(a) ? pct(g.total, sub.grandes[p].total) : null;
    return el("tr", {}, el("td", {}, a, curso(a) ? tag("en curso", "Año sin cerrar: las cifras aún crecerán") : ""),
      el("td", { class: "num" }, fmt0.format(g.beneficiarios)), el("td", { class: "num" }, nf(g.total / 1e6)),
      el("td", { class: "num " + (v == null || Math.abs(v) < 0.05 ? "" : v > 0 ? "var-up" : "var-down") }, v == null ? "—" : flecha(v)),
      el("td", { class: "num" }, sub.partidos[a] ? fmt1.format(sub.partidos[a].total / 1e6) : "—"));
  }));

  draw();
  onResize(draw);
}

/* ---------- Informe de comprobaciones de la herramienta de datos (página de fuentes) ---------- */
const NOMBRE_FUENTE = { estado: "Ejecución del Estado", pge: "Presupuestos del Estado", entregas: "Entregas a cuenta", ccaa: "Presupuestos autonómicos", cofog: "Gasto por función (COFOG)", poblacion: "Población", subvenciones: "Subvenciones (BDNS)" };
function renderInforme(inf) {
  const res = $("#informe-resumen"), ul = $("#informe-lista");
  if (!res) return;
  if (!inf) { res.textContent = "No se pudo cargar el informe de comprobaciones."; return; }
  const r = inf.resumen;
  res.replaceChildren(el("strong", {}, `${r.correctas} de ${r.pruebas} comprobaciones correctas`),
    ` en el último análisis (${fecha(inf.generado)}). `, el("a", { href: "/datos/v1/informe.json" }, "Informe completo"), ".");
  res.classList.remove("muted");
  ul.replaceChildren(...inf.pruebas.map((p) => el("li", {},
    el("span", { class: p.ok ? "inc-good" : "err" }, p.ok ? "✓ " : "✗ "), `${NOMBRE_FUENTE[p.fuente] || p.fuente}: ${p.prueba}`,
    p.casos ? el("span", { class: "muted" }, ` (${fmt0.format(p.casos)} casos)`) : "",
    !p.ok ? el("div", { class: "note" }, `${p.n_fallos} con diferencias, por ejemplo: ${p.fallos.slice(0, 2).join("; ")}`) : "",
    p.avisos ? el("div", { class: "note" }, `Aviso: ${p.avisos[0]}${p.avisos.length > 1 ? ` (y ${p.avisos.length - 1} más)` : ""}`) : "")));
}

/* ---------- Portada: cifras clave ---------- */
function renderHome(d) {
  const box = $("#home-kpis");
  const tarjeta = (href, t, v, sub) => el("a", { class: "kpi card-link", href }, el("h3", {}, t), el("div", { class: "big" }, v), el("div", { class: "sub" }, sub));
  const out = [];
  let lead = "";
  if (d.estado) {
    const act = d.estado.anios[0], n = act.meses.length, mes = act.meses[n - 1].toLowerCase();
    const sal = partida(act, "saldos", "B.9").valores[n - 1];
    const emp = totalBloque(act, "empleos").valores[n - 1];
    lead = `Hasta ${mes} de ${act.anio} el Estado ha gastado ${nf(emp)} millones de euros, con un déficit de ${nf(Math.abs(sal))} millones.`;
    out.push(tarjeta("estado.html", `Saldo del Estado hasta ${mes} ${act.anio}`, nf(sal) + " M€",
      act.pib ? `${fmt1.format((100 * Math.abs(sal)) / act.pib)} % del PIB · gasto: ${nf(emp)} M€` : `Gasto: ${nf(emp)} M€`));
  }
  if (d.pge) {
    const A = pgeAnios(d.pge), a = A[A.length - 1], col = a.col;
    const pens = d.pge.politicas.find((p) => p.codigo === "21");
    out.push(tarjeta("presupuesto.html", `Presupuesto del Estado en vigor (${a.anio}${a.prorr ? `, prorrogado de ${a.base}` : ""})`, nf(d.pge.total ? d.pge.total[col] : null) + " M€",
      pens ? `Pensiones: ${nf(pens.valores[col])} M€, la mayor política` : ""));
  }
  if (d.cofog) {
    const reg = d.cofog.subsectores.regional, r = reg[reg.length - 1];
    const tot = d3.sum(Object.values(d.cofog.subsectores), (arr) => { const a = arr.find((q) => q.anio === r.anio); return a ? a.divisiones["07"] || 0 : 0; });
    out.push(tarjeta("quien-gasta.html", `Gasto público en sanidad que hacen las comunidades (${r.anio})`, pf((100 * r.divisiones["07"]) / tot),
      `${nf(r.divisiones["07"])} M€ frente a ${nf(d.cofog.subsectores.central.find((q) => q.anio === r.anio).divisiones["07"])} M€ del Estado`));
  }
  if (d.entregas) {
    const a = d.entregas.anios[0], tot = d3.sum(a.filas, (f) => f.total);
    const hab = d.poblacion ? d3.sum(a.filas, (f) => { const t = d.poblacion.territorios[f.comunidad] || {}; return t[a.anio] || t[a.anio - 1] || 0; }) : 0;
    out.push(tarjeta("comunidades.html", `Entregas a cuenta a las comunidades (${a.anio})`, nf(tot) + " M€",
      hab ? `${fmt0.format((tot * 1e6) / hab)} € por habitante de media` : ""));
  }
  if (out.length) box.replaceChildren(...out);
  else box.replaceChildren(el("p", { class: "err" }, "No se pudieron cargar los datos."));
  if (lead) $("#lead").textContent = lead + " Datos oficiales de Hacienda y del INE, actualizados cada día.";
}

/* ---------- Accesibilidad: filas y cabeceras pulsables también con teclado ---------- */
function pulsable(node, fn, label) {
  node.setAttribute("tabindex", "0");
  // Las filas y cabeceras de tabla conservan su papel; el resto se anuncia como botón.
  if (!/^(TR|TH)$/.test(node.tagName)) node.setAttribute("role", "button");
  if (label) node.setAttribute("aria-label", label);
  node.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); fn(); } });
}

/* ---------- Utilidades ---------- */
const resizers = [];
function onResize(fn) { resizers.push(fn); }
let rt;
addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => resizers.forEach((f) => f()), 150); });

async function getJSON(name) {
  const r = await fetch(DATA + name, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
}

addEventListener("scroll", hideTip, { passive: true });

(async function main() {
  // Cada página carga solo los datos que necesita.
  const PAGINAS = {
    inicio: ["estado", "pge", "cofog", "entregas", "poblacion"],
    estado: ["estado"],
    presupuesto: ["pge", "cofog", "entregas"],
    "quien-gasta": ["cofog"],
    comunidades: ["entregas", "ccaa", "cofog", "poblacion"],
    subvenciones: ["subvenciones"],
    fuentes: ["estado", "informe"],
  };
  const pagina = document.body.dataset.page;
  const names = ["meta", ...(PAGINAS[pagina] || [])];
  const res = await Promise.allSettled(names.map((n) => getJSON(n + ".json")));
  const d = Object.fromEntries(names.map((n, i) => [n, res[i].status === "fulfilled" ? res[i].value : null]));
  const fail = (sel, what) => { const n = $(sel); if (n) n.replaceChildren(el("p", { class: "err" }, `No se pudieron cargar los datos de ${what}.`)); };
  const run = (fn, sel, what) => { try { fn(); } catch (e) { console.error(e); fail(sel, what); } };
  if (pagina === "inicio") run(() => renderHome(d), "#home-kpis", "la portada");
  if (pagina === "estado") run(() => (d.estado ? renderEstado(d.estado) : fail("#kpis", "ejecución del Estado")), "#kpis", "ejecución del Estado");
  if (pagina === "presupuesto") run(() => (d.pge ? renderPge(d.pge, d.cofog, d.entregas) : fail("#ch-pge", "presupuesto")), "#ch-pge", "presupuesto");
  if (pagina === "quien-gasta") run(() => (d.cofog ? renderFunciones(d.cofog) : fail("#ch-fun", "gasto por función")), "#ch-fun", "gasto por función");
  if (pagina === "comunidades") run(() => (d.entregas && d.ccaa ? renderCcaa(d.entregas, d.ccaa, d.cofog, d.poblacion) : fail("#ch-ea", "comunidades")), "#ch-ea", "comunidades");
  if (pagina === "subvenciones") run(() => (d.subvenciones ? renderSubvenciones(d.subvenciones) : fail("#sub-kpis", "subvenciones")), "#sub-kpis", "subvenciones");
  if (pagina === "fuentes") renderInforme(d.informe);
  renderMeta(d.meta || {}, d.estado);
})();
