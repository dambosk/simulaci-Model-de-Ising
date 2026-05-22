// Global Control states
const exponent = 3; // Modifica per escalar paramètricament (ex: 3 -> 10^3, 4 -> 10^4)
const L = Math.pow(10, exponent);
const VIEW_SIZE = 200; // Finestra del test referencial limitat i quadrat de zoom.
const b = Math.floor(L / VIEW_SIZE);
const Z_b = 8.5; // Factor constant de Wilson (Ajustar manualment visual a test)

let grid = [];
let gridB = []; // For Damage Spreading comparison
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

// Canvases Phase 1
const canvas1 = document.getElementById('simCanvas150');
const canvas2 = document.getElementById('simCanvasZoom');
const canvas3 = document.getElementById('simCanvas75');

// Canvases Phase 2 (Damage Spreading)
const canvasA = document.getElementById('simCanvasA');
const canvasB = document.getElementById('simCanvasB');
const canvasD = document.getElementById('simCanvasDamage');

document.getElementById('titleOriginal').textContent = `1. Graella Original (${L}x${L})`;
document.getElementById('titleZoom').textContent = `2. Zoom Quadrant (${VIEW_SIZE}x${VIEW_SIZE})`;
document.getElementById('titleCoarse').textContent = `3. Coarse-Graining b=${b} (${VIEW_SIZE}x${VIEW_SIZE})`;

const ctx1 = canvas1.getContext('2d');
const ctx2 = canvas2.getContext('2d');
const ctx3 = canvas3.getContext('2d');
const ctxA = canvasA.getContext('2d');
const ctxB = canvasB.getContext('2d');
const ctxD = canvasD.getContext('2d');

canvas1.width = L; canvas1.height = L;
canvas2.width = VIEW_SIZE; canvas2.height = VIEW_SIZE;
canvas3.width = VIEW_SIZE; canvas3.height = VIEW_SIZE;
canvasA.width = L; canvasA.height = L;
canvasB.width = L; canvasB.height = L;
canvasD.width = L; canvasD.height = L;

const imgData1 = ctx1.createImageData(L, L);
const imgData2 = ctx2.createImageData(VIEW_SIZE, VIEW_SIZE);
const imgData3 = ctx3.createImageData(VIEW_SIZE, VIEW_SIZE);
const imgDataA = ctxA.createImageData(L, L);
const imgDataB = ctxB.createImageData(L, L);
const imgDataD = ctxD.createImageData(L, L);

const mag1 = document.getElementById('magDisplay150');
const mag2 = document.getElementById('magDisplayZoom');
const mag3 = document.getElementById('magDisplay75');
const damageCountDisplay = document.getElementById('damageCount');

function initializeAll(stateType) {
    grid = new Array(L);
    gridB = new Array(L);
    for (let i = 0; i < L; i++) {
        grid[i] = new Int8Array(L);
        gridB[i] = new Int8Array(L);
        for (let j = 0; j < L; j++) {
            let s = 1;
            if (stateType === 'up') s = 1;
            else if (stateType === 'down') s = -1;
            else s = Math.random() < 0.5 ? 1 : -1;

            grid[i][j] = s;
            gridB[i][j] = s;
        }
    }
    renderAll();
}

function renderAll() {
    // 1. Base grid & Damage Spreading Phase 2 rendering together (L x L)
    let m1 = 0;
    let damageNodes = 0;
    let idxL = 0;

    for (let i = 0; i < L; i++) {
        for (let j = 0; j < L; j++) {
            const sA = grid[i][j];
            const sB = gridB[i][j];
            m1 += sA;

            // Render grid A (Base model)
            if (sA === 1) {
                imgData1.data[idxL] = 96; imgData1.data[idxL + 1] = 165; imgData1.data[idxL + 2] = 250; imgData1.data[idxL + 3] = 255;
                imgDataA.data[idxL] = 96; imgDataA.data[idxL + 1] = 165; imgDataA.data[idxL + 2] = 250; imgDataA.data[idxL + 3] = 255;
            } else {
                imgData1.data[idxL] = 15; imgData1.data[idxL + 1] = 23; imgData1.data[idxL + 2] = 42; imgData1.data[idxL + 3] = 255;
                imgDataA.data[idxL] = 15; imgDataA.data[idxL + 1] = 23; imgDataA.data[idxL + 2] = 42; imgDataA.data[idxL + 3] = 255;
            }

            // Render grid B (Perturbed shadow model)
            if (sB === 1) {
                imgDataB.data[idxL] = 96; imgDataB.data[idxL + 1] = 165; imgDataB.data[idxL + 2] = 250; imgDataB.data[idxL + 3] = 255;
            } else {
                imgDataB.data[idxL] = 15; imgDataB.data[idxL + 1] = 23; imgDataB.data[idxL + 2] = 42; imgDataB.data[idxL + 3] = 255;
            }

            // Render Damage grid (Red for perturbation, empty black for equal alignment)
            if (sA !== sB) {
                damageNodes++;
                imgDataD.data[idxL] = 255; imgDataD.data[idxL + 1] = 40; imgDataD.data[idxL + 2] = 40; imgDataD.data[idxL + 3] = 255;
            } else {
                imgDataD.data[idxL] = 0; imgDataD.data[idxL + 1] = 0; imgDataD.data[idxL + 2] = 0; imgDataD.data[idxL + 3] = 255;
            }

            idxL += 4;
        }
    }
    mag1.textContent = (m1 / (L * L)).toFixed(3);
    damageCountDisplay.textContent = damageNodes;

    ctx1.putImageData(imgData1, 0, 0);
    ctxA.putImageData(imgDataA, 0, 0);
    ctxB.putImageData(imgDataB, 0, 0);
    ctxD.putImageData(imgDataD, 0, 0);

    // 2. Zoom al Quadrant superior esquerre (Lligat a Model A per Kadanoff test)
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

// Separate node logic handler dynamically capable of mutating arbitrary grids
function updateSpin(g, i, j, randProb, T, probFlip4, probFlip8) {
    const s = g[i][j];
    const up = g[(i - 1 + L) % L][j];
    const down = g[(i + 1) % L][j];
    const left = g[i][(j - 1 + L) % L];
    const right = g[i][(j + 1) % L];

    const sumNeighbors = up + down + left + right;
    const dE = 2 * s * sumNeighbors;

    if (dE <= 0) {
        g[i][j] = -s;
    } else {
        const prob = (dE === 4) ? probFlip4 : (dE === 8 ? probFlip8 : Math.exp(-dE / T));
        if (randProb < prob) { // Sync thermal random path applied here!
            g[i][j] = -s;
        }
    }
}

function doSweep(T) {
    const probFlip4 = Math.exp(-4 / T);
    const probFlip8 = Math.exp(-8 / T);
    const N = L * L;

    // Simulate same thermal noise sequence for BOTH models A and B synchronously
    for (let step = 0; step < N; step++) {
        const i = Math.floor(Math.random() * L);
        const j = Math.floor(Math.random() * L);
        const p = Math.random();

        updateSpin(grid, i, j, p, T, probFlip4, probFlip8);
        updateSpin(gridB, i, j, p, T, probFlip4, probFlip8);
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

// Damage interaction setup (Click to perturb Model B)
canvasB.addEventListener('mousedown', (e) => {
    const rect = canvasB.getBoundingClientRect();
    const scaleX = canvasB.width / rect.width;
    const scaleY = canvasB.height / rect.height;

    // Position mapped to specific node index relative to native grid logic L
    const cx = Math.floor((e.clientX - rect.left) * scaleX);
    const cy = Math.floor((e.clientY - rect.top) * scaleY);

    // Depending on resolution, flip a cluster to make damage visible immediately 
    const r = L > 300 ? 5 : 1;

    for (let di = -r; di <= r; di++) {
        for (let dj = -r; dj <= r; dj++) {
            if (di * di + dj * dj <= r * r) {
                let i = (cy + di + L) % L;
                let j = (cx + dj + L) % L;
                gridB[i][j] = -gridB[i][j]; // Flip only Model B introducing macro-damage chaos
            }
        }
    }

    // Draw initial perturbation immediately 
    if (!isSimulating) {
        renderAll();
    }
});

// Init on page load
initializeAll('random');
