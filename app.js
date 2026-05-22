// Global Control states
const exponent = 3; // Modifica per escalar paramètricament (ex: 3 -> 10^3, 4 -> 10^4)
const L = Math.pow(10, exponent);
const VIEW_SIZE = 200; // Finestra del test referencial limitat i quadrat de zoom.
const b = Math.floor(L / VIEW_SIZE);
const Z_b = 8.5; // Factor constant de Wilson (Ajustar manualment visual a test)

let grid = [];
let isSimulating = false;
let animationId = null;
let temperature = 1.0; // Normalized minimum T/Tc
const Tc = 2.269185 - (0.9679 / L); // Donarà aproximadament 2.262731

// UI Elements
const tempSlider = document.getElementById('temperatureSlider');
const tempSliderValue = document.getElementById('tempSliderValue');
const tempDisplay = document.getElementById('tempDisplay');
const kelvinDisplay = document.getElementById('kelvinDisplay');
const initStateSelect = document.getElementById('initialState');
const applyInitBtn = document.getElementById('applyInitBtn');
const toggleSimBtn = document.getElementById('toggleSimBtn');

// Canvases
const canvas1 = document.getElementById('simCanvas150');
const canvas2 = document.getElementById('simCanvasZoom');
const canvas3 = document.getElementById('simCanvas75');

document.getElementById('titleOriginal').textContent = `1. Graella Original (${L}x${L})`;
document.getElementById('titleZoom').textContent = `2. Zoom Quadrant (${VIEW_SIZE}x${VIEW_SIZE})`;
document.getElementById('titleCoarse').textContent = `3. Coarse-Graining b=${b} (${VIEW_SIZE}x${VIEW_SIZE})`;

const ctx1 = canvas1.getContext('2d');
const ctx2 = canvas2.getContext('2d');
const ctx3 = canvas3.getContext('2d');

canvas1.width = L; canvas1.height = L;
canvas2.width = VIEW_SIZE; canvas2.height = VIEW_SIZE;
canvas3.width = VIEW_SIZE; canvas3.height = VIEW_SIZE;

const imgData1 = ctx1.createImageData(L, L);
const imgData2 = ctx2.createImageData(VIEW_SIZE, VIEW_SIZE);
const imgData3 = ctx3.createImageData(VIEW_SIZE, VIEW_SIZE);

const mag1 = document.getElementById('magDisplay150');
const mag2 = document.getElementById('magDisplayZoom');
const mag3 = document.getElementById('magDisplay75');

function initializeAll(stateType) {
    grid = new Array(L);
    for (let i = 0; i < L; i++) {
        grid[i] = new Int8Array(L);
        for (let j = 0; j < L; j++) {
            if (stateType === 'up') grid[i][j] = 1;
            else if (stateType === 'down') grid[i][j] = -1;
            else grid[i][j] = Math.random() < 0.5 ? 1 : -1;
        }
    }
    renderAll();
}

function renderAll() {
    // 1. Base grid
    let m1 = 0;
    let idx1 = 0;
    for (let i = 0; i < L; i++) {
        for (let j = 0; j < L; j++) {
            const s = grid[i][j];
            m1 += s;
            if (s === 1) { imgData1.data[idx1++] = 96; imgData1.data[idx1++] = 165; imgData1.data[idx1++] = 250; imgData1.data[idx1++] = 255; }
            else { imgData1.data[idx1++] = 15; imgData1.data[idx1++] = 23; imgData1.data[idx1++] = 42; imgData1.data[idx1++] = 255; }
        }
    }
    mag1.textContent = (m1 / (L * L)).toFixed(3);
    ctx1.putImageData(imgData1, 0, 0);

    // 2. Zoom al Quadrant superior esquerre
    let m2 = 0;
    let idx2 = 0;
    for (let i = 0; i < VIEW_SIZE; i++) {
        for (let j = 0; j < VIEW_SIZE; j++) {
            const s = grid[i][j];
            m2 += s;
            if (s === 1) { imgData2.data[idx2++] = 96; imgData2.data[idx2++] = 165; imgData2.data[idx2++] = 250; imgData2.data[idx2++] = 255; }
            else { imgData2.data[idx2++] = 15; imgData2.data[idx2++] = 23; imgData2.data[idx2++] = 42; imgData2.data[idx2++] = 255; }
        }
    }
    mag2.textContent = (m2 / (VIEW_SIZE * VIEW_SIZE)).toFixed(3);
    ctx2.putImageData(imgData2, 0, 0);

    // 3. Block continuous paramètric automàtic
    let avg3 = new Float32Array(VIEW_SIZE * VIEW_SIZE);
    let k3 = 0;
    const b2 = b * b;

    for (let i = 0; i < VIEW_SIZE; i++) {
        for (let j = 0; j < VIEW_SIZE; j++) {
            let sum = 0;
            for (let di = 0; di < b; di++) {
                for (let dj = 0; dj < b; dj++) {
                    sum += grid[i * b + di][j * b + dj];
                }
            }
            let avgSpin = sum / b2;
            avg3[k3++] = avgSpin;
        }
    }

    let m3 = 0;
    let idx3 = 0;
    k3 = 0;
    for (let i = 0; i < VIEW_SIZE; i++) {
        for (let j = 0; j < VIEW_SIZE; j++) {
            let rawAvg = avg3[k3++];
            m3 += rawAvg;

            let scaledSpin = rawAvg * Z_b;
            if (scaledSpin > 1) scaledSpin = 1;
            if (scaledSpin < -1) scaledSpin = -1;

            let f = (scaledSpin + 1) / 2;
            imgData3.data[idx3++] = 15 + f * (96 - 15);
            imgData3.data[idx3++] = 23 + f * (165 - 23);
            imgData3.data[idx3++] = 42 + f * (250 - 42);
            imgData3.data[idx3++] = 255;
        }
    }
    mag3.textContent = (m3 / (VIEW_SIZE * VIEW_SIZE)).toFixed(3);
    ctx3.putImageData(imgData3, 0, 0);
}

function doSweep(T) {
    const probFlip4 = Math.exp(-4 / T);
    const probFlip8 = Math.exp(-8 / T);
    const N = L * L;

    for (let step = 0; step < N; step++) {
        const i = Math.floor(Math.random() * L);
        const j = Math.floor(Math.random() * L);
        const s = grid[i][j];

        const up = grid[(i - 1 + L) % L][j];
        const down = grid[(i + 1) % L][j];
        const left = grid[i][(j - 1 + L) % L];
        const right = grid[i][(j + 1) % L];

        const sumNeighbors = up + down + left + right;
        const dE = 2 * s * sumNeighbors;

        if (dE <= 0) {
            grid[i][j] = -s;
        } else {
            const prob = (dE === 4) ? probFlip4 : (dE === 8 ? probFlip8 : Math.exp(-dE / T));
            if (Math.random() < prob) {
                grid[i][j] = -s;
            }
        }
    }
}

function loop() {
    if (!isSimulating) return;

    const T = temperature * Tc;
    // Iterate només 1 frame per optimitzar el mainthread i que el JIT de V8 pugui escombrar (sense freezar la màquina massa!).
    doSweep(T);

    renderAll();
    animationId = requestAnimationFrame(loop);
}

// ------------------------------------
// Event Listeners
// ------------------------------------
toggleSimBtn.addEventListener('click', () => {
    isSimulating = !isSimulating;
    if (isSimulating) {
        toggleSimBtn.textContent = 'Pausar Simulació';
        toggleSimBtn.classList.replace('btn-primary', 'btn-secondary');
        loop();
    } else {
        toggleSimBtn.textContent = 'Iniciar Simulació';
        toggleSimBtn.classList.replace('btn-secondary', 'btn-primary');
        cancelAnimationFrame(animationId);
    }
});

applyInitBtn.addEventListener('click', () => {
    const st = initStateSelect.value;
    initializeAll(st);
});

temperatureSlider.addEventListener('input', (e) => {
    temperature = parseFloat(e.target.value);
    const valStr = temperature.toFixed(2);
    tempSliderValue.textContent = valStr;
    tempDisplay.textContent = valStr;
    kelvinDisplay.textContent = (temperature * Tc).toFixed(2);
});

// Init on page load
initializeAll('random');
