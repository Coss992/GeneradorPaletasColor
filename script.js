// — Configuración —
const NUM_PANELS = 5;
const MAX_HISTORY = 5;

// DOM
const paletteEl = document.getElementById('palette');
const separatorsEl = document.getElementById('separators');
const inspector = document.getElementById('inspector');
const hR = document.getElementById('hRange');
const sR = document.getElementById('sRange');
const lR = document.getElementById('lRange');
const closeBtn = document.getElementById('closeInspector');
const toast = document.getElementById('toast');

const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const viewBtn = document.getElementById('viewBtn');
const viewModal = document.getElementById('viewModal');
const viewOverlay = document.getElementById('viewOverlay');
const closeView = document.getElementById('closeView');
const viewList = document.getElementById('viewList');

const exportBtnMain = document.getElementById('exportBtn');
const exportModal = document.getElementById('exportModal');
const exportOverlay = document.getElementById('exportOverlay');
const closeExport = document.getElementById('closeExport');

// Estado
let panels = [], current = null;
let undoStack = [], redoStack = [];
let draggingPanel, startX = 0, initIdx = 0;

// —— Helpers de color ——
function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12,
        a = s * Math.min(l, 1 - l),
        f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: 255 * f(0) | 0, g: 255 * f(8) | 0, b: 255 * f(4) | 0 };
}
function rgbToHex(r, g, b) {
    return [r, g, b]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('').toUpperCase();
}
function toCss(c) { return `hsl(${c.h | 0},${c.s | 0}%,${c.l | 0}%)`; }
function toHex(c) { const { r, g, b } = hslToRgb(c.h, c.s, c.l); return rgbToHex(r, g, b); }
function toRgbString(c) { const { r, g, b } = hslToRgb(c.h, c.s, c.l); return `rgb(${r}, ${g}, ${b})`; }
function randomHSL() { return { h: 360 * Math.random(), s: 100 * Math.random(), l: 5 + 90 * Math.random() }; }
function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
}

// —— Historial ——
function snapshot() { return panels.map(p => ({ color: { ...p.color }, locked: p.locked })); }
function restore(state) {
    state.forEach((s, i) => { panels[i].color = { ...s.color }; panels[i].locked = s.locked; });
    panels.forEach(p => paint(p)); repaintSeparators(); updateRemove();
}
function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = []; updateUndoRedo();
}
function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    updateUndoRedo();
}
function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    updateUndoRedo();
}
function updateUndoRedo() {
    undoBtn.disabled = !undoStack.length;
    redoBtn.disabled = !redoStack.length;
}

// —— Crear panel ——
function makePanel() {
    const el = document.createElement('div');
    el.className = 'panel';
    el.innerHTML = `
    <img class="lock"   src="img/unlockB.svg" draggable="false">
    <img class="copy"   src="img/copiarB.svg" draggable="false">
    <img class="drag"   src="img/dragB.svg"   draggable="false">
    <img class="remove" src="img/removeB.svg" draggable="false">
    <div class="hex"></div><div class="name"></div>`;
    paletteEl.append(el);
    const p = { el, locked: false, color: randomHSL() };
    const [lockImg, copyImg, dragImg, remImg, hexEl] = [
        el.querySelector('.lock'),
        el.querySelector('.copy'),
        el.querySelector('.drag'),
        el.querySelector('.remove'),
        el.querySelector('.hex')
    ];
    lockImg.addEventListener('click', e => {
        e.stopPropagation(); pushHistory();
        p.locked = !p.locked;
        el.classList.toggle('locked', p.locked);
        paint(p);
    });
    copyImg.addEventListener('click', e => {
        e.stopPropagation();
        navigator.clipboard.writeText(hexEl.textContent).then(() => showToast('HEX copiado'));
    });
    remImg.addEventListener('click', e => {
        e.stopPropagation();
        if (panels.length > 2) {
            pushHistory();
            panels = panels.filter(x => x !== p);
            el.remove();
            repaintSeparators(); updateRemove();
        }
    });
    hexEl.addEventListener('click', e => {
        e.stopPropagation();
        current = p;
        hR.value = p.color.h | 0;
        sR.value = p.color.s | 0;
        lR.value = p.color.l | 0;
        inspector.classList.remove('hidden');
    });
    dragImg.addEventListener('mousedown', e => {
        e.stopPropagation(); pushHistory();
        draggingPanel = p; startX = e.clientX; initIdx = panels.indexOf(p);
        el.classList.add('dragging');
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd, { once: true });
    });
    return p;
}

// —— Drag ——
function onDragMove(e) {
    if (!draggingPanel) return;
    const dx = e.clientX - startX;
    draggingPanel.el.style.transform = `translateX(${dx}px)`;
}
function onDragEnd() {
    window.removeEventListener('mousemove', onDragMove);
    const el = draggingPanel.el;
    const w = paletteEl.clientWidth / panels.length;
    const dx = parseFloat(el.style.transform.replace(/[^-.\d]/g, '')) || 0;
    let newIdx = initIdx + Math.round(dx / w);
    newIdx = Math.max(0, Math.min(newIdx, panels.length - 1));

    const before = panels.map(p => p.el.getBoundingClientRect());
    panels = panels.filter(p => p !== draggingPanel);
    panels.splice(newIdx, 0, draggingPanel);
    panels.forEach(p => paletteEl.append(p.el));
    repaintSeparators(); updateRemove();

    const after = panels.map(p => p.el.getBoundingClientRect());
    panels.forEach((p, i) => {
        const shift = before[i].left - after[i].left;
        if (shift) {
            p.el.style.transition = 'none';
            p.el.style.transform = `translateX(${shift}px)`;
            requestAnimationFrame(() => {
                p.el.style.transition = 'transform 600ms cubic-bezier(0.22,1,0.36,1)';
                p.el.style.transform = '';
            });
        }
    });

    el.style.transform = ''; el.classList.remove('dragging');
    draggingPanel = null;
}

// —— Pintar ——
function paint(p) {
    p.el.style.background = toCss(p.color);
    const hexEl = p.el.querySelector('.hex');
    hexEl.textContent = toHex(p.color);
    // decidir si texto claro/oscuro
    const { r, g, b } = hslToRgb(p.color.h, p.color.s, p.color.l);
    const bri = (r * 299 + g * 587 + b * 114) / 1000;
    const tone = bri > 186 ? 'B' : 'W';
    const txt = tone === 'B' ? '#000' : '#fff';
    hexEl.style.color = txt;

    ['lock', 'copy', 'drag', 'remove'].forEach(cls => {
        const img = p.el.querySelector('.' + cls);
        if (!img) return;
        let prefix = cls;
        if (cls === 'copy') prefix = 'copiar';      // <–– aquí!
        img.src = `img/${prefix}${tone}.svg`;
    });
}


// —— Generar paleta ——
function generatePalette() {
    pushHistory();
    panels.forEach(p => { if (!p.locked) { p.color = randomHSL(); paint(p) } });
    repaintSeparators(); updateRemove();
}

// —— Separators ——
function repaintSeparators() {
    separatorsEl.innerHTML = '';
    if (panels.length >= 10) return;
    panels.forEach((_, i) => {
        if (i < panels.length - 1) {
            const sep = document.createElement('div');
            sep.className = 'separator';
            sep.style.left = `${100 * (i + 1) / panels.length}%`;
            const btn = document.createElement('button');
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="#000" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`;
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (panels.length < 10) {
                    pushHistory();
                    const newP = makePanel();
                    panels.splice(i + 1, 0, newP);
                    paint(newP);
                    panels.forEach(p => paletteEl.append(p.el));
                    repaintSeparators(); updateRemove();
                }
            });
            sep.append(btn);
            separatorsEl.append(sep);
        }
    });
}

// —— Mostrar/ocultar remove ——
function updateRemove() {
    panels.forEach(p => {
        if (panels.length > 2) p.el.classList.add('more-than-two');
        else p.el.classList.remove('more-than-two');
    });
}

// —— Inspector live ——
[hR, sR, lR].forEach(inp =>
    inp.addEventListener('input', () => {
        if (!current) return;
        current.color = { h: +hR.value, s: +sR.value, l: +lR.value };
        paint(current);
    })
);
closeBtn.addEventListener('click', () => { inspector.classList.add('hidden'); current = null });

// —— Undo/Redo/Space ——
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
window.addEventListener('keydown', e => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault(); generatePalette();
    }
});

// —— Modal Ver ——
viewBtn.addEventListener('click', () => {
    viewList.innerHTML = '';
    panels.forEach(p => {
        const li = document.createElement('li'),
            swatch = document.createElement('div'),
            spanHex = document.createElement('span'),
            btnHex = document.createElement('button'),
            spanRgb = document.createElement('span'),
            btnRgb = document.createElement('button'),
            hex = toHex(p.color),
            rgb = toRgbString(p.color);
        swatch.className = 'color-swatch'; swatch.style.background = toCss(p.color);

        spanHex.textContent = hex;
        btnHex.className = 'copy-btn'; btnHex.textContent = 'Copiar HEX';
        btnHex.onclick = () => navigator.clipboard.writeText(hex).then(() => showToast('HEX copiado'));

        spanRgb.textContent = rgb;
        btnRgb.className = 'copy-btn'; btnRgb.textContent = 'Copiar RGB';
        btnRgb.onclick = () => navigator.clipboard.writeText(rgb).then(() => showToast('RGB copiado'));

        li.append(swatch, spanHex, btnHex, spanRgb, btnRgb);
        viewList.append(li);
    });
    viewModal.classList.remove('hidden');
});
viewOverlay.addEventListener('click', () => viewModal.classList.add('hidden'));
closeView.addEventListener('click', () => viewModal.classList.add('hidden'));

// —— Inicialización ——
for (let i = 0; i < NUM_PANELS; i++) {
    const p = makePanel();
    panels.push(p);
    paint(p);
}
repaintSeparators();
updateRemove();
updateUndoRedo();

// —— Export Modal ——
exportBtnMain.addEventListener('click', () => exportModal.classList.remove('hidden'));
closeExport.addEventListener('click', () => exportModal.classList.add('hidden'));
exportOverlay.addEventListener('click', () => exportModal.classList.add('hidden'));

exportModal.querySelectorAll('button[data-format]').forEach(btn => {
    btn.addEventListener('click', () => {
        const fmt = btn.dataset.format;
        exportPalette(fmt);
        exportModal.classList.add('hidden');
    });
});

// —— Funciones de exportación ——

function exportToImage() {
    html2canvas(paletteEl).then(canvas => {
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob),
                a = document.createElement('a');
            a.href = url; a.download = 'paleta.png'; a.click();
            URL.revokeObjectURL(url);
        });
    });
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'px', format: 'a4' });
    const box = 50;
    panels.forEach((p, i) => {
        const x = 20 + i * (box + 10);
        doc.setFillColor(toHex(p.color));
        doc.rect(x, 20, box, box, 'F');
        doc.setTextColor('#000');
        doc.text(toHex(p.color), x, 20 + box + 15);
    });
    doc.save('paleta.pdf');
}

function exportToCSS() {
    const rules = panels.map((p, i) => `  --color-${i + 1}: ${toHex(p.color)};`).join('\n'),
        css = `:root {\n${rules}\n}`;
    downloadText(css, 'paleta.css', 'text/css');
}

function exportToCode() {
    const arr = panels.map(p => ({ hex: toHex(p.color), rgb: toRgbString(p.color) })),
        code = `export const palette = ${JSON.stringify(arr, null, 2)};`;
    downloadText(code, 'paleta.js', 'application/javascript');
}

function downloadText(content, filename, mime) {
    const blob = new Blob([content], { type: mime }),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function exportPalette(fmt) {
    switch (fmt) {
        case 'image': exportToImage(); break;
        case 'pdf': exportToPDF(); break;
        case 'css': exportToCSS(); break;
        case 'code': exportToCode(); break;
    }
}
