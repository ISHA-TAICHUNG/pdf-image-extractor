/**
 * PDF Handler Module
 * 處理 PDF 檔案上傳與圖片擷取
 */

const PDFHandler = {
    pdfDoc: null,
    
    /**
     * 初始化 PDF.js
     */
    init() {
        // 設定 PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    },
    
    /**
     * 載入 PDF 檔案
     * @param {File} file - PDF 檔案
     * @returns {Promise<Object>} PDF 文件資訊
     */
    async loadPDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            return {
                numPages: this.pdfDoc.numPages,
                fileName: file.name
            };
        } catch (error) {
            console.error('載入 PDF 失敗:', error);
            throw new Error('無法載入 PDF 檔案，請確認檔案格式正確');
        }
    },
    
    /**
     * 從 PDF 頁面擷取圖片
     * @param {number} pageNum - 頁碼
     * @param {number} scale - 縮放比例
     * @returns {Promise<Object>} 圖片資訊
     */
    async extractPageAsImage(pageNum, scale = 2) {
        if (!this.pdfDoc) {
            throw new Error('請先載入 PDF 檔案');
        }
        
        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            
            // 建立 canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // 渲染頁面到 canvas
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            return {
                canvas,
                width: viewport.width,
                height: viewport.height,
                pageNum
            };
        } catch (error) {
            console.error(`擷取第 ${pageNum} 頁失敗:`, error);
            throw new Error(`無法擷取第 ${pageNum} 頁`);
        }
    },
    
    /**
     * 從所有頁面擷取圖片
     * @param {Function} onProgress - 進度回調
     * @returns {Promise<Array>} 所有頁面的圖片資訊
     */
    async extractAllPages(onProgress) {
        if (!this.pdfDoc) {
            throw new Error('請先載入 PDF 檔案');
        }
        
        const images = [];
        const totalPages = this.pdfDoc.numPages;
        
        for (let i = 1; i <= totalPages; i++) {
            const image = await this.extractPageAsImage(i);
            images.push(image);
            
            if (onProgress) {
                onProgress(i, totalPages);
            }
        }
        
        return images;
    },
    
    /**
     * 嘗試從 PDF 中擷取嵌入的圖片物件
     * 這個方法會嘗試找出 PDF 中的原始圖片
     * @param {number} pageNum - 頁碼
     * @returns {Promise<Array>} 嵌入圖片陣列
     */
    async extractEmbeddedImages(pageNum) {
        if (!this.pdfDoc) {
            throw new Error('請先載入 PDF 檔案');
        }
        
        const images = [];
        
        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const operatorList = await page.getOperatorList();
            const objs = page.objs;
            
            // 遍歷操作列表尋找圖片
            for (let i = 0; i < operatorList.fnArray.length; i++) {
                // OPS.paintImageXObject = 85
                if (operatorList.fnArray[i] === 85) {
                    const imgName = operatorList.argsArray[i][0];
                    
                    try {
                        const imgData = await new Promise((resolve, reject) => {
                            objs.get(imgName, (data) => {
                                if (data) {
                                    resolve(data);
                                } else {
                                    reject(new Error('無法取得圖片資料'));
                                }
                            });
                        });
                        
                        if (imgData && imgData.width && imgData.height) {
                            // 將圖片資料轉換為 canvas
                            const canvas = document.createElement('canvas');
                            canvas.width = imgData.width;
                            canvas.height = imgData.height;
                            const ctx = canvas.getContext('2d');
                            
                            // 建立 ImageData
                            const imageData = ctx.createImageData(imgData.width, imgData.height);
                            
                            // 根據圖片類型處理資料
                            if (imgData.data) {
                                // 直接複製資料
                                const data = imgData.data;
                                for (let j = 0; j < data.length; j++) {
                                    imageData.data[j] = data[j];
                                }
                            }
                            
                            ctx.putImageData(imageData, 0, 0);
                            
                            images.push({
                                canvas,
                                width: imgData.width,
                                height: imgData.height,
                                name: imgName,
                                pageNum
                            });
                        }
                    } catch (e) {
                        // 忽略無法處理的圖片
                        console.warn(`無法處理圖片 ${imgName}:`, e);
                    }
                }
            }
        } catch (error) {
            console.error(`擷取嵌入圖片失敗:`, error);
        }
        
        return images;
    },
    
    /**
     * 從所有頁面擷取嵌入圖片
     * @param {Function} onProgress - 進度回調
     * @returns {Promise<Array>} 所有嵌入圖片
     */
    async extractAllEmbeddedImages(onProgress) {
        if (!this.pdfDoc) {
            throw new Error('請先載入 PDF 檔案');
        }
        
        const allImages = [];
        const totalPages = this.pdfDoc.numPages;
        
        for (let i = 1; i <= totalPages; i++) {
            const pageImages = await this.extractEmbeddedImages(i);
            allImages.push(...pageImages);
            
            if (onProgress) {
                onProgress(i, totalPages);
            }
        }
        
        return allImages;
    },
    
    /**
     * 重置 PDF 文件
     */
    reset() {
        this.pdfDoc = null;
    }
};

// 初始化
PDFHandler.init();
