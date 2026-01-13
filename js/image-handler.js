/**
 * Image Handler Module
 * 處理圖片驗證、轉換和下載
 */

const ImageHandler = {
    // 規格要求
    specs: {
        dpi: 300,
        width: 413,
        height: 531,
        maxSize: 1 * 1024 * 1024 // 1MB
    },

    /**
     * 驗證圖片規格
     * @param {Object} imageData - 圖片資料 { canvas, width, height }
     * @returns {Object} 驗證結果
     */
    validateImage(imageData) {
        const { canvas, width, height } = imageData;

        const result = {
            isValid: true,
            warnings: [],
            details: {
                width: width,
                height: height,
                aspectRatio: (width / height).toFixed(3)
            }
        };

        // 檢查尺寸（允許 5% 誤差）
        const widthTolerance = this.specs.width * 0.05;
        const heightTolerance = this.specs.height * 0.05;

        if (Math.abs(width - this.specs.width) > widthTolerance) {
            result.warnings.push(`寬度 ${width}px (要求: ${this.specs.width}px)`);
        }

        if (Math.abs(height - this.specs.height) > heightTolerance) {
            result.warnings.push(`高度 ${height}px (要求: ${this.specs.height}px)`);
        }

        // 如果有警告，標記為非完全符合
        if (result.warnings.length > 0) {
            result.isValid = false;
        }

        return result;
    },

    /**
     * 調整圖片尺寸
     * @param {HTMLCanvasElement} sourceCanvas - 來源 canvas
     * @param {number} targetWidth - 目標寬度
     * @param {number} targetHeight - 目標高度
     * @returns {HTMLCanvasElement} 調整後的 canvas
     */
    resizeImage(sourceCanvas, targetWidth = this.specs.width, targetHeight = this.specs.height) {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 計算縮放比例，保持比例
        const sourceAspect = sourceCanvas.width / sourceCanvas.height;
        const targetAspect = targetWidth / targetHeight;

        let sx = 0, sy = 0, sw = sourceCanvas.width, sh = sourceCanvas.height;

        if (sourceAspect > targetAspect) {
            // 來源較寬，裁切兩側
            sw = sourceCanvas.height * targetAspect;
            sx = (sourceCanvas.width - sw) / 2;
        } else {
            // 來源較高，裁切上下
            sh = sourceCanvas.width / targetAspect;
            sy = (sourceCanvas.height - sh) / 2;
        }

        ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

        return canvas;
    },

    /**
     * 將 canvas 轉換為 Blob（含 DPI 設定）
     * @param {HTMLCanvasElement} canvas 
     * @param {string} format - 'jpeg' 或 'png'
     * @param {number} quality - JPEG 品質 (0-1)
     * @param {number} dpi - DPI 值
     * @returns {Promise<Blob>}
     */
    async canvasToBlob(canvas, format = 'jpeg', quality = 0.92, dpi = 300) {
        return new Promise((resolve, reject) => {
            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            canvas.toBlob(
                async (blob) => {
                    if (blob) {
                        // 為圖片加入 DPI 資訊
                        const blobWithDPI = await this.setBlobDPI(blob, dpi, format);
                        resolve(blobWithDPI);
                    } else {
                        reject(new Error('無法轉換圖片'));
                    }
                },
                mimeType,
                quality
            );
        });
    },

    /**
     * 設定 Blob 的 DPI 資訊
     * @param {Blob} blob 
     * @param {number} dpi 
     * @param {string} format 
     * @returns {Promise<Blob>}
     */
    async setBlobDPI(blob, dpi, format) {
        const arrayBuffer = await blob.arrayBuffer();
        const dataView = new DataView(arrayBuffer);

        if (format === 'jpeg') {
            // 修改 JPEG 的 JFIF APP0 標記中的 DPI
            return this.setJpegDPI(arrayBuffer, dpi);
        } else if (format === 'png') {
            // 修改 PNG 的 pHYs chunk
            return this.setPngDPI(arrayBuffer, dpi);
        }

        return blob;
    },

    /**
     * 設定 JPEG 的 DPI
     * @param {ArrayBuffer} buffer 
     * @param {number} dpi 
     * @returns {Blob}
     */
    setJpegDPI(buffer, dpi) {
        const data = new Uint8Array(buffer);

        // 尋找 APP0 JFIF 標記 (FF E0)
        for (let i = 0; i < data.length - 20; i++) {
            if (data[i] === 0xFF && data[i + 1] === 0xE0) {
                // 確認是 JFIF
                if (data[i + 4] === 0x4A && data[i + 5] === 0x46 &&
                    data[i + 6] === 0x49 && data[i + 7] === 0x46) {
                    // 設定密度單位為 dots per inch (01)
                    data[i + 11] = 0x01;
                    // 設定 X 密度 (big endian)
                    data[i + 12] = (dpi >> 8) & 0xFF;
                    data[i + 13] = dpi & 0xFF;
                    // 設定 Y 密度 (big endian)
                    data[i + 14] = (dpi >> 8) & 0xFF;
                    data[i + 15] = dpi & 0xFF;
                    break;
                }
            }
        }

        return new Blob([data], { type: 'image/jpeg' });
    },

    /**
     * 設定 PNG 的 DPI (透過 pHYs chunk)
     * @param {ArrayBuffer} buffer 
     * @param {number} dpi 
     * @returns {Blob}
     */
    setPngDPI(buffer, dpi) {
        const data = new Uint8Array(buffer);

        // DPI 轉換為每公尺像素數 (1 inch = 0.0254 meters)
        const ppm = Math.round(dpi / 0.0254);

        // 建立 pHYs chunk
        // 格式: length (4 bytes) + "pHYs" (4 bytes) + data (9 bytes) + CRC (4 bytes)
        const physChunk = new Uint8Array(21);

        // Length: 9
        physChunk[0] = 0; physChunk[1] = 0; physChunk[2] = 0; physChunk[3] = 9;

        // Type: pHYs
        physChunk[4] = 0x70; // p
        physChunk[5] = 0x48; // H
        physChunk[6] = 0x59; // Y
        physChunk[7] = 0x73; // s

        // X pixels per unit (big endian)
        physChunk[8] = (ppm >> 24) & 0xFF;
        physChunk[9] = (ppm >> 16) & 0xFF;
        physChunk[10] = (ppm >> 8) & 0xFF;
        physChunk[11] = ppm & 0xFF;

        // Y pixels per unit (big endian)
        physChunk[12] = (ppm >> 24) & 0xFF;
        physChunk[13] = (ppm >> 16) & 0xFF;
        physChunk[14] = (ppm >> 8) & 0xFF;
        physChunk[15] = ppm & 0xFF;

        // Unit: meter (1)
        physChunk[16] = 1;

        // CRC (簡化處理，使用固定值可能導致某些軟體無法正確讀取)
        const crc = this.crc32(physChunk.subarray(4, 17));
        physChunk[17] = (crc >> 24) & 0xFF;
        physChunk[18] = (crc >> 16) & 0xFF;
        physChunk[19] = (crc >> 8) & 0xFF;
        physChunk[20] = crc & 0xFF;

        // 在 IHDR chunk 後插入 pHYs chunk
        // PNG header: 8 bytes
        // IHDR: length (4) + type (4) + data (13) + crc (4) = 25 bytes
        // 插入位置: 8 + 25 = 33
        const insertPos = 33;

        // 檢查是否已有 pHYs chunk，如果有則替換
        let hasPhys = false;
        for (let i = 8; i < data.length - 4; i++) {
            if (data[i] === 0x70 && data[i + 1] === 0x48 &&
                data[i + 2] === 0x59 && data[i + 3] === 0x73) {
                // 找到現有的 pHYs，修改它
                const ppm = Math.round(dpi / 0.0254);
                data[i + 4] = (ppm >> 24) & 0xFF;
                data[i + 5] = (ppm >> 16) & 0xFF;
                data[i + 6] = (ppm >> 8) & 0xFF;
                data[i + 7] = ppm & 0xFF;
                data[i + 8] = (ppm >> 24) & 0xFF;
                data[i + 9] = (ppm >> 16) & 0xFF;
                data[i + 10] = (ppm >> 8) & 0xFF;
                data[i + 11] = ppm & 0xFF;
                data[i + 12] = 1;
                hasPhys = true;
                break;
            }
        }

        if (hasPhys) {
            return new Blob([data], { type: 'image/png' });
        }

        // 插入新的 pHYs chunk
        const newData = new Uint8Array(data.length + physChunk.length);
        newData.set(data.subarray(0, insertPos), 0);
        newData.set(physChunk, insertPos);
        newData.set(data.subarray(insertPos), insertPos + physChunk.length);

        return new Blob([newData], { type: 'image/png' });
    },

    /**
     * 計算 CRC32
     * @param {Uint8Array} data 
     * @returns {number}
     */
    crc32(data) {
        let crc = 0xFFFFFFFF;
        const table = this.getCRC32Table();

        for (let i = 0; i < data.length; i++) {
            crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
        }

        return (crc ^ 0xFFFFFFFF) >>> 0;
    },

    /**
     * 取得 CRC32 查找表
     * @returns {Uint32Array}
     */
    getCRC32Table() {
        if (!this._crc32Table) {
            this._crc32Table = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) {
                    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                }
                this._crc32Table[i] = c;
            }
        }
        return this._crc32Table;
    },

    /**
     * 將 canvas 轉換為 Data URL
     * @param {HTMLCanvasElement} canvas 
     * @param {string} format 
     * @param {number} quality 
     * @returns {string}
     */
    canvasToDataURL(canvas, format = 'jpeg', quality = 0.92) {
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        return canvas.toDataURL(mimeType, quality);
    },

    /**
     * 檢查並壓縮圖片至指定大小
     * @param {HTMLCanvasElement} canvas 
     * @param {string} format 
     * @param {number} maxSize - 最大檔案大小（bytes）
     * @param {number} dpi - DPI 值
     * @returns {Promise<Blob>}
     */
    async compressToSize(canvas, format = 'jpeg', maxSize = this.specs.maxSize, dpi = 300) {
        let quality = 0.92;
        let blob = await this.canvasToBlob(canvas, format, quality, dpi);

        // 如果是 PNG 且超過大小限制，嘗試轉換為 JPEG
        if (format === 'png' && blob.size > maxSize) {
            console.warn('PNG 超過大小限制，自動轉換為 JPEG');
            format = 'jpeg';
            blob = await this.canvasToBlob(canvas, format, quality, dpi);
        }

        // 逐步降低品質直到符合大小要求
        while (blob.size > maxSize && quality > 0.1) {
            quality -= 0.05;
            blob = await this.canvasToBlob(canvas, format, quality, dpi);
        }

        if (blob.size > maxSize) {
            console.warn('無法壓縮至指定大小');
        }

        return blob;
    },

    /**
     * 建立圖片預覽元素
     * @param {HTMLCanvasElement} canvas 
     * @param {number} index 
     * @param {string} name 
     * @param {Object} validation 
     * @returns {HTMLElement}
     */
    createImageCard(canvas, index, name, validation) {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.dataset.index = index;

        if (!validation.isValid) {
            card.classList.add('invalid');
        }

        const dataURL = this.canvasToDataURL(canvas);

        card.innerHTML = `
            <div class="image-wrapper">
                <img src="${dataURL}" alt="圖片 ${index + 1}">
                <div class="image-checkbox">✓</div>
                <div class="image-status ${validation.isValid ? 'valid' : 'invalid'}">
                    ${validation.isValid ? '符合' : '尺寸異常'}
                </div>
            </div>
            <div class="image-info">
                <div class="image-name" title="${name}">${name}</div>
                <div class="image-details">
                    ${validation.details.width} × ${validation.details.height} px
                </div>
            </div>
        `;

        return card;
    },

    /**
     * 下載單一圖片
     * @param {HTMLCanvasElement} canvas 
     * @param {string} filename 
     * @param {string} format 
     * @param {number} quality
     * @param {number} dpi
     */
    async downloadImage(canvas, filename, format = 'jpeg', quality = 0.92, dpi = 300) {
        const blob = await this.compressToSize(canvas, format, this.specs.maxSize, dpi);
        const extension = format === 'png' ? 'png' : 'jpg';
        saveAs(blob, `${filename}.${extension}`);
    },

    /**
     * 批次下載圖片（ZIP 格式）
     * @param {Array} images - 圖片資料陣列 [{ canvas, name }]
     * @param {string} format 
     * @param {number} quality 
     * @param {Function} onProgress 
     * @param {number} dpi
     * @returns {Promise<void>}
     */
    async downloadAsZip(images, format = 'jpeg', quality = 0.92, onProgress, dpi = 300) {
        const zip = new JSZip();
        const extension = format === 'png' ? 'png' : 'jpg';

        for (let i = 0; i < images.length; i++) {
            const { canvas, name } = images[i];
            const blob = await this.compressToSize(canvas, format, this.specs.maxSize, dpi);
            zip.file(`${name}.${extension}`, blob);

            if (onProgress) {
                onProgress(i + 1, images.length);
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, '電測截圖.zip');
    },

    /**
     * 格式化檔案大小
     * @param {number} bytes 
     * @returns {string}
     */
    formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' B';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        }
    }
};
