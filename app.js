// --- State Management ---
const state = {
    activeModes: {
        solid: false,
        gradient: false,
        arrows: false,
        shift: false
    },
    settings: {
        neglectSide: 'left', // 'left' or 'right'
        solidOpacity: 0.5,   // 0.1 to 1.0
        gradientWidth: 0.5,  // 0.1 to 1.0
        gradientOpacity: 0.8, // 0.2 to 1.0
        arrowSpeed: 3,       // 1 to 5
        arrowSize: 40,       // 20 to 80 px
        arrowOpacity: 0.6,   // 0.1 to 1.0
        shiftOffset: 0,      // -100 to 100 (left to right)
        shiftZoom: 1.3       // 1.1 to 2.0
    },
    videoStream: null,
    animationFrameId: null,
    arrowsList: []
};

// --- Arrow Object Definition ---
class VisualArrow {
    constructor(yPercent, offsetDelay) {
        this.yPercent = yPercent; // Vertical position as % of screen height
        this.offsetDelay = offsetDelay; // Delay multiplier for staggering
        this.x = 0;
        this.isInitialized = false;
    }

    init(canvasWidth) {
        this.reset(canvasWidth, true);
        this.isInitialized = true;
    }

    reset(canvasWidth, isInitial = false) {
        const side = state.settings.neglectSide;
        // Stagger initial positions, otherwise start off-screen
        const offset = isInitial ? (canvasWidth * this.offsetDelay) : 0;

        if (side === 'left') {
            // Move right to left (guide eyes to the left neglect side)
            this.x = canvasWidth + 50 + offset;
        } else {
            // Move left to right (guide eyes to the right neglect side)
            this.x = -50 - offset;
        }
    }

    update(canvasWidth, speedScale) {
        if (!this.isInitialized) {
            this.init(canvasWidth);
        }

        const side = state.settings.neglectSide;
        // Base speed times the scale factor
        const step = (1.5 + speedScale * 1.5); 

        if (side === 'left') {
            this.x -= step;
            if (this.x < -80) {
                this.reset(canvasWidth);
            }
        } else {
            this.x += step;
            if (this.x > canvasWidth + 80) {
                this.reset(canvasWidth);
            }
        }
    }

    draw(ctx, canvasHeight, size, opacity) {
        const side = state.settings.neglectSide;
        
        ctx.save();
        ctx.fillStyle = `rgba(14, 213, 201, ${opacity})`;
        ctx.font = `bold ${size}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add subtle neon glow
        ctx.shadowColor = 'rgba(14, 213, 201, 0.6)';
        ctx.shadowBlur = 8;

        // Render direction character
        const char = side === 'left' ? '◀' : '▶';
        const y = canvasHeight * this.yPercent;
        
        ctx.fillText(char, this.x, y);
        ctx.restore();
    }
}

// --- DOM Elements ---
const elements = {
    video: document.getElementById('video-feed'),
    canvas: document.getElementById('ar-canvas'),
    togglePanelBtn: document.getElementById('toggle-panel-btn'),
    controlPanel: document.getElementById('control-panel'),
    cameraToggleBtn: document.getElementById('camera-toggle-btn'),
    resetSettingsBtn: document.getElementById('reset-settings-btn'),
    cameraError: document.getElementById('camera-error'),
    errorMessage: document.getElementById('error-message'),
    retryCameraBtn: document.getElementById('retry-camera-btn'),
    
    // Config controls
    sideLeft: document.getElementById('side-left'),
    sideRight: document.getElementById('side-right'),
    
    modeSolidEnable: document.getElementById('mode-solid-enable'),
    solidOpacity: document.getElementById('solid-opacity'),
    solidOpacityVal: document.getElementById('solid-opacity-val'),
    
    modeGradientEnable: document.getElementById('mode-gradient-enable'),
    gradientWidth: document.getElementById('gradient-width'),
    gradientWidthVal: document.getElementById('gradient-width-val'),
    gradientOpacity: document.getElementById('gradient-opacity'),
    gradientOpacityVal: document.getElementById('gradient-opacity-val'),
    
    modeArrowsEnable: document.getElementById('mode-arrows-enable'),
    arrowSpeed: document.getElementById('arrow-speed'),
    arrowSpeedVal: document.getElementById('arrow-speed-val'),
    arrowSize: document.getElementById('arrow-size'),
    arrowSizeVal: document.getElementById('arrow-size-val'),
    arrowOpacity: document.getElementById('arrow-opacity'),
    arrowOpacityVal: document.getElementById('arrow-opacity-val'),
    
    modeShiftEnable: document.getElementById('mode-shift-enable'),
    shiftOffset: document.getElementById('shift-offset'),
    shiftOffsetVal: document.getElementById('shift-offset-val'),
    shiftZoom: document.getElementById('shift-zoom'),
    shiftZoomVal: document.getElementById('shift-zoom-val'),
    
    pwaInstallBanner: document.getElementById('pwa-install-banner'),
    pwaInstallBtn: document.getElementById('pwa-install-btn'),
    pwaCloseBtn: document.getElementById('pwa-close-btn')
};

// Initialize Canvas context
const ctx = elements.canvas.getContext('2d');

// --- Initialize Flowing Arrows ---
function initArrows() {
    state.arrowsList = [
        new VisualArrow(0.25, 0.0), // Top line
        new VisualArrow(0.50, 0.45), // Middle line
        new VisualArrow(0.75, 0.25), // Bottom line
        new VisualArrow(0.35, 0.7),  // Mid-top
        new VisualArrow(0.65, 0.15)  // Mid-bottom
    ];
}

// --- Setup Event Listeners ---
function setupEventListeners() {
    // Panel Toggle
    elements.togglePanelBtn.addEventListener('click', () => {
        elements.controlPanel.classList.toggle('hidden');
        elements.togglePanelBtn.classList.toggle('panel-closed');
    });

    // Camera Toggle
    elements.cameraToggleBtn.addEventListener('click', () => {
        if (state.videoStream) {
            stopCamera();
        } else {
            startCamera();
        }
    });

    // Retry Camera
    elements.retryCameraBtn.addEventListener('click', () => {
        elements.cameraError.classList.add('hidden');
        startCamera();
    });

    // Reset Settings
    elements.resetSettingsBtn.addEventListener('click', resetToDefaults);

    // Neglect Side change
    const handleSideChange = (e) => {
        state.settings.neglectSide = e.target.value;
        // Reset all arrows positions to match the new direction
        state.arrowsList.forEach(arrow => arrow.reset(elements.canvas.width));
    };
    elements.sideLeft.addEventListener('change', handleSideChange);
    elements.sideRight.addEventListener('change', handleSideChange);

    // Mode Toggle Bindings
    elements.modeSolidEnable.addEventListener('change', (e) => {
        state.activeModes.solid = e.target.checked;
        toggleSectionActive('section-solid', e.target.checked);
    });
    elements.modeGradientEnable.addEventListener('change', (e) => {
        state.activeModes.gradient = e.target.checked;
        toggleSectionActive('section-gradient', e.target.checked);
    });
    elements.modeArrowsEnable.addEventListener('change', (e) => {
        state.activeModes.arrows = e.target.checked;
        toggleSectionActive('section-arrows', e.target.checked);
        if (e.target.checked) {
            state.arrowsList.forEach(arrow => arrow.reset(elements.canvas.width));
        }
    });
    elements.modeShiftEnable.addEventListener('change', (e) => {
        state.activeModes.shift = e.target.checked;
        toggleSectionActive('section-shift', e.target.checked);
    });

    // Sliders Bindings
    elements.solidOpacity.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.settings.solidOpacity = val / 100;
        elements.solidOpacityVal.textContent = `${val}%`;
    });

    elements.gradientWidth.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.settings.gradientWidth = val / 100;
        elements.gradientWidthVal.textContent = `${val}%`;
    });
    elements.gradientOpacity.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.settings.gradientOpacity = val / 100;
        elements.gradientOpacityVal.textContent = `${val}%`;
    });

    elements.arrowSpeed.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.settings.arrowSpeed = val;
        const labels = ['極遅', '遅い', '普通', '速い', '極速'];
        elements.arrowSpeedVal.textContent = labels[val - 1];
    });
    elements.arrowSize.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.settings.arrowSize = val;
        let sizeLabel = '中';
        if (val < 30) sizeLabel = '小';
        else if (val > 60) sizeLabel = '大';
        elements.arrowSizeVal.textContent = `${sizeLabel} (${val}px)`;
    });
    elements.arrowOpacity.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.settings.arrowOpacity = val / 100;
        elements.arrowOpacityVal.textContent = `${val}%`;
    });

    elements.shiftOffset.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.settings.shiftOffset = val;
        
        let direction = '';
        if (val < 0) direction = `左へ ${Math.abs(val)}`;
        else if (val > 0) direction = `右へ ${val}`;
        else direction = '中央';
        
        elements.shiftOffsetVal.textContent = direction;
    });
    elements.shiftZoom.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 10;
        state.settings.shiftZoom = val;
        elements.shiftZoomVal.textContent = `${val.toFixed(1)}x`;
    });

    // Resize Event
    window.addEventListener('resize', resizeCanvas);
}

function toggleSectionActive(sectionId, isActive) {
    const el = document.getElementById(sectionId);
    if (isActive) {
        el.classList.add('active');
    } else {
        el.classList.remove('active');
    }
}

// --- Canvas Resizing ---
function resizeCanvas() {
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;
    
    // Align canvas drawing buffer with its display size
    if (elements.canvas.width !== displayWidth || elements.canvas.height !== displayHeight) {
        elements.canvas.width = displayWidth;
        elements.canvas.height = displayHeight;
        
        // Re-align arrow initial placements based on new dimensions
        state.arrowsList.forEach(arrow => arrow.reset(displayWidth, true));
    }
}

// --- Camera Access ---
async function startCamera() {
    elements.cameraToggleBtn.textContent = '接続中...';
    elements.cameraToggleBtn.disabled = true;

    const constraints = {
        video: {
            facingMode: 'environment', // Prefer back camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    };

    try {
        if (state.videoStream) {
            stopCamera();
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        state.videoStream = stream;
        elements.video.srcObject = stream;
        
        // Wait for video metadata to load so we know the video dimensions
        elements.video.onloadedmetadata = () => {
            elements.video.play();
            resizeCanvas();
            startRenderLoop();
            
            elements.cameraToggleBtn.textContent = 'カメラを停止';
            elements.cameraToggleBtn.disabled = false;
            elements.cameraToggleBtn.classList.remove('btn-primary');
            elements.cameraToggleBtn.classList.add('btn-secondary');
        };
    } catch (error) {
        console.error('Camera initialization failed:', error);
        showCameraError(error);
        
        elements.cameraToggleBtn.textContent = 'カメラを起動';
        elements.cameraToggleBtn.disabled = false;
    }
}

function stopCamera() {
    if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
    }

    if (state.videoStream) {
        state.videoStream.getTracks().forEach(track => track.stop());
        state.videoStream = null;
    }

    elements.video.srcObject = null;
    
    // Clear canvas to dark screen
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
    
    // Draw placeholder text
    ctx.fillStyle = '#94a3b8';
    ctx.font = "16px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText("カメラが停止しています。設定パネルから起動してください。", elements.canvas.width / 2, elements.canvas.height / 2);

    elements.cameraToggleBtn.textContent = 'カメラを起動';
    elements.cameraToggleBtn.classList.remove('btn-secondary');
    elements.cameraToggleBtn.classList.add('btn-primary');
}

function showCameraError(err) {
    let msg = 'カメラの使用が許可されていないか、対応するカメラが見つかりません。';
    
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        msg += '\n\n【重要】カメラ機能はセキュリティの都合上、HTTPS接続（またはlocalhost）でのみ動作します。URLが https:// で始まっているか確認してください。';
    } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg += '\n\nブラウザの設定でカメラへのアクセス権限を許可し、ページを再読み込みしてください。';
    } else {
        msg += `\n\nエラー詳細: ${err.message || err.name}`;
    }

    elements.errorMessage.textContent = msg;
    elements.cameraError.classList.remove('hidden');
}

// --- Render Loop ---
function startRenderLoop() {
    function render() {
        if (!state.videoStream) return;
        
        drawARFrame();
        state.animationFrameId = requestAnimationFrame(render);
    }
    state.animationFrameId = requestAnimationFrame(render);
}

function drawARFrame() {
    const cWidth = elements.canvas.width;
    const cHeight = elements.canvas.height;
    const video = elements.video;
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    
    ctx.clearRect(0, 0, cWidth, cHeight);

    // 1. Render Base Frame with optional Shift / Zoom
    if (state.activeModes.shift) {
        const zoom = state.settings.shiftZoom;
        const cAspect = cWidth / cHeight;
        
        // Calculate crop bounds for cover fit
        let sWidth = vWidth;
        let sHeight = vHeight;
        
        if (cAspect > vWidth / vHeight) {
            // Canvas is wider than video aspect
            sWidth = vWidth;
            sHeight = vWidth / cAspect;
        } else {
            // Canvas is taller than video aspect
            sWidth = vHeight * cAspect;
            sHeight = vHeight;
        }
        
        // Apply zoom modifier
        sWidth = sWidth / zoom;
        sHeight = sHeight / zoom;
        
        // Compute base centered coordinates
        const sxMid = (vWidth - sWidth) / 2;
        const syMid = (vHeight - sHeight) / 2;
        
        // Compute horizontal shift offset
        const maxShift = (vWidth - sWidth) / 2;
        // ShiftOffset value is -100 (left shift) to 100 (right shift)
        // If left shift (-100), we want to view more left side of the camera feed (decrease sx)
        const shiftX = (state.settings.shiftOffset / 100) * maxShift;
        
        let sx = sxMid + shiftX;
        let sy = syMid;
        
        // Clamp bounds to prevent empty borders
        sx = Math.max(0, Math.min(vWidth - sWidth, sx));
        
        // Draw the cropped & shifted frame
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, cWidth, cHeight);
    } else {
        // Normal cover rendering (no shifting)
        renderCoverVideo(video, vWidth, vHeight, cWidth, cHeight);
    }

    // 2. Render Overlay Effects
    const side = state.settings.neglectSide;

    // A: Solid Darkening Overlay
    if (state.activeModes.solid) {
        const opacity = state.settings.solidOpacity;
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        
        if (side === 'left') {
            // Darken left half
            ctx.fillRect(0, 0, cWidth / 2, cHeight);
        } else {
            // Darken right half
            ctx.fillRect(cWidth / 2, 0, cWidth / 2, cHeight);
        }
    }

    // B: Gradient Darkening Overlay
    if (state.activeModes.gradient) {
        const gradWidth = state.settings.gradientWidth;
        const maxOpacity = state.settings.gradientOpacity;
        
        let grad;
        if (side === 'left') {
            // Fade from dark (left) to transparent (moving right)
            const endX = cWidth * gradWidth;
            grad = ctx.createLinearGradient(0, 0, endX, 0);
            grad.addColorStop(0, `rgba(0, 0, 0, ${maxOpacity})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, endX, cHeight);
        } else {
            // Fade from dark (right) to transparent (moving left)
            const startX = cWidth * (1 - gradWidth);
            grad = ctx.createLinearGradient(cWidth, 0, startX, 0);
            grad.addColorStop(0, `rgba(0, 0, 0, ${maxOpacity})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = grad;
            ctx.fillRect(startX, 0, cWidth - startX, cHeight);
        }
    }

    // C: Attention-catching Flowing Arrows Overlay
    if (state.activeModes.arrows) {
        const speed = state.settings.arrowSpeed;
        const size = state.settings.arrowSize;
        const opacity = state.settings.arrowOpacity;
        
        state.arrowsList.forEach(arrow => {
            arrow.update(cWidth, speed);
            arrow.draw(ctx, cHeight, size, opacity);
        });
    }
}

// Utility function to draw video matching background-size: cover
function renderCoverVideo(img, imgW, imgH, containerW, containerH) {
    const imgRatio = imgW / imgH;
    const containerRatio = containerW / containerH;
    
    let sx, sy, sWidth, sHeight;
    
    if (containerRatio > imgRatio) {
        // Container is wider than image (cropped top/bottom)
        sWidth = imgW;
        sHeight = imgW / containerRatio;
        sx = 0;
        sy = (imgH - sHeight) / 2;
    } else {
        // Container is taller than image (cropped sides)
        sWidth = imgH * containerRatio;
        sHeight = imgH;
        sx = (imgW - sWidth) / 2;
        sy = 0;
    }
    
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, containerW, containerH);
}

// --- Settings Operations ---
function resetToDefaults() {
    // Reset state values
    state.activeModes.solid = false;
    state.activeModes.gradient = false;
    state.activeModes.arrows = false;
    state.activeModes.shift = false;
    
    state.settings.neglectSide = 'left';
    state.settings.solidOpacity = 0.5;
    state.settings.gradientWidth = 0.5;
    state.settings.gradientOpacity = 0.8;
    state.settings.arrowSpeed = 3;
    state.settings.arrowSize = 40;
    state.settings.arrowOpacity = 0.6;
    state.settings.shiftOffset = 0;
    state.settings.shiftZoom = 1.3;

    // Reset UI Elements
    elements.sideLeft.checked = true;
    elements.sideRight.checked = false;
    
    elements.modeSolidEnable.checked = false;
    elements.solidOpacity.value = 50;
    elements.solidOpacityVal.textContent = '50%';
    toggleSectionActive('section-solid', false);
    
    elements.modeGradientEnable.checked = false;
    elements.gradientWidth.value = 50;
    elements.gradientWidthVal.textContent = '50%';
    elements.gradientOpacity.value = 80;
    elements.gradientOpacityVal.textContent = '80%';
    toggleSectionActive('section-gradient', false);
    
    elements.modeArrowsEnable.checked = false;
    elements.arrowSpeed.value = 3;
    elements.arrowSpeedVal.textContent = '普通';
    elements.arrowSize.value = 40;
    elements.arrowSizeVal.textContent = '中 (40px)';
    elements.arrowOpacity.value = 60;
    elements.arrowOpacityVal.textContent = '60%';
    toggleSectionActive('section-arrows', false);
    
    elements.modeShiftEnable.checked = false;
    elements.shiftOffset.value = 0;
    elements.shiftOffsetVal.textContent = '中央';
    elements.shiftZoom.value = 13;
    elements.shiftZoomVal.textContent = '1.3x';
    toggleSectionActive('section-shift', false);
    
    // Reset arrows
    state.arrowsList.forEach(arrow => arrow.reset(elements.canvas.width));
}

// --- PWA Installation Logic ---
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can install the PWA
    elements.pwaInstallBanner.classList.remove('hidden');
});

elements.pwaInstallBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);
    
    // We've used the prompt, and can't use it again
    deferredPrompt = null;
    
    // Hide the banner
    elements.pwaInstallBanner.classList.add('hidden');
});

elements.pwaCloseBtn.addEventListener('click', () => {
    elements.pwaInstallBanner.classList.add('hidden');
});

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
    initArrows();
    setupEventListeners();
    
    // Pre-draw stopped screen placeholder
    resizeCanvas();
    stopCamera();
});
