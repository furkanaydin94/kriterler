// Global Application State
const AppState = {
    // Canvas Configuration
    canvas: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        isPanning: false,
        isDraggingNode: false,
        gridSize: 20
    },

    // Nodes Data (Initial State from v4)
    nodes: {
        'node-1-1': { id: 'node-1-1', type: 'process', name: 'ÖN KOŞULLAR', x: 50, y: 360, width: 260 },
        'node-1-2': { id: 'node-1-2', type: 'process', name: 'SOSYOEKONOMİK DEĞERLENDİRME', x: 350, y: 360, width: 260 },
        'node-1-3a': { id: 'node-1-3a', type: 'process', name: 'KONTENJAN SINIRI', x: 700, y: 260, width: 260 },
        'node-1-3b': { id: 'node-1-3b', type: 'process', name: 'KRİTER SINIRI', x: 700, y: 460, width: 260 },
        'node-1-4': { id: 'node-1-4', type: 'hub', name: 'YÖNTEM', x: 1050, y: 360, width: 100 },
        'node-2-1a': { id: 'node-2-1a', type: 'method', name: 'Puanlı Yerleştirme', x: 1350, y: 160, width: 200 },
        'node-2-1b': { id: 'node-2-1b', type: 'method', name: 'Gelir Sıralaması', x: 1350, y: 240, width: 200 },
        'node-2-2': { id: 'node-2-2', type: 'method', name: 'Kuyruk Modeli', x: 1350, y: 320, width: 200 },
        'node-2-3': { id: 'node-2-3', type: 'method', name: 'Hak Modeli', x: 1350, y: 400, width: 200 },
        'node-2-4': { id: 'node-2-4', type: 'method', name: 'Uzman Görüşü', x: 1350, y: 480, width: 200 }
    },

    // Connections (Defined relative to IDs)
    connections: [
        { id: 'c1', from: 'node-1-1', to: 'node-1-2' },
        { id: 'c2', from: 'node-1-2', to: 'node-1-3a' },
        { id: 'c3', from: 'node-1-2', to: 'node-1-3b' },
        { id: 'c4', from: 'node-1-3a', to: 'node-1-4' },
        { id: 'c5', from: 'node-1-3b', to: 'node-1-4' },
        { id: 'c6', from: 'node-1-4', to: 'node-2-1a' },
        { id: 'c7', from: 'node-1-4', to: 'node-2-1b' },
        { id: 'c8', from: 'node-1-4', to: 'node-2-2' },
        { id: 'c9', from: 'node-1-4', to: 'node-2-3' },
        { id: 'c10', from: 'node-1-4', to: 'node-2-4' }
    ],

    // Data Store (Will be populated from Excel)
    services: {},     // Service ID -> { name, path: [], mudurluk }
    matrixData: {},   // Node ID -> [ { ustGrup, grupEtiketi, values: { sId: { val, type... } } } ]

    // UI State
    ui: {
        activeMethodFilter: null,
        highlightedNodes: new Set(),
        selectedNodes: new Set(), // Multi-select için seçili node'lar
        currentModalNodeId: null,
        viewMode: 'workflow', // 'workflow' or 'management'
        connectionMode: false,
        isFullscreen: false
    },

    // Filters (Header Level)
    filters: {
        selectedMudurlukler: new Set(),
        selectedHizmetler: new Set(),
        selectedUstGruplar: new Set(), // For modal
        hiddenColumns: new Set()      // For modal
    },

    // Modal Specific State
    modal: {
        // Detail Level: 'ustgrup' | 'grupetiket' | 'durum'
        detailLevel: 'durum',

        // Show Options (what to display in cells)
        showDeger: true,
        showTur: true,
        showIslem: true,

        // Modal-specific filters
        selectedModalMudurlukler: new Set(),
        selectedModalHizmetler: new Set(),
        selectedModalUstGruplar: new Set(),
        selectedModalTurler: new Set(),
        selectedTurler: new Set(),

        // Expandable rows state
        expandedUstGrup: {},           // { ustGrupName: true/false }
        expandedGrupEtiketi: {},       // { "ustGrup|grupEtiketi": true/false }

        // Context Menu Filters
        columnRowFilter: null,      // { columnId, type: 'var' | 'yok' }
        rowColumnFilter: null,      // { rowId, type: 'var' | 'yok' }

        // View Mode
        viewMode: 'list'            // 'list' | 'group'
    }
};

// ============================================
// UNDO/REDO HISTORY MANAGER
// ============================================
const HistoryManager = {
    undoStack: [],
    redoStack: [],
    MAX_HISTORY: 50,

    // Save current state to undo stack
    saveState(actionName = '') {
        const snapshot = {
            action: actionName,
            timestamp: Date.now(),
            nodes: JSON.parse(JSON.stringify(AppState.nodes)),
            connections: JSON.parse(JSON.stringify(AppState.connections))
        };

        this.undoStack.push(snapshot);

        // Clear redo stack when new action is performed
        this.redoStack = [];

        // Limit history size
        if (this.undoStack.length > this.MAX_HISTORY) {
            this.undoStack.shift();
        }
    },

    // Undo last action
    undo() {
        if (this.undoStack.length === 0) {
            console.log('Nothing to undo');
            return false;
        }

        // Save current state to redo stack
        const currentSnapshot = {
            action: 'redo',
            timestamp: Date.now(),
            nodes: JSON.parse(JSON.stringify(AppState.nodes)),
            connections: JSON.parse(JSON.stringify(AppState.connections))
        };
        this.redoStack.push(currentSnapshot);

        // Restore previous state
        const prevState = this.undoStack.pop();
        AppState.nodes = prevState.nodes;
        AppState.connections = prevState.connections;

        // Re-render
        if (window.Nodes) Nodes.renderAll();
        if (window.DataManager) DataManager.saveToLocalStorage();

        console.log(`Undo: ${prevState.action || 'action'}`);
        return true;
    },

    // Redo last undone action
    redo() {
        if (this.redoStack.length === 0) {
            console.log('Nothing to redo');
            return false;
        }

        // Save current state to undo stack
        const currentSnapshot = {
            action: 'undo',
            timestamp: Date.now(),
            nodes: JSON.parse(JSON.stringify(AppState.nodes)),
            connections: JSON.parse(JSON.stringify(AppState.connections))
        };
        this.undoStack.push(currentSnapshot);

        // Restore redo state
        const redoState = this.redoStack.pop();
        AppState.nodes = redoState.nodes;
        AppState.connections = redoState.connections;

        // Re-render
        if (window.Nodes) Nodes.renderAll();
        if (window.DataManager) DataManager.saveToLocalStorage();

        console.log('Redo completed');
        return true;
    },

    // Check if undo is available
    canUndo() {
        return this.undoStack.length > 0;
    },

    // Check if redo is available
    canRedo() {
        return this.redoStack.length > 0;
    }
};

window.HistoryManager = HistoryManager;
