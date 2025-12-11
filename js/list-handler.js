/**
 * List Handler Module
 * 處理名稱清單檔案 (CSV, TXT, xlsx, xlsm)
 */

const ListHandler = {
    names: [],
    usedNames: new Set(),

    /**
     * 載入清單檔案
     * @param {File} file - 清單檔案
     * @returns {Promise<Array>} 名稱陣列
     */
    async loadList(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        try {
            switch (extension) {
                case 'txt':
                    this.names = await this.parseTXT(file);
                    break;
                case 'csv':
                    this.names = await this.parseCSV(file);
                    break;
                case 'xlsx':
                case 'xlsm':
                    this.names = await this.parseExcel(file);
                    break;
                default:
                    throw new Error('不支援的檔案格式');
            }

            // 清理空白名稱
            this.names = this.names.filter(name => name && name.trim());
            this.usedNames.clear();

            return this.names;
        } catch (error) {
            console.error('解析清單失敗:', error);
            throw new Error('無法解析清單檔案，請確認格式正確');
        }
    },

    /**
     * 解析 TXT 檔案
     * @param {File} file 
     * @returns {Promise<Array>}
     */
    async parseTXT(file) {
        const text = await file.text();
        return text.split(/\r?\n/).map(line => line.trim());
    },

    /**
     * 解析 CSV 檔案
     * @param {File} file 
     * @returns {Promise<Array>}
     */
    async parseCSV(file) {
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        const names = [];

        for (const line of lines) {
            // 取得第一欄作為名稱
            const parts = line.split(',');
            if (parts[0]) {
                // 移除可能的引號
                let name = parts[0].trim().replace(/^["']|["']$/g, '');
                if (name) {
                    names.push(name);
                }
            }
        }

        return names;
    },

    /**
     * 解析 Excel 檔案 (xlsx, xlsm)
     * @param {File} file 
     * @returns {Promise<Array>}
     */
    async parseExcel(file) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        // 取得第一個工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 轉換為 JSON
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // 取得第一欄的值
        const names = [];
        for (const row of data) {
            if (row[0] !== undefined && row[0] !== null) {
                const name = String(row[0]).trim();
                if (name) {
                    names.push(name);
                }
            }
        }

        return names;
    },

    /**
     * 取得所有名稱
     * @returns {Array}
     */
    getNames() {
        return [...this.names];
    },

    /**
     * 取得可用的名稱（未被使用的）
     * @returns {Array}
     */
    getAvailableNames() {
        return this.names.filter(name => !this.usedNames.has(name));
    },

    /**
     * 標記名稱為已使用
     * @param {string} name 
     */
    markAsUsed(name) {
        this.usedNames.add(name);
    },

    /**
     * 取消標記名稱
     * @param {string} name 
     */
    unmarkUsed(name) {
        this.usedNames.delete(name);
    },

    /**
     * 檢查名稱是否已使用
     * @param {string} name 
     * @returns {boolean}
     */
    isUsed(name) {
        return this.usedNames.has(name);
    },

    /**
     * 依序取得名稱
     * @param {number} index - 索引
     * @returns {string|null}
     */
    getNameByIndex(index) {
        if (index >= 0 && index < this.names.length) {
            return this.names[index];
        }
        return null;
    },

    /**
     * 搜尋名稱
     * @param {string} query - 搜尋關鍵字
     * @returns {Array}
     */
    searchNames(query) {
        const lowerQuery = query.toLowerCase();
        return this.names.filter(name =>
            name.toLowerCase().includes(lowerQuery)
        );
    },

    /**
     * 取得名稱總數
     * @returns {number}
     */
    getCount() {
        return this.names.length;
    },

    /**
     * 重置清單
     */
    reset() {
        this.names = [];
        this.usedNames.clear();
    }
};
