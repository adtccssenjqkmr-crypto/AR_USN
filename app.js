// --- State Management ---
const state = {
    activeModes: {
        solid: false,
        gradient: false,
        arrows: false,
        shift: false,
        arSplit: false // Side-by-side AR split screen
    },
    settings: {
        neglectSide: 'left', // 'left' or 'right'
        solidOpacity: 0.5,   // 0.1 to 1.0
        gradientWidth: 0.5,  // 0.1 to 1.0
        gradientOpacity: 0.8, // 0.2 to 1.0
        arrowSpeed: 3,       // 1 to 5
        arrowSize: 40,       // 20 to 80 px
        arrowOpacity: 0.6,   // 0.1 to 1.0
        shiftOffset: 0,      // -100 to 100
        shiftZoom: 1.3       // 1.1 to 2.0
    },
    videoStream: null,
    animationFrameId: null,
    arrowsList: [],
    selectedDeviceId: null
};

// --- Offscreen Canvas for Rendering (Saves memory and enables perfect split-screen synchronization) ---
const offscreenCanvas = document.createElement('canvas');
const oCtx = offscreenCanvas.getContext('2d');

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
        const offset = isInitial ? (canvasWidth * this.offsetDelay) : 0;

        if (side === 'left') {
            // Left neglect -> guide attention to the left. Flow Right to Left (◀)
            this.x = canvasWidth + 50 + offset;
        } else {
            // Right neglect -> guide attention to the right. Flow Left to Right (▶)
            this.x = -50 - offset;
        }
    }

    update(canvasWidth, speedScale) {
        if (!this.isInitialized) {
            this.init(canvasWidth);
        }

        const side = state.settings.neglectSide;
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
        
        // Add neon glow
        ctx.shadowColor = 'rgba(14, 213, 201, 0.6)';
        ctx.shadowBlur = 8;

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
    cameraSelect: document.getElementById('camera-select'),
    modeArSplit: document.getElementById('mode-ar-split'),
    
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

const ctx = elements.canvas.getContext('2d');

// --- Initialize Flowing Arrows ---
function initArrows() {
    state.arrowsList = [
        new VisualArrow(0.25, 0.0),  // Line 1
        new VisualArrow(0.50, 0.45), // Line 2 (center)
        new VisualArrow(0.75, 0.25), // Line 3
        new VisualArrow(0.38, 0.70), // Line 4
        new VisualArrow(0.62, 0.15)  // Line 5
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
        const targetWidth = state.activeModes.arSplit ? elements.canvas.width / 2 : elements.canvas.width;
        state.arrowsList.forEach(arrow => arrow.reset(targetWidth));
    };
    elements.sideLeft.addEventListener('change', handleSideChange);
    elements.sideRight.addEventListener('change', handleSideChange);

    // Split Screen mode
    elements.modeArSplit.addEventListener('change', (e) => {
        state.activeModes.arSplit = e.target.checked;
        updateOffscreenSize();
    });

    // Camera device select dropdown
    elements.cameraSelect.addEventListener('change', (e) => {
        state.selectedDeviceId = e.target.value;
        if (state.videoStream) {
            // Hot reload camera stream
            startCamera();
        }
    });

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
            const targetWidth = state.activeModes.arSplit ? elements.canvas.width / 2 : elements.canvas.width;
            state.arrowsList.forEach(arrow => arrow.reset(targetWidth));
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

    // Double-tap or Double-click on Canvas to Hide Settings Panel
    setupDoubleTapTrigger();
}

function toggleSectionActive(sectionId, isActive) {
    const el = document.getElementById(sectionId);
    if (isActive) {
        el.classList.add('active');
    } else {
        el.classList.remove('active');
    }
}

// --- Double Tap Trigger implementation ---
function setupDoubleTapTrigger() {
    let lastTap = 0;
    
    // Touch interface
    elements.canvas.addEventListener('touchstart', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        
        if (tapLength < 300 && tapLength > 0) {
            toggleUIVisibility();
            e.preventDefault(); // Prevent double tap zoom
        }
        lastTap = currentTime;
    }, { passive: false });
    
    // Mouse interface (PC)
    elements.canvas.addEventListener('dblclick', () => {
        toggleUIVisibility();
    });
}

function toggleUIVisibility() {
    const isHidden = document.body.classList.toggle('ui-hidden');
    
    // Show toast feedback
    const toast = document.getElementById('double-tap-toast');
    if (toast) {
        toast.textContent = isHidden ? '👁️ 設定を隠しました（ダブルタップで再表示）' : '⚙️ 設定を表示しました';
        toast.style.animation = 'none';
        toast.offsetHeight; // trigger reflow
        toast.style.animation = 'fade-in-out 4s forwards';
    }
}

// --- Canvas Resizing ---
function resizeCanvas() {
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;
    
    if (elements.canvas.width !== displayWidth || elements.canvas.height !== displayHeight) {
        elements.canvas.width = displayWidth;
        elements.canvas.height = displayHeight;
        updateOffscreenSize();
    }
}

function updateOffscreenSize() {
    const w = state.activeModes.arSplit ? elements.canvas.width / 2 : elements.canvas.width;
    const h = elements.canvas.height;
    
    offscreenCanvas.width = w;
    offscreenCanvas.height = h;
    
    state.arrowsList.forEach(arrow => arrow.reset(w, true));
}

// --- Device Enumeration for Cameras ---
async function enumerateCameras() {
    try {
        // Enforce media query permission before listing devices so labels are accessible
        await navigator.mediaDevices.getUserMedia({ video: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        elements.cameraSelect.innerHTML = '';
        
        if (videoDevices.length === 0) {
            const opt = document.createElement('option');
            opt.value = "";
            opt.textContent = "カメラが見つかりません";
            elements.cameraSelect.appendChild(opt);
            return;
        }

        // Try to identify and select ultra-wide angle back camera by default
        let defaultDeviceId = null;
        
        // Keywords for ultra wide lenses
        const ultraWideKeywords = ['ultra', 'super', '0.5x', 'wide', '広角', '超広角', 'fisheye'];
        
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            
            const label = device.label || `カメラ ${index + 1}`;
            option.textContent = label;
            elements.cameraSelect.appendChild(option);
            
            // Check if label matches ultra-wide, prioritize if it is a back camera
            const lowerLabel = label.toLowerCase();
            const isBack = lowerLabel.includes('back') || lowerLabel.includes('rear') || lowerLabel.includes('背面') || lowerLabel.includes('環境') || lowerLabel.includes('out');
            
            if (isBack && ultraWideKeywords.some(kw => lowerLabel.includes(kw))) {
                defaultDeviceId = device.deviceId;
            }
        });
        
        // Fallback to first back camera, then first available camera if no wide angle found
        if (!defaultDeviceId) {
            const firstBackCam = videoDevices.find(d => {
                const l = d.label.toLowerCase();
                return l.includes('back') || l.includes('rear') || l.includes('背面') || l.includes('環境') || l.includes('out');
            });
            defaultDeviceId = firstBackCam ? firstBackCam.deviceId : videoDevices[0].deviceId;
        }

        state.selectedDeviceId = defaultDeviceId;
        elements.cameraSelect.value = defaultDeviceId;
    } catch (e) {
        console.warn('Could not enumerate camera devices:', e);
        // Clean default fallback in case enumeration fails (e.g. permission denied beforehand)
        elements.cameraSelect.innerHTML = '<option value="">背面カメラ（自動選択）</option>';
    }
}

// --- Camera Access ---
async function startCamera() {
    elements.cameraToggleBtn.textContent = '接続中...';
    elements.cameraToggleBtn.disabled = true;

    // Build constraints. If we selected a device ID, use it. Otherwise, request environment facingMode.
    const constraints = {
        video: {
            deviceId: state.selectedDeviceId ? { exact: state.selectedDeviceId } : undefined,
            facingMode: state.selectedDeviceId ? undefined : 'environment',
            width: { ideal: 1920 }, // High-res target for wide view
            height: { ideal: 1080 }
        },
        audio: false
    };

    try {
        if (state.videoStream) {
            state.videoStream.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        state.videoStream = stream;
        elements.video.srcObject = stream;
        
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
    
    // Clear canvas
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
    
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
    
    // Define the dimensions of a single screen (split or full)
    const targetWidth = state.activeModes.arSplit ? cWidth / 2 : cWidth;
    const targetHeight = cHeight;
    
    // Render on offscreen canvas first
    oCtx.clearRect(0, 0, targetWidth, targetHeight);

    // 1. Render Camera Stream (Cover Fit / Perspective Shift)
    if (state.activeModes.shift) {
        const zoom = state.settings.shiftZoom;
        const cAspect = targetWidth / targetHeight;
        
        let sWidth = vWidth;
        let sHeight = vHeight;
        
        if (cAspect > vWidth / vHeight) {
            sWidth = vWidth;
            sHeight = vWidth / cAspect;
        } else {
            sWidth = vHeight * cAspect;
            sHeight = vHeight;
        }
        
        sWidth = sWidth / zoom;
        sHeight = sHeight / zoom;
        
        const sxMid = (vWidth - sWidth) / 2;
        const syMid = (vHeight - sHeight) / 2;
        
        const maxShift = (vWidth - sWidth) / 2;
        // ShiftOffset: -100 (left shift) to 100 (right shift)
        const shiftX = (state.settings.shiftOffset / 100) * maxShift;
        
        let sx = sxMid + shiftX;
        let sy = syMid;
        
        sx = Math.max(0, Math.min(vWidth - sWidth, sx));
        
        oCtx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
    } else {
        renderCoverVideo(oCtx, video, vWidth, vHeight, targetWidth, targetHeight);
    }

    // 2. Render Overlay Rehabilitation Effects on Offscreen Context
    const side = state.settings.neglectSide;

    // A: Solid Darkening Overlay
    // NOTE: For rehabilitation, we want to darken the NON-neglected (healthy) side to force attention to the neglected side.
    if (state.activeModes.solid) {
        const opacity = state.settings.solidOpacity;
        oCtx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        
        if (side === 'left') {
            // Left neglect -> Darken RIGHT side (healthy side)
            oCtx.fillRect(targetWidth / 2, 0, targetWidth / 2, targetHeight);
        } else {
            // Right neglect -> Darken LEFT side (healthy side)
            oCtx.fillRect(0, 0, targetWidth / 2, targetHeight);
        }
    }

    // B: Gradient Darkening Overlay
    if (state.activeModes.gradient) {
        const gradWidth = state.settings.gradientWidth;
        const maxOpacity = state.settings.gradientOpacity;
        
        let grad;
        if (side === 'left') {
            // Left neglect -> Darken RIGHT side. Gradient starts dark at right edge and fades going left.
            const startX = targetWidth;
            const endX = targetWidth - (targetWidth * gradWidth);
            grad = oCtx.createLinearGradient(startX, 0, endX, 0);
            grad.addColorStop(0, `rgba(0, 0, 0, ${maxOpacity})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            oCtx.fillStyle = grad;
            oCtx.fillRect(endX, 0, targetWidth - endX, targetHeight);
        } else {
            // Right neglect -> Darken LEFT side. Gradient starts dark at left edge and fades going right.
            const startX = 0;
            const endX = targetWidth * gradWidth;
            grad = oCtx.createLinearGradient(startX, 0, endX, 0);
            grad.addColorStop(0, `rgba(0, 0, 0, ${maxOpacity})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            oCtx.fillStyle = grad;
            oCtx.fillRect(0, 0, endX, targetHeight);
        }
    }

    // C: Attention-catching Flowing Arrows Overlay
    if (state.activeModes.arrows) {
        const speed = state.settings.arrowSpeed;
        const size = state.settings.arrowSize;
        const opacity = state.settings.arrowOpacity;
        
        state.arrowsList.forEach(arrow => {
            arrow.update(targetWidth, speed);
            arrow.draw(oCtx, targetHeight, size, opacity);
        });
    }

    // 3. Project Offscreen Rendering onto Main Screen
    ctx.clearRect(0, 0, cWidth, cHeight);
    
    if (state.activeModes.arSplit) {
        // Render identical left & right images for HMD / VR head mount goggles
        ctx.drawImage(offscreenCanvas, 0, 0, targetWidth, targetHeight, 0, 0, cWidth / 2, cHeight);
        ctx.drawImage(offscreenCanvas, 0, 0, targetWidth, targetHeight, cWidth / 2, 0, cWidth / 2, cHeight);
    } else {
        // Standard full-screen render
        ctx.drawImage(offscreenCanvas, 0, 0, targetWidth, targetHeight, 0, 0, cWidth, cHeight);
    }
}

// Utility function to draw video matching background-size: cover
function renderCoverVideo(targetCtx, img, imgW, imgH, containerW, containerH) {
    const imgRatio = imgW / imgH;
    const containerRatio = containerW / containerH;
    
    let sx, sy, sWidth, sHeight;
    
    if (containerRatio > imgRatio) {
        sWidth = imgW;
        sHeight = imgW / containerRatio;
        sx = 0;
        sy = (imgH - sHeight) / 2;
    } else {
        sWidth = imgH * containerRatio;
        sHeight = imgH;
        sx = (imgW - sWidth) / 2;
        sy = 0;
    }
    
    targetCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, containerW, containerH);
}

// --- Settings Operations ---
function resetToDefaults() {
    state.activeModes.solid = false;
    state.activeModes.gradient = false;
    state.activeModes.arrows = false;
    state.activeModes.shift = false;
    state.activeModes.arSplit = false;
    
    state.settings.neglectSide = 'left';
    state.settings.solidOpacity = 0.5;
    state.settings.gradientWidth = 0.5;
    state.settings.gradientOpacity = 0.8;
    state.settings.arrowSpeed = 3;
    state.settings.arrowSize = 40;
    state.settings.arrowOpacity = 0.6;
    state.settings.shiftOffset = 0;
    state.settings.shiftZoom = 1.3;

    elements.sideLeft.checked = true;
    elements.sideRight.checked = false;
    elements.modeArSplit.checked = false;
    
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
    
    // Auto-reselect first camera
    if (elements.cameraSelect.options.length > 0) {
        state.selectedDeviceId = elements.cameraSelect.options[0].value;
        elements.cameraSelect.selectedIndex = 0;
    }
    
    updateOffscreenSize();
    if (state.videoStream) {
        startCamera();
    }
}

// --- PWA Installation Logic ---
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    elements.pwaInstallBanner.classList.remove('hidden');
});

elements.pwaInstallBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);
    deferredPrompt = null;
    elements.pwaInstallBanner.classList.add('hidden');
});

elements.pwaCloseBtn.addEventListener('click', () => {
    elements.pwaInstallBanner.classList.add('hidden');
});

// App Initialization
document.addEventListener('DOMContentLoaded', async () => {
    initArrows();
    setupEventListeners();
    
    // Enumerate cameras first, then initialize canvas sizes and stop screen placeholders
    await enumerateCameras();
    
    resizeCanvas();
    stopCamera();
});
