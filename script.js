const NUM_PANELS = 5;
const paletteEl = document.getElementById('palette');
const separatorsEl = document.getElementById('separators');
const inspector = document.getElementById('inspector');
const hR = document.getElementById('hRange');
const sR = document.getElementById('sRange');
const lR = document.getElementById('lRange');
const closeBtn = document.getElementById('closeInspector');
const toast = document.getElementById('toast');

let panels = [], current = null;
let draggingPanel = null, startX = 0, initIndex = 0;

// — Helpers de color —
function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l),
        f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: 255 * f(0) | 0, g: 255 * f(8) | 0, b: 255 * f(4) | 0 };
}
function rgbToHex(r, g, b) {
    return [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function toCss(c) { return `hsl(${c.h.toFixed(0)},${c.s.toFixed(0)}%,${c.l.toFixed(0)}%)`; }
function toHex(c) { const { r, g, b } = hslToRgb(c.h, c.s, c.l); return rgbToHex(r, g, b); }
function randomHSL() { return { h: Math.random() * 360, s: Math.random() * 100, l: 5 + Math.random() * 90 }; }
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// — Crear un panel —
function makePanel() {
    const el = document.createElement('div');
    el.className = 'panel';
    el.innerHTML = `
    <img class="lock"   src="img/unlockB.svg"  draggable="false">
    <img class="copy"   src="img/copiarB.svg"   draggable="false">
    <img class="drag"   src="img/dragB.svg"     draggable="false">
    <img class="remove" src="img/removeB.svg"   draggable="false">
    <div class="hex"></div>
    <div class="name"></div>`;
    paletteEl.append(el);

    const p = { el, locked: false, color: randomHSL() };
    const lockImg = el.querySelector('.lock');
    const copyImg = el.querySelector('.copy');
    const dragImg = el.querySelector('.drag');
    const remImg = el.querySelector('.remove');
    const hexEl = el.querySelector('.hex');

    lockImg.addEventListener('click', e => {
        e.stopPropagation();
        p.locked = !p.locked;
        el.classList.toggle('locked', p.locked);
        paint(p);
    });
    copyImg.addEventListener('click', e => {
        e.stopPropagation();
        navigator.clipboard.writeText(hexEl.textContent)
            .then(() => showToast('✅ Color copiado al portapapeles'));
    });
    remImg.addEventListener('click', e => {
        e.stopPropagation();
        if (panels.length > 2) {
            panels = panels.filter(x => x !== p);
            el.remove();
            repaintSeparators();
            updateRemoveVisibility();
        }
    });
    hexEl.addEventListener('click', e => {
        e.stopPropagation(); current = p;
        hR.value = p.color.h.toFixed(0);
        sR.value = p.color.s.toFixed(0);
        lR.value = p.color.l.toFixed(0);
        inspector.classList.remove('hidden');
    });
    dragImg.addEventListener('mousedown', e => {
        e.stopPropagation();
        draggingPanel = p;
        startX = e.clientX;
        initIndex = panels.indexOf(p);
        el.classList.add('dragging');
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd, { once: true });
    });

    return p;
}

// — Drag en vivo —
function onDragMove(e) {
    if (!draggingPanel) return;
    const dx = e.clientX - startX;
    draggingPanel.el.style.transform = `translateX(${dx}px)`;
}

// — Al soltar: snap + FLIP —
function onDragEnd() {
    window.removeEventListener('mousemove', onDragMove);
    const el = draggingPanel.el;
    const w = paletteEl.clientWidth / panels.length;
    const dx = parseFloat(el.style.transform.replace(/[^-.\d]/g, '')) || 0;
    let newIdx = initIndex + Math.round(dx / w);
    newIdx = Math.max(0, Math.min(newIdx, panels.length - 1));

    const before = panels.map(p => p.el.getBoundingClientRect());
    panels = panels.filter(p => p !== draggingPanel);
    panels.splice(newIdx, 0, draggingPanel);
    panels.forEach(p => paletteEl.append(p.el));

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

    el.style.transform = '';
    el.classList.remove('dragging');
    draggingPanel = null;
}

// — Pintar un panel —
function paint(p) {
    p.el.style.background = toCss(p.color);
    const hexEl = p.el.querySelector('.hex'),
        nameEl = p.el.querySelector('.name');
    hexEl.textContent = toHex(p.color);
    nameEl.textContent = '';
    const { r, g, b } = hslToRgb(p.color.h, p.color.s, p.color.l);
    const bri = (r * 299 + g * 587 + b * 114) / 1000;
    const tone = bri > 186 ? 'B' : 'W';
    hexEl.style.color = tone === 'B' ? '#000' : '#fff';
    nameEl.style.color = hexEl.style.color;
    p.el.querySelector('.lock').src = `img/${p.locked ? 'lock' : 'unlock'}${tone}.svg`;
    p.el.querySelector('.copy').src = `img/copiar${tone}.svg`;
    p.el.querySelector('.drag').src = `img/drag${tone}.svg`;
    p.el.querySelector('.remove').src = `img/remove${tone}.svg`;
}

// — Generar/rellenar paleta —
function generatePalette() {
    panels.forEach(p => {
        if (!p.locked) {
            p.color = randomHSL();
            paint(p);
        }
    });
    repaintSeparators();
    updateRemoveVisibility();
}

// — Separators —
function repaintSeparators() {
    separatorsEl.innerHTML = '';
    if (panels.length >= 10) return;
    panels.forEach((_, i) => {
        if (i < panels.length - 1) {
            const sep = document.createElement('div');
            sep.className = 'separator';
            sep.style.left = `${100 * (i + 1) / panels.length}%`;

            const btn = document.createElement('button');
            btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24"
             stroke-width="2" stroke="#000" fill="none"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>`;
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (panels.length < 10) {
                    const newP = makePanel();
                    panels.splice(i + 1, 0, newP);
                    panels.forEach(p => paletteEl.append(p.el));
                    paint(newP);
                    repaintSeparators();
                    updateRemoveVisibility();
                }
            });

            sep.append(btn);
            separatorsEl.append(sep);
        }
    });
}

// — Mostrar/ocultar remove según número de panels —
function updateRemoveVisibility() {
    panels.forEach(p => {
        if (panels.length > 2) p.el.classList.add('more-than-two');
        else p.el.classList.remove('more-than-two');
    });
}

// — Inspector live —
[hR, sR, lR].forEach(inp => inp.addEventListener('input', () => {
    if (!current) return;
    current.color = { h: +hR.value, s: +sR.value, l: +lR.value };
    paint(current);
}));
closeBtn.addEventListener('click', () => {
    inspector.classList.add('hidden');
    current = null;
});

// — Regenerar con Space —
window.addEventListener('keydown', e => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        generatePalette();
    }
});

// — Inicialización —
for (let i = 0; i < NUM_PANELS; i++) {
    const p = makePanel();
    panels.push(p);
    paint(p);
}
repaintSeparators();
updateRemoveVisibility();
