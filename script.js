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

// — Helpers de color —
function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return {
        r: Math.round(255 * f(0)),
        g: Math.round(255 * f(8)),
        b: Math.round(255 * f(4))
    };
}
function rgbToHex(r, g, b) {
    return [r, g, b].map(x =>
        x.toString(16).padStart(2, '0')
    ).join('').toUpperCase();
}
function toCss(c) {
    return `hsl(${c.h.toFixed(0)},${c.s.toFixed(0)}%,${c.l.toFixed(0)}%)`;
}
function toHex(c) {
    const { r, g, b } = hslToRgb(c.h, c.s, c.l);
    return rgbToHex(r, g, b);
}
function randomHSL() {
    return {
        h: Math.random() * 360,
        s: Math.random() * 100,
        l: 5 + Math.random() * 90
    };
}

// — Toast —
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
    <img class="lock"   src="img/unlockB.svg" alt="toggle lock">
    <img class="copy"   src="img/copiarB.svg" alt="copy hex">
    <img class="remove" src="img/removeB.svg" alt="delete">
    <div class="hex"></div>
    <div class="name"></div>`;
    paletteEl.append(el);

    const p = { el, locked: false, color: { h: 0, s: 0, l: 0 } };
    const lockImg = el.querySelector('.lock');
    const copyImg = el.querySelector('.copy');
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
            generatePalette(); // reubica y redibuja separators
        }
    });

    hexEl.addEventListener('click', e => {
        e.stopPropagation();
        current = p;
        hR.value = p.color.h.toFixed(0);
        sR.value = p.color.s.toFixed(0);
        lR.value = p.color.l.toFixed(0);
        inspector.classList.remove('hidden');
    });

    return p;
}

// — Pintar un panel —
function paint(p) {
    p.el.style.background = toCss(p.color);
    const hexEl = p.el.querySelector('.hex');
    const nameEl = p.el.querySelector('.name');
    const hex = toHex(p.color);

    hexEl.textContent = hex;
    nameEl.textContent = '';

    const { r, g, b } = hslToRgb(p.color.h, p.color.s, p.color.l);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const tone = brightness > 186 ? 'B' : 'W';
    const txt = tone === 'B' ? '#000' : '#fff';

    hexEl.style.color = txt;
    nameEl.style.color = txt;

    p.el.querySelector('.lock').src = `img/${p.locked ? 'lock' : 'unlock'}${tone}.svg`;
    p.el.querySelector('.copy').src = `img/copiar${tone}.svg`;
    p.el.querySelector('.remove').src = `img/remove${tone}.svg`;
}

// — Generar toda la paleta —
function generatePalette() {
    panels.forEach(p => {
        if (!p.locked) {
            p.color = randomHSL();
            paint(p);
        }
    });
    recreateSeparators();
}

// — Crear separators (solo si hay < 10 panels) —
function recreateSeparators() {
    separatorsEl.innerHTML = '';
    if (panels.length >= 10) return;
    const count = panels.length;
    panels.forEach((_, i) => {
        if (i < count - 1) {
            const sep = document.createElement('div');
            sep.className = 'separator';
            sep.style.left = `${100 * (i + 1) / count}%`;

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
                    // insertar un nuevo panel justo tras el índice i
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

// — Inspector live —
[hR, sR, lR].forEach(inp => {
    inp.addEventListener('input', () => {
        if (!current) return;
        current.color = {
            h: +hR.value,
            s: +sR.value,
            l: +lR.value
        };
        paint(current);
    });
});
closeBtn.addEventListener('click', () => {
    inspector.classList.add('hidden');
    current = null;
});

// — Espacio para regenerar —
window.addEventListener('keydown', e => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        generatePalette();
    }
});

// — Inicialización —
for (let i = 0; i < NUM_PANELS; i++) {
    panels.push(makePanel());
}
generatePalette();
