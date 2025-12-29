// Main Application Entry

const App = {
    async init() {
        // Load layout (node positions) from LocalStorage
        DataManager.loadLayoutFromLocalStorage();

        // Fetch default data from veriler.xlsx (always on page load)
        const dataLoaded = await DataManager.fetchDefaultData();
        if (!dataLoaded) {
            console.log('Could not load veriler.xlsx, using empty state.');
        }

        // Init Modules - ORDER MATTERS!
        // Canvas first (sets up transform)
        if (window.Canvas) Canvas.init();
        // Connections BEFORE Nodes (Nodes.renderAll calls Connections.updateAll)
        if (window.Connections) Connections.init();
        // Nodes (renders nodes and triggers connection render)
        if (window.Nodes) Nodes.init();
        // Filters (updates highlighting)
        if (window.Filters) Filters.init();
        // Modal (sets up handlers)
        if (window.Modal) Modal.init();

        console.log('App initialized successfully!');
        console.log(`Loaded ${Object.keys(AppState.services).length} services`);

        // Setup Import/Export Listeners
        document.getElementById('import-excel-input')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                DataManager.importFromExcel(file).then(() => {
                    // Re-render without page reload (session-only data)
                    if (window.Nodes) Nodes.renderAll();
                    if (window.Filters) Filters.init();
                    App.renderManagementList();
                    alert('Veriler başarıyla yüklendi! (Bu oturum için geçerli)');
                }).catch(err => {
                    alert('İçe aktarma hatası: ' + err);
                });
                e.target.value = ''; // Reset input
            }
        });

        // Clear Data Button
        document.getElementById('clear-data-btn')?.addEventListener('click', () => {
            if (confirm('Tüm verileri temizlemek istediğinize emin misiniz?')) {
                DataManager.clearData();
                App.renderManagementList();
                alert('Veriler temizlendi!');
            }
        });

        // Reload Default Data Button
        document.getElementById('reload-data-btn')?.addEventListener('click', async () => {
            if (confirm('Varsayılan verileri (veriler.xlsx) yeniden yüklemek istiyor musunuz?')) {
                await DataManager.fetchDefaultData();
                if (window.Nodes) Nodes.renderAll();
                if (window.Filters) Filters.init();
                App.renderManagementList();
                alert('Varsayılan veriler yüklendi!');
            }
        });

        // Init Management List
        this.renderManagementList();
    },

    renderManagementList() {
        const list = document.getElementById('mgmt-service-list');
        if (!list) return;

        const serviceEntries = Object.entries(AppState.services);

        if (serviceEntries.length === 0) {
            list.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-400 italic">Henüz hizmet eklenmemiş.</td></tr>`;
            return;
        }

        list.innerHTML = serviceEntries.map(([sId, s]) => `
            <tr class="hover:bg-slate-50 group">
                <td class="p-4 font-bold text-slate-700">${s.name}</td>
                <td class="p-4 text-slate-600">${s.mudurluk}</td>
                <td class="p-4 text-right space-x-2">
                    <button class="text-blue-600 hover:text-blue-800 font-bold text-xs" onclick="editService('${sId}')">DÜZENLE</button>
                    <button class="text-red-500 hover:text-red-700 font-bold text-xs" onclick="deleteService('${sId}')">SİL</button>
                </td>
            </tr>
        `).join('');
    },

    renderPathSelectionCheckboxes() {
        const container = document.getElementById('path-selection-container');
        if (!container) return;

        // Process nodes (1-1 to 1-4)
        const processNodes = [
            { id: 'node-1-1', name: 'ÖN KOŞULLAR', required: true },
            { id: 'node-1-2', name: 'SOSYOEKONOMİK DEĞERLENDİRME' },
            { id: 'node-1-3a', name: 'KONTENJAN SINIRI' },
            { id: 'node-1-3b', name: 'KRİTER SINIRI' },
            { id: 'node-1-4', name: 'YÖNTEM' }
        ];

        // Method nodes (2-1a to 2-4)
        const methodNodes = [
            { id: 'node-2-1a', name: 'Puanlı Yerleştirme', icon: '★' },
            { id: 'node-2-1b', name: 'Gelir Sıralaması', icon: '⇵' },
            { id: 'node-2-2', name: 'Kuyruk Modeli', icon: '⌚' },
            { id: 'node-2-3', name: 'Hak Modeli', icon: '✔' },
            { id: 'node-2-4', name: 'Uzman Görüşü', icon: '👨‍⚕️' }
        ];

        let html = `
            <label class="block text-xs font-bold text-slate-500 mb-2">Akış Yolu</label>
            <div class="space-y-2 mb-4">
                ${processNodes.map(n => `
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" name="path-node" value="${n.id}" 
                               ${n.required ? 'checked disabled' : ''} 
                               class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                        <span class="text-sm ${n.required ? 'text-slate-400' : 'text-slate-700'}">${n.name}</span>
                        ${n.required ? '<span class="text-[10px] text-slate-400">(zorunlu)</span>' : ''}
                    </label>
                `).join('')}
            </div>
            
            <label class="block text-xs font-bold text-slate-500 mb-2">Yöntem Seçimi</label>
            <div class="space-y-2">
                ${methodNodes.map(n => `
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="method-node" value="${n.id}" 
                               class="w-4 h-4 border-slate-300 text-blue-600 focus:ring-blue-500">
                        <span class="text-sm text-slate-700">${n.icon} ${n.name}</span>
                    </label>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;
    },

    renderMudurlukOptions() {
        const select = document.getElementById('srv-mudurluk-input');
        if (!select) return;

        // Get unique mudurluks from existing services
        const muds = new Set(['Genel']);
        Object.values(AppState.services).forEach(s => {
            if (s.mudurluk) muds.add(s.mudurluk);
        });

        select.innerHTML = Array.from(muds).sort().map(m =>
            `<option value="${m}">${m}</option>`
        ).join('');
    }
};

// Start App when DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// ============================================
// GLOBAL FUNCTIONS (Called from HTML inline handlers)
// ============================================

// View Switcher - MUST be global for inline onclick
function switchView(view) {
    AppState.ui.viewMode = view;

    // Toggle Buttons
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (view === 'workflow') {
        document.getElementById('btn-workflow')?.classList.add('active');
    } else {
        document.getElementById('btn-mgmt')?.classList.add('active');
    }

    // Toggle Main Views
    if (view === 'workflow') {
        document.getElementById('view-workflow')?.classList.remove('hidden');
        document.getElementById('view-management')?.classList.add('hidden');
        // Repaint to fix any offset issues
        if (window.Connections) Connections.renderAll();
        if (window.Nodes) Nodes.renderAll();
    } else {
        document.getElementById('view-workflow')?.classList.add('hidden');
        document.getElementById('view-management')?.classList.remove('hidden');
        if (window.App) {
            App.renderManagementList();
            App.renderPathSelectionCheckboxes();
            App.renderMudurlukOptions();
        }
    }
}

// Fullscreen Toggle
function toggleRealFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// Modal Functions
function closeModal() {
    if (window.Modal) Modal.close();
}

function toggleModalFullscreen() {
    if (window.Modal) Modal.toggleModalFullscreen();
}

function closeNodeEditModal() {
    document.getElementById('node-edit-modal').classList.add('hidden');
}

function saveNodeEdit() {
    // TODO: Implement node edit save
    alert('Node düzenleme kaydedildi!');
    closeNodeEditModal();
}

// Service Form Functions (Management View)
function saveServiceForm() {
    const nameEl = document.getElementById('srv-name-input');
    const mudEl = document.getElementById('srv-mudurluk-input');
    const editId = document.getElementById('edit-service-id').value;

    if (!nameEl.value.trim()) {
        alert('Hizmet adı giriniz!');
        return;
    }

    // Collect path from checkboxes
    const path = [];
    document.querySelectorAll('input[name="path-node"]:checked').forEach(cb => {
        path.push(cb.value);
    });

    // Add selected method
    const selectedMethod = document.querySelector('input[name="method-node"]:checked');
    if (selectedMethod) {
        path.push(selectedMethod.value);
    }

    const sId = editId || Utils.generateId('S');

    AppState.services[sId] = {
        name: nameEl.value.trim(),
        mudurluk: mudEl.value,
        path: path
    };

    DataManager.saveToLocalStorage();
    App.renderManagementList();
    resetServiceForm();

    // Update filters dropdown
    if (window.Filters) Filters.renderDropdowns();
}

function editService(sId) {
    const service = AppState.services[sId];
    if (!service) return;

    // Fill form
    document.getElementById('srv-name-input').value = service.name;
    document.getElementById('srv-mudurluk-input').value = service.mudurluk;
    document.getElementById('edit-service-id').value = sId;

    // Check path nodes
    document.querySelectorAll('input[name="path-node"]').forEach(cb => {
        if (!cb.disabled) {
            cb.checked = service.path.includes(cb.value);
        }
    });

    // Select method
    document.querySelectorAll('input[name="method-node"]').forEach(rb => {
        rb.checked = service.path.includes(rb.value);
    });

    // Scroll to form
    document.getElementById('srv-name-input').focus();
}

function deleteService(sId) {
    const service = AppState.services[sId];
    if (!service) return;

    if (confirm(`'${service.name}' hizmetini silmek istediğinize emin misiniz?`)) {
        delete AppState.services[sId];
        DataManager.saveToLocalStorage();
        App.renderManagementList();

        // Update filters dropdown
        if (window.Filters) Filters.renderDropdowns();
    }
}

function resetServiceForm() {
    document.getElementById('srv-name-input').value = '';
    document.getElementById('srv-mudurluk-input').value = 'Genel';
    document.getElementById('edit-service-id').value = '';

    // Uncheck all except required
    document.querySelectorAll('input[name="path-node"]').forEach(cb => {
        if (!cb.disabled) cb.checked = false;
    });
    document.querySelectorAll('input[name="method-node"]').forEach(rb => {
        rb.checked = false;
    });
}

// Excel Functions
function exportServicesToExcel() {
    if (window.DataManager) DataManager.exportServicesToExcel();
}

function handleExcelImport(event) {
    const file = event.target.files[0];
    if (file && window.DataManager) {
        DataManager.importFromExcel(file).then(() => {
            alert('Veriler başarıyla yüklendi!');
            window.location.reload();
        }).catch(err => {
            alert('Yükleme hatası: ' + err);
        });
    }
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close modal if open
        const modal = document.getElementById('comparison-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeModal();
            return;
        }

        // Exit fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }
});

// Node Interaction Functions
function openComparison(nodeId) {
    if (window.Modal) {
        Modal.open('node-' + nodeId);
    }
}

function filterByMethod(methodId) {
    if (window.Filters) {
        Filters.filterByMethod(methodId);
    }
}

// Toolbar Functions
function addNewNode(type = 'process') {
    if (window.Nodes) {
        const typeNames = {
            'process': 'Süreç Kutusu',
            'hub': 'Yöntem (Daire)',
            'method': 'Filtre Kutusu'
        };
        const name = prompt(`${typeNames[type]} adı:`);
        if (name) {
            Nodes.addNode(type, name);
        }
    }
}

function toggleConnectionMode() {
    if (window.Connections) {
        Connections.toggleConnectionMode();
    }
}

// Toolbar Toggle (Collapsible)
function toggleToolbar() {
    const menu = document.getElementById('toolbar-menu');
    if (!menu) return;

    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
    } else {
        menu.classList.add('hidden');
    }
}

// Close toolbar when clicking outside
document.addEventListener('click', (e) => {
    const toolbar = document.getElementById('canvas-toolbar');
    const menu = document.getElementById('toolbar-menu');
    const headerToolsBtn = e.target.closest('[onclick="toggleToolbar()"]');

    // Don't close if clicking on header tools button
    if (headerToolsBtn) return;

    if (toolbar && menu && !toolbar.contains(e.target) && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});

// Excel Import
function importExcelFile(input) {
    const file = input.files[0];
    if (!file) return;

    DataManager.importFromExcel(file).then(() => {
        // Clear all filters so all data is visible (tümü seçili)
        AppState.filters.selectedMudurlukler.clear();
        AppState.filters.selectedHizmetler.clear();

        alert('Excel başarıyla içe aktarıldı!');
        if (window.Nodes) Nodes.renderAll();
        if (window.Filters) Filters.init();
        input.value = ''; // Reset input
    }).catch(err => {
        alert('İçe aktarma hatası: ' + err);
        input.value = '';
    });
}

// Excel Export
function exportToExcel() {
    DataManager.exportToExcel();
}

// Clear All Data
function clearAllData() {
    if (!confirm('TÜM VERİLER SİLİNECEK! Emin misiniz?')) return;

    // Keep only the default nodes structure
    AppState.services = {};
    AppState.matrixData = {};

    DataManager.saveToLocalStorage();
    if (window.Nodes) Nodes.renderAll();
    if (window.Filters) Filters.init();

    alert('Tüm hizmet verileri temizlendi. Nodelar korundu.');
}

// Toggle modal fullscreen
function toggleModalFullscreen() {
    const modal = document.querySelector('#comparison-modal > div');
    if (!modal) return;

    if (modal.classList.contains('max-w-[95vw]')) {
        // Go fullscreen
        modal.classList.remove('max-w-[95vw]', 'h-[90vh]', 'rounded-2xl');
        modal.classList.add('w-screen', 'h-screen', 'rounded-none');
    } else {
        // Exit fullscreen
        modal.classList.remove('w-screen', 'h-screen', 'rounded-none');
        modal.classList.add('max-w-[95vw]', 'h-[90vh]', 'rounded-2xl');
    }
}
