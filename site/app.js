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
}

/* ---------- PGE ---------- */
function renderPge(pge) {
  const col = pge.columnas[pge.columnas.length - 1];
  const anioLey = pge.prorrogado ? "prorrogado" : "aprobado";
  $("#pge-etq").textContent = `· ${col}`;
  $("#pge-nota").textContent =
    `Créditos iniciales de los Presupuestos Generales del Estado consolidados (capítulos 1 a 8) en la columna «${col}» ` +
    `(presupuesto ${anioLey}), en millones de euros: ${nf(pge.total ? pge.total[col] : d3.sum(pge.politicas, (p) => p.valores[col]))} M€ en total. ` +
    `Pulsa una política para ver sus programas.`;
  let sel = null;
  const prevCol = pge.columnas.length > 1 ? pge.columnas[pge.columnas.length - 2] : null;
  const rows = pge.politicas.map((p) => ({
    key: p.codigo, label: p.politica, v: p.valores[col] || 0, p,
    tip: [p.politica, `${nf(p.valores[col])} M€ en ${col}`, prevCol ? `${nf(p.valores[prevCol])} M€ en ${prevCol}` : "", `${p.programas.length} programas`].filter(Boolean),
  })).sort((a, b) => b.v - a.v);
  const draw = () => barras("#ch-pge", rows, { aria: "Presupuesto por política de gasto", selected: sel, onClick: (r) => { sel = sel === r.key ? null : r.key; draw(); detalle(); } });
  const detalle = () => {
    const box = $("#pge-detalle");
    const r = rows.find((x) => x.key === sel);
    if (!r) { box.hidden = true; return; }
    box.hidden = false;
    const progs = r.p.programas.filter((g) => g.valores[col]).sort((a, b) => b.valores[col] - a.valores[col]);
    const tb = el("tbody");
    progs.forEach((g) => tb.append(el("tr", {}, el("td", {}, g.codigo), el("td", {}, g.programa), el("td", { class: "num" }, nf(g.valores[col])), el("td", { class: "num" }, pf((100 * g.valores[col]) / r.v)))));
    box.replaceChildren(
      el("h4", {}, `${r.p.codigo} · ${r.label}: ${nf(r.v)} M€`),
      el("div", { class: "scroll" }, el("table", { class: "tbl" }, el("thead", {}, el("tr", {}, el("th", {}, "Programa"), el("th", {}, "Nombre"), el("th", { class: "num" }, "M€"), el("th", { class: "num" }, "% de la política"))), tb))
    );
  };
  draw();
  onResize(draw);
}

/* ---------- Comunidades ---------- */
function renderCcaa(entregas, ccaa) {
  const state = {
    ea: entregas.anios[0].anio,
    anio: ccaa.anios[0].anio,
    com: decodeURIComponent((location.hash.match(/ccaa=([^&]+)/) || [])[1] || "Andalucía"),
    sortK: "total", sortDir: -1,
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
    $("#ea-total").textContent = `Total ${a.anio}: ${nf(d3.sum(a.filas, (f) => f.total))} M€${a.norma ? " · " + a.norma : ""}`;
    const rows = a.filas.map((f) => ({
      key: f.comunidad, label: f.comunidad, v: f.total,
      tip: [f.comunidad, `${nf(f.total)} M€ en ${a.anio}`, `IRPF ${nf(f.irpf)} · IVA ${nf(f.iva)} · II.EE. ${nf(f.impuestos_especiales)}`,
        `F. Suficiencia ${nf(f.fondo_suficiencia)} · F. Garantía ${nf(f.fondo_garantia)}`, "Pulsa para ver su gasto"],
    })).sort((x, y) => y.v - x.v);
    barras("#ch-ea", rows, { aria: "Entregas a cuenta por comunidad", selected: state.com, labW: 170, onClick: (r) => setCom(r.key) });
  }

  function drawDetalle() {
    const a = caAnio();
    const c = a.comunidades.find((x) => x.comunidad === state.com);
    const ea = eaAnio().filas.find((f) => f.comunidad === state.com);
    selC.value = state.com;
    $("#ccaa-tit").textContent = `¿En qué gasta ${state.com}?`;
    const res = $("#ccaa-resumen");
    if (c) {
      const pol = (cod) => (c.politicas.find((p) => p.codigo === cod) || {}).importe || 0;
      const peso = ea ? (100 * ea.total) / c.total : null;
      res.replaceChildren(
        el("h4", {}, `Presupuesto ${a.anio}`),
        el("div", { class: "big kpi-num" }, nf(c.total) + " M€"),
        el("p", {}, `Sanidad ${pf((100 * pol("31")) / c.total)} · Educación ${pf((100 * pol("32")) / c.total)} · Servicios sociales ${pf((100 * pol("23")) / c.total)} · Deuda ${pf((100 * pol("95")) / c.total)}`),
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
    if (!c) { $("#ch-ccaa").replaceChildren(); return; }
    const areas = [...new Set(c.politicas.map((p) => p.area))];
    const colores = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6"].map(css);
    const rows = c.politicas.filter((p) => p.importe > 0).map((p) => ({
      key: p.codigo, label: p.politica, v: p.importe, color: colores[areas.indexOf(p.area) % colores.length],
      tip: [p.politica, `${nf(p.importe)} M€ · ${pf((100 * p.importe) / c.total)} del presupuesto`, p.area],
    })).sort((x, y) => y.v - x.v);
    barras("#ch-ccaa", rows, { aria: `Presupuesto de ${state.com} por política`, labW: 300 });
  }

  function drawTabla() {
    const a = caAnio(), ea = eaAnio();
    const data = a.comunidades.map((c) => {
      const pol = (cod) => (c.politicas.find((p) => p.codigo === cod) || {}).importe || 0;
      const e = ea.filas.find((f) => f.comunidad === c.comunidad);
      return { comunidad: c.comunidad, total: c.total, entregas: e ? e.total : null, peso: e ? (100 * e.total) / c.total : null,
        p31: (100 * pol("31")) / c.total, p32: (100 * pol("32")) / c.total, p23: (100 * pol("23")) / c.total, p95: (100 * pol("95")) / c.total };
    });
    const k = state.sortK, dir = state.sortDir;
    data.sort((x, y) => (typeof x[k] === "string" ? x[k].localeCompare(y[k], "es") : (x[k] ?? -1) - (y[k] ?? -1)) * dir);
    const tb = $("#tbl-ccaa tbody");
    tb.replaceChildren(...data.map((r) => el("tr", { class: r.comunidad === state.com ? "sel" : "", onclick: () => { setCom(r.comunidad); $("#ccaa-tit").scrollIntoView({ behavior: "smooth" }); } },
      el("td", {}, r.comunidad), el("td", { class: "num" }, nf(r.total)), el("td", { class: "num" }, r.entregas == null ? "foral" : nf(r.entregas)),
      el("td", { class: "num" }, pf(r.peso)), el("td", { class: "num" }, pf(r.p31)), el("td", { class: "num" }, pf(r.p32)),
      el("td", { class: "num" }, pf(r.p23)), el("td", { class: "num" }, pf(r.p95)))));
  }
  document.querySelectorAll("#tbl-ccaa th").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.k;
    state.sortDir = state.sortK === k ? -state.sortDir : (k === "comunidad" ? 1 : -1);
    state.sortK = k;
    drawTabla();
  }));

  function all() { drawEa(); drawDetalle(); drawTabla(); }
  if (!nombres.includes(state.com)) state.com = "Andalucía";
  all();
  onResize(() => { drawEa(); drawDetalle(); });
}

/* ---------- Fuentes ---------- */
function renderFuentes(meta, d) {
  const etiquetas = {
    estado: ["Ejecución mensual del Estado (IGAE)", d.estado && d.estado.fuente, d.estado && d.estado.anios[0].actualizado],
    pge: ["Presupuestos Generales del Estado consolidados (SEPG)", d.pge && d.pge.fuente, null],
    entregas: ["Entregas a cuenta a las comunidades (Financiación Autonómica)", d.entregas && d.entregas.fuente, null],
    ccaa: ["Presupuestos de las comunidades autónomas (SGCIEF)", d.ccaa && d.ccaa.fuente, null],
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
  const names = ["meta", "estado", "pge", "entregas", "ccaa"];
  const res = await Promise.allSettled(names.map((n) => getJSON(n + ".json")));
  const d = Object.fromEntries(names.map((n, i) => [n, res[i].status === "fulfilled" ? res[i].value : null]));
  const fail = (sel, what) => { const n = $(sel); if (n) n.replaceChildren(el("p", { class: "err" }, `No se pudieron cargar los datos de ${what}.`)); };
  try { d.estado ? renderEstado(d.estado) : fail("#kpis", "ejecución del Estado"); } catch (e) { console.error(e); fail("#kpis", "ejecución del Estado"); }
  try { d.pge ? renderPge(d.pge) : fail("#ch-pge", "presupuesto"); } catch (e) { console.error(e); fail("#ch-pge", "presupuesto"); }
  try { d.entregas && d.ccaa ? renderCcaa(d.entregas, d.ccaa) : fail("#ch-ea", "comunidades"); } catch (e) { console.error(e); fail("#ch-ea", "comunidades"); }
  renderFuentes(d.meta || {}, d);
})();
