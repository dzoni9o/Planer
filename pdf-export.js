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

function drawPdfWall(pdf, room, wall, x, y, w, h) {
  const lengthM = wallLengthM(room, wall) || 1;
  const wallHeightM = 2.8;
  const scale = Math.min(w / lengthM, h / wallHeightM);
  const ox = x + (w - lengthM * scale) / 2;
  const base = y + h - 18;
  const top = base - wallHeightM * scale;

  pdf.text(`${wallLabel(wall)} / ${lengthM}m`, x, y + 9, 9, "#333333", true);
  pdf.line(ox, base, ox + lengthM * scale, base, "#202020", 1.2);
  pdf.line(ox, top, ox + lengthM * scale, top, "#dddddd", 0.4, "2 3");
  pdf.text("0m", ox, base + 11, 7, "#777777");
  pdf.text(`${lengthM}m`, ox + lengthM * scale, base + 11, 7, "#777777", false, "right");
  pdf.text("zona kablova", ox + lengthM * scale / 2, top - 5, 6, "#999999", false, "center");

  const wallElements = S.elements
    .filter((element) => element.roomId === room.id && element.wall === wall)
    .sort((a, b) => elementWallOffsetM(room, a) - elementWallOffsetM(room, b));

  wallElements.forEach((element) => {
    const px = ox + elementWallOffsetM(room, element) * scale;
    if (element.type === "box") {
      const bw = Math.max(8, (element.size || 1) * 7);
      const bh = 10;
      const cy = base - ((element.heightCm || 110) / 100) * scale;
      const status = BOX_STATUS[element.status] || BOX_STATUS.nova;
      pdf.rect(px - bw / 2, cy - bh / 2, bw, bh, status.color, "#ffffff", 1);
      pdf.text(element.code || "", px, cy - 8, 6, status.color, true, "center");
      pdf.text(`${Math.round((element.offsetM || 0) * 100)}cm / h${element.heightCm || 110}`, px, cy + 14, 6, "#777777", false, "center");

      const labels = connectedCableLabels(element);
      if (labels.length) {
        pdf.line(px, cy - bh / 2, px, top, status.color, 0.7, "3 2");
        labels.slice(0, 3).forEach((label, index) => {
          pdf.text(shortPdfText(label, 34), px + 4, top + 9 + index * 7, 6, status.color);
        });
      }
    } else if (element.type === "door") {
      const dw = (element.widthM || 0.9) * scale;
      pdf.rect(px - dw / 2, base - 1, dw, 3, "#d4882a", "#fff4dc", 0.8);
      pdf.text("vrata", px, base + 10, 6, "#9a620f", false, "center");
    } else if (element.type === "window") {
      const ww = (element.widthM || 1.2) * scale;
      const wy = base - 1.2 * scale;
      pdf.rect(px - ww / 2, wy - 4, ww, 8, "#5a9fd4", "#eef7ff", 0.8);
      pdf.text("prozor", px, wy + 11, 6, "#2d6f9f", false, "center");
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
  pdf.text(`Prostorija: ${room.name}`, margin, 34, 16, "#141414", true);
  pdf.text(`Dimenzije: ${room.wM} x ${room.hM} m   Materijal: ${material}`, margin, 52, 9, "#555555");
  pdf.text(`Dozne: ${summary.boxes.length}   Kablovi: ${summary.connections.length}   Kablova: ${summary.cableM} m   Vrata: ${summary.doors}   Prozori: ${summary.windows}`, margin, 66, 9, "#555555");

  const cardW = pdf.w - margin * 2;
  const cardH = 118;
  [
    ["N", margin, 88],
    ["S", margin, 218],
    ["W", margin, 348],
    ["E", margin, 478],
  ].forEach(([wall, x, panelY]) => {
    pdf.rect(x, panelY, cardW, cardH, "#d8d8d8", "#ffffff", 0.7);
    drawPdfWall(pdf, room, wall, x + 12, panelY + 10, cardW - 24, cardH - 22);
  });

  const roomBoxes = summary.boxes;
  const roomConnections = summary.connections;
  let y = 620;

  pdf.text("Dozne u prostoriji", margin, y, 11, "#222222", true);
  y += 17;
  if (!roomBoxes.length) {
    pdf.text("Nema dozni.", margin, y, 9, "#777777");
  } else {
    roomBoxes.forEach((box) => {
      if (y > 780) {
        pdf.addPage();
        y = 40;
      }
      const modules = (box.moduli || []).map((module) => module.naziv).join(", ");
      pdf.text(shortPdfText(`${box.code} | ${wallLabel(box.wall)} | ${box.size || 1}M | h ${box.heightCm || 110}cm | ${modules || "bez modula"}`, 110), margin, y, 8, "#333333");
      y += 11;
    });
  }

  y += 10;
  pdf.text("Kablovi vezani za prostoriju", margin, y, 11, "#222222", true);
  y += 17;
  if (!roomConnections.length) {
    pdf.text("Nema kablova.", margin, y, 9, "#777777");
  } else {
    roomConnections.forEach((connection) => {
      if (y > 780) {
        pdf.addPage();
        y = 40;
      }
      const a = S.elements.find((element) => element.id === connection.aId);
      const b = S.elements.find((element) => element.id === connection.bId);
      const definition = KABLI.find((cable) => cable.sifra === (connection.kabl?.sifra || "")) || connection.kabl || {};
      pdf.text(shortPdfText(`${a?.code || "?"} -> ${b?.code || "?"} | ${definition.naziv || definition.sifra || "Kabl"} | ${cableLenM(connection)} m`, 110), margin, y, 8, definition.boja || "#333333");
      y += 11;
    });
  }
}

function drawPdfMaterials(pdf) {
  const rows = collectPdfMaterials();
  pdf.addPage();
  const margin = 34;
  let y = 36;
  pdf.text("Spisak materijala", margin, y, 16, "#141414", true);
  y += 24;

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
}

function exportPdf() {
  if (!S.rooms.length) {
    toast("Dodaj prostoriju pre PDF izvoza");
    return;
  }

  const pdf = new PdfWriter();
  pdf.addPage();
  pdf.text("NikVolt plan instalacije", 34, 42, 18, "#141414", true);
  pdf.text(`Datum: ${new Date().toLocaleDateString("sr-RS")}   Prostorije: ${S.rooms.length}   Dozne: ${S.elements.filter((element) => element.type === "box").length}   Kablovi: ${S.connections.length}`, 34, 66, 9, "#555555");
  pdf.text("PDF je generisan vektorski: zidovi, dozne, kablovi i tekst su PDF elementi, bez bitmap screenshotova.", 34, 86, 9, "#555555");
  pdf.text("Sadrzaj", 34, 124, 13, "#222222", true);

  let y = 148;
  S.rooms.forEach((room, index) => {
    pdf.text(`${index + 1}. ${room.name} (${room.wM} x ${room.hM} m)`, 48, y, 10, "#333333");
    y += 15;
  });
  pdf.text(`${S.rooms.length + 1}. Spisak materijala`, 48, y, 10, "#333333");

  S.rooms.forEach((room) => drawPdfRoom(pdf, room));
  drawPdfMaterials(pdf);
  pdf.save(`nikvolt-plan-${new Date().toISOString().slice(0, 10)}.pdf`);
  toast("PDF izvezen");
}

window.exportPdf = exportPdf;
