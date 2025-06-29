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

// Helpers de color
function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: 255 * f(0) | 0, g: 255 * f(8) | 0, b: 255 * f(4) | 0 };
}
function rgbToHex(r, g, b) {
    return [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function toCss(c) { return `hsl(${c.h | 0},${c.s | 0}%,${c.l | 0}%)`; }
function toHex(c) { const { r, g, b } = hslToRgb(c.h, c.s, c.l); return rgbToHex(r, g, b); }
function randomHSL() { return { h: Math.random() * 360, s: Math.random() * 100, l: 5 + Math.random() * 90 }; }
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Crear panel
function makePanel() {
    const el = document.createElement('div');
    el.className = 'panel';
    el.innerHTML = `
    <img class="lock"   src="img/unlockB.svg"  alt="" draggable="false">
    <img class="copy"   src="img/copiarB.svg"   alt="" draggable="false">
    <img class="drag"   src="img/dragB.svg"     alt="" draggable="false">
    <img class="remove" src="img/removeB.svg"   alt="" draggable="false">
    <div class="hex"></div>
    <div class="name"></div>`;
    paletteEl.append(el);

    const p = { el, locked: false, color: { h: 0, s: 0, l: 0 } };
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
            .then(() => showToast('✅ Color copiado'));
    });

    remImg.addEventListener('click', e => {
        e.stopPropagation();
        if (panels.length > 2) {
            panels = panels.filter(x => x !== p);
            el.remove();
            generatePalette();
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

// Drag en vivo (sin animación)
function onDragMove(e) {
    if (!draggingPanel) return;
    const dx = e.clientX - startX;
    draggingPanel.el.style.transform = `translateX(${dx}px)`;
}

// Al soltar: snap y reorden FLIP
function onDragEnd() {
    window.removeEventListener('mousemove', onDragMove);
    const el = draggingPanel.el;
    // calcula nuevo índice
    const w = paletteEl.clientWidth / panels.length;
    const dx = parseFloat(el.style.transform.replace(/[^-.\d]/g, '')) || 0;
    let newIdx = initIndex + Math.round(dx / w);
    newIdx = Math.max(0, Math.min(newIdx, panels.length - 1));
    // FLIP: guarda rects antes
    const before = panels.map(p => p.el.getBoundingClientRect());
    // reordena array
    panels = panels.filter(p => p !== draggingPanel);
    panels.splice(newIdx, 0, draggingPanel);
    // re-dibuja
    panels.forEach(p => paletteEl.append(p.el));
    // FLIP: anima vecinos
    const after = panels.map(p => p.el.getBoundingClientRect());
    panels.forEach((p, i) => {
        const dy = before[i].left - after[i].left;
        if (dy) {
            p.el.style.transition = 'none';
            p.el.style.transform = `translateX(${dy}px)`;
            requestAnimationFrame(() => {
                p.el.style.transition = 'transform 600ms cubic-bezier(0.22,1,0.36,1)';
                p.el.style.transform = '';
            });
        }
    });
    // cleanup
    el.style.transform = '';
    el.classList.remove('dragging');
    draggingPanel = null;
}

// Pintar panel
function paint(p) {
    p.el.style.background = toCss(p.color);
    const hexEl = p.el.querySelector('.hex');
    const nameEl = p.el.querySelector('.name');
    hexEl.textContent = toHex(p.color);
    nameEl.textContent = '';
    const { r, g, b } = hslToRgb(p.color.h, p.color.s, p.color.l);
    const bri = (r * 299 + g * 587 + b * 114) / 1000;
    const tone = bri > 186 ? 'B' : 'W', txt = (tone === 'B' ? '#000' : '#fff');
    hexEl.style.color = txt; nameEl.style.color = txt;
    p.el.querySelector('.lock').src = `img/${p.locked ? 'lock' : 'unlock'}${tone}.svg`;
    p.el.querySelector('.copy').src = `img/copiar${tone}.svg`;
    p.el.querySelector('.drag').src = `img/drag${tone}.svg`;
    p.el.querySelector('.remove').src = `img/remove${tone}.svg`;
}

// Generar/rellenar paleta
function generatePalette() {
    panels.forEach(p => {
        if (!p.locked) {
            p.color = randomHSL();
            paint(p);
        }
    });
    repaintSeparators();
}

// Separators
function repaintSeparators() {
    separatorsEl.innerHTML = '';
    if (panels.length >= 10) return;
    panels.forEach((_, i) => {
        if (i < panels.length - 1) {
            const sep = document.createElement('div');
            sep.className = 'separator';
            sep.style.left = `${100 * (i + 1) / panels.length}%`;
            const btn = document.createElement('button');
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24"
        stroke-width="2" stroke="#000" fill="none"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>`;
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (panels.length < 10) {
                    const newP = makePanel();
                    panels.splice(i + 1, 0, newP);
                    paint(newP);
                    generatePalette();
                }
            });
            sep.append(btn);
            separatorsEl.append(sep);
        }
    });
}

// Inspector live
[hR, sR, lR].forEach(inp => {
    inp.addEventListener('input', () => {
        if (!current) return;
        current.color = { h: +hR.value, s: +sR.value, l: +lR.value };
        paint(current);
    });
});
closeBtn.addEventListener('click', () => {
    inspector.classList.add('hidden');
    current = null;
});

// Espacio para regenerar
window.addEventListener('keydown', e => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        generatePalette();
    }
});

// Inicialización
for (let i = 0; i < NUM_PANELS; i++) {
    panels.push(makePanel());
}
generatePalette();
