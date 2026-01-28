/**
 * 電測截圖工具 - 主程式
 * PDF 圖片擷取與重命名應用程式
 */

const App = {
    // 狀態
    state: {
        pdfLoaded: false,
        listLoaded: false,
        currentPage: 1,
        totalPages: 0,
        // 選取模式固定為 'individual'
        selectionMode: 'individual',
        // 統一區域 (相對於 PDF 頁面的比例)
        uniformRegion: null,
        // 每頁個別區域
        pageRegions: {},
        // 是否正在選取
        isSelecting: false,
        selectionStart: { x: 0, y: 0 },
        // 擷取的圖片
        images: [],
        selectedImages: new Set(),
        // 設定
        namingMode: 'sequential',
        outputFormat: 'jpeg',
        jpegQuality: 1.0,
        dpi: 300,
        // 目標尺寸
        targetWidth: 413,
        targetHeight: 531,
        // 每頁的區域調整設定 (rotation, scale)
        regionAdjustments: {},
        // 當前頁面的原始裁切 canvas（用於預覽）
        currentCropCanvas: null,
        // 是否正在渲染頁面（防止快速點擊）
        isRenderingPage: false
    },

    // DOM 元素快取
    elements: {},

    /**
     * 初始化應用程式
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.showToast('歡迎使用電測截圖工具！請先上傳 PDF 檔案', 'success');
    },

    /**
     * 快取 DOM 元素
     */
    cacheElements() {
        this.elements = {
            // Step 1: 上傳
            stepUpload: document.getElementById('step-upload'),
            pdfDropZone: document.getElementById('pdf-drop-zone'),
            pdfInput: document.getElementById('pdf-input'),
            pdfBrowseBtn: document.getElementById('pdf-browse-btn'),
            pdfInfo: document.getElementById('pdf-info'),
            pdfName: document.getElementById('pdf-name'),
            pdfPages: document.getElementById('pdf-pages'),
            pdfRemove: document.getElementById('pdf-remove'),

            listDropZone: document.getElementById('list-drop-zone'),
            listInput: document.getElementById('list-input'),
            listBrowseBtn: document.getElementById('list-browse-btn'),
            listInfo: document.getElementById('list-info'),
            listName: document.getElementById('list-name'),
            listCount: document.getElementById('list-count'),
            listRemove: document.getElementById('list-remove'),

            // Step 2: 區域選取
            stepRegion: document.getElementById('step-region'),
            prevPageBtn: document.getElementById('prev-page-btn'),
            nextPageBtn: document.getElementById('next-page-btn'),
            currentPageSpan: document.getElementById('current-page'),
            totalPagesSpan: document.getElementById('total-pages'),
            clearRegionBtn: document.getElementById('clear-region-btn'),
            applyRegionBtn: document.getElementById('apply-region-btn'),
            individualProgress: document.getElementById('individual-progress'),
            selectedPagesCount: document.getElementById('selected-pages-count'),
            totalPagesCount: document.getElementById('total-pages-count'),
            pageStatusList: document.getElementById('page-status-list'),
            pdfPreviewWrapper: document.getElementById('pdf-preview-wrapper'),
            pdfCanvas: document.getElementById('pdf-canvas'),
            selectionOverlay: document.getElementById('selection-overlay'),
            selectionBox: document.getElementById('selection-box'),
            // 區域調整控制
            regionAdjustPanel: document.getElementById('region-adjust-panel'),
            regionPreviewCanvas: document.getElementById('region-preview-canvas'),
            cropRotationSlider: document.getElementById('crop-rotation-slider'),
            cropRotationDisplay: document.getElementById('crop-rotation-display'),
            cropScaleSlider: document.getElementById('crop-scale-slider'),
            cropScaleDisplay: document.getElementById('crop-scale-display'),
            regionPosition: document.getElementById('region-position'),
            regionSize: document.getElementById('region-size'),

            // Step 3: 設定
            stepSettings: document.getElementById('step-settings'),
            outputFormat: document.getElementById('output-format'),
            namingMode: document.getElementById('naming-mode'),
            outputDpi: document.getElementById('output-dpi'),
            progressCard: document.getElementById('progress-card'),
            progressTitle: document.getElementById('progress-title'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            extractBtn: document.getElementById('extract-btn'),

            // Step 4: 結果
            stepResults: document.getElementById('step-results'),
            imageCount: document.getElementById('image-count'),
            selectAllBtn: document.getElementById('select-all-btn'),
            downloadBtn: document.getElementById('download-btn'),
            imagesGrid: document.getElementById('images-grid'),
            nameListSection: document.getElementById('name-list-section'),
            nameListContainer: document.getElementById('name-list-container'),

            // Toast
            toastContainer: document.getElementById('toast-container')
        };
    },

    /**
     * 綁定事件
     */
    bindEvents() {
        // PDF 上傳
        this.elements.pdfBrowseBtn.addEventListener('click', () => {
            this.elements.pdfInput.click();
        });

        this.elements.pdfInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handlePDFUpload(e.target.files[0]);
            }
        });

        this.elements.pdfDropZone.addEventListener('click', (e) => {
            if (e.target === this.elements.pdfDropZone || e.target.closest('.upload-zone')) {
                this.elements.pdfInput.click();
            }
        });

        this.elements.pdfRemove.addEventListener('click', () => {
            this.removePDF();
        });

        // 清單上傳
        this.elements.listBrowseBtn.addEventListener('click', () => {
            this.elements.listInput.click();
        });

        this.elements.listInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleListUpload(e.target.files[0]);
            }
        });

        this.elements.listDropZone.addEventListener('click', (e) => {
            if (e.target === this.elements.listDropZone || e.target.closest('.upload-zone')) {
                this.elements.listInput.click();
            }
        });

        this.elements.listRemove.addEventListener('click', () => {
            this.removeList();
        });

        // 拖放事件
        this.setupDragDrop(this.elements.pdfDropZone, this.handlePDFUpload.bind(this));
        this.setupDragDrop(this.elements.listDropZone, this.handleListUpload.bind(this));

        // 頁面導航
        this.elements.prevPageBtn.addEventListener('click', () => {
            this.goToPage(this.state.currentPage - 1);
        });

        this.elements.nextPageBtn.addEventListener('click', () => {
            this.goToPage(this.state.currentPage + 1);
        });

        // 區域選取
        this.elements.pdfPreviewWrapper.addEventListener('mousedown', (e) => {
            this.startSelection(e);
        });

        this.elements.pdfPreviewWrapper.addEventListener('mousemove', (e) => {
            this.updateSelection(e);
        });

        this.elements.pdfPreviewWrapper.addEventListener('mouseup', (e) => {
            this.endSelection(e);
        });

        this.elements.pdfPreviewWrapper.addEventListener('mouseleave', (e) => {
            if (this.state.isSelecting) {
                this.endSelection(e);
            }
        });

        // 觸控支援
        this.elements.pdfPreviewWrapper.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.startSelection({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault() });
        });

        this.elements.pdfPreviewWrapper.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            this.updateSelection({ clientX: touch.clientX, clientY: touch.clientY });
        });

        this.elements.pdfPreviewWrapper.addEventListener('touchend', (e) => {
            this.endSelection(e);
        });

        this.elements.clearRegionBtn.addEventListener('click', () => {
            this.clearSelection();
        });

        this.elements.applyRegionBtn.addEventListener('click', () => {
            this.applyRegion();
        });

        // 區域調整控制
        this.elements.cropRotationSlider.addEventListener('input', (e) => {
            const degrees = parseInt(e.target.value);
            this.updateCropAdjustments(degrees, null);
        });

        this.elements.cropScaleSlider.addEventListener('input', (e) => {
            const scale = parseInt(e.target.value);
            this.updateCropAdjustments(null, scale);
        });

        // 快速旋轉按鈕
        document.querySelectorAll('.quick-rotate-buttons button').forEach(btn => {
            btn.addEventListener('click', () => {
                const degrees = parseInt(btn.dataset.rotate);
                this.elements.cropRotationSlider.value = degrees;
                this.updateCropAdjustments(degrees, null);
            });
        });

        // +/- 角度調整按鈕
        document.querySelectorAll('.rotation-adjust-buttons button').forEach(btn => {
            btn.addEventListener('click', () => {
                const step = parseInt(btn.dataset.rotateStep);
                const currentRotation = parseInt(this.elements.cropRotationSlider.value);
                let newRotation = currentRotation + step;
                // 限制在 -180 到 180 的範圍
                newRotation = Math.max(-180, Math.min(180, newRotation));
                this.elements.cropRotationSlider.value = newRotation;
                this.updateCropAdjustments(newRotation, null);
            });
        });

        // 設定變更
        this.elements.outputFormat.addEventListener('change', (e) => {
            this.state.outputFormat = e.target.value;
        });

        this.elements.namingMode.addEventListener('change', (e) => {
            this.state.namingMode = e.target.value;
            this.updateNamingMode();
        });

        this.elements.outputDpi.addEventListener('change', (e) => {
            this.state.dpi = parseInt(e.target.value);
        });

        // 擷取按鈕
        this.elements.extractBtn.addEventListener('click', () => {
            this.extractAllImages();
        });

        // 圖片選取
        this.elements.selectAllBtn.addEventListener('click', () => {
            this.toggleSelectAll();
        });

        this.elements.downloadBtn.addEventListener('click', () => {
            this.downloadSelectedImages();
        });
    },

    /**
     * 設定拖放事件
     */
    setupDragDrop(dropZone, handler) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handler(files[0]);
            }
        });
    },

    /**
     * 處理 PDF 上傳
     */
    async handlePDFUpload(file) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            this.showToast('請上傳 PDF 檔案', 'error');
            return;
        }

        try {
            this.showToast('正在載入 PDF...', 'success');

            // 載入 PDF
            const pdfInfo = await PDFHandler.loadPDF(file);

            this.state.pdfLoaded = true;
            this.state.totalPages = pdfInfo.numPages;
            this.state.currentPage = 1;
            this.state.pageRegions = {};

            // 更新 UI
            this.elements.pdfInfo.hidden = false;
            this.elements.pdfName.textContent = file.name;
            this.elements.pdfPages.textContent = `${pdfInfo.numPages} 頁`;
            this.elements.pdfDropZone.style.display = 'none';

            // 顯示區域選取步驟
            this.elements.stepRegion.hidden = false;
            this.elements.totalPagesSpan.textContent = pdfInfo.numPages;
            this.elements.totalPagesCount.textContent = pdfInfo.numPages;

            // 渲染第一頁
            await this.renderPage(1);

            // 更新選取模式 UI
            this.updateSelectionModeUI();

            this.showToast(`PDF 載入完成，共 ${pdfInfo.numPages} 頁。請框選照片區域。`, 'success');

        } catch (error) {
            console.error('PDF 處理失敗:', error);
            this.showToast(error.message || 'PDF 處理失敗', 'error');
        }
    },

    /**
     * 更新選取模式 UI
     */
    updateSelectionModeUI() {
        // 固定為逐頁選取模式
        this.elements.individualProgress.hidden = false;
        this.renderPageStatusList();
        this.updateApplyButtonState();
    },

    /**
     * 渲染頁面狀態列表
     */
    renderPageStatusList() {
        this.elements.pageStatusList.innerHTML = '';

        for (let i = 1; i <= this.state.totalPages; i++) {
            const item = document.createElement('div');
            item.className = 'page-status-item';
            item.textContent = i;

            if (i === this.state.currentPage) {
                item.classList.add('current');
            }

            if (this.state.pageRegions[i]) {
                item.classList.add('selected');
            }

            item.addEventListener('click', () => {
                this.goToPage(i);
            });

            this.elements.pageStatusList.appendChild(item);
        }

        // 更新已選取頁數
        const selectedCount = Object.keys(this.state.pageRegions).length;
        this.elements.selectedPagesCount.textContent = selectedCount;
    },

    /**
     * 渲染指定頁面（包含重試機制和載入提示）
     */
    async renderPage(pageNum, retryCount = 0) {
        const maxRetries = 3;

        // 防止快速點擊 - 如果正在渲染則跳過
        if (this.state.isRenderingPage) {
            return;
        }

        this.state.isRenderingPage = true;

        try {
            // 顯示載入提示
            this.elements.pdfCanvas.style.opacity = '0.5';

            const result = await PDFHandler.extractPageAsImage(pageNum, 1.5);

            // 複製到顯示用的 canvas
            this.elements.pdfCanvas.width = result.canvas.width;
            this.elements.pdfCanvas.height = result.canvas.height;
            const ctx = this.elements.pdfCanvas.getContext('2d');
            ctx.drawImage(result.canvas, 0, 0);

            // 恢復透明度
            this.elements.pdfCanvas.style.opacity = '1';

            // 更新頁碼
            this.state.currentPage = pageNum;
            this.elements.currentPageSpan.textContent = pageNum;

            // 更新導航按鈕
            this.elements.prevPageBtn.disabled = pageNum <= 1;
            this.elements.nextPageBtn.disabled = pageNum >= this.state.totalPages;

            // 顯示該頁的選取區域（如果有的話）
            this.drawCurrentPageSelection();

            // 更新區域調整面板（如果有選取區域）
            if (this.state.pageRegions[pageNum]) {
                const adj = this.state.regionAdjustments[pageNum] || { rotation: 0, scale: 100 };
                this.elements.cropRotationSlider.value = adj.rotation;
                this.elements.cropRotationDisplay.textContent = adj.rotation + '°';
                this.elements.cropScaleSlider.value = adj.scale;
                this.elements.cropScaleDisplay.textContent = adj.scale + '%';
                this.updateRegionPreview();
                this.elements.regionAdjustPanel.hidden = false;
            } else {
                this.elements.regionAdjustPanel.hidden = true;
            }

            // 更新頁面狀態列表
            if (this.state.selectionMode === 'individual') {
                this.renderPageStatusList();
            }

        } catch (error) {
            // 只在 Console 記錄錯誤，不打擾使用者
            console.warn('頁面渲染遇到問題，正在重試...', error.message);

            // 恢復透明度
            this.elements.pdfCanvas.style.opacity = '1';

            // 靜默重試機制
            if (retryCount < maxRetries) {
                this.state.isRenderingPage = false; // 重置狀態以便重試
                await new Promise(resolve => setTimeout(resolve, 300)); // 等待 300ms
                return this.renderPage(pageNum, retryCount + 1);
            }
            // 所有重試都失敗後也不顯示錯誤，因為使用者可能仍可正常使用
            console.error('頁面渲染最終失敗，但不影響其他功能');
        } finally {
            this.state.isRenderingPage = false;
        }
    },

    /**
     * 旋轉 Canvas
     */
    rotateCanvas(sourceCanvas, degrees) {
        const radians = (degrees * Math.PI) / 180;
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));

        const newWidth = sourceCanvas.width * cos + sourceCanvas.height * sin;
        const newHeight = sourceCanvas.width * sin + sourceCanvas.height * cos;

        const rotatedCanvas = document.createElement('canvas');
        rotatedCanvas.width = newWidth;
        rotatedCanvas.height = newHeight;

        const ctx = rotatedCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(radians);
        ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);

        return rotatedCanvas;
    },

    /**
     * 套用旋轉和縮放調整（固定輸出尺寸，圖像在框內旋轉）
     */
    applyAdjustments(sourceCanvas, rotation, scale, outputWidth, outputHeight) {
        const radians = (rotation * Math.PI) / 180;
        const scaleFactor = scale / 100;

        // 輸出 canvas 保持固定尺寸
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = outputWidth;
        resultCanvas.height = outputHeight;

        const ctx = resultCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 填充背景（可選，防止透明邊緣）
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outputWidth, outputHeight);

        // 計算基礎縮放比例（讓原始圖像填滿輸出框）
        const baseScaleX = outputWidth / sourceCanvas.width;
        const baseScaleY = outputHeight / sourceCanvas.height;
        const baseScale = Math.max(baseScaleX, baseScaleY);

        // 移動到中心點，旋轉並縮放
        ctx.translate(outputWidth / 2, outputHeight / 2);
        ctx.rotate(radians);
        ctx.scale(baseScale * scaleFactor, baseScale * scaleFactor);

        // 繪製圖像（圖像中心對齊框架中心）
        ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);

        return resultCanvas;
    },

    /**
     * 繪製當前頁面的選取區域
     */
    drawCurrentPageSelection() {
        let region = this.state.pageRegions[this.state.currentPage];

        if (region) {
            const rect = this.elements.pdfCanvas.getBoundingClientRect();

            this.elements.selectionBox.hidden = false;
            this.elements.selectionBox.style.left = (region.x * rect.width) + 'px';
            this.elements.selectionBox.style.top = (region.y * rect.height) + 'px';
            this.elements.selectionBox.style.width = (region.width * rect.width) + 'px';
            this.elements.selectionBox.style.height = (region.height * rect.height) + 'px';
        } else {
            this.elements.selectionBox.hidden = true;
        }
    },

    /**
     * 切換頁面
     */
    async goToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.state.totalPages) return;
        await this.renderPage(pageNum);
    },

    /**
     * 開始選取區域
     */
    startSelection(e) {
        e.preventDefault();

        const rect = this.elements.pdfCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.state.isSelecting = true;
        this.state.selectionStart = { x, y };

        this.elements.selectionBox.hidden = false;
        this.elements.selectionBox.style.left = x + 'px';
        this.elements.selectionBox.style.top = y + 'px';
        this.elements.selectionBox.style.width = '0px';
        this.elements.selectionBox.style.height = '0px';
    },

    /**
     * 更新選取區域
     */
    updateSelection(e) {
        if (!this.state.isSelecting) return;

        const rect = this.elements.pdfCanvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

        const startX = this.state.selectionStart.x;
        const startY = this.state.selectionStart.y;

        const left = Math.min(startX, x);
        const top = Math.min(startY, y);
        const width = Math.abs(x - startX);
        const height = Math.abs(y - startY);

        this.elements.selectionBox.style.left = left + 'px';
        this.elements.selectionBox.style.top = top + 'px';
        this.elements.selectionBox.style.width = width + 'px';
        this.elements.selectionBox.style.height = height + 'px';
    },

    /**
     * 結束選取區域
     */
    endSelection(e) {
        if (!this.state.isSelecting) return;

        this.state.isSelecting = false;

        const rect = this.elements.pdfCanvas.getBoundingClientRect();
        const canvasWidth = this.elements.pdfCanvas.width;
        const canvasHeight = this.elements.pdfCanvas.height;

        // 計算選取區域 (轉換為 canvas 座標)
        const scaleX = canvasWidth / rect.width;
        const scaleY = canvasHeight / rect.height;

        const boxStyle = this.elements.selectionBox.style;
        const left = parseFloat(boxStyle.left) * scaleX;
        const top = parseFloat(boxStyle.top) * scaleY;
        const width = parseFloat(boxStyle.width) * scaleX;
        const height = parseFloat(boxStyle.height) * scaleY;

        // 最小選取區域
        if (width < 20 || height < 20) {
            this.showToast('選取區域太小，請重新框選', 'warning');
            this.elements.selectionBox.hidden = true;
            return;
        }

        // 儲存選取區域（相對於 canvas 的比例）
        const region = {
            x: left / canvasWidth,
            y: top / canvasHeight,
            width: width / canvasWidth,
            height: height / canvasHeight
        };

        // 固定為逐頁選取模式
        this.state.pageRegions[this.state.currentPage] = region;
        this.renderPageStatusList();

        // 初始化區域調整設定
        const adjKey = this.state.currentPage;
        if (!this.state.regionAdjustments[adjKey]) {
            this.state.regionAdjustments[adjKey] = {
                rotation: 0,
                scale: 100
            };
        }

        // 顯示區域資訊
        this.elements.regionPosition.textContent = `X: ${Math.round(left)}, Y: ${Math.round(top)}`;
        this.elements.regionSize.textContent = `${Math.round(width)} × ${Math.round(height)} px`;

        // 擷取並顯示區域預覽
        this.updateRegionPreview();

        // 顯示區域調整面板
        this.elements.regionAdjustPanel.hidden = false;

        // 重置調整控制
        const adj = this.state.regionAdjustments[adjKey];
        this.elements.cropRotationSlider.value = adj.rotation;
        this.elements.cropRotationDisplay.textContent = adj.rotation + '°';
        this.elements.cropScaleSlider.value = adj.scale;
        this.elements.cropScaleDisplay.textContent = adj.scale + '%';

        // 更新確認按鈕狀態
        this.updateApplyButtonState();

        this.showToast('區域選取完成！可調整角度和縮放，然後點擊「確認並繼續」', 'success');
    },

    /**
     * 更新區域預覽
     */
    async updateRegionPreview() {
        const pageNum = this.state.currentPage;
        let region = this.state.pageRegions[pageNum];

        if (!region) return;

        // 使用較低解析度預覽以提高效能
        const pageResult = await PDFHandler.extractPageAsImage(pageNum, 1.5);

        // 計算裁切區域
        const cropX = Math.round(region.x * pageResult.canvas.width);
        const cropY = Math.round(region.y * pageResult.canvas.height);
        const cropWidth = Math.round(region.width * pageResult.canvas.width);
        const cropHeight = Math.round(region.height * pageResult.canvas.height);

        // 建立原始裁切 canvas
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(
            pageResult.canvas,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
        );

        // 儲存原始裁切 canvas
        this.state.currentCropCanvas = cropCanvas;

        // 套用調整並顯示預覽
        this.renderCropPreview();
    },

    /**
     * 渲染裁切預覽（固定框架，圖像在框內旋轉）
     */
    renderCropPreview() {
        if (!this.state.currentCropCanvas) return;

        // 使用當前頁碼作為 key
        const adjKey = this.state.currentPage;
        const adj = this.state.regionAdjustments[adjKey] || { rotation: 0, scale: 100 };
        const sourceCanvas = this.state.currentCropCanvas;

        // 預覽 canvas 保持固定比例（與目標尺寸相同比例）
        const previewCanvas = this.elements.regionPreviewCanvas;
        const previewWidth = 200;  // 固定預覽寬度
        const previewHeight = Math.round(previewWidth * (this.state.targetHeight / this.state.targetWidth));

        previewCanvas.width = previewWidth;
        previewCanvas.height = previewHeight;

        const ctx = previewCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 繪製格子背景（透明度指示器）
        const gridSize = 10;
        for (let y = 0; y < previewHeight; y += gridSize) {
            for (let x = 0; x < previewWidth; x += gridSize) {
                const isEven = ((x / gridSize) + (y / gridSize)) % 2 === 0;
                ctx.fillStyle = isEven ? '#c0c0c0' : '#808080';
                ctx.fillRect(x, y, gridSize, gridSize);
            }
        }

        // 計算旋轉參數
        const radians = (adj.rotation * Math.PI) / 180;
        const scaleFactor = adj.scale / 100;

        // 計算縮放比例（讓裁切區域填滿預覽框）
        const baseScale = Math.max(
            previewWidth / sourceCanvas.width,
            previewHeight / sourceCanvas.height
        );

        // 儲存狀態，移動到中心點，旋轉並縮放
        ctx.save();
        ctx.translate(previewWidth / 2, previewHeight / 2);
        ctx.rotate(radians);
        ctx.scale(baseScale * scaleFactor, baseScale * scaleFactor);

        // 繪製圖像（圖像中心對齊框架中心）
        ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
        ctx.restore();

        // 繪製框架邊框
        ctx.strokeStyle = '#4361ee';
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, previewWidth - 2, previewHeight - 2);
    },

    /**
     * 更新區域調整設定
     */
    updateCropAdjustments(rotation, scale) {
        // 使用當前頁碼作為 key
        const adjKey = this.state.currentPage;

        if (!this.state.regionAdjustments[adjKey]) {
            this.state.regionAdjustments[adjKey] = { rotation: 0, scale: 100 };
        }

        if (rotation !== null) {
            this.state.regionAdjustments[adjKey].rotation = rotation;
            this.elements.cropRotationDisplay.textContent = rotation + '°';
        }

        if (scale !== null) {
            this.state.regionAdjustments[adjKey].scale = scale;
            this.elements.cropScaleDisplay.textContent = scale + '%';
        }

        // 更新預覽
        this.renderCropPreview();
    },

    /**
     * 更新確認按鈕狀態
     */
    updateApplyButtonState() {
        // 至少要有一頁選取
        this.elements.applyRegionBtn.disabled = Object.keys(this.state.pageRegions).length === 0;
    },

    /**
     * 清除選取
     */
    clearSelection() {
        delete this.state.pageRegions[this.state.currentPage];
        delete this.state.regionAdjustments[this.state.currentPage];
        this.renderPageStatusList();

        this.state.currentCropCanvas = null;
        this.elements.selectionBox.hidden = true;
        this.elements.regionAdjustPanel.hidden = true;
        this.updateApplyButtonState();
    },

    /**
     * 套用區域，進入設定步驟
     */
    applyRegion() {
        if (Object.keys(this.state.pageRegions).length === 0) {
            this.showToast('請至少選取一頁的照片區域', 'warning');
            return;
        }

        // 顯示設定步驟
        this.elements.stepSettings.hidden = false;

        // 捲動到設定區域
        this.elements.stepSettings.scrollIntoView({ behavior: 'smooth' });

        this.showToast('區域已確認！請設定輸出選項後點擊「開始擷取」', 'success');
    },

    /**
     * 處理清單上傳
     */
    async handleListUpload(file) {
        const validExtensions = ['.csv', '.txt', '.xls', '.xlsx', '.xlsm'];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();

        if (!validExtensions.includes(fileExt)) {
            this.showToast('請上傳 CSV、TXT 或 Excel 檔案', 'error');
            return;
        }

        try {
            const names = await ListHandler.loadList(file);

            if (names.length === 0) {
                this.showToast('清單中沒有找到名稱', 'warning');
                return;
            }

            this.state.listLoaded = true;
            this.elements.listInfo.hidden = false;
            this.elements.listName.textContent = file.name;
            this.elements.listCount.textContent = `${names.length} 個名稱`;
            this.elements.listDropZone.style.display = 'none';

            this.showToast(`成功載入 ${names.length} 個名稱`, 'success');

        } catch (error) {
            console.error('清單處理失敗:', error);
            this.showToast(error.message || '清單處理失敗', 'error');
        }
    },

    /**
     * 移除 PDF
     */
    removePDF() {
        PDFHandler.reset();
        this.state.pdfLoaded = false;
        this.state.totalPages = 0;
        this.state.currentPage = 1;
        this.state.uniformRegion = null;
        this.state.pageRegions = {};
        this.state.images = [];
        this.state.selectedImages.clear();

        this.elements.pdfInput.value = '';
        this.elements.pdfInfo.hidden = true;
        this.elements.pdfDropZone.style.display = '';
        this.elements.stepRegion.hidden = true;
        this.elements.stepSettings.hidden = true;
        this.elements.stepResults.hidden = true;
        this.clearSelection();
    },

    /**
     * 移除清單
     */
    removeList() {
        ListHandler.reset();
        this.state.listLoaded = false;

        this.elements.listInput.value = '';
        this.elements.listInfo.hidden = true;
        this.elements.listDropZone.style.display = '';

        // 重置圖片名稱
        this.state.images.forEach((img, index) => {
            img.name = String(index + 1).padStart(3, '0');
        });

        this.renderImages();
    },

    /**
     * 擷取所有頁面的圖片
     */
    async extractAllImages() {
        try {
            this.elements.progressCard.hidden = false;
            this.elements.extractBtn.disabled = true;
            this.state.images = [];

            // 決定要擷取哪些頁面
            let pagesToExtract = [];

            // 逐頁模式：只擷取有選取區域的頁面
            for (const [page, region] of Object.entries(this.state.pageRegions)) {
                pagesToExtract.push({ page: parseInt(page), region: region });
            }
            pagesToExtract.sort((a, b) => a.page - b.page);

            for (let i = 0; i < pagesToExtract.length; i++) {
                const { page, region } = pagesToExtract[i];

                // 更新進度
                const progress = ((i + 1) / pagesToExtract.length) * 100;
                this.elements.progressFill.style.width = progress + '%';
                this.elements.progressText.textContent = `正在擷取第 ${page} 頁 (${i + 1}/${pagesToExtract.length})...`;

                // 擷取整頁（使用高解析度）
                const pageResult = await PDFHandler.extractPageAsImage(page, 3);

                // 裁切指定區域
                const cropX = Math.round(region.x * pageResult.canvas.width);
                const cropY = Math.round(region.y * pageResult.canvas.height);
                const cropWidth = Math.round(region.width * pageResult.canvas.width);
                const cropHeight = Math.round(region.height * pageResult.canvas.height);

                // 建立裁切 canvas
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropWidth;
                cropCanvas.height = cropHeight;
                const cropCtx = cropCanvas.getContext('2d');
                cropCtx.drawImage(
                    pageResult.canvas,
                    cropX, cropY, cropWidth, cropHeight,
                    0, 0, cropWidth, cropHeight
                );

                // 取得區域調整設定
                const adjKey = page;
                const adj = this.state.regionAdjustments[adjKey] || { rotation: 0, scale: 100 };

                // 套用旋轉和縮放，直接輸出目標尺寸（固定框架，圖像在框內旋轉）
                const finalCanvas = this.applyAdjustments(
                    cropCanvas,
                    adj.rotation,
                    adj.scale,
                    this.state.targetWidth,
                    this.state.targetHeight
                );

                // 決定名稱
                let name;
                if (this.state.listLoaded && this.state.namingMode === 'sequential') {
                    name = ListHandler.getNameByIndex(i) || String(i + 1).padStart(3, '0');
                } else {
                    name = String(i + 1).padStart(3, '0');
                }

                // 驗證圖片
                const validation = ImageHandler.validateImage({
                    canvas: finalCanvas,
                    width: this.state.targetWidth,
                    height: this.state.targetHeight
                });

                this.state.images.push({
                    canvas: finalCanvas,
                    width: this.state.targetWidth,
                    height: this.state.targetHeight,
                    pageNum: page,
                    name: name,
                    validation: validation,
                    rotation: 0, // 結果頁面的旋轉角度
                    scale: 100   // 結果頁面的縮放比例
                });
            }

            this.elements.progressText.textContent = `擷取完成！共 ${this.state.images.length} 張照片`;

            // 顯示結果
            setTimeout(() => {
                this.elements.progressCard.hidden = true;
                this.elements.extractBtn.disabled = false;
                this.elements.stepResults.hidden = false;
                this.renderImages();
                this.elements.stepResults.scrollIntoView({ behavior: 'smooth' });
            }, 500);

            this.showToast(`成功擷取 ${this.state.images.length} 張照片（尺寸：${this.state.targetWidth}×${this.state.targetHeight}px）`, 'success');

        } catch (error) {
            console.error('擷取失敗:', error);
            this.elements.progressCard.hidden = true;
            this.elements.extractBtn.disabled = false;
            this.showToast('擷取失敗: ' + error.message, 'error');
        }
    },

    /**
     * 更新圖片變形（旋轉和縮放）
     */
    updateImageTransform(index) {
        const img = this.state.images[index];
        const degrees = img.rotation || 0;
        const scale = img.scale || 100;

        // 建立旋轉縮放後的 canvas（固定輸出尺寸）
        const outputWidth = this.state.targetWidth;
        const outputHeight = this.state.targetHeight;

        const transformedCanvas = document.createElement('canvas');
        transformedCanvas.width = outputWidth;
        transformedCanvas.height = outputHeight;

        const ctx = transformedCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 填充白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outputWidth, outputHeight);

        // 計算旋轉參數
        const radians = (degrees * Math.PI) / 180;
        const scaleFactor = scale / 100;

        // 計算基礎縮放比例（讓原始圖像填滿輸出框）
        const baseScaleX = outputWidth / img.canvas.width;
        const baseScaleY = outputHeight / img.canvas.height;
        const baseScale = Math.max(baseScaleX, baseScaleY);

        // 移動到中心點，旋轉並縮放
        ctx.translate(outputWidth / 2, outputHeight / 2);
        ctx.rotate(radians);
        ctx.scale(baseScale * scaleFactor, baseScale * scaleFactor);

        // 繪製圖像（圖像中心對齊框架中心）
        ctx.drawImage(
            img.canvas,
            -img.canvas.width / 2,
            -img.canvas.height / 2
        );

        // 更新圖片卡片的顯示
        const card = this.elements.imagesGrid.children[index];
        if (card) {
            const imgElement = card.querySelector('.image-wrapper img');
            imgElement.src = transformedCanvas.toDataURL('image/jpeg', 0.9);

            // 更新旋轉滑桿和輸入框
            const rotationSlider = card.querySelector('.rotation-slider');
            const rotationInput = card.querySelector('.rotation-value');
            if (rotationSlider) rotationSlider.value = degrees;
            if (rotationInput) rotationInput.value = degrees + '°';

            // 更新縮放滑桿和數值
            const scaleSlider = card.querySelector('.scale-slider');
            const scaleValue = card.querySelector('.scale-value');
            if (scaleSlider) scaleSlider.value = scale;
            if (scaleValue) scaleValue.textContent = scale + '%';
        }

        // 儲存變形後的 canvas 供下載使用
        img.rotatedCanvas = transformedCanvas;
    },

    /**
     * 設定圖片縮放
     */
    setImageScale(index, scale) {
        const img = this.state.images[index];
        // 限制縮放範圍 50% 到 200%
        scale = Math.max(50, Math.min(200, parseInt(scale)));
        img.scale = scale;
        this.updateImageTransform(index);
    },

    /**
     * 旋轉圖片（設定絕對角度，固定框架模式）
     */
    setImageRotation(index, degrees) {
        const img = this.state.images[index];
        // 角度範圍 -180 到 180
        degrees = ((degrees + 180) % 360) - 180;
        img.rotation = degrees;
        this.updateImageTransform(index);
    },

    /**
     * 旋轉圖片（增加相對角度）
     */
    rotateImage(index, deltaDegrees) {
        const img = this.state.images[index];
        const newDegrees = (img.rotation + deltaDegrees + 360) % 360;
        this.setImageRotation(index, newDegrees);
    },

    /**
     * 更新命名模式
     */
    updateNamingMode() {
        if (this.state.namingMode === 'manual' && this.state.listLoaded) {
            this.elements.nameListSection.hidden = false;
        } else {
            this.elements.nameListSection.hidden = true;
        }

        // 切換模式時重新渲染圖片
        if (this.state.images.length > 0) {
            if (this.state.listLoaded) {
                ListHandler.usedNames.clear();
            }
            this.updateImageNames();
        }
    },

    /**
     * 更新圖片名稱
     */
    updateImageNames() {
        if (this.state.namingMode === 'sequential') {
            this.state.images.forEach((img, index) => {
                const name = ListHandler.getNameByIndex(index);
                if (name) {
                    img.name = name;
                    ListHandler.markAsUsed(name);
                } else {
                    img.name = String(index + 1).padStart(3, '0');
                }
            });
        }

        this.renderImages();
        this.renderNameList();
    },

    /**
     * 渲染圖片預覽
     */
    renderImages() {
        this.elements.imagesGrid.innerHTML = '';
        this.elements.imageCount.textContent = this.state.images.length;

        this.state.images.forEach((img, index) => {
            const card = document.createElement('div');
            card.className = 'image-card';
            card.dataset.index = index;

            if (this.state.selectedImages.has(index)) {
                card.classList.add('selected');
            }

            const dataURL = img.rotatedCanvas
                ? img.rotatedCanvas.toDataURL('image/jpeg', 0.9)
                : img.canvas.toDataURL('image/jpeg', 0.9);

            card.innerHTML = `
                <div class="image-wrapper">
                    <img src="${dataURL}" alt="照片 ${index + 1}">
                    <div class="image-checkbox">✓</div>
                    <div class="image-status ${img.validation.isValid ? 'valid' : 'invalid'}">
                        ${img.validation.isValid ? '符合' : '尺寸異常'}
                    </div>
                </div>
                <div class="image-info">
                    <div class="image-name" title="${img.name}">${img.name}</div>
                    <div class="image-details">
                        ${img.width} × ${img.height} px | 第 ${img.pageNum} 頁
                    </div>
                </div>
                <div class="rotation-controls">
                    <div class="rotation-adjust-buttons">
                        <button class="rotate-btn" data-rotate-step="-5" title="-5°">-5°</button>
                        <button class="rotate-btn" data-rotate-step="-1" title="-1°">-1°</button>
                        <button class="rotate-btn" data-rotate-step="1" title="+1°">+1°</button>
                        <button class="rotate-btn" data-rotate-step="5" title="+5°">+5°</button>
                    </div>
                    <div class="rotation-slider-row">
                        <input type="range" class="rotation-slider" min="-180" max="180" value="${img.rotation}" title="拖曳調整角度">
                        <input type="text" class="rotation-value" value="${img.rotation}°" title="輸入角度">
                    </div>
                    
                    <div class="rotation-slider-row" style="margin-top: 8px;">
                         <span style="font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; margin-right: 4px;">縮放</span>
                         <input type="range" class="scale-slider" min="50" max="200" value="${img.scale || 100}" step="5" title="拖曳調整縮放" style="flex: 1; height: 4px; accent-color: var(--primary); cursor: pointer;">
                         <span class="scale-value" style="font-size: 0.75rem; color: var(--text-primary); width: 35px; text-align: right;">${img.scale || 100}%</span>
                    </div>

                    <div class="rotation-buttons" style="margin-top: 8px;">
                        <button class="rotate-btn" data-rotate="0" title="重置角度">⟳ 重置</button>
                    </div>
                </div>
            `;

            // 點擊選取
            card.querySelector('.image-wrapper').addEventListener('click', () => {
                this.toggleImageSelection(index);
            });

            // 滑桿事件
            const slider = card.querySelector('.rotation-slider');
            slider.addEventListener('input', (e) => {
                const degrees = parseInt(e.target.value);
                this.setImageRotation(index, degrees);
            });

            // 輸入框事件
            const rotationInput = card.querySelector('.rotation-value');
            rotationInput.addEventListener('change', (e) => {
                let value = e.target.value.replace('°', '').trim();
                let degrees = parseInt(value);
                if (isNaN(degrees)) degrees = 0;
                degrees = Math.max(0, Math.min(360, degrees));
                this.setImageRotation(index, degrees);
            });

            rotationInput.addEventListener('focus', (e) => {
                e.target.select();
            });

            // 縮放滑桿事件
            const scaleSlider = card.querySelector('.scale-slider');
            scaleSlider.addEventListener('input', (e) => {
                const scale = parseInt(e.target.value);
                this.setImageScale(index, scale);
                card.querySelector('.scale-value').textContent = scale + '%';
            });

            // 旋轉按鈕事件
            card.querySelectorAll('.rotate-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // +/- 步進按鈕
                    if (btn.dataset.rotateStep) {
                        const step = parseInt(btn.dataset.rotateStep);
                        const currentRotation = this.state.images[index].rotation || 0;
                        let newRotation = currentRotation + step;
                        // 限制在 -180 到 180 的範圍
                        newRotation = Math.max(-180, Math.min(180, newRotation));
                        this.setImageRotation(index, newRotation);
                    }
                    // 重置按鈕
                    else if (btn.dataset.rotate !== undefined) {
                        const degrees = parseInt(btn.dataset.rotate);
                        if (degrees === 0) {
                            this.setImageRotation(index, 0);
                        } else {
                            this.rotateImage(index, degrees);
                        }
                    }
                });
            });

            // 如果是手動模式且有清單，添加下拉選單
            if (this.state.namingMode === 'manual' && this.state.listLoaded) {
                const nameSelect = document.createElement('div');
                nameSelect.className = 'image-name-select';

                const select = document.createElement('select');
                select.innerHTML = '<option value="">-- 選擇名稱 --</option>';

                ListHandler.getNames().forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    if (img.name === name) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });

                select.addEventListener('change', (e) => {
                    this.assignNameToImage(index, e.target.value);
                });

                nameSelect.appendChild(select);
                card.querySelector('.image-info').appendChild(nameSelect);
            }

            // 如果是自訂輸入模式，添加輸入框
            if (this.state.namingMode === 'custom') {
                const nameInputDiv = document.createElement('div');
                nameInputDiv.className = 'image-name-input';

                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = '輸入自訂名稱';
                input.value = img.customName || '';
                input.className = 'custom-name-input';

                input.addEventListener('change', (e) => {
                    img.customName = e.target.value.trim();
                    if (img.customName) {
                        img.name = img.customName;
                    } else {
                        img.name = String(index + 1).padStart(3, '0');
                    }
                    // 更新顯示的名稱
                    card.querySelector('.image-name').textContent = img.name;
                    card.querySelector('.image-name').title = img.name;
                });

                input.addEventListener('focus', (e) => {
                    e.target.select();
                });

                nameInputDiv.appendChild(input);
                card.querySelector('.image-info').appendChild(nameInputDiv);
            }

            this.elements.imagesGrid.appendChild(card);
        });

        this.updateDownloadButton();
    },

    /**
     * 渲染名稱清單
     */
    renderNameList() {
        if (!this.state.listLoaded) return;

        this.elements.nameListContainer.innerHTML = '';

        ListHandler.getNames().forEach(name => {
            const tag = document.createElement('span');
            tag.className = 'name-tag';
            tag.textContent = name;

            if (ListHandler.isUsed(name)) {
                tag.classList.add('used');
            }

            this.elements.nameListContainer.appendChild(tag);
        });
    },

    /**
     * 指定名稱給圖片
     */
    assignNameToImage(imageIndex, name) {
        const img = this.state.images[imageIndex];

        if (img.name && ListHandler.isUsed(img.name)) {
            ListHandler.unmarkUsed(img.name);
        }

        if (name) {
            img.name = name;
            ListHandler.markAsUsed(name);
        } else {
            img.name = String(imageIndex + 1).padStart(3, '0');
        }

        this.renderNameList();

        const card = this.elements.imagesGrid.children[imageIndex];
        if (card) {
            card.querySelector('.image-name').textContent = img.name;
            card.querySelector('.image-name').title = img.name;
        }
    },

    /**
     * 切換圖片選取
     */
    toggleImageSelection(index) {
        const card = this.elements.imagesGrid.children[index];

        if (this.state.selectedImages.has(index)) {
            this.state.selectedImages.delete(index);
            card.classList.remove('selected');
        } else {
            this.state.selectedImages.add(index);
            card.classList.add('selected');
        }

        this.updateDownloadButton();
    },

    /**
     * 全選/取消全選
     */
    toggleSelectAll() {
        const allSelected = this.state.selectedImages.size === this.state.images.length;

        if (allSelected) {
            this.state.selectedImages.clear();
            this.elements.selectAllBtn.textContent = '全選';
        } else {
            this.state.images.forEach((_, index) => {
                this.state.selectedImages.add(index);
            });
            this.elements.selectAllBtn.textContent = '取消全選';
        }

        Array.from(this.elements.imagesGrid.children).forEach((card, index) => {
            if (this.state.selectedImages.has(index)) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        this.updateDownloadButton();
    },

    /**
     * 更新下載按鈕狀態
     */
    updateDownloadButton() {
        const count = this.state.selectedImages.size;
        this.elements.downloadBtn.disabled = count === 0;
        this.elements.downloadBtn.innerHTML = `
            <span>⬇️</span>
            下載選取的圖片 (${count})
        `;
    },

    /**
     * 下載選取的圖片
     */
    async downloadSelectedImages() {
        if (this.state.selectedImages.size === 0) {
            this.showToast('請先選取要下載的圖片', 'warning');
            return;
        }

        try {
            const selectedImages = Array.from(this.state.selectedImages).map(index => {
                const img = this.state.images[index];
                return {
                    canvas: img.rotatedCanvas || img.canvas,
                    name: img.name
                };
            });

            if (selectedImages.length === 1) {
                this.showToast('正在準備下載...', 'success');
                await ImageHandler.downloadImage(
                    selectedImages[0].canvas,
                    selectedImages[0].name,
                    this.state.outputFormat,
                    this.state.jpegQuality,
                    this.state.dpi
                );
            } else {
                this.elements.progressCard.hidden = false;
                this.elements.progressTitle.textContent = '正在打包圖片...';

                await ImageHandler.downloadAsZip(
                    selectedImages,
                    this.state.outputFormat,
                    this.state.jpegQuality,
                    (current, total) => {
                        const progress = (current / total) * 100;
                        this.elements.progressFill.style.width = progress + '%';
                        this.elements.progressText.textContent = `正在處理 ${current}/${total} 張圖片...`;
                    },
                    this.state.dpi
                );

                this.elements.progressCard.hidden = true;
            }

            this.showToast('下載完成！', 'success');

        } catch (error) {
            console.error('下載失敗:', error);
            this.elements.progressCard.hidden = true;
            this.showToast('下載失敗: ' + error.message, 'error');
        }
    },

    /**
     * 顯示 Toast 通知
     */
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
};

// 初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
