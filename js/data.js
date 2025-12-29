// Data Management Module - With Auto-Fetch from veriler.xlsx

const DataManager = {
    // Flag to track if using user-uploaded data (session-only)
    isUsingSessionData: false,

    // Save node positions to LocalStorage (only layout, not data)
    saveToLocalStorage() {
        const layoutToSave = {
            nodes: AppState.nodes,
            connections: AppState.connections
        };
        localStorage.setItem('kriter_v5_layout', JSON.stringify(layoutToSave));
    },

    // Load only layout from LocalStorage (nodes positions)
    loadLayoutFromLocalStorage() {
        const saved = localStorage.getItem('kriter_v5_layout');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.nodes) AppState.nodes = parsed.nodes;
                if (parsed.connections) AppState.connections = parsed.connections;
                return true;
            } catch (e) {
                console.error('Error loading layout:', e);
                return false;
            }
        }
        return false;
    },

    // Fetch veriler.xlsx from root directory on page load
    async fetchDefaultData() {
        try {
            console.log('Fetching veriler.xlsx...');
            const response = await fetch('./veriler.xlsx');

            if (!response.ok) {
                console.warn('veriler.xlsx not found, using empty state');
                return false;
            }

            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });

            // First sheet = Data
            const dataSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(dataSheet);

            if (!json.length) {
                console.warn('veriler.xlsx is empty');
                return false;
            }

            // Clear existing data before loading
            AppState.services = {};
            AppState.matrixData = {};

            // Process data sheet
            this.processExcelData(json);

            // Check for config/node sheet (second sheet if exists)
            if (workbook.SheetNames.length > 1) {
                const configSheet = workbook.Sheets[workbook.SheetNames[1]];
                const configJson = XLSX.utils.sheet_to_json(configSheet);
                this.processNodeConfig(configJson);
            }

            this.isUsingSessionData = false;
            console.log('Default data loaded successfully');
            return true;
        } catch (err) {
            console.error('Error fetching veriler.xlsx:', err);
            return false;
        }
    },

    // Clear all data (reset to empty state)
    clearData() {
        AppState.services = {};
        AppState.matrixData = {};
        this.isUsingSessionData = false;

        // Re-render
        if (window.Nodes) Nodes.renderAll();
        if (window.Filters) Filters.init();

        console.log('Data cleared');
    },

    // Import from user's Excel file (session-only)
    async importFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // First sheet = Data
                    const dataSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(dataSheet);

                    if (!json.length) {
                        reject('Dosya boş!');
                        return;
                    }

                    // Clear existing data before importing user data
                    AppState.services = {};
                    AppState.matrixData = {};

                    // Process data sheet
                    this.processExcelData(json);

                    // Check for config/node sheet (second sheet if exists)
                    if (workbook.SheetNames.length > 1) {
                        const configSheet = workbook.Sheets[workbook.SheetNames[1]];
                        const configJson = XLSX.utils.sheet_to_json(configSheet);
                        this.processNodeConfig(configJson);
                    }

                    // Mark as session data (won't persist after refresh)
                    this.isUsingSessionData = true;

                    // Only save layout, not data
                    this.saveToLocalStorage();
                    resolve(true);
                } catch (err) {
                    console.error('Import error:', err);
                    reject(err.message || err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    },

    processExcelData(data) {
        const newServices = {};
        const newMatrixData = {};

        // Helper to generate service ID
        const getServiceId = (name) => {
            const existing = Object.keys(newServices).find(k => newServices[k].name === name);
            if (existing) return existing;
            return 'S_' + Math.abs(name.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0) % 100000);
        };

        // Find matching node by name (akış column value)
        const findNodeByAkis = (akisName) => {
            if (!akisName) return null;
            const normalizedName = akisName.toUpperCase().trim();

            // Search through existing nodes
            const node = Object.values(AppState.nodes).find(n =>
                n.name.toUpperCase().trim() === normalizedName ||
                n.name.toUpperCase().includes(normalizedName) ||
                normalizedName.includes(n.name.toUpperCase())
            );

            return node ? node.id : null;
        };

        data.forEach(row => {
            // Column mapping (Turkish headers)
            const mudurluk = row['Müdürlük'] || row['A'] || '';
            const hizmetAdi = row['Hizmet Adı'] || row['B'] || '';
            const akis = row['Akış'] || row['C'] || '';
            const ustGrup = row['Üst Grup'] || row['D'] || 'Genel';
            const grupEtiketi = row['Grup Etiketi'] || row['E'] || '';
            const durum = row['Durum'] || row['F'] || '';
            const deger = row['Değer'] || row['G'] || '';
            const degerTuru = row['Değer Türü'] || row['H'] || '';
            const islemTipi = row['İşlem Tipi'] || row['I'] || '';

            if (!hizmetAdi) return; // Skip empty rows

            const sId = getServiceId(hizmetAdi);
            const nodeId = findNodeByAkis(akis);

            // 1. Create/Update Service
            if (!newServices[sId]) {
                newServices[sId] = {
                    name: hizmetAdi,
                    mudurluk: mudurluk,
                    path: nodeId ? [nodeId] : []
                };
            } else if (nodeId && !newServices[sId].path.includes(nodeId)) {
                newServices[sId].path.push(nodeId);
            }

            // 2. Add to Matrix Data (if node found)
            if (nodeId) {
                if (!newMatrixData[nodeId]) newMatrixData[nodeId] = [];

                // Find or create rule
                let rule = newMatrixData[nodeId].find(r =>
                    r.ustGrup === ustGrup &&
                    r.grupEtiketi === grupEtiketi &&
                    r.durum === durum
                );

                if (!rule) {
                    rule = {
                        id: Utils.generateId('rule'),
                        ustGrup,
                        grupEtiketi,
                        durum,
                        values: {}
                    };
                    newMatrixData[nodeId].push(rule);
                }

                // Add value for this service
                rule.values[sId] = {
                    val: String(deger),
                    type: degerTuru,
                    proc: islemTipi
                };
            }
        });

        // Merge with existing or replace
        AppState.services = { ...AppState.services, ...newServices };
        AppState.matrixData = { ...AppState.matrixData, ...newMatrixData };
    },

    processNodeConfig(data) {
        data.forEach(row => {
            const nodeId = row['Node ID'] || row['ID'];
            const nodeName = row['Node Adı'] || row['Name'];
            const nodeType = row['Tip'] || row['Type'];
            const x = parseFloat(row['X']) || 0;
            const y = parseFloat(row['Y']) || 0;

            if (nodeId && AppState.nodes[nodeId]) {
                // Update existing node
                if (x) AppState.nodes[nodeId].x = x;
                if (y) AppState.nodes[nodeId].y = y;
                if (nodeName) AppState.nodes[nodeId].name = nodeName;
            } else if (nodeId && nodeName) {
                // Create new node from config
                AppState.nodes[nodeId] = {
                    id: nodeId,
                    name: nodeName,
                    type: nodeType || 'process',
                    x: x,
                    y: y,
                    width: 260
                };
            }

            // Process connections if present
            const connectedTo = row['Bağlantılar'] || row['Connections'];
            if (connectedTo && nodeId) {
                connectedTo.split(',').forEach(targetId => {
                    const cleanTarget = targetId.trim();
                    if (cleanTarget && !AppState.connections.some(c => c.from === nodeId && c.to === cleanTarget)) {
                        AppState.connections.push({
                            id: Utils.generateId('c'),
                            from: nodeId,
                            to: cleanTarget,
                            fromPos: 'right',
                            toPos: 'left'
                        });
                    }
                });
            }
        });
    },

    // Export to Excel (Original data + Node config sheet)
    exportToExcel() {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Service Data (original format)
        const serviceData = [];

        Object.entries(AppState.services).forEach(([sId, service]) => {
            // Get all rules for this service across all nodes
            Object.entries(AppState.matrixData).forEach(([nodeId, rules]) => {
                const node = AppState.nodes[nodeId];
                rules.forEach(rule => {
                    if (rule.values && rule.values[sId]) {
                        serviceData.push({
                            'Müdürlük': service.mudurluk,
                            'Hizmet Adı': service.name,
                            'Akış': node ? node.name : nodeId,
                            'Üst Grup': rule.ustGrup,
                            'Grup Etiketi': rule.grupEtiketi,
                            'Durum': rule.durum || '',
                            'Değer': rule.values[sId].val,
                            'Değer Türü': rule.values[sId].type,
                            'İşlem Tipi': rule.values[sId].proc
                        });
                    }
                });
            });
        });

        if (serviceData.length === 0) {
            // Create empty template
            serviceData.push({
                'Müdürlük': '',
                'Hizmet Adı': '',
                'Akış': '',
                'Üst Grup': '',
                'Grup Etiketi': '',
                'Durum': '',
                'Değer': '',
                'Değer Türü': '',
                'İşlem Tipi': ''
            });
        }

        const ws1 = XLSX.utils.json_to_sheet(serviceData);
        XLSX.utils.book_append_sheet(wb, ws1, "Hizmetler");

        // Sheet 2: Node Configuration
        const nodeConfig = Object.values(AppState.nodes).map(node => {
            // Find connections from this node
            const connections = AppState.connections
                .filter(c => c.from === node.id)
                .map(c => c.to)
                .join(', ');

            return {
                'Node ID': node.id,
                'Node Adı': node.name,
                'Tip': node.type,
                'X': Math.round(node.x),
                'Y': Math.round(node.y),
                'Bağlantılar': connections
            };
        });

        const ws2 = XLSX.utils.json_to_sheet(nodeConfig);
        XLSX.utils.book_append_sheet(wb, ws2, "Yapılandırma");

        // Download
        XLSX.writeFile(wb, `Kriter_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
};

window.DataManager = DataManager;
