/* Presupuestos abiertos — web estática que lee data/*.json */
"use strict";

const DATA = "data/";
const fmt0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf = (v) => (v == null || isNaN(v) ? "—" : fmt0.format(v));
const pf = (v) => (v == null || isNaN(v) ? "—" : fmt1.format(v) + " %");
const sgn = (v) => (v == null || isNaN(v) ? "—" : (v > 0 ? "+" : "") + fmt1.format(v) + " %");
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
  const max = d3.max(rows, (r) => Math.max(0, r.v)) || 1;
  const min = Math.min(0, d3.min(rows, (r) => r.v) || 0);
  const x = d3.scaleLinear([min, max], [labW, W - valW]);
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
  g.append("rect").attr("width", W).attr("height", rh).style("fill", "transparent")
    .on("mousemove", (ev, r) => showTip(ev, r.tip || [r.label, nf(r.v) + " M€"]))
    .on("mouseleave", hideTip)
    .on("click", (ev, r) => opts.onClick && opts.onClick(r));
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
    svg.append("g").selectAll("circle").data(pts).join("circle").attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.v))
      .attr("r", 2.6).attr("fill", s.color);
    svg.append("g").selectAll("circle").data(pts).join("circle").attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.v))
      .attr("r", 10).attr("fill", "transparent")
      .on("mousemove", (ev, d) => showTip(ev, [`${s.name} · ${d.x}`, opts.fmt ? opts.fmt(d.v) : nf(d.v) + " M€", ...(s.tip ? s.tip(d.x, d.v) : [])]))
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
      .on("mousemove", (ev) => showTip(ev, [r.label, `${nf(tot)} M€ en total`,
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
        .on("mousemove", (ev, d) => showTip(ev, [`${s.name} · ${d.mes}`, nf(d.v) + " M€ acumulados"]))
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
        if (va) tipTxt.push(`${sgn((100 * (v - va)) / va)} frente a ${ant.anio}`);
        return { key: p.codigo, label, v, tip: tipTxt, color };
      })
      .sort((a, b) => b.v - a.v);
    const top = rows.slice(0, 10);
    const resto = rows.slice(10);
    if (resto.length) top.push({ key: "resto", label: `Resto (${resto.length} partidas)`, v: d3.sum(resto, (r) => r.v), color: css("--c6"),
      tip: ["Resto", ...resto.map((r) => `${r.label}: ${nf(r.v)}`)] });
    const d = () => barras(sel, top, { aria: `${bloque} del Estado por partida`, labW: 230 });
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
function renderPge(pge, cofog, entregas) {
  const cols = pge.columnas;
  let col = cols[cols.length - 1];
  const selCol = $("#sel-pge");
  selCol.replaceChildren(...[...cols].reverse().map((c) => new Option(c.endsWith("-P") ? `${c.slice(0, 4)} (prorrogado)` : c, c)));
  selCol.onchange = () => { col = selCol.value; all(); };
  let sel = null;
  let rows = [];
  const pol = (cod) => pge.politicas.find((p) => p.codigo === cod);

  function nota() {
    const prorr = col.endsWith("-P");
    const ultimo = col === cols[cols.length - 1];
    $("#pge-etq").textContent = `· ${col}`;
    $("#pge-nota").textContent =
      `Créditos iniciales de los Presupuestos Generales del Estado consolidados (capítulos 1 a 8) en la columna «${col}» ` +
      `(presupuesto ${prorr ? "prorrogado" : "aprobado"}${ultimo ? ", el que está en vigor" : ""}), en millones de euros: ` +
      `${nf(pge.total ? pge.total[col] : d3.sum(pge.politicas, (p) => p.valores[col]))} M€ en total. Pulsa una política para ver sus programas y su evolución.`;
  }

  // Aviso: Sanidad y Educación «parecen» pequeñas porque las gestionan las comunidades.
  function aviso() {
    const box = $("#pge-aviso");
    const reg = cofog && cofog.subsectores.regional;
    const cen = cofog && cofog.subsectores.central;
    if (!reg || !cen) { box.hidden = true; return; }
    const ur = reg[reg.length - 1], uc = cen.find((a) => a.anio === ur.anio) || cen[cen.length - 1];
    const v = (c) => (pol(c) || { valores: {} }).valores[col];
    const ea = entregas && entregas.anios.find((a) => a.anio === +col.slice(0, 4));
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
      el("p", { class: "note" }, el("a", { href: "#funciones" }, "Ver quién gasta en cada función ↓"))
    );
  }

  function draw() {
    const prevCol = cols[cols.indexOf(col) - 1];
    rows = pge.politicas.map((p) => ({
      key: p.codigo, label: p.politica, v: p.valores[col] || 0, p,
      tip: [p.politica, `${nf(p.valores[col])} M€ en ${col}`, prevCol ? `${nf(p.valores[prevCol])} M€ en ${prevCol}` : "", `${p.programas.length} programas`].filter(Boolean),
    })).sort((a, b) => b.v - a.v);
    barras("#ch-pge", rows, { aria: "Presupuesto por política de gasto", selected: sel, onClick: (r) => { sel = sel === r.key ? null : r.key; draw(); detalle(); } });
  }
  function detalle() {
    const box = $("#pge-detalle");
    const r = rows.find((x) => x.key === sel);
    if (!r) { box.hidden = true; return; }
    box.hidden = false;
    const progs = r.p.programas.filter((g) => g.valores[col]).sort((a, b) => b.valores[col] - a.valores[col]);
    const tb = el("tbody");
    progs.forEach((g) => tb.append(el("tr", {}, el("td", {}, g.codigo), el("td", {}, g.programa), el("td", { class: "num" }, nf(g.valores[col])), el("td", { class: "num" }, pf((100 * g.valores[col]) / r.v)))));
    const evol = el("div", { class: "chart" });
    box.replaceChildren(
      el("h4", {}, `${r.p.codigo} · ${r.label}: ${nf(r.v)} M€ en ${col}`),
      el("p", { class: "note" }, `Evolución ${cols[0]}–${cols[cols.length - 1]} (créditos iniciales; «-P» = prorrogado, repite el año anterior).`),
      evol,
      el("div", { class: "scroll" }, el("table", { class: "tbl" }, el("thead", {}, el("tr", {}, el("th", {}, "Programa"), el("th", {}, "Nombre"), el("th", { class: "num" }, "M€"), el("th", { class: "num" }, "% de la política"))), tb))
    );
    lineas(evol, cols, [{ name: r.label, color: css("--c1"), vals: cols.map((c) => r.p.valores[c]) }], { H: 200, aria: `Evolución de ${r.label}` });
  }
  function all() { nota(); aviso(); draw(); detalle(); }
  all();
  onResize(() => { draw(); detalle(); });
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
  const state = {
    ea: entregas.anios[0].anio,
    anio: ccaa.anios[0].anio,
    com: decodeURIComponent((location.hash.match(/ccaa=([^&]+)/) || [])[1] || "Andalucía"),
    sortK: "total", sortDir: -1,
    pol: "31",
    abiertos: new Set(),
  };
  const eaAnio = () => entregas.anios.find((a) => a.anio === state.ea);
  const caAnio = () => ccaa.anios.find((a) => a.anio === state.anio);

  const selEa = $("#sel-ea"), selC = $("#sel-ccaa"), selA = $("#sel-ccaa-anio");
  selEa.replaceChildren(...entregas.anios.map((a) => new Option(a.anio, a.anio)));
  selA.replaceChildren(...ccaa.anios.map((a) => new Option(a.anio, a.anio)));
  const nombres = [...new Set([...ccaa.anios[0].comunidades.map((c) => c.comunidad), ...entregas.anios[0].filas.map((f) => f.comunidad)])].sort((a, b) => a.localeCompare(b, "es"));
  selC.replaceChildren(...nombres.map((n) => new Option(n, n)));
  selEa.onchange = () => { state.ea = +selEa.value; all(); };
  selA.onchange = () => { state.anio = +selA.value; all(); };
  selC.onchange = () => setCom(selC.value);

  function setCom(c) {
    state.com = c;
    history.replaceState(null, "", "#ccaa=" + encodeURIComponent(c));
    all();
  }

  function drawEa() {
    const a = eaAnio();
    const tot = d3.sum(a.filas, (f) => f.total);
    $("#ea-total").textContent = `Total ${a.anio}: ${nf(tot)} M€${a.norma ? " · " + a.norma : ""}`;
    // Conjunto de comunidades de régimen común: lo que reciben frente a lo que presupuestan en servicios básicos.
    const pres = ccaa.anios.find((x) => x.anio === a.anio);
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
    const rows = a.filas.map((f) => ({
      key: f.comunidad, label: f.comunidad, v: ph() ? porHab(f.total, f.comunidad, a.anio) : f.total,
      tip: [f.comunidad, `${nf(f.total)} M€ en ${a.anio}`, `${ef(porHab(f.total, f.comunidad, a.anio))} por habitante`,
        `IRPF ${nf(f.irpf)} · IVA ${nf(f.iva)} · II.EE. ${nf(f.impuestos_especiales)}`,
        `F. Suficiencia ${nf(f.fondo_suficiencia)} · F. Garantía ${nf(f.fondo_garantia)}`, "Pulsa para ver su gasto"],
    })).filter((r) => r.v != null).sort((x, y) => y.v - x.v);
    barras("#ch-ea", rows, { aria: "Entregas a cuenta por comunidad", selected: state.com, labW: 170, valFmt: ph() ? ef : nf, onClick: (r) => setCom(r.key) });
  }

  function drawDetalle() {
    const a = caAnio();
    const c = a.comunidades.find((x) => x.comunidad === state.com);
    const ea = eaAnio().filas.find((f) => f.comunidad === state.com);
    selC.value = state.com;
    $("#ccaa-tit").textContent = `¿En qué gasta ${state.com}?`;
    const res = $("#ccaa-resumen");
    if (c) {
      const pol = (cod) => polImporte(c, cod);
      const peso = ea ? (100 * ea.total) / c.total : null;
      // Para comparar lo que recibe con lo que gasta, se usa el presupuesto del mismo año que las entregas.
      const cMismo = (ccaa.anios.find((x) => x.anio === state.ea) || { comunidades: [] }).comunidades.find((x) => x.comunidad === state.com);
      const spf = cMismo ? spfDe(cMismo) : null;
      const phc = (v) => ef(porHab(v, state.com, a.anio));
      res.replaceChildren(
        el("h4", {}, `Presupuesto ${a.anio}`),
        el("div", { class: "big kpi-num" }, nf(c.total) + " M€"),
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
    if (!c) { $("#ch-ccaa").replaceChildren(); $("#ccaa-pol").hidden = true; $("#ccaa-econ").hidden = true; return; }
    const areas = [...new Set(c.politicas.map((p) => p.area))];
    const colores = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6"].map(css);
    const rows = c.politicas.filter((p) => p.importe > 0).map((p) => ({
      key: p.codigo, label: p.politica, v: p.importe, color: p.codigo === state.pol ? css("--sel") : colores[areas.indexOf(p.area) % colores.length],
      tip: [p.politica, `${nf(p.importe)} M€ · ${pf((100 * p.importe) / c.total)} del presupuesto`, p.area, "Pulsa para ver en qué se gasta"],
    })).sort((x, y) => y.v - x.v);
    if (!rows.some((r) => r.key === state.pol)) state.pol = rows[0].key;
    barras("#ch-ccaa", rows, { aria: `Presupuesto de ${state.com} por política`, labW: 300, selected: state.pol,
      onClick: (r) => { state.pol = r.key; drawDetalle(); $("#ccaa-pol").scrollIntoView({ behavior: "smooth", block: "nearest" }); } });
    drawPolitica(a, c);
    drawEconomica(a, c);
  }

  // Detalle de una política: capítulos, evolución y comparación con las demás comunidades.
  function drawPolitica(a, c) {
    const box = $("#ccaa-pol");
    const p = c.politicas.find((x) => x.codigo === state.pol);
    if (!p) { box.hidden = true; return; }
    box.hidden = false;
    const caps = ccaa.capitulos || [];
    const capChart = el("div", { class: "chart" }), evol = el("div", { class: "chart" }), rank = el("div", { class: "chart" });
    const capRows = p.capitulos ? caps.map((nombre, i) => ({ key: String(i + 1), label: `${i + 1}. ${nombre}`, v: p.capitulos[i] || 0,
      tip: [nombre, `${nf(p.capitulos[i])} M€ · ${pf((100 * (p.capitulos[i] || 0)) / p.importe)} de ${p.politica.toLowerCase()}`] }))
      .filter((r) => r.v) : [];
    const principales = [...capRows].sort((x, y) => y.v - x.v).slice(0, 3).map((r) => `${pf((100 * r.v) / p.importe)} ${r.label.replace(/^\d\. /, "").toLowerCase()}`);
    const ys = ccaa.anios.map((x) => x.anio).sort((x, y) => x - y);
    const serie = ys.map((y) => { const cc = ccaa.anios.find((q) => q.anio === y).comunidades.find((q) => q.comunidad === state.com); const pp = cc && cc.politicas.find((q) => q.codigo === state.pol); return pp ? pp.importe : null; });
    const pesos = a.comunidades.map((cc) => { const pp = cc.politicas.find((q) => q.codigo === state.pol); const imp = pp ? pp.importe : 0;
      return { key: cc.comunidad, label: cc.comunidad, v: ph() ? porHab(imp, cc.comunidad, a.anio) : (100 * imp) / cc.total,
        tip: [cc.comunidad, `${nf(imp)} M€ · ${pf((100 * imp) / cc.total)} de su presupuesto`, `${ef(porHab(imp, cc.comunidad, a.anio))} por habitante`] }; })
      .filter((r) => r.v != null).sort((x, y) => y.v - x.v);
    box.replaceChildren(
      el("h4", {}, `${p.politica} en ${state.com} · ${a.anio}: ${nf(p.importe)} M€ (${pf((100 * p.importe) / c.total)} del presupuesto` +
        (pob ? `, ${ef(porHab(p.importe, state.com, a.anio))} por habitante)` : ")")),
      principales.length ? el("p", {}, `Se reparte así: ${principales.join(", ")}.`) : "",
      el("div", { class: "cols" },
        el("div", {}, el("h5", {}, "Por tipo de gasto (capítulos)"), capChart),
        el("div", {}, el("h5", {}, `Evolución ${ys[0]}–${ys[ys.length - 1]} (${ph() ? "€ por habitante" : "M€"})`), evol)),
      el("h5", {}, ph() ? `${p.politica} por habitante en cada comunidad · ${a.anio}` : `Peso de ${p.politica.toLowerCase()} en el presupuesto de cada comunidad · ${a.anio}`),
      rank
    );
    if (capRows.length) barras(capChart, capRows, { aria: `Capítulos de ${p.politica}`, labW: 220 });
    else capChart.replaceChildren(el("p", { class: "note" }, "Sin desglose por capítulos para este año."));
    const serieV = ph() ? serie.map((v, i) => porHab(v, state.com, ys[i])) : serie;
    lineas(evol, ys.map(String), [{ name: p.politica, color: css("--c1"), vals: serieV }], { H: 200, aria: `Evolución de ${p.politica} en ${state.com}` });
    barras(rank, pesos, { aria: `${p.politica} por comunidad`, labW: 170, selected: state.com, valFmt: ph() ? ef : pf, onClick: (r) => setCom(r.key) });
  }

  // Desglose económico: capítulo > artículo > concepto, desplegable.
  function drawEconomica(a, c) {
    const box = $("#ccaa-econ");
    if (!c.gastos) { box.hidden = true; return; }
    box.hidden = false;
    const nombres = ccaa.economica || {};
    const cods = Object.keys(c.gastos).sort((x, y) => x.replace("t", "~").localeCompare(y.replace("t", "~")));
    const hijos = (cod) => cods.filter((k) => k.length === cod.length + 1 && k.startsWith(cod) && !k.endsWith("t"));
    const tb = el("tbody");
    const fila = (cod, nivel) => {
      const v = c.gastos[cod], hs = hijos(cod), abierto = state.abiertos.has(cod);
      const tr = el("tr", { class: (nivel === 0 ? "cap" : "") + (hs.length ? " exp" : "") },
        el("td", { style: `padding-left:${9 + nivel * 18}px` }, hs.length ? (abierto ? "▾ " : "▸ ") : "  ", `${cod}. ${nombres[cod] || ""}`),
        el("td", { class: "num" }, nf(v)), el("td", { class: "num" }, pf((100 * v) / c.total)));
      if (hs.length) tr.addEventListener("click", () => { abierto ? state.abiertos.delete(cod) : state.abiertos.add(cod); drawEconomica(a, c); });
      tb.append(tr);
      if (abierto) hs.forEach((h) => fila(h, nivel + 1));
    };
    cods.filter((k) => k.length === 1).forEach((k) => fila(k, 0));
    box.replaceChildren(
      el("h4", {}, `Desglose económico del presupuesto de ${state.com} · ${a.anio}`),
      el("p", { class: "note" }, "En qué se gasta, sea cual sea la política: sueldos, compras, recetas, transferencias a ayuntamientos, inversiones, deuda… Pulsa una fila para desplegar sus partidas."),
      el("div", { class: "scroll" }, el("table", { class: "tbl econ" },
        el("thead", {}, el("tr", {}, el("th", {}, "Partida"), el("th", { class: "num" }, "M€"), el("th", { class: "num" }, "% del total"))), tb))
    );
  }

  // Evolución de la comunidad: lo que recibe frente a lo que dedica a sanidad, educación y servicios sociales.
  function drawEvol() {
    const ys = [...new Set([...entregas.anios.map((a) => a.anio), ...ccaa.anios.map((a) => a.anio),
      ...(cofog ? cofog.comunidades.map((a) => a.anio) : [])])].sort((a, b) => a - b);
    const xs = ys.map(String);
    const fEa = (y) => { const a = entregas.anios.find((q) => q.anio === y); const f = a && a.filas.find((q) => q.comunidad === state.com); return f ? f.total : null; };
    const fPres = (y) => { const a = ccaa.anios.find((q) => q.anio === y); const c = a && a.comunidades.find((q) => q.comunidad === state.com); return c ? spfDe(c) : null; };
    const fEje = (y) => { const a = cofog && cofog.comunidades.find((q) => q.anio === y); const c = a && a.filas.find((q) => q.comunidad === state.com); return c ? (c.divisiones["07"] || 0) + (c.divisiones["09"] || 0) + (c.divisiones["10"] || 0) : null; };
    const conv = (f) => ys.map((y) => (ph() ? porHab(f(y), state.com, y) : f(y)));
    const fmtV = (v) => (ph() ? ef(v) + " por habitante" : nf(v) + " M€");
    const series = [
      { name: "Entregas a cuenta recibidas", color: css("--c2"), vals: conv(fEa), tip: (x, v) => { const p = fPres(+x), e = fEa(+x); return p ? [`Equivale al ${pf((100 * e) / p)} de su presupuesto en sanidad, educación y servicios sociales`] : []; } },
      { name: "Presupuesto en sanidad, educación y servicios sociales", color: css("--c3"), vals: conv(fPres) },
      { name: "Gasto ejecutado en sanidad, educación y protección social (IGAE)", color: css("--c3"), dash: true, vals: conv(fEje) },
    ].filter((s) => s.vals.some((v) => v != null));
    $("#ccaa-evol-tit").textContent = `${state.com}: lo que recibe y lo que gasta en servicios básicos${ph() ? " (€ por habitante)" : ""}`;
    leyenda("#leg-ccaa-evol", series);
    lineas("#ch-ccaa-evol", xs, series, { aria: `Evolución de ${state.com}`, H: 280, fmt: fmtV });
  }

  function drawTabla() {
    const a = caAnio(), ea = eaAnio();
    const enHab = ph();
    $("#tbl-unidad").textContent = enHab
      ? `Presupuesto y políticas de ${a.anio} y entregas de ${ea.anio}, en euros por habitante. «Peso» y «Entregas / servicios básicos» siguen en %.`
      : `Presupuesto ${a.anio} y entregas ${ea.anio} en millones de euros; las políticas, en % del presupuesto.`;
    const data = a.comunidades.map((c) => {
      const pol = (cod) => (c.politicas.find((p) => p.codigo === cod) || {}).importe || 0;
      const e = ea.filas.find((f) => f.comunidad === c.comunidad);
      const v = (m, y = a.anio) => (enHab ? porHab(m, c.comunidad, y) : m);
      const p = (cod) => (enHab ? porHab(pol(cod), c.comunidad, a.anio) : (100 * pol(cod)) / c.total);
      return { comunidad: c.comunidad, total: v(c.total), entregas: e ? v(e.total, ea.anio) : null, peso: e ? (100 * e.total) / c.total : null,
        cob: e && spfDe(c) ? (100 * e.total) / spfDe(c) : null,
        p31: p("31"), p32: p("32"), p23: p("23"), p95: p("95") };
    });
    const fm = enHab ? ef : nf, fp = enHab ? ef : pf;
    const k = state.sortK, dir = state.sortDir;
    data.sort((x, y) => (typeof x[k] === "string" ? x[k].localeCompare(y[k], "es") : (x[k] ?? -1) - (y[k] ?? -1)) * dir);
    const tb = $("#tbl-ccaa tbody");
    tb.replaceChildren(...data.map((r) => el("tr", { class: r.comunidad === state.com ? "sel" : "", onclick: () => { setCom(r.comunidad); $("#ccaa-tit").scrollIntoView({ behavior: "smooth" }); } },
      el("td", {}, r.comunidad), el("td", { class: "num" }, fm(r.total)), el("td", { class: "num" }, r.entregas == null ? "foral" : fm(r.entregas)),
      el("td", { class: "num" }, pf(r.peso)), el("td", { class: "num" }, pf(r.cob)), el("td", { class: "num" }, fp(r.p31)), el("td", { class: "num" }, fp(r.p32)),
      el("td", { class: "num" }, fp(r.p23)), el("td", { class: "num" }, fp(r.p95)))));
  }
  document.querySelectorAll("#tbl-ccaa th").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.k;
    state.sortDir = state.sortK === k ? -state.sortDir : (k === "comunidad" ? 1 : -1);
    state.sortK = k;
    drawTabla();
  }));

  function all() { drawEa(); drawDetalle(); drawEvol(); drawTabla(); }
  if (!nombres.includes(state.com)) state.com = "Andalucía";
  all();
  onResize(() => { drawEa(); drawDetalle(); drawEvol(); });
}

/* ---------- Fuentes ---------- */
function renderFuentes(meta, d) {
  const etiquetas = {
    estado: ["Ejecución mensual del Estado (IGAE)", d.estado && d.estado.fuente, d.estado && d.estado.anios[0].actualizado],
    pge: ["Presupuestos Generales del Estado consolidados (SEPG)", d.pge && d.pge.fuente, null],
    entregas: ["Entregas a cuenta a las comunidades (Financiación Autonómica)", d.entregas && d.entregas.fuente, null],
    ccaa: ["Presupuestos de las comunidades autónomas (SGCIEF)", d.ccaa && d.ccaa.fuente, null],
    cofog: ["Gasto de las administraciones públicas por función, COFOG (IGAE)", d.cofog && d.cofog.fuente, null],
    poblacion: ["Población residente a 1 de enero (INE, Estadística Continua de Población)", d.poblacion && d.poblacion.fuente, null],
  };
  const ul = $("#lista-fuentes");
  ul.replaceChildren();
  for (const [k, [nombre, url, act]] of Object.entries(etiquetas)) {
    const m = (meta.fuentes || {})[k] || {};
    const li = el("li", {}, url ? el("a", { href: url }, nombre) : nombre, ". ");
    if (act) li.append(`Publicado por Hacienda el ${fecha(act)}. `);
    if (m.descargado) li.append(`Datos nuevos incorporados el ${fecha(m.descargado)}.`);
    if (m.error) li.append(el("span", { class: "err" }, ` Último intento fallido (${fecha(m.error_fecha)}): se muestran los datos anteriores.`));
    ul.append(li);
  }
  const ult = d3.max(Object.values(meta.fuentes || {}), (f) => f.descargado);
  $("#badge-act").textContent = ult ? `Última actualización de datos: ${fecha(ult)}` : "";
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

(async function main() {
  const names = ["meta", "estado", "pge", "entregas", "ccaa", "cofog", "poblacion"];
  const res = await Promise.allSettled(names.map((n) => getJSON(n + ".json")));
  const d = Object.fromEntries(names.map((n, i) => [n, res[i].status === "fulfilled" ? res[i].value : null]));
  const fail = (sel, what) => { const n = $(sel); if (n) n.replaceChildren(el("p", { class: "err" }, `No se pudieron cargar los datos de ${what}.`)); };
  try { d.estado ? renderEstado(d.estado) : fail("#kpis", "ejecución del Estado"); } catch (e) { console.error(e); fail("#kpis", "ejecución del Estado"); }
  try { d.pge ? renderPge(d.pge, d.cofog, d.entregas) : fail("#ch-pge", "presupuesto"); } catch (e) { console.error(e); fail("#ch-pge", "presupuesto"); }
  try { d.cofog ? renderFunciones(d.cofog) : fail("#ch-fun", "gasto por función"); } catch (e) { console.error(e); fail("#ch-fun", "gasto por función"); }
  try { d.entregas && d.ccaa ? renderCcaa(d.entregas, d.ccaa, d.cofog, d.poblacion) : fail("#ch-ea", "comunidades"); } catch (e) { console.error(e); fail("#ch-ea", "comunidades"); }
  renderFuentes(d.meta || {}, d);
})();
