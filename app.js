const EMBEDDED_VAULT_PAYLOAD = null;

let activeVault = null;
let uploadedCustomPhoto = "";
let isEditorOpen = false;

let audioCtx = null;
let isAudioMuted = false;
let isUvActive = false;
let isMagnifierActive = false;
let elapsedSeconds = 0;
let penaltySeconds = 0;
let timerInterval = null;

let gameState = {
    currentStage: 1,
    viewingStage: 1,
    solvedAnswers: [],
    unlockedHints: { 1: 0, 2: 0, 3: 0 },
    unlockedPhotoUrl: "",
    unlockedMessage: ""
};

/* --- Audio Taktil (Web Audio API) --- */

function ensureAudioContext() {
    if (isAudioMuted) return null;
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

function toggleAudioMute() {
    isAudioMuted = !isAudioMuted;
    const label = document.getElementById('audio-status-icon');
    if (label) label.textContent = isAudioMuted ? 'SUARA: OFF' : 'SUARA: ON';
    if (!isAudioMuted) playKeySound();
    showToast(isAudioMuted ? 'Efek suara dimatikan.' : 'Efek suara taktil diaktifkan.', 'info');
}

function playKeySound() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.045);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
}

function playTypingClick(e) {
    if (e && (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt')) return;
    playKeySound();
}

function playPaperSound() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.07);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
}

function playUvHumSound(turningOn) {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(turningOn ? 220 : 440, now);
    osc.frequency.exponentialRampToValueAtTime(turningOn ? 580 : 180, now + 0.16);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
}

function playErrorThud() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.linearRampToValueAtTime(72, now + 0.22);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
}

function playUnlockChime(isFinal = false) {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = isFinal ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];

    notes.forEach((freq, idx) => {
        const start = now + idx * 0.085;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.36);
    });
}

/* --- Alat Investigasi (Senter UV & Kaca Pembesar) --- */

function toggleUvTool() {
    isUvActive = !isUvActive;
    playUvHumSound(isUvActive);

    const overlay = document.getElementById('uv-spotlight-overlay');
    const dockBtn = document.getElementById('dock-btn-uv');
    const topBtn = document.getElementById('top-uv-btn');

    if (isUvActive) {
        document.body.classList.add('uv-mode-on', 'uv-active-cursor');
        overlay.classList.remove('hidden');
        if (dockBtn) dockBtn.classList.add('clay-keycap-pressed');
        if (topBtn) topBtn.classList.add('ring-2', 'ring-[#9333ea]');
        showToast('Senter UV Aktif! Arahkan ke catatan & diorama untuk melihat tinta tersembunyi.', 'info');
        appendActivityLog('Senter_UV', 'bg-[#d8b4fe]', 'Menyalakan Senter UV untuk memindai tinta rahasia.', 'done');
    } else {
        document.body.classList.remove('uv-mode-on', 'uv-active-cursor');
        overlay.classList.add('hidden');
        if (dockBtn) dockBtn.classList.remove('clay-keycap-pressed');
        if (topBtn) topBtn.classList.remove('ring-2', 'ring-[#9333ea]');
    }
}

window.addEventListener('mousemove', (e) => {
    if (!isUvActive) return;
    document.documentElement.style.setProperty('--uv-x', `${e.clientX}px`);
    document.documentElement.style.setProperty('--uv-y', `${e.clientY}px`);
});

window.addEventListener('touchmove', (e) => {
    if (!isUvActive || !e.touches[0]) return;
    document.documentElement.style.setProperty('--uv-x', `${e.touches[0].clientX}px`);
    document.documentElement.style.setProperty('--uv-y', `${e.touches[0].clientY}px`);
}, { passive: true });

function toggleMagnifierTool() {
    isMagnifierActive = !isMagnifierActive;
    playKeySound();

    const dockBtn = document.getElementById('dock-btn-mag');
    const topBtn = document.getElementById('top-mag-btn');

    if (isMagnifierActive) {
        if (dockBtn) dockBtn.classList.add('clay-keycap-pressed');
        if (topBtn) topBtn.classList.add('ring-2', 'ring-[#2a7b88]');
        showToast('Kaca Pembesar Aktif! Arahkan ke gambar diorama di layar bukti.', 'info');
        appendActivityLog('Lensa_Pembesar', 'bg-[#a8d8ea]', 'Mengaktifkan Kaca Pembesar pada layar bukti.', 'done');
    } else {
        if (dockBtn) dockBtn.classList.remove('clay-keycap-pressed');
        if (topBtn) topBtn.classList.remove('ring-2', 'ring-[#2a7b88]');
        hideMagnifierLens();
    }
}

function updateMagnifierAt(clientX, clientY) {
    if (!isMagnifierActive) return;
    const container = document.getElementById('phone-visual-header');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) {
        hideMagnifierLens();
        return;
    }

    let lens = document.getElementById('active-magnifier-lens');
    if (!lens) {
        lens = document.createElement('div');
        lens.id = 'active-magnifier-lens';
        lens.className = 'magnifier-lens';
        container.appendChild(lens);
    }

    const zoom = 1.75;
    const lensSize = 120;
    lens.style.left = `${relX - lensSize / 2}px`;
    lens.style.top = `${relY - lensSize / 2}px`;

    let inner = lens.querySelector('.lens-inner');
    if (!inner) {
        inner = document.createElement('div');
        inner.className = 'lens-inner pointer-events-none';
        lens.appendChild(inner);
    }

    inner.innerHTML = container.innerHTML;
    const nestedLens = inner.querySelector('#active-magnifier-lens');
    if (nestedLens) nestedLens.remove();

    inner.style.width = `${rect.width}px`;
    inner.style.height = `${rect.height}px`;
    inner.style.transformOrigin = '0 0';
    inner.style.transform = `translate(${lensSize / 2 - relX * zoom}px, ${lensSize / 2 - relY * zoom}px) scale(${zoom})`;
}

function handleDioramaPointerMove(e) {
    updateMagnifierAt(e.clientX, e.clientY);
}

function handleDioramaTouchMove(e) {
    if (e.touches && e.touches[0]) {
        updateMagnifierAt(e.touches[0].clientX, e.touches[0].clientY);
    }
}

function hideMagnifierLens() {
    const lens = document.getElementById('active-magnifier-lens');
    if (lens) lens.remove();
}

/* --- Generator Foto Polaroid Bawaan --- */

function createDefaultMemoryPolaroid() {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f8f3e8';
    ctx.fillRect(0, 0, 720, 540);

    const grad = ctx.createLinearGradient(0, 40, 0, 420);
    grad.addColorStop(0, '#163d52');
    grad.addColorStop(0.55, '#3b7e8c');
    grad.addColorStop(1, '#f0b884');
    ctx.fillStyle = grad;
    ctx.fillRect(42, 42, 636, 375);

    ctx.fillStyle = '#fff5b8';
    ctx.beginPath();
    ctx.arc(540, 110, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1f2933';
    ctx.fillRect(110, 260, 500, 157);
    ctx.beginPath();
    ctx.moveTo(90, 260);
    ctx.lineTo(360, 165);
    ctx.lineTo(630, 260);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fdfaf2';
    ctx.beginPath();
    ctx.arc(360, 245, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a3228';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(360, 245);
    ctx.lineTo(360, 222);
    ctx.moveTo(360, 245);
    ctx.lineTo(342, 255);
    ctx.stroke();

    ctx.fillStyle = '#3a3228';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARSIP RAHASIA KLUB DETEKTIF — LOKER 14 & MENARA JAM', 360, 468);
    ctx.font = '600 15px "JetBrains Mono", monospace';
    ctx.fillStyle = '#7a6f61';
    ctx.fillText('BRANKAS TERBUKA // KASUS SEKOLAH LAMA SELESAI', 360, 498);

    return canvas.toDataURL('image/jpeg', 0.9);
}

/* --- Stopwatch & Navigasi Mobile --- */

function formatSecondsMMSS(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startDetectiveStopwatch() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameState.currentStage <= 3 && !isEditorOpen) {
            elapsedSeconds += 1;
            const total = elapsedSeconds + penaltySeconds;
            const formatted = formatSecondsMMSS(total);

            const swEl = document.getElementById('detective-stopwatch');
            const mobBadge = document.getElementById('mob-timer-badge');
            const penEl = document.getElementById('penalty-counter');

            if (swEl) swEl.textContent = formatted;
            if (mobBadge) mobBadge.textContent = formatted;
            if (penEl) penEl.textContent = `+${formatSecondsMMSS(penaltySeconds)}`;
        }
    }, 1000);
}

function switchMobilePane(paneName) {
    playKeySound();
    const panes = {
        chapters: document.getElementById('pane-chapters'),
        canvas: document.getElementById('pane-canvas'),
        logs: document.getElementById('pane-logs')
    };
    const tabs = {
        chapters: document.getElementById('mob-tab-chapters'),
        canvas: document.getElementById('mob-tab-canvas'),
        logs: document.getElementById('mob-tab-logs')
    };

    Object.keys(panes).forEach((key) => {
        if (!panes[key]) return;
        if (key === paneName) {
            panes[key].classList.remove('hidden');
            panes[key].classList.add('flex');
            if (tabs[key]) {
                tabs[key].className = 'flex-1 py-2 px-2 rounded-2xl bg-[#6c5ce7] text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1';
            }
        } else {
            panes[key].classList.add('hidden');
            panes[key].classList.remove('flex');
            if (tabs[key]) {
                tabs[key].className = 'flex-1 py-2 px-2 rounded-2xl text-xs font-extrabold text-clayink transition-all cursor-pointer flex items-center justify-center gap-1';
            }
        }
    });
}

function getStageDioramaSvg(stage) {
    if (stage === 1) {
        return `<svg viewBox="0 0 320 160" class="w-full h-full object-cover">
            <rect width="320" height="160" fill="#0d2c40"/>
            <rect x="24" y="14" width="60" height="22" rx="4" fill="#9cdbe6" opacity="0.8"/>
            <rect x="94" y="14" width="60" height="22" rx="4" fill="#c7eef5" opacity="0.85"/>
            <rect x="28" y="44" width="42" height="102" rx="6" fill="#218394"/>
            <rect x="76" y="44" width="42" height="102" rx="6" fill="#17616e"/>
            <rect x="81" y="50" width="32" height="42" rx="3" fill="#071924"/>
            <circle cx="97" cy="71" r="11" fill="#f6e08b"/>
            <polygon points="116,49 138,56 138,96 116,92" fill="#32a4b8"/>
            <rect x="124" y="44" width="42" height="102" rx="6" fill="#218394"/>
            <rect x="182" y="48" width="108" height="54" rx="6" fill="#dfd2bc" stroke="#8a7456" stroke-width="3"/>
            <rect x="194" y="58" width="24" height="20" rx="2" fill="#f6e08b"/>
            <rect x="228" y="60" width="44" height="26" rx="2" fill="#ffffff"/>
            <text x="250" y="76" font-size="8" font-family="monospace" font-weight="bold" fill="#3a3228" text-anchor="middle">NO. 14</text>
            <rect x="180" y="116" width="112" height="16" rx="5" fill="#ebe1d0"/>
            <g class="uv-hidden-ink">
                <polygon points="245,14 248,21 256,21 250,26 252,33 245,29 238,33 240,26 234,21 242,21" fill="#c084fc"/>
                <text x="245" y="43" font-size="6.5" font-family="monospace" font-weight="bold" fill="#e9d5ff" text-anchor="middle">UV: KUNCI UTAMA (2 KATA)</text>
            </g>
        </svg>`;
    }
    if (stage === 2) {
        return `<svg viewBox="0 0 320 160" class="w-full h-full object-cover">
            <rect width="320" height="160" fill="#ebe1cf"/>
            <polygon points="65,80 245,80 270,122 40,122" fill="#bd8958"/>
            <rect x="55" y="122" width="15" height="34" rx="4" fill="#7d532d"/>
            <rect x="240" y="122" width="15" height="34" rx="4" fill="#7d532d"/>
            <path d="M100 88 Q130 80 152 91 L152 110 Q130 99 100 107 Z" fill="#fffdf7"/>
            <path d="M204 88 Q174 80 152 91 L152 110 Q174 99 204 107 Z" fill="#fff7e2"/>
            <ellipse cx="152" cy="94" rx="36" ry="13" fill="#ffe184" opacity="0.7"/>
            <text x="178" y="99" font-size="6.5" font-family="monospace" font-weight="bold" fill="#c0392b">03:15</text>
            <circle cx="212" cy="100" r="12" fill="#ccecf2" stroke="#2a7b88" stroke-width="3.5"/>
            <line x1="221" y1="108" x2="233" y2="118" stroke="#4a3728" stroke-width="4" stroke-linecap="round"/>
            <g class="uv-hidden-ink">
                <rect x="34" y="12" width="252" height="24" rx="6" fill="#3b0764" opacity="0.92"/>
                <text x="160" y="27" font-size="8.5" font-family="monospace" font-weight="bold" fill="#e9d5ff" text-anchor="middle">JEBAKAN! TINTA MERAH INI PALSU — ABAIKAN</text>
            </g>
        </svg>`;
    }
    return `<svg viewBox="0 0 320 160" class="w-full h-full object-cover">
        <defs>
            <linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1e465c"/>
                <stop offset="65%" stop-color="#4e8594"/>
                <stop offset="100%" stop-color="#f2b680"/>
            </linearGradient>
        </defs>
        <rect width="320" height="160" fill="url(#sky3)"/>
        <rect x="26" y="26" width="54" height="12" rx="6" fill="#f7d3b5" opacity="0.85"/>
        <rect x="234" y="34" width="60" height="13" rx="6.5" fill="#f7d3b5" opacity="0.85"/>
        <rect x="114" y="44" width="92" height="104" rx="8" fill="#f5ede0"/>
        <polygon points="104,46 160,12 216,46" fill="#c96e57"/>
        <circle cx="160" cy="78" r="25" fill="#fffdf8" stroke="#9c7c5c" stroke-width="4"/>
        <line x1="160" y1="78" x2="160" y2="61" stroke="#3a3228" stroke-width="3" stroke-linecap="round"/>
        <line x1="160" y1="78" x2="147" y2="86" stroke="#3a3228" stroke-width="3" stroke-linecap="round"/>
        <rect x="176" y="122" width="38" height="22" rx="5" fill="#9c6b43"/>
        <circle cx="152" cy="130" r="6" fill="none" stroke="#f2c44e" stroke-width="3"/>
        <line x1="158" y1="130" x2="174" y2="130" stroke="#f2c44e" stroke-width="3" stroke-linecap="round"/>
        <g class="uv-hidden-ink">
            <rect x="210" y="72" width="98" height="22" rx="6" fill="#3b0764" opacity="0.9"/>
            <text x="259" y="86" font-size="7.5" font-family="monospace" font-weight="bold" fill="#38bdf8" text-anchor="middle">UV: [SANDI B1] + JAM</text>
        </g>
    </svg>`;
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgMap = {
        success: 'bg-[#b9d2a2] text-clayink border-white',
        warning: 'bg-[#f0b98d] text-clayink border-white',
        error: 'bg-[#f5b7aa] text-[#781f11] border-white',
        info: 'bg-[#f6e08b] text-clayink border-white'
    };
    toast.className = `pointer-events-auto px-4 py-3 rounded-2xl border shadow-[0_10px_24px_rgba(58,50,40,0.2)] text-xs font-bold flex items-center gap-2.5 ${bgMap[type] || bgMap.info}`;
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.25s ease';
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

function appendActivityLog(agentName, badgeColor, description, statusType = 'done') {
    const feed = document.getElementById('activity-log-feed');
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const item = document.createElement('div');
    item.className = 'clay-card p-3 flex items-start justify-between gap-2.5';

    const leftWrap = document.createElement('div');
    leftWrap.className = 'flex items-start gap-2.5';

    const avatar = document.createElement('div');
    avatar.className = `w-8 h-8 rounded-xl ${badgeColor} flex items-center justify-center font-mono font-extrabold text-xs text-clayink shrink-0 shadow-xs`;
    avatar.textContent = agentName.slice(0, 2).toUpperCase();

    const textWrap = document.createElement('div');
    const meta = document.createElement('div');
    meta.className = 'flex items-center gap-1.5';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'text-[10px] font-mono text-claymuted';
    timeSpan.textContent = timeStr;
    meta.appendChild(timeSpan);

    const titleP = document.createElement('p');
    titleP.className = 'font-extrabold text-xs text-clayink';
    titleP.textContent = agentName;

    const descP = document.createElement('p');
    descP.className = 'text-[11px] text-claymuted leading-snug mt-0.5';
    descP.textContent = description;

    textWrap.appendChild(meta);
    textWrap.appendChild(titleP);
    textWrap.appendChild(descP);

    leftWrap.appendChild(avatar);
    leftWrap.appendChild(textWrap);

    const statusIcon = document.createElement('span');
    if (statusType === 'done') {
        statusIcon.className = 'w-5 h-5 rounded-full bg-[#589c68] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-1';
        statusIcon.textContent = '✓';
    } else if (statusType === 'decoy') {
        statusIcon.className = 'w-5 h-5 rounded-full bg-[#e08256] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-1';
        statusIcon.textContent = '!';
    } else {
        statusIcon.className = 'w-5 h-5 rounded-full border-2 border-[#bfb29c] shrink-0 mt-1';
    }

    item.appendChild(leftWrap);
    item.appendChild(statusIcon);
    feed.prepend(item);
}

/* --- Kriptografi & Penyegelan Brankas --- */

function normalizeAnswer(str) {
    return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bufToBase64(buf) {
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return window.btoa(bin);
}

function base64ToBuf(b64) {
    const bin = window.atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

async function deriveAesKey(passphrase, salt) {
    const mat = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
        mat,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptSecretPayload(obj, masterPass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(masterPass, salt);
    const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(JSON.stringify(obj))
    );
    return {
        salt: bufToBase64(salt.buffer),
        iv: bufToBase64(iv.buffer),
        ciphertext: bufToBase64(cipher)
    };
}

async function decryptSecretPayload(pkg, masterPass) {
    const salt = new Uint8Array(base64ToBuf(pkg.salt));
    const iv = new Uint8Array(base64ToBuf(pkg.iv));
    const key = await deriveAesKey(masterPass, salt);
    const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        base64ToBuf(pkg.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plain));
}

async function buildVaultFromEditor() {
    const q1 = document.getElementById('setup-q1').value.trim();
    const q2 = document.getElementById('setup-q2').value.trim();
    const q3 = document.getElementById('setup-q3').value.trim();

    const a1 = normalizeAnswer(document.getElementById('setup-a1').value);
    const a2 = normalizeAnswer(document.getElementById('setup-a2').value);
    const a3 = normalizeAnswer(document.getElementById('setup-a3').value);
    const secretMsg = document.getElementById('setup-secret-msg').value.trim();

    if (!q1 || !q2 || !q3 || !a1 || !a2 || !a3) {
        showToast('Semua cerita dan kunci jawaban wajib diisi!', 'error');
        return null;
    }

    const photoToEncrypt = uploadedCustomPhoto || createDefaultMemoryPolaroid();
    const h1 = await sha256Hex(`B1::${a1}`);
    const h2 = await sha256Hex(`B2::${a1}::${a2}`);
    const h3 = await sha256Hex(`B3::${a1}::${a2}::${a3}`);

    const masterPass = `${a1}|${a2}|${a3}`;
    const encrypted = await encryptSecretPayload(
        {
            photo: photoToEncrypt,
            message: secretMsg || 'Selamat! Semua sandi sekolah lama berhasil dipecahkan.'
        },
        masterPass
    );

    const wordCount1 = a1.split(' ').length;
    const wordCount2 = a2.split(' ').length;

    return {
        stages: [
            {
                title: 'Misteri Loker No. 14',
                story: q1,
                hint: 'Petunjuk 1: Rasi Ursa Minor (Beruang Kecil) memiliki bintang penunjuk arah utara di ujung ekornya.',
                hint2: `Petunjuk 2 (Format): Jawaban terdiri dari ${wordCount1} kata dalam bahasa Indonesia.`
            },
            {
                title: 'Meja Kelas & Buku Harian',
                story: q2,
                hint: 'Petunjuk 1: Periksa tulisan kapital berwarna tinta merah basah di halaman buku harian.',
                hint2: `Petunjuk 2 (Format): Ketik ${wordCount2} kata peringatan merah tersebut (cabang ini adalah pengecoh).`
            },
            {
                title: 'Gembok Menara Jam Senja',
                story: q3,
                hint: 'Petunjuk 1: Gabungkan jawaban asli dari Babak 1 (abaikan Babak 2) dengan angka jam bayangan matahari.',
                hint2: 'Petunjuk 2 (Format): [JAWABAN BABAK 1] diikuti spasi dan 2 digit angka pukul pagi di narasi.'
            }
        ],
        hashes: [h1, h2, h3],
        encrypted
    };
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Pilih file gambar JPG, PNG, atau WebP.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const maxDim = 1100;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                else { w = Math.round((w * maxDim) / h); h = maxDim; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            uploadedCustomPhoto = canvas.toDataURL('image/jpeg', 0.85);

            const preview = document.getElementById('setup-photo-preview');
            const placeholder = document.getElementById('upload-placeholder');
            preview.src = uploadedCustomPhoto;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
            showToast('Foto berhasil dimuat dan siap disegel!', 'success');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function applyCustomPuzzleAndPlay() {
    const vault = await buildVaultFromEditor();
    if (!vault) return;
    activeVault = vault;
    resetPlayerProgress();
    if (isEditorOpen) toggleMode();
    showToast('Kasus baru berhasil disegel dan siap dimainkan!', 'success');
}

async function encryptAndDownloadStandalone() {
    try {
        const vault = isEditorOpen ? await buildVaultFromEditor() : activeVault;
        if (!vault) return;

        const docClone = document.documentElement.cloneNode(true);

        const editorView = docClone.querySelector('#canvas-editor-mode');
        if (editorView) editorView.remove();

        const sidebarEditorBtn = docClone.querySelector('#btn-sidebar-editor');
        if (sidebarEditorBtn) sidebarEditorBtn.remove();

        const dockEditorBtn = docClone.querySelector('#dock-btn-editor');
        if (dockEditorBtn) dockEditorBtn.remove();

        const dockExportBtn = docClone.querySelector('#dock-btn-export');
        if (dockExportBtn) dockExportBtn.remove();

        const playerView = docClone.querySelector('#canvas-player-mode');
        if (playerView) playerView.classList.remove('hidden');

        // Kunci badge mode atas menjadi Mode Penyelidik pada file ekspor
        const topPill = docClone.querySelector('#top-mode-pill');
        if (topPill) {
            topPill.textContent = 'Mode Penyelidik';
            topPill.className = 'px-3 py-1 rounded-xl bg-[#6c5ce7] text-white text-[11px] font-bold shadow-sm cursor-default';
            topPill.removeAttribute('onclick');
        }

        const toastCont = docClone.querySelector('#toast-container');
        if (toastCont) toastCont.innerHTML = '';

        try {
            const cssResp = await fetch('style.css');
            if (cssResp.ok) {
                const cssText = await cssResp.text();
                const linkEl = docClone.querySelector('link[href="style.css"]');
                if (linkEl) {
                    const styleEl = document.createElement('style');
                    styleEl.textContent = cssText;
                    linkEl.replaceWith(styleEl);
                }
            }

            const jsResp = await fetch('app.js');
            if (jsResp.ok) {
                let jsText = await jsResp.text();
                jsText = jsText.replace(
                    'const EMBEDDED_VAULT_PAYLOAD = null;',
                    `const EMBEDDED_VAULT_PAYLOAD = ${JSON.stringify(vault)};`
                );
                const scriptEl = docClone.querySelector('script[src="app.js"]');
                if (scriptEl) {
                    const inlineScript = document.createElement('script');
                    inlineScript.textContent = jsText;
                    scriptEl.replaceWith(inlineScript);
                }
            }
        } catch (bundleErr) {
            console.warn('Mode lokal terdeteksi, menyertakan referensi file langsung.', bundleErr);
        }

        let htmlStr = '<!DOCTYPE html>\n' + docClone.outerHTML;
        htmlStr = htmlStr.replace(
            'const EMBEDDED_VAULT_PAYLOAD = null;',
            `const EMBEDDED_VAULT_PAYLOAD = ${JSON.stringify(vault)};`
        );

        const blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'detektif-os-kasus-sekolah.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('File detektif-os-kasus-sekolah.html berhasil diunduh!', 'success');
        appendActivityLog('Arsip_Siap', 'bg-[#b9d2a2]', 'Mengekspor berkas kasus mandiri siap kirim.', 'done');
    } catch (err) {
        console.error(err);
        showToast('Gagal mengekspor file HTML.', 'error');
    }
}

/* --- Kontrol Tampilan & Navigasi Babak --- */

function toggleMode() {
    if (EMBEDDED_VAULT_PAYLOAD) return;

    isEditorOpen = !isEditorOpen;
    const playerCanvas = document.getElementById('canvas-player-mode');
    const editorCanvas = document.getElementById('canvas-editor-mode');
    const topPill = document.getElementById('top-mode-pill');
    const sidebarLabel = document.getElementById('sidebar-editor-label');

    if (isEditorOpen) {
        playerCanvas.classList.add('hidden');
        editorCanvas.classList.remove('hidden');
        editorCanvas.classList.add('flex');
        topPill.textContent = 'Editor Kasus';
        topPill.className = 'px-3 py-1 rounded-xl bg-[#2a7b88] text-white text-[11px] font-bold shadow-sm cursor-pointer';
        sidebarLabel.textContent = 'Kembali ke Penyelidikan';
    } else {
        editorCanvas.classList.add('hidden');
        editorCanvas.classList.remove('flex');
        playerCanvas.classList.remove('hidden');
        topPill.textContent = 'Mode Penyelidik';
        topPill.className = 'px-3 py-1 rounded-xl bg-[#6c5ce7] text-white text-[11px] font-bold shadow-sm cursor-pointer';
        sidebarLabel.textContent = 'Editor Kasus & Foto';
    }
}

function selectChapterCard(stageNum) {
    if (isEditorOpen) toggleMode();

    if (stageNum > gameState.currentStage && gameState.currentStage <= 3) {
        playErrorThud();
        showToast(`Babak 0${stageNum} masih terkunci! Selesaikan Babak 0${gameState.currentStage} terlebih dahulu.`, 'warning');
        return;
    }
    gameState.viewingStage = stageNum;
    renderDetectiveOS();
    inspectTimelineNode(stageNum);
    if (window.innerWidth < 1024) switchMobilePane('canvas');
}

function inspectTimelineNode(nodeIdx) {
    const titleEl = document.getElementById('popover-title');
    const descEl = document.getElementById('popover-desc');
    const badgeEl = document.getElementById('popover-badge');

    const nodesInfo = [
        {
            title: 'Simpul Awal: Kasus Sekolah Lama Dibuka',
            desc: 'Penyelidikan dimulai dari ruang loker gedung olahraga.',
            badge: 'MULAI',
            color: 'bg-[#f6e08b]'
        },
        {
            title: 'Cabang petunjuk/b1: Loker No. 14',
            desc: gameState.solvedAnswers[0]
                ? `Terpecahkan ("${gameState.solvedAnswers[0].toUpperCase()}"). Kata sandi ini terhubung langsung ke gembok Babak 3!`
                : 'Cabang petunjuk utama yang hasilnya akan digabungkan di Menara Jam (Babak 3).',
            badge: 'TERHUBUNG KE B3',
            color: 'bg-[#cbb4e8]'
        },
        {
            title: 'Cabang pengecoh/b2: Meja Kelas Lama',
            desc: gameState.solvedAnswers[1]
                ? `Jebakan Terdeteksi ("${gameState.solvedAnswers[1].toUpperCase()}"). Cabang ini buntu — jangan dipakai di Babak 3!`
                : 'Waspada! Tinta merah di meja kelas lama berpotensi menjadi pengecoh penyelidikan.',
            badge: 'PENGECOH (BUNTU)',
            color: 'bg-[#f0b98d]'
        },
        {
            title: 'Cabang kunci/b3: Menara Jam Senja',
            desc: 'Menggabungkan sandi asli dari Babak 1 dengan kode angka bayangan jam matahari.',
            badge: 'KUNCI BRANKAS',
            color: 'bg-[#b9d2a2]'
        },
        {
            title: 'Brankas Foto Rahasia',
            desc: gameState.currentStage === 4
                ? 'Foto kenangan berhasil dibuka! Klik untuk melihat ulang.'
                : 'Tersegel rapat oleh gembok kombinasi Menara Jam.',
            badge: gameState.currentStage === 4 ? 'TERBUKA' : 'TERSEGEL',
            color: 'bg-[#f6e08b]'
        }
    ];

    const info = nodesInfo[nodeIdx] || nodesInfo[1];
    titleEl.textContent = info.title;
    descEl.textContent = info.desc;
    badgeEl.textContent = info.badge;
    badgeEl.className = `px-2 py-0.5 rounded-lg ${info.color} text-clayink font-mono text-[10px] font-bold shrink-0`;

    if (nodeIdx === 4 && gameState.currentStage === 4) {
        openUnlockedPhotoModal();
    }
}

function renderDetectiveOS() {
    if (!activeVault) return;

    const cur = gameState.currentStage;
    const viewStg = cur === 4 ? 3 : gameState.viewingStage;

    const vaultLockBadge = document.getElementById('vault-lock-badge');
    if (vaultLockBadge) {
        vaultLockBadge.textContent = cur === 4 ? 'BRANKAS TERBUKA' : 'BRANKAS TERSEGEL';
    }

    for (let i = 1; i <= 3; i++) {
        const card = document.getElementById(`nav-card-${i}`);
        const badge = document.getElementById(`badge-stage-${i}`);
        const dot = document.getElementById(`dot-stage-${i}`);

        card.classList.toggle('clay-card-active', i === viewStg);

        if (i < cur || cur === 4) {
            if (i === 2) {
                badge.textContent = 'Pengecoh';
                badge.className = 'absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e08256] text-white shadow';
                dot.className = 'w-2.5 h-2.5 rounded-full bg-[#e08256]';
            } else {
                badge.textContent = 'Selesai';
                badge.className = 'absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#589c68] text-white shadow';
                dot.className = 'w-2.5 h-2.5 rounded-full bg-[#589c68]';
            }
        } else if (i === cur) {
            badge.textContent = 'Aktif';
            badge.className = 'absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6c5ce7] text-white shadow';
            dot.className = 'w-2.5 h-2.5 rounded-full bg-[#6c5ce7]';
        } else {
            badge.textContent = 'Terkunci';
            badge.className = 'absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8c7f70] text-white shadow';
            dot.className = 'w-2.5 h-2.5 rounded-full bg-[#b8ad9e]';
        }
    }

    document.getElementById('chk-1').textContent = gameState.solvedAnswers[0] ? '✓' : '•';
    document.getElementById('chk-2').textContent = gameState.solvedAnswers[1] ? '!' : '•';
    document.getElementById('chk-3').textContent = gameState.solvedAnswers[2] ? '✓' : '•';
    document.getElementById('chk-4').textContent = cur === 4 ? '✓' : '•';

    const lavText = document.getElementById('lavender-clue-text');
    if (gameState.solvedAnswers[0] && !gameState.solvedAnswers[1]) {
        lavText.textContent = `Sandi "${gameState.solvedAnswers[0].toUpperCase()}" tersimpan! Sekarang periksa meja kelas di Babak 2.`;
    } else if (gameState.solvedAnswers[1] && cur === 3) {
        lavText.textContent = `Babak 2 ternyata PENGECOH! Gunakan sandi Babak 1 ("${gameState.solvedAnswers[0].toUpperCase()}") + kode jam untuk Babak 3.`;
    } else if (cur === 4) {
        lavText.textContent = 'Semua bukti terhubung! Foto rahasia di Menara Jam berhasil dibuka.';
    } else {
        lavText.textContent = 'Temukan kata sandi di Babak 1 dulu. Hati-hati, tidak semua petunjuk di sekolah itu asli!';
    }

    if (gameState.solvedAnswers[0]) {
        document.getElementById('card-b1-status').textContent = 'VALID';
        document.getElementById('card-b1-val').textContent = gameState.solvedAnswers[0].toUpperCase();
    } else {
        document.getElementById('card-b1-status').textContent = 'BELUM';
        document.getElementById('card-b1-val').textContent = '[TERKUNCI]';
    }

    if (gameState.solvedAnswers[1]) {
        document.getElementById('card-b2-status').textContent = 'PENGECOH';
        document.getElementById('card-b2-val').textContent = gameState.solvedAnswers[1].toUpperCase();
        document.getElementById('card-b2-val').classList.add('line-through', 'opacity-70');
        document.getElementById('card-b2-note').textContent = 'Abaikan! Ini jebakan tinta merah.';
    } else {
        document.getElementById('card-b2-status').textContent = 'BELUM';
        document.getElementById('card-b2-val').textContent = '[TERKUNCI]';
        document.getElementById('card-b2-val').classList.remove('line-through', 'opacity-70');
        document.getElementById('card-b2-note').textContent = 'Status: Menunggu verifikasi';
    }

    if (gameState.solvedAnswers[2]) {
        document.getElementById('card-b3-status').textContent = 'TERBUKA';
        document.getElementById('card-b3-val').textContent = gameState.solvedAnswers[2].toUpperCase();
    } else if (gameState.solvedAnswers[0]) {
        document.getElementById('card-b3-status').textContent = 'SIAP';
        document.getElementById('card-b3-val').textContent = `${gameState.solvedAnswers[0].toUpperCase()} + [??]`;
    } else {
        document.getElementById('card-b3-status').textContent = 'TERSEGEL';
        document.getElementById('card-b3-val').textContent = '[BUKTI #01 + KODE JAM]';
    }

    const lineProgress = document.getElementById('line-main-progress');
    const xEndMap = { 1: 142, 2: 230, 3: 428, 4: 534 };
    lineProgress.setAttribute('x2', xEndMap[cur] || 142);

    const solvedCount = Math.min(gameState.solvedAnswers.length, 3);
    document.getElementById('progress-ratio-text').textContent = `${solvedCount}/3`;

    const visualHeader = document.getElementById('phone-visual-header');
    const stagePill = document.getElementById('phone-stage-pill');
    const statusTag = document.getElementById('phone-status-tag');
    const titleEl = document.getElementById('phone-title');
    const storyEl = document.getElementById('phone-story-text');
    const hintBoxEl = document.getElementById('phone-hint-box');
    const hintTextEl = document.getElementById('phone-hint-text');
    const hintTier2El = document.getElementById('phone-hint-tier2');
    const actionBtn = document.getElementById('phone-action-btn');

    if (cur === 4) {
        visualHeader.innerHTML = `<img src="${gameState.unlockedPhotoUrl}" alt="Foto Rahasia" class="w-full h-full object-cover">`;
        stagePill.textContent = 'BRANKAS TERBUKA';
        statusTag.textContent = '100% Terbuka';
        titleEl.textContent = 'Foto Kenangan Rahasia';
        storyEl.textContent = gameState.unlockedMessage;
        hintBoxEl.classList.remove('hidden');
        hintTextEl.textContent = `Kunci Gabungan Valid: ${gameState.solvedAnswers[2].toUpperCase()}`;
        hintTier2El.classList.add('hidden');
        actionBtn.textContent = 'Lihat Foto Ukuran Penuh';
        actionBtn.onclick = () => { playKeySound(); openUnlockedPhotoModal(); };
    } else {
        const stgObj = activeVault.stages[viewStg - 1];
        const hintLevel = gameState.unlockedHints[viewStg] || 0;

        visualHeader.innerHTML = getStageDioramaSvg(viewStg);
        stagePill.textContent = `BABAK 0${viewStg} / 03`;
        statusTag.textContent = viewStg < cur ? 'Terpecahkan' : 'Menunggu Sandi';
        titleEl.textContent = stgObj.title;
        storyEl.textContent = stgObj.story;

        if (hintLevel >= 1) {
            hintBoxEl.classList.remove('hidden');
            hintTextEl.textContent = stgObj.hint;
        } else {
            hintBoxEl.classList.add('hidden');
        }

        if (hintLevel >= 2) {
            hintTier2El.textContent = stgObj.hint2 || 'Periksa kembali ejaan & spasi jawaban.';
            hintTier2El.classList.remove('hidden');
        } else {
            hintTier2El.classList.add('hidden');
        }

        actionBtn.textContent = viewStg === cur ? 'Masukkan Kode Temuan' : 'Kembali ke Babak Aktif';
        actionBtn.onclick = () => {
            playKeySound();
            if (viewStg !== cur) {
                gameState.viewingStage = cur;
                renderDetectiveOS();
            }
            focusAnswerInput();
        };
    }
}

/* --- Validasi Jawaban & Pembukaan Brankas --- */

async function submitStageAnswer(event) {
    event.preventDefault();
    if (!activeVault || gameState.currentStage > 3) return;

    const inputEl = document.getElementById('player-input');
    const errBox = document.getElementById('player-error-msg');
    const guess = normalizeAnswer(inputEl.value);
    if (!guess) return;

    const stg = gameState.currentStage;
    let hash = '';

    if (stg === 1) {
        hash = await sha256Hex(`B1::${guess}`);
    } else if (stg === 2) {
        hash = await sha256Hex(`B2::${gameState.solvedAnswers[0]}::${guess}`);
    } else if (stg === 3) {
        hash = await sha256Hex(`B3::${gameState.solvedAnswers[0]}::${gameState.solvedAnswers[1]}::${guess}`);
    }

    if (hash === activeVault.hashes[stg - 1]) {
        errBox.classList.add('hidden');
        gameState.solvedAnswers.push(guess);
        inputEl.value = '';

        if (stg === 1) {
            playUnlockChime(false);
            gameState.currentStage = 2;
            gameState.viewingStage = 2;
            showToast(`Sandi Loker 14 ("${guess.toUpperCase()}") valid! Simpan untuk Babak 3.`, 'success');
            appendActivityLog('Detektif_Loker', 'bg-[#cbb4e8]', `Menemukan sandi asli Babak 1: "${guess.toUpperCase()}".`, 'done');
            inspectTimelineNode(1);
            renderDetectiveOS();
        } else if (stg === 2) {
            playUnlockChime(false);
            gameState.currentStage = 3;
            gameState.viewingStage = 3;
            showToast('Jebakan terdeteksi! Tinta merah di meja kelas hanyalah PENGECOH.', 'warning');
            appendActivityLog('Analisis_Pengecoh', 'bg-[#f0b98d]', `Cabang Babak 2 ("${guess.toUpperCase()}") terbukti buntu/pengecoh!`, 'decoy');
            inspectTimelineNode(2);
            renderDetectiveOS();
        } else if (stg === 3) {
            const btn = document.getElementById('btn-submit-answer');
            btn.disabled = true;
            btn.textContent = 'Membuka...';

            try {
                const masterPass = gameState.solvedAnswers.join('|');
                const decrypted = await decryptSecretPayload(activeVault.encrypted, masterPass);

                playUnlockChime(true);
                gameState.unlockedPhotoUrl = decrypted.photo;
                gameState.unlockedMessage = decrypted.message;
                gameState.currentStage = 4;

                const finalTime = formatSecondsMMSS(elapsedSeconds + penaltySeconds);
                showToast(`Gembok terbuka dalam ${finalTime}! Foto rahasia berhasil ditemukan.`, 'success');
                appendActivityLog('Brankas_Menara', 'bg-[#b9d2a2]', `Brankas foto terbuka (Waktu: ${finalTime})!`, 'done');
                inspectTimelineNode(4);
                renderDetectiveOS();
                openUnlockedPhotoModal();
            } catch (err) {
                console.error(err);
                playErrorThud();
                showToast('Gagal membuka foto rahasia.', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>Periksa</span><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
            }
        }
    } else {
        playErrorThud();
        errBox.classList.remove('hidden');
        const bezel = document.querySelector('.clay-phone-bezel');
        bezel.classList.remove('animate-shake');
        void bezel.offsetWidth;
        bezel.classList.add('animate-shake');
        inputEl.select();
    }
}

/* --- Modal & Bantuan --- */

function openUnlockedPhotoModal() {
    if (gameState.currentStage !== 4) return;
    const modal = document.getElementById('vault-modal');
    const badge = document.getElementById('modal-badge');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body-content');

    badge.textContent = 'ARSIP TERBUKA';
    badge.className = 'px-2.5 py-1 rounded-xl bg-[#b9d2a2] text-clayink font-mono text-xs font-extrabold';
    title.textContent = 'Berkas Foto Rahasia Terungkap';

    body.innerHTML = '';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'rounded-2xl overflow-hidden border-2 border-white shadow-md bg-[#1e272e]';
    const img = document.createElement('img');
    img.src = gameState.unlockedPhotoUrl;
    img.alt = 'Foto Rahasia';
    img.className = 'w-full max-h-[360px] object-contain mx-auto';
    imgWrap.appendChild(img);

    const msgBox = document.createElement('div');
    msgBox.className = 'clay-sticky-yellow p-3.5 text-xs sm:text-sm font-semibold text-clayink leading-relaxed';
    msgBox.textContent = gameState.unlockedMessage;

    const dlBtn = document.createElement('a');
    dlBtn.href = gameState.unlockedPhotoUrl;
    dlBtn.download = 'foto-rahasia-detektif-os.jpg';
    dlBtn.className = 'clay-btn-primary w-full py-3 font-bold text-xs sm:text-sm text-center block';
    dlBtn.textContent = 'Unduh Foto Kenangan ke Perangkat';

    body.appendChild(imgWrap);
    body.appendChild(msgBox);
    body.appendChild(dlBtn);

    modal.classList.remove('hidden');
}

function toggleClueBoardModal() {
    const modal = document.getElementById('vault-modal');
    const badge = document.getElementById('modal-badge');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body-content');

    badge.textContent = 'STRUKTUR ALUR';
    badge.className = 'px-2.5 py-1 rounded-xl bg-[#cbb4e8] text-clayink font-mono text-xs font-extrabold';
    title.textContent = 'Peta Koneksi & Pengecoh Kasus';

    body.innerHTML = `
        <div class="space-y-2.5 text-xs text-clayink">
            <div class="clay-sticky-lavender p-3">
                <p class="font-extrabold">1. Babak 01 (Loker No. 14) &rarr; Kunci Inti</p>
                <p class="mt-0.5">Jawaban dari babak pertama merupakan bagian pertama dari kata sandi gembok akhir di Babak 03.</p>
            </div>
            <div class="clay-sticky-peach p-3">
                <p class="font-extrabold">2. Babak 02 (Meja Kelas Lama) &rarr; Pengecoh</p>
                <p class="mt-0.5">Catatan tinta merah di buku harian sengaja dibuat untuk mengecoh penyelidik. Jangan masukkan jawaban Babak 02 ke gembok terakhir!</p>
            </div>
            <div class="clay-sticky-sage p-3">
                <p class="font-extrabold">3. Babak 03 (Menara Jam Senja) &rarr; Brankas Foto</p>
                <p class="mt-0.5">Gabungkan <strong>[Jawaban Babak 1]</strong> + spasi + <strong>[Kode Jam Matahari]</strong> untuk membuka brankas foto rahasia.</p>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closeVaultModal() {
    document.getElementById('vault-modal').classList.add('hidden');
}

function showQuickHint() {
    const stg = gameState.currentStage === 4 ? 3 : gameState.viewingStage;
    if (!activeVault) return;

    const currentTier = gameState.unlockedHints[stg] || 0;
    if (currentTier < 2) {
        gameState.unlockedHints[stg] = currentTier + 1;
        penaltySeconds += 120;
        const penEl = document.getElementById('penalty-counter');
        if (penEl) penEl.textContent = `+${formatSecondsMMSS(penaltySeconds)}`;

        appendActivityLog(
            'Sistem_Petunjuk',
            'bg-[#f6e08b]',
            `Membuka Petunjuk Tingkat ${currentTier + 1} Babak 0${stg} (+02:00 penalti).`,
            'decoy'
        );
        renderDetectiveOS();
        showToast(`Petunjuk Tingkat ${currentTier + 1} Babak 0${stg} dibuka (+02:00 penalti waktu).`, 'info');
    } else {
        showToast(`Semua petunjuk Babak 0${stg} sudah terbuka di layar bukti!`, 'info');
    }

    if (window.innerWidth < 1024) switchMobilePane('canvas');
}

function focusAnswerInput() {
    if (isEditorOpen) toggleMode();
    if (window.innerWidth < 1024) switchMobilePane('canvas');
    const inp = document.getElementById('player-input');
    inp.focus();
}

function resetPlayerProgress() {
    gameState = {
        currentStage: 1,
        viewingStage: 1,
        solvedAnswers: [],
        unlockedHints: { 1: 0, 2: 0, 3: 0 },
        unlockedPhotoUrl: '',
        unlockedMessage: ''
    };
    elapsedSeconds = 0;
    penaltySeconds = 0;
    document.getElementById('player-error-msg').classList.add('hidden');
    document.getElementById('player-input').value = '';
    appendActivityLog('Reset_Kasus', 'bg-[#f6e08b]', 'Penyelidikan & stopwatch diatur ulang ke Babak 01.', 'info');
    inspectTimelineNode(1);
    renderDetectiveOS();
}

/* --- Inisialisasi --- */

window.addEventListener('DOMContentLoaded', async () => {
    if (EMBEDDED_VAULT_PAYLOAD) {
        activeVault = EMBEDDED_VAULT_PAYLOAD;

        const topPill = document.getElementById('top-mode-pill');
        if (topPill) {
            topPill.textContent = 'Mode Penyelidik';
            topPill.className = 'px-3 py-1 rounded-xl bg-[#6c5ce7] text-white text-[11px] font-bold shadow-sm cursor-default';
            topPill.disabled = true;
        }

        const editorView = document.getElementById('canvas-editor-mode');
        if (editorView) editorView.remove();
        const sidebarEditorBtn = document.getElementById('btn-sidebar-editor');
        if (sidebarEditorBtn) sidebarEditorBtn.remove();
        const dockEditorBtn = document.getElementById('dock-btn-editor');
        if (dockEditorBtn) dockEditorBtn.remove();
        const dockExportBtn = document.getElementById('dock-btn-export');
        if (dockExportBtn) dockExportBtn.remove();
    } else {
        const samplePhoto = createDefaultMemoryPolaroid();
        const preview = document.getElementById('setup-photo-preview');
        const placeholder = document.getElementById('upload-placeholder');
        if (preview && placeholder) {
            preview.src = samplePhoto;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }
        activeVault = await buildVaultFromEditor();
    }

    appendActivityLog('Arsip_Sekolah', 'bg-[#b9d2a2]', 'Memuat berkas misteri sekolah lama (3 babak).', 'done');
    appendActivityLog('Segel_Brankas', 'bg-[#cbb4e8]', 'Foto rahasia tersegel rapat di dalam brankas.', 'done');
    startDetectiveStopwatch();
    renderDetectiveOS();
});