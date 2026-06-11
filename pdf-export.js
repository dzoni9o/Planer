function asciiPdfText(value) {
  return String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "dj").replace(/Đ/g, "Dj")
    .replace(/č/g, "c").replace(/Č/g, "C")
    .replace(/ć/g, "c").replace(/Ć/g, "C")
    .replace(/š/g, "s").replace(/Š/g, "S")
    .replace(/ž/g, "z").replace(/Ž/g, "Z")
    .replace(/[^\x20-\x7E]/g, " ");
}

function pdfEscape(value) {
  return asciiPdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfColor(hex) {
  const m = String(hex || "#111111").match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [0.1, 0.1, 0.1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

class PdfWriter {
  constructor() {
    this.w = 595.28;
    this.h = 841.89;
    this.pages = [];
    this.current = null;
  }

  addPage() {
    this.current = [];
    this.pages.push(this.current);
  }

  cmd(value) {
    this.current.push(value);
  }

  y(value) {
    return this.h - value;
  }

  stroke(hex = "#111111") {
    const [r, g, b] = pdfColor(hex);
    this.cmd(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
  }

  fill(hex = "#111111") {
    const [r, g, b] = pdfColor(hex);
    this.cmd(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
  }

  line(x1, y1, x2, y2, hex = "#111111", width = 1, dash = "") {
    this.stroke(hex);
    this.cmd(`${width} w`);
    this.cmd(dash ? `[${dash}] 0 d` : "[] 0 d");
    this.cmd(`${x1.toFixed(2)} ${this.y(y1).toFixed(2)} m ${x2.toFixed(2)} ${this.y(y2).toFixed(2)} l S`);
  }

  rect(x, y, w, h, stroke = "#111111", fill = null, width = 1) {
    this.stroke(stroke);
    this.cmd(`${width} w`);
    if (fill) {
      this.fill(fill);
      this.cmd(`${x.toFixed(2)} ${this.y(y + h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re B`);
    } else {
      this.cmd(`${x.toFixed(2)} ${this.y(y + h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    }
  }

  poly(points, stroke = "#111111", fill = null, width = 1) {
    if (!points.length) return;
    this.stroke(stroke);
    this.cmd(`${width} w`);
    if (fill) this.fill(fill);
    const [first, ...rest] = points;
    let path = `${first.x.toFixed(2)} ${this.y(first.y).toFixed(2)} m`;
    rest.forEach((point) => {
      path += ` ${point.x.toFixed(2)} ${this.y(point.y).toFixed(2)} l`;
    });
    path += " h";
    this.cmd(`${path} ${fill ? "B" : "S"}`);
  }

  text(value, x, y, size = 10, hex = "#111111", bold = false, align = "left") {
    this.fill(hex);
    const text = asciiPdfText(value);
    const width = text.length * size * 0.5;
    const tx = align === "center" ? x - width / 2 : (align === "right" ? x - width : x);
    this.cmd(`BT ${bold ? "/F2" : "/F1"} ${size} Tf ${tx.toFixed(2)} ${this.y(y).toFixed(2)} Td (${pdfEscape(text)}) Tj ET`);
  }

  save(name) {
    const objects = [];
    const add = (value) => {
      objects.push(value);
      return objects.length;
    };

    const font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageIds = [];

    for (const content of this.pages) {
      const stream = content.join("\n");
      const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageId = add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${this.w} ${this.h}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    }

    const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    pageIds.forEach((id) => {
      objects[id - 1] = objects[id - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
    });

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;

    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function collectPdfMaterials() {
  const rows = [];
  const add = (key, label, qty, unit = "kom", color = "#222222") => {
    if (!qty) return;
    let row = rows.find((item) => item.key === key && item.unit === unit);
    if (!row) {
      row = { key, label, qty: 0, unit, color };
      rows.push(row);
    }
    row.qty += qty;
  };

  S.elements.filter((element) => element.type === "box").forEach((box) => {
    const items = box.nabavka || nabavkaZaDoznu(box.size || 1, box.materijal || "cigla");
    items.forEach((item) => {
      add(item.sifra || item.naziv, item.naziv || item.sifra, item.kolicina || 1, "kom", TIP_BOJA[item.tip] || "#222222");
    });

    (box.moduli || []).forEach((module) => {
      const category = KAT_BOJE[module.kat] || KAT_BOJE.ostalo;
      add(`${module.kod || module.naziv}.0`, `${module.naziv} ${module.kod || ""}.0`, 1, "kom", category.color);
    });
  });

  const cables = {};
  S.connections.forEach((connection) => {
    const a = S.elements.find((element) => element.id === connection.aId);
    const b = S.elements.find((element) => element.id === connection.bId);
    if (!a || !b) return;

    const code = connection.kabl?.sifra || "PPY-3x2.5";
    const definition = KABLI.find((cable) => cable.sifra === code) || KABLI[1];
    if (!cables[code]) cables[code] = { label: definition.naziv, qty: 0, color: definition.boja };
    cables[code].qty += cableLenM(connection);
  });

  Object.entries(cables).forEach(([key, cable]) => {
    add(key, `${cable.label} (+10% rezerva)`, Math.ceil(cable.qty * 1.1), "m", cable.color);
  });

  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

function wallLabel(wall) {
  return { N: "Severni zid", S: "Juzni zid", W: "Zapadni zid", E: "Istocni zid" }[wall] || wall;
}

function wallLengthM(room, wall) {
  return wall === "N" || wall === "S" ? Number(room.wM || 0) : Number(room.hM || 0);
}

function elementWallOffsetM(room, element) {
  const len = wallLengthM(room, element.wall) || 1;
  return element.fromCorner === "start"
    ? Number(element.offsetM || 0)
    : Math.max(0, len - Number(element.offsetM || 0));
}

function connectedCableLabels(box) {
  return S.connections
    .filter((connection) => connection.aId === box.id || connection.bId === box.id)
    .map((connection) => {
      const otherId = connection.aId === box.id ? connection.bId : connection.aId;
      const other = S.elements.find((element) => element.id === otherId);
      const definition = KABLI.find((cable) => cable.sifra === (connection.kabl?.sifra || "")) || connection.kabl || {};
      return `${definition.sifra || "KABL"} ${cableLenM(connection)}m -> ${other?.code || "?"}`;
    });
}

function roomPdfSummary(room) {
  const boxes = S.elements.filter((element) => element.roomId === room.id && element.type === "box");
  const doors = S.elements.filter((element) => element.roomId === room.id && element.type === "door").length;
  const windows = S.elements.filter((element) => element.roomId === room.id && element.type === "window").length;
  const connections = S.connections.filter((connection) => boxes.some((box) => box.id === connection.aId || box.id === connection.bId));
  const cableM = Math.round(connections.reduce((sum, connection) => sum + cableLenM(connection), 0) * 10) / 10;
  return { boxes, doors, windows, connections, cableM };
}

function shortPdfText(value, max = 70) {
  const text = asciiPdfText(value);
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function projectPdfInfo() {
  const boxes = S.elements.filter((element) => element.type === "box");
  const doors = S.elements.filter((element) => element.type === "door").length;
  const windows = S.elements.filter((element) => element.type === "window").length;
  const cableM = Math.round(S.connections.reduce((sum, connection) => sum + cableLenM(connection), 0) * 10) / 10;
  const areaM2 = Math.round(S.rooms.reduce((sum, room) => sum + Number(room.wM || 0) * Number(room.hM || 0), 0) * 10) / 10;
  return { boxes, doors, windows, cableM, areaM2 };
}

function projectPdfName() {
  return localStorage.getItem("nikvolt_project_name") || "NikVolt projekat";
}

function drawHeader(pdf, title, subtitle = "") {
  pdf.rect(0, 0, pdf.w, 64, "#111827", "#111827", 0.1);
  pdf.text("NIKVOLT", 34, 25, 10, "#e8c44a", true);
  pdf.text(title, 34, 45, 15, "#ffffff", true);
  if (subtitle) pdf.text(subtitle, pdf.w - 34, 45, 8, "#cbd5e1", false, "right");
}

function drawFooter(pdf) {
  pdf.line(34, 812, pdf.w - 34, 812, "#e5e7eb", 0.6);
  pdf.text("NikVolt Planer", 34, 827, 7, "#6b7280");
  pdf.text(new Date().toLocaleDateString("sr-RS"), pdf.w - 34, 827, 7, "#6b7280", false, "right");
}

function drawInfoCard(pdf, x, y, w, h, label, value, color = "#111827") {
  pdf.rect(x, y, w, h, "#e5e7eb", "#f8fafc", 0.5);
  pdf.text(label, x + 10, y + 15, 7, "#64748b", true);
  pdf.text(value, x + 10, y + 36, 15, color, true);
}

function projectBounds() {
  if (!S.rooms.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1, w: 1, h: 1 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  S.rooms.forEach((room) => {
    minX = Math.min(minX, room.x);
    minY = Math.min(minY, room.y);
    maxX = Math.max(maxX, room.x + room.wPx);
    maxY = Math.max(maxY, room.y + room.hPx);
  });
  return { minX, minY, maxX, maxY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function fitProjectToBox(x, y, w, h, pad = 18) {
  const bounds = projectBounds();
  const scale = Math.min((w - pad * 2) / bounds.w, (h - pad * 2) / bounds.h);
  const ox = x + (w - bounds.w * scale) / 2 - bounds.minX * scale;
  const oy = y + (h - bounds.h * scale) / 2 - bounds.minY * scale;
  return { bounds, scale, ox, oy };
}

function roomColor(index) {
  const palette = ["#eef7ef", "#eef5ff", "#fff7e6", "#f7efff", "#eefaf7", "#fff1f1"];
  return palette[index % palette.length];
}

function drawPdfTopPlan(pdf, x, y, w, h) {
  const fit = fitProjectToBox(x, y, w, h, 22);
  pdf.rect(x, y, w, h, "#d1d5db", "#ffffff", 0.8);
  pdf.rect(x, y, w, 26, "#f1f5f9", "#f1f5f9", 0.1);
  pdf.text("Tlocrt kuce - pticija perspektiva", x + 12, y + 17, 10, "#111827", true);

  S.rooms.forEach((room, index) => {
    const rx = fit.ox + room.x * fit.scale;
    const ry = fit.oy + room.y * fit.scale;
    const rw = room.wPx * fit.scale;
    const rh = room.hPx * fit.scale;
    pdf.rect(rx, ry, rw, rh, "#334155", roomColor(index), 1.4);
    pdf.text(room.name || `Prostorija ${index + 1}`, rx + rw / 2, ry + rh / 2 - 5, 8, "#111827", true, "center");
    pdf.text(`${room.wM} x ${room.hM} m`, rx + rw / 2, ry + rh / 2 + 8, 7, "#64748b", false, "center");
  });

  S.elements.forEach((element) => {
    const p = element.type === "box" ? elemPx(element) : elemWallPx(element);
    if (!p) return;
    const px = fit.ox + p.x * fit.scale;
    const py = fit.oy + p.y * fit.scale;
    if (element.type === "box") {
      const status = BOX_STATUS[element.status] || BOX_STATUS.nova;
      pdf.rect(px - 3, py - 3, 6, 6, status.color, "#ffffff", 0.8);
      pdf.text(element.code || "", px + 5, py - 4, 5.5, status.color, true);
    } else if (element.type === "door") {
      pdf.line(px - 5, py, px + 5, py, "#d4882a", 1.4);
    } else if (element.type === "window") {
      pdf.line(px - 5, py, px + 5, py, "#5a9fd4", 1.4);
    }
  });

  S.connections.forEach((connection) => {
    const a = S.elements.find((element) => element.id === connection.aId);
    const b = S.elements.find((element) => element.id === connection.bId);
    if (!a || !b) return;
    const pA = elemPx(a), pB = elemPx(b);
    if (!pA || !pB) return;
    const color = connection.kabl?.boja || "#d97706";
    pdf.line(fit.ox + pA.x * fit.scale, fit.oy + pA.y * fit.scale, fit.ox + pB.x * fit.scale, fit.oy + pB.y * fit.scale, color, 0.5, "2 2");
  });
}

function drawPdf3DPlan(pdf, x, y, w, h) {
  const fit = fitProjectToBox(x, y, w, h, 34);
  const wallLift = 0.3 * PX_PER_M * fit.scale;
  const isoX = (px, py) => x + w / 2 + ((px - fit.bounds.minX) - (py - fit.bounds.minY)) * fit.scale * 0.74;
  const isoY = (px, py) => y + 48 + ((px - fit.bounds.minX) + (py - fit.bounds.minY)) * fit.scale * 0.36;
  const projectPts = [
    { x: fit.bounds.minX, y: fit.bounds.minY },
    { x: fit.bounds.maxX, y: fit.bounds.minY },
    { x: fit.bounds.maxX, y: fit.bounds.maxY },
    { x: fit.bounds.minX, y: fit.bounds.maxY },
  ].map((p) => ({ x: isoX(p.x, p.y), y: isoY(p.x, p.y) + wallLift }));
  const minIsoX = Math.min(...projectPts.map((p) => p.x));
  const maxIsoX = Math.max(...projectPts.map((p) => p.x));
  const maxIsoY = Math.max(...projectPts.map((p) => p.y));
  const shiftX = x + w / 2 - (minIsoX + maxIsoX) / 2;
  const shiftY = y + h - 30 - maxIsoY;
  const iso = (px, py, z = 0) => ({ x: isoX(px, py) + shiftX, y: isoY(px, py) + shiftY - z });

  pdf.rect(x, y, w, h, "#d1d5db", "#ffffff", 0.8);
  pdf.rect(x, y, w, 26, "#f1f5f9", "#f1f5f9", 0.1);
  pdf.text("Prostorni prikaz - zidovi 30cm", x + 12, y + 17, 10, "#111827", true);

  S.rooms.forEach((room, index) => {
    const floor = [
      iso(room.x, room.y, 0),
      iso(room.x + room.wPx, room.y, 0),
      iso(room.x + room.wPx, room.y + room.hPx, 0),
      iso(room.x, room.y + room.hPx, 0),
    ];
    const top = [
      iso(room.x, room.y, wallLift),
      iso(room.x + room.wPx, room.y, wallLift),
      iso(room.x + room.wPx, room.y + room.hPx, wallLift),
      iso(room.x, room.y + room.hPx, wallLift),
    ];
    pdf.poly(floor, "#cbd5e1", roomColor(index), 0.6);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      pdf.poly([floor[i], floor[j], top[j], top[i]], "#64748b", i % 2 ? "#dbe6d8" : "#e8efe5", 0.6);
    }
    pdf.poly(top, "#334155", null, 1.1);
    const center = iso(room.x + room.wPx / 2, room.y + room.hPx / 2, wallLift + 7);
    pdf.text(room.name || `Prostorija ${index + 1}`, center.x, center.y, 6.5, "#111827", true, "center");
  });
}

function drawPdfPlanPage(pdf) {
  pdf.addPage();
  drawHeader(pdf, "Nacrt kuce", "tlocrt + 3D ugao");
  drawPdfTopPlan(pdf, 34, 88, pdf.w - 68, 315);
  drawPdf3DPlan(pdf, 34, 438, pdf.w - 68, 330);
  drawFooter(pdf);
}

function modulePdfColor(module) {
  return (KAT_BOJE[module.kat] || KAT_BOJE.ostalo).color || "#64748b";
}

function drawPdfBoxFace(pdf, box, cx, cy, w, h) {
  const status = BOX_STATUS[box.status] || BOX_STATUS.nova;
  const cap = Math.max(1, box.size || 1);
  const modules = box.moduli || [];
  pdf.rect(cx - w / 2, cy - h / 2, w, h, status.color, "#f8fafc", 1.2);
  pdf.rect(cx - w / 2 + 2, cy - h / 2 + 2, w - 4, h - 4, "#cbd5e1", "#ffffff", 0.45);
  for (let i = 1; i < cap; i++) {
    const sx = cx - w / 2 + (i / cap) * w;
    pdf.line(sx, cy - h / 2 + 3, sx, cy + h / 2 - 3, "#d1d5db", 0.35);
  }
  let pos = 0;
  modules.forEach((module) => {
    const mw = (module.vel || 1) / cap * (w - 4);
    const mx = cx - w / 2 + 2 + (pos / cap) * (w - 4);
    const color = modulePdfColor(module);
    pdf.rect(mx + 1, cy - h / 2 + 4, Math.max(3, mw - 2), h - 8, color, color, 0.2);
    pos += module.vel || 1;
  });
  pdf.text(box.code || "", cx, cy - h / 2 - 6, 6.8, status.color, true, "center");
}

function drawPdfModuleCallout(pdf, box, cx, y) {
  const modules = box.moduli || [];
  const cap = box.size || 1;
  const rows = modules.length
    ? modules.map((module) => `${module.kod || ""} ${module.naziv || ""}`.trim())
    : [`prazno ${cap}M`];
  const h = Math.min(rows.length, 3) * 8 + 8;
  pdf.rect(cx - 50, y - 8, 100, h, "#d1d5db", "#ffffff", 0.45);
  rows.slice(0, 3).forEach((row, index) => {
    const module = modules[index];
    pdf.text(shortPdfText(row, 28), cx, y + index * 8, 5.5, module ? modulePdfColor(module) : "#94a3b8", true, "center");
  });
  if (rows.length > 3) pdf.text(`+${rows.length - 3} mod.`, cx, y + 24, 5.3, "#64748b", true, "center");
}

function drawPdfWall(pdf, room, wall, x, y, w, h) {
  const lengthM = wallLengthM(room, wall) || 1;
  const wallHeightM = 2.8;
  const headH = 22;
  const padX = 24;
  const padTop = 34;
  const padBottom = 28;
  const scale = Math.min((w - padX * 2) / lengthM, (h - padTop - padBottom) / wallHeightM);
  const ox = x + (w - lengthM * scale) / 2;
  const base = y + h - padBottom;
  const top = base - wallHeightM * scale;
  const cableZone = top + 24;

  pdf.rect(x, y, w, h, "#cbd5e1", "#ffffff", 0.8);
  pdf.rect(x, y, w, headH, "#0f172a", "#0f172a", 0.1);
  pdf.text(`${wallLabel(wall)} / ${lengthM}m`, x + 10, y + 15, 9, "#ffffff", true);
  pdf.text("zidni pogled - dozne, moduli i kablovi", x + w - 10, y + 15, 7, "#cbd5e1", false, "right");
  pdf.rect(ox - 10, top - 8, lengthM * scale + 20, base - top + 16, "#d8dfd6", "#fbfdf9", 0.6);
  for (let gx = 0; gx <= lengthM; gx += 0.5) {
    const px = ox + gx * scale;
    pdf.line(px, top, px, base, "#edf2ea", 0.25);
  }
  for (let gy = 0.5; gy < wallHeightM; gy += 0.5) {
    const py = base - gy * scale;
    pdf.line(ox, py, ox + lengthM * scale, py, "#edf2ea", 0.25);
  }
  pdf.line(ox, base, ox + lengthM * scale, base, "#5f7559", 2.2);
  pdf.line(ox, top, ox + lengthM * scale, top, "#94a38d", 0.8, "5 4");
  pdf.line(ox, cableZone, ox + lengthM * scale, cableZone, "#94a3b8", 0.6, "3 3");
  pdf.text("zona razvoda", ox + lengthM * scale / 2, cableZone - 5, 5.8, "#64748b", false, "center");
  pdf.text("0m", ox, base + 12, 6.5, "#64748b");
  pdf.text(`${lengthM}m`, ox + lengthM * scale, base + 12, 6.5, "#64748b", false, "right");

  const wallElements = S.elements
    .filter((element) => element.roomId === room.id && element.wall === wall)
    .sort((a, b) => elementWallOffsetM(room, a) - elementWallOffsetM(room, b));
  const wallBoxes = wallElements.filter((element) => element.type === "box");

  let cableLane = 0;
  S.connections.forEach((connection) => {
    const a = S.elements.find((element) => element.id === connection.aId);
    const b = S.elements.find((element) => element.id === connection.bId);
    if (!a || !b) return;
    const aOn = a.roomId === room.id && a.wall === wall && a.type === "box";
    const bOn = b.roomId === room.id && b.wall === wall && b.type === "box";
    if (!aOn && !bOn) return;
    const color = connection.kabl?.boja || "#d97706";
    const laneY = cableZone + cableLane * 9;
    cableLane += 1;
    const onA = aOn ? a : null;
    const onB = bOn ? b : null;
    const points = [onA, onB].filter(Boolean).map((box) => ({
      box,
      x: ox + elementWallOffsetM(room, box) * scale,
      y: base - ((box.heightCm || 110) / 100) * scale,
    }));
    points.forEach((point) => {
      pdf.line(point.x, point.y - 9, point.x, laneY, color, 1.1);
    });
    if (points.length === 2) {
      pdf.line(points[0].x, laneY, points[1].x, laneY, color, 1.1);
      pdf.rect((points[0].x + points[1].x) / 2 - 18, laneY - 7, 36, 11, color, "#ffffff", 0.45);
      pdf.text(`${cableLenM(connection)}m`, (points[0].x + points[1].x) / 2, laneY + 1, 6, color, true, "center");
    } else if (points.length === 1) {
      const dir = points[0].x < ox + lengthM * scale / 2 ? -1 : 1;
      const exitX = dir < 0 ? ox : ox + lengthM * scale;
      pdf.line(points[0].x, laneY, exitX, laneY, color, 1.1);
      pdf.text(`${cableLenM(connection)}m`, points[0].x + dir * 22, laneY - 3, 6, color, true, dir < 0 ? "right" : "left");
    }
  });

  wallElements.forEach((element) => {
    const px = ox + elementWallOffsetM(room, element) * scale;
    if (element.type === "box") {
      const bw = Math.max(22, (element.size || 1) * 13);
      const bh = 18;
      const cy = base - ((element.heightCm || 110) / 100) * scale;
      drawPdfBoxFace(pdf, element, px, cy, bw, bh);
      pdf.text(`${Math.round((element.offsetM || 0) * 100)}cm`, px, base + 11, 5.8, "#475569", true, "center");
      pdf.text(`h ${element.heightCm || 110}cm`, px, cy + bh / 2 + 9, 5.8, "#475569", false, "center");
      const row = wallBoxes.findIndex((box) => box.id === element.id) % 2;
      const calloutY = Math.min(cy + bh / 2 + 19 + row * 17, y + h - 34);
      drawPdfModuleCallout(pdf, element, px, calloutY);
    } else if (element.type === "door") {
      const dw = (element.widthM || 0.9) * scale;
      pdf.rect(px - dw / 2, base - 44, dw, 44, "#d4882a", "#fff7ed", 0.9);
      pdf.line(px - dw / 2, base, px - dw / 2, base - 44, "#d4882a", 1.4);
      pdf.line(px + dw / 2, base, px + dw / 2, base - 44, "#d4882a", 1.4);
      pdf.text(`vrata ${Math.round((element.widthM || 0.9) * 100)}cm`, px, base - 49, 6, "#9a620f", true, "center");
    } else if (element.type === "window") {
      const ww = (element.widthM || 1.2) * scale;
      const wy = base - 1.2 * scale;
      pdf.rect(px - ww / 2, wy - 13, ww, 26, "#5a9fd4", "#eef7ff", 0.9);
      pdf.line(px - ww / 2, wy, px + ww / 2, wy, "#5a9fd4", 0.7);
      pdf.text(`prozor ${Math.round((element.widthM || 1.2) * 100)}cm`, px, wy - 18, 6, "#2d6f9f", true, "center");
    }
  });

  if (!wallElements.length) {
    pdf.text("Nema elemenata na ovom zidu", ox + lengthM * scale / 2, y + h / 2, 8, "#999999", false, "center");
  }
}

function drawPdfRoom(pdf, room) {
  pdf.addPage();
  const margin = 34;
  const summary = roomPdfSummary(room);
  const material = MATERIJAL_ZIDA[room.materijal || "cigla"]?.label || room.materijal || "cigla";
  drawHeader(pdf, `Prostorija: ${room.name}`, `${room.wM} x ${room.hM} m`);
  pdf.text(`Materijal: ${material}`, margin, 86, 9, "#475569");
  pdf.text(`Dozne: ${summary.boxes.length}   Kablovi: ${summary.connections.length}   Kablova: ${summary.cableM} m   Vrata: ${summary.doors}   Prozori: ${summary.windows}`, margin, 100, 9, "#475569");

  const cardW = pdf.w - margin * 2;
  const cardH = 158;
  [
    ["N", margin, 118],
    ["S", margin, 284],
    ["W", margin, 450],
    ["E", margin, 616],
  ].forEach(([wall, x, panelY]) => {
    drawPdfWall(pdf, room, wall, x, panelY, cardW, cardH);
  });
  drawFooter(pdf);
}

function drawPdfMaterials(pdf) {
  const rows = collectPdfMaterials();
  pdf.addPage();
  const margin = 34;
  drawHeader(pdf, "Spisak materijala", "nabavka");
  let y = 92;

  if (!rows.length) {
    pdf.text("Nema materijala za prikaz.", margin, y, 10, "#777777");
    return;
  }

  pdf.text("Naziv", margin, y, 9, "#555555", true);
  pdf.text("Kolicina", pdf.w - margin, y, 9, "#555555", true, "right");
  y += 10;
  pdf.line(margin, y, pdf.w - margin, y, "#dddddd", 0.8);
  y += 12;

  rows.forEach((row, index) => {
    if (y > 800) {
      pdf.addPage();
      y = 40;
      pdf.text("Spisak materijala", margin, y, 13, "#141414", true);
      y += 20;
    }
    if (index % 2 === 0) {
      pdf.rect(margin - 4, y - 8, pdf.w - margin * 2 + 8, 12, "#f4f4f4", "#f4f4f4", 0.1);
    }
    pdf.text(shortPdfText(row.label, 82), margin, y, 8, row.color || "#222222");
    pdf.text(`${row.qty} ${row.unit}`, pdf.w - margin, y, 8, row.color || "#222222", true, "right");
    y += 12;
  });
  drawFooter(pdf);
}

function exportPdf() {
  if (!S.rooms.length) {
    toast("Dodaj prostoriju pre PDF izvoza");
    return;
  }

  const pdf = new PdfWriter();
  const info = projectPdfInfo();
  pdf.addPage();
  const projectName = projectPdfName();
  drawHeader(pdf, projectName, "elektro plan");
  pdf.text("Plan elektro instalacije", 34, 104, 24, "#111827", true);
  pdf.text("Vektorski PDF izvestaj iz NikVolt planera", 34, 128, 11, "#475569");
  pdf.text("Projektni podaci", 34, 176, 13, "#111827", true);

  const cardY = 202;
  const cardW = 118;
  drawInfoCard(pdf, 34, cardY, cardW, 58, "PROSTORIJE", `${S.rooms.length}`, "#111827");
  drawInfoCard(pdf, 162, cardY, cardW, 58, "POVRSINA", `${info.areaM2} m2`, "#2563eb");
  drawInfoCard(pdf, 290, cardY, cardW, 58, "DOZNE", `${info.boxes.length}`, "#16a34a");
  drawInfoCard(pdf, 418, cardY, cardW, 58, "KABLOVI", `${info.cableM} m`, "#d97706");

  pdf.text(`Vrata: ${info.doors}   Prozori: ${info.windows}   Strujni krugovi: ${S.connections.length}`, 34, 288, 9, "#475569");
  pdf.text(`Datum izvoza: ${new Date().toLocaleDateString("sr-RS")}`, 34, 306, 9, "#475569");
  pdf.text("Napomena: naziv projekta i dodatni podaci jos nisu definisani u aplikaciji; naslov se moze povezati kasnije.", 34, 330, 8, "#64748b");
  pdf.text("Sadrzaj dokumenta", 34, 382, 13, "#111827", true);

  let y = 408;
  pdf.text("1. Nacrt kuce - tlocrt i 3D ugao", 48, y, 10, "#111827", true);
  y += 20;
  S.rooms.forEach((room, index) => {
    const summary = roomPdfSummary(room);
    pdf.text(`${index + 2}. ${room.name}`, 48, y, 10, "#111827", true);
    pdf.text(`${room.wM} x ${room.hM} m | ${summary.boxes.length} dozni | ${summary.connections.length} kablova | ${summary.cableM} m`, 190, y, 8, "#64748b");
    y += 17;
  });
  pdf.text(`${S.rooms.length + 2}. Spisak materijala`, 48, y + 6, 10, "#111827", true);
  drawFooter(pdf);

  drawPdfPlanPage(pdf);
  S.rooms.forEach((room) => drawPdfRoom(pdf, room));
  drawPdfMaterials(pdf);
  pdf.save(`nikvolt-plan-${new Date().toISOString().slice(0, 10)}.pdf`);
  toast("PDF izvezen");
}

window.exportPdf = exportPdf;
