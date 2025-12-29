// Comparison Modal Logic - V5 Enhanced

const Modal = {
    init() {
        // Close on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.id === 'comparison-modal') this.close();
            if (e.target.id === 'node-edit-modal') this.closeEdit();
        });

        // Context menu close on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                document.querySelectorAll('.context-menu').forEach(m => m.remove());
            }
        });
    },

    open(nodeId) {
        AppState.ui.currentModalNodeId = nodeId;
        const node = AppState.nodes[nodeId];
        document.getElementById('modal-title').textContent = node.name.toUpperCase();
        document.getElementById('comparison-modal').classList.remove('hidden');
        document.getElementById('comparison-modal').classList.add('flex');

        // Reset modal state
        this.resetModalState();

        // Update detail level buttons
        this.updateDetailLevelButtons();

        // Initialize modal filters from data
        this.initModalFilters(nodeId);

        // Render table
        this.renderTable(nodeId);
    },

    close() {
        document.getElementById('comparison-modal').classList.add('hidden');
        document.getElementById('comparison-modal').classList.remove('flex');
        AppState.ui.currentModalNodeId = null;
    },

    resetModalState() {
        AppState.modal.columnRowFilter = null;
        AppState.modal.rowColumnFilter = null;
        AppState.filters.hiddenColumns.clear();

        // Sync show options with checkboxes
        document.getElementById('show-deger').checked = AppState.modal.showDeger;
        document.getElementById('show-tur').checked = AppState.modal.showTur;
        document.getElementById('show-islem').checked = AppState.modal.showIslem;
    },

    toggleModalFullscreen() {
        const modal = document.getElementById('comparison-modal').querySelector('> div');
        modal.classList.toggle('h-full');
        modal.classList.toggle('h-[90vh]');
        modal.classList.toggle('w-full');
        modal.classList.toggle('max-w-[95vw]');
        modal.classList.toggle('rounded-none');
        AppState.ui.isFullscreen = !AppState.ui.isFullscreen;
    },

    // ============================================
    // DETAIL LEVEL
    // ============================================

    setDetailLevel(level) {
        const nodeId = AppState.ui.currentModalNodeId;
        const rules = AppState.matrixData[nodeId] || [];

        AppState.modal.detailLevel = level;

        // Update expanded states based on level (V4 behavior)
        if (level === 'ustgrup') {
            // Collapse all - only show üst grup summary rows
            AppState.modal.expandedUstGrup = {};
            AppState.modal.expandedGrupEtiketi = {};
        } else if (level === 'grupetiket') {
            // Expand üst gruplar, collapse grup etiketleri
            AppState.modal.expandedUstGrup = {};
            AppState.modal.expandedGrupEtiketi = {};
            rules.forEach(rule => {
                if (rule.ustGrup) AppState.modal.expandedUstGrup[rule.ustGrup] = true;
            });
        } else if (level === 'durum') {
            // Expand all
            rules.forEach(rule => {
                if (rule.ustGrup) AppState.modal.expandedUstGrup[rule.ustGrup] = true;
                if (rule.grupEtiketi) {
                    const key = `${rule.ustGrup}|${rule.grupEtiketi}`;
                    AppState.modal.expandedGrupEtiketi[key] = true;
                }
            });
        }

        this.updateDetailLevelButtons();
        this.renderTable(nodeId);
    },

    updateDetailLevelButtons() {
        const levels = ['ustgrup', 'grupetiket', 'durum'];
        levels.forEach(l => {
            const btn = document.getElementById(`btn-level-${l}`);
            if (btn) {
                if (l === AppState.modal.detailLevel) {
                    btn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
                    btn.classList.remove('text-slate-500');
                } else {
                    btn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
                    btn.classList.add('text-slate-500');
                }
            }
        });
    },

    // Toggle Üst Grup expand/collapse
    toggleUstGrup(ustGrup) {
        AppState.modal.expandedUstGrup[ustGrup] = !AppState.modal.expandedUstGrup[ustGrup];
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    // Toggle Grup Etiketi expand/collapse
    toggleGrupEtiketi(ustGrup, grupEtiketi) {
        const key = `${ustGrup}|${grupEtiketi}`;
        AppState.modal.expandedGrupEtiketi[key] = !AppState.modal.expandedGrupEtiketi[key];
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    // Expand all rows
    expandAll() {
        const nodeId = AppState.ui.currentModalNodeId;
        const rules = AppState.matrixData[nodeId] || [];
        rules.forEach(rule => {
            if (rule.ustGrup) AppState.modal.expandedUstGrup[rule.ustGrup] = true;
            if (rule.grupEtiketi) {
                const key = `${rule.ustGrup}|${rule.grupEtiketi}`;
                AppState.modal.expandedGrupEtiketi[key] = true;
            }
        });
        this.renderTable(nodeId);
    },

    // Collapse all rows
    collapseAll() {
        AppState.modal.expandedUstGrup = {};
        AppState.modal.expandedGrupEtiketi = {};
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    // ============================================
    // SHOW OPTIONS
    // ============================================

    toggleShowOption(option) {
        if (option === 'deger') AppState.modal.showDeger = !AppState.modal.showDeger;
        if (option === 'tur') AppState.modal.showTur = !AppState.modal.showTur;
        if (option === 'islem') AppState.modal.showIslem = !AppState.modal.showIslem;

        this.renderTable(AppState.ui.currentModalNodeId);
    },

    // ============================================
    // MODAL FILTER DROPDOWNS (V4 Style)
    // ============================================

    initModalFilters(nodeId) {
        const rules = AppState.matrixData[nodeId] || [];

        // Extract unique values for filters
        const ustGruplar = new Set();
        const turler = new Set();

        rules.forEach(rule => {
            if (rule.ustGrup) ustGruplar.add(rule.ustGrup);
            Object.values(rule.values || {}).forEach(v => {
                if (v && v.type) turler.add(v.type);
            });
        });

        // Reset modal filter selections to ALL selected
        AppState.modal.selectedModalUstGruplar = new Set(ustGruplar);
        AppState.modal.selectedModalTurler = new Set(turler);
        AppState.modal.selectedModalHizmetler = new Set(this.getTargetServices(nodeId));

        // Initialize expanded state - all expanded by default
        AppState.modal.expandedUstGrup = {};
        AppState.modal.expandedGrupEtiketi = {};
        rules.forEach(rule => {
            if (rule.ustGrup) {
                AppState.modal.expandedUstGrup[rule.ustGrup] = true;
            }
            if (rule.grupEtiketi) {
                const key = `${rule.ustGrup}|${rule.grupEtiketi}`;
                AppState.modal.expandedGrupEtiketi[key] = true;
            }
        });

        // Render dropdowns
        this.renderModalFilterDropdowns(nodeId, Array.from(ustGruplar), Array.from(turler));
    },

    renderModalFilterDropdowns(nodeId, ustGruplar, turler) {
        const container = document.getElementById('modal-filters');
        if (!container) return;

        const targetServices = this.getTargetServices(nodeId);

        container.innerHTML = `
            <!-- Üst Grup Filter -->
            <div class="multi-select-dropdown mini" id="modal-ustgrup-dropdown">
                <div class="dropdown-trigger" onclick="Modal.toggleModalDropdown('ustgrup')">
                    <span>Üst Grup</span>
                    <span class="badge">${AppState.modal.selectedModalUstGruplar?.size || 0}</span>
                    <span class="arrow">▼</span>
                </div>
                <div class="dropdown-menu" id="modal-ustgrup-menu">
                    <div class="dropdown-option" onclick="Modal.toggleAllModalUstGrup()">
                        <strong>Tümünü Seç/Kaldır</strong>
                    </div>
                    ${ustGruplar.sort().map(ug => `
                        <div class="dropdown-option ${AppState.modal.selectedModalUstGruplar?.has(ug) ? 'selected' : ''}" 
                             onclick="Modal.toggleModalUstGrup('${ug}')">
                            <span>${ug}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Tür Filter -->
            <div class="multi-select-dropdown mini" id="modal-tur-dropdown">
                <div class="dropdown-trigger" onclick="Modal.toggleModalDropdown('tur')">
                    <span>Tür</span>
                    <span class="badge">${AppState.modal.selectedModalTurler?.size || 0}</span>
                    <span class="arrow">▼</span>
                </div>
                <div class="dropdown-menu" id="modal-tur-menu">
                    <div class="dropdown-option" onclick="Modal.toggleAllModalTur()">
                        <strong>Tümünü Seç/Kaldır</strong>
                    </div>
                    ${turler.sort().map(t => `
                        <div class="dropdown-option ${AppState.modal.selectedModalTurler?.has(t) ? 'selected' : ''}" 
                             onclick="Modal.toggleModalTur('${t}')">
                            <span>${t}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Hizmet Filter -->
            <div class="multi-select-dropdown mini" id="modal-hizmet-dropdown">
                <div class="dropdown-trigger" onclick="Modal.toggleModalDropdown('hizmet')">
                    <span>Hizmet</span>
                    <span class="badge">${AppState.modal.selectedModalHizmetler?.size || 0}</span>
                    <span class="arrow">▼</span>
                </div>
                <div class="dropdown-menu" id="modal-hizmet-menu" style="min-width: 200px;">
                    <div class="dropdown-option" onclick="Modal.toggleAllModalHizmet()">
                        <strong>Tümünü Seç/Kaldır</strong>
                    </div>
                    ${targetServices.map(sId => {
            const srv = AppState.services[sId];
            return `
                            <div class="dropdown-option ${AppState.modal.selectedModalHizmetler?.has(sId) ? 'selected' : ''}" 
                                 onclick="Modal.toggleModalHizmet('${sId}')">
                                <span>${srv ? srv.name : sId}</span>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    },

    toggleModalDropdown(type) {
        const menu = document.getElementById(`modal-${type}-menu`);
        // Close other dropdowns
        document.querySelectorAll('#modal-filters .dropdown-menu').forEach(m => {
            if (m !== menu) m.classList.remove('open');
        });
        menu?.classList.toggle('open');
        event?.stopPropagation();
    },

    toggleModalUstGrup(ug) {
        if (AppState.modal.selectedModalUstGruplar.has(ug)) {
            AppState.modal.selectedModalUstGruplar.delete(ug);
        } else {
            AppState.modal.selectedModalUstGruplar.add(ug);
        }
        this.updateModalFilterUI();
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    toggleAllModalUstGrup() {
        const rules = AppState.matrixData[AppState.ui.currentModalNodeId] || [];
        const allUstGrup = new Set(rules.map(r => r.ustGrup).filter(Boolean));

        if (AppState.modal.selectedModalUstGruplar.size === allUstGrup.size) {
            AppState.modal.selectedModalUstGruplar.clear();
        } else {
            AppState.modal.selectedModalUstGruplar = new Set(allUstGrup);
        }
        this.updateModalFilterUI();
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    toggleModalTur(t) {
        if (AppState.modal.selectedModalTurler.has(t)) {
            AppState.modal.selectedModalTurler.delete(t);
        } else {
            AppState.modal.selectedModalTurler.add(t);
        }
        this.updateModalFilterUI();
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    toggleAllModalTur() {
        const rules = AppState.matrixData[AppState.ui.currentModalNodeId] || [];
        const allTur = new Set();
        rules.forEach(r => {
            Object.values(r.values || {}).forEach(v => {
                if (v && v.type) allTur.add(v.type);
            });
        });

        if (AppState.modal.selectedModalTurler.size === allTur.size) {
            AppState.modal.selectedModalTurler.clear();
        } else {
            AppState.modal.selectedModalTurler = new Set(allTur);
        }
        this.updateModalFilterUI();
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    toggleModalHizmet(sId) {
        if (AppState.modal.selectedModalHizmetler.has(sId)) {
            AppState.modal.selectedModalHizmetler.delete(sId);
        } else {
            AppState.modal.selectedModalHizmetler.add(sId);
        }
        this.updateModalFilterUI();
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    toggleAllModalHizmet() {
        const allHizmet = new Set(this.getTargetServices(AppState.ui.currentModalNodeId));

        if (AppState.modal.selectedModalHizmetler.size === allHizmet.size) {
            AppState.modal.selectedModalHizmetler.clear();
        } else {
            AppState.modal.selectedModalHizmetler = new Set(allHizmet);
        }
        this.updateModalFilterUI();
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    updateModalFilterUI() {
        // Update badges
        document.querySelector('#modal-ustgrup-dropdown .badge').textContent =
            AppState.modal.selectedModalUstGruplar?.size || 0;
        document.querySelector('#modal-tur-dropdown .badge').textContent =
            AppState.modal.selectedModalTurler?.size || 0;
        document.querySelector('#modal-hizmet-dropdown .badge').textContent =
            AppState.modal.selectedModalHizmetler?.size || 0;

        // Update selected states
        document.querySelectorAll('#modal-ustgrup-menu .dropdown-option').forEach(opt => {
            const text = opt.querySelector('span')?.textContent;
            if (text && AppState.modal.selectedModalUstGruplar?.has(text)) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });

        document.querySelectorAll('#modal-tur-menu .dropdown-option').forEach(opt => {
            const text = opt.querySelector('span')?.textContent;
            if (text && AppState.modal.selectedModalTurler?.has(text)) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    },


    // ============================================
    // MATRIX RENDER LOGIC
    // ============================================

    renderTable(nodeId) {
        let rules = AppState.matrixData[nodeId] || [];
        const thead = document.getElementById('matrix-head');
        const tbody = document.getElementById('matrix-body');

        thead.innerHTML = '';
        tbody.innerHTML = '';

        // Apply Üst Grup filter
        if (AppState.modal.selectedModalUstGruplar?.size > 0) {
            rules = rules.filter(r => AppState.modal.selectedModalUstGruplar.has(r.ustGrup));
        }

        // Apply Tür filter - filter rules that have at least one value with selected type
        if (AppState.modal.selectedModalTurler?.size > 0) {
            rules = rules.filter(r => {
                return Object.values(r.values || {}).some(v =>
                    v && v.type && AppState.modal.selectedModalTurler.has(v.type)
                );
            });
        }

        // Apply column filter - show only rules with values for this service
        if (AppState.modal.activeColumnFilter) {
            const filterId = AppState.modal.activeColumnFilter;
            rules = rules.filter(r => {
                return r.values && r.values[filterId] && (r.values[filterId].val || r.values[filterId].type);
            });
        }

        // Sort rules by fill count (most filled first)
        rules = rules.slice().sort((a, b) => {
            const countA = Object.values(a.values || {}).filter(v => v && (v.val || v.type)).length;
            const countB = Object.values(b.values || {}).filter(v => v && (v.val || v.type)).length;
            return countB - countA;
        });

        // Get target services
        let targetServiceIds = this.getTargetServicesForModal(nodeId);

        // Filter out hidden columns
        targetServiceIds = targetServiceIds.filter(id => !AppState.filters.hiddenColumns.has(id));

        // Update hidden columns panel
        this.updateHiddenColumnsPanel();

        // Render Header
        this.renderTableHeader(thead, targetServiceIds);

        // Group Rules by Detail Level
        const grouped = this.groupRulesByDetailLevel(rules);

        // Render Body
        if (Object.keys(grouped).length === 0) {
            tbody.innerHTML = `<tr><td colspan="${targetServiceIds.length + 3}" class="p-8 text-center text-slate-400 italic">Veri bulunamadı.</td></tr>`;
            return;
        }

        this.renderTableBody(tbody, grouped, targetServiceIds);

        // Update filter indicator
        this.updateFilterIndicator();
    },

    getTargetServices(nodeId) {
        // Original function - returns all relevant services for a node
        return Object.keys(AppState.services).filter(sId => {
            const srv = AppState.services[sId];
            // Filter by path (must include this node)
            if (!srv.path.includes(nodeId)) return false;
            // Filter by Mudurluk (header level)
            if (AppState.filters.selectedMudurlukler.size > 0 &&
                !AppState.filters.selectedMudurlukler.has(srv.mudurluk)) return false;
            // Filter by Method
            if (AppState.ui.activeMethodFilter &&
                !srv.path.includes(AppState.ui.activeMethodFilter)) return false;
            return true;
        });
    },

    getTargetServicesForModal(nodeId) {
        // Apply modal-specific hizmet filter
        let baseServices = this.getTargetServices(nodeId);

        // If modal hizmet filter has selections, use it
        if (AppState.modal.selectedModalHizmetler?.size > 0) {
            baseServices = baseServices.filter(sId => AppState.modal.selectedModalHizmetler.has(sId));
        }

        // Apply row filter - show only services with values for this row
        if (AppState.modal.activeRowFilter && AppState.modal.rowFilterRules) {
            const rules = AppState.modal.rowFilterRules;
            baseServices = baseServices.filter(sId => {
                return rules.some(rule => rule.values && rule.values[sId] && (rule.values[sId].val || rule.values[sId].type));
            });
        }

        // Sort services by fill count (most filled first)
        const allRules = AppState.matrixData[nodeId] || [];
        baseServices.sort((a, b) => {
            const countA = allRules.filter(r => r.values && r.values[a] && (r.values[a].val || r.values[a].type)).length;
            const countB = allRules.filter(r => r.values && r.values[b] && (r.values[b].val || r.values[b].type)).length;
            return countB - countA;
        });

        return baseServices;
    },

    renderTableHeader(thead, serviceIds) {
        const tr = document.createElement('tr');
        tr.className = 'bg-slate-50';

        // First header cell (Kriter Tanımı) - click to clear all filters
        const firstTh = document.createElement('th');
        firstTh.className = 'min-w-[280px] text-left p-3 sticky left-0 top-0 bg-slate-50 z-30 border-r border-slate-200 text-xs font-bold uppercase text-slate-500 cursor-pointer hover:bg-slate-100';
        firstTh.innerHTML = `KRİTER TANIMI ${AppState.modal.activeColumnFilter ? '<span class="text-amber-500 ml-2">🔍</span>' : ''}`;
        firstTh.addEventListener('click', () => {
            // Clear column filter
            if (AppState.modal.activeColumnFilter) {
                AppState.modal.activeColumnFilter = null;
                Modal.renderTable(AppState.ui.currentModalNodeId);
            }
        });
        tr.appendChild(firstTh);

        // Service column headers - click to filter
        serviceIds.forEach(sId => {
            const srv = AppState.services[sId];
            if (!srv) return;

            const isActive = AppState.modal.activeColumnFilter === sId;

            const th = document.createElement('th');
            th.className = `min-w-[160px] p-3 cursor-pointer hover:bg-purple-50 transition text-left sticky top-0 z-20 ${isActive ? 'bg-purple-100' : 'bg-slate-50'}`;
            th.innerHTML = `
                <div class="flex flex-col gap-0.5">
                    <span class="truncate text-xs font-bold ${isActive ? 'text-purple-700' : 'text-purple-600'} uppercase">${srv.name} ${isActive ? '✓' : ''}</span>
                    <span class="text-[9px] font-normal text-slate-400">${srv.mudurluk}</span>
                </div>
            `;

            // Click to toggle filter
            th.addEventListener('click', () => {
                Modal.toggleColumnFilter(sId);
            });

            tr.appendChild(th);
        });

        thead.innerHTML = '';
        thead.appendChild(tr);
    },

    // Toggle column filter - show only rows with values for this service
    toggleColumnFilter(sId) {
        if (AppState.modal.activeColumnFilter === sId) {
            // Clear filter
            AppState.modal.activeColumnFilter = null;
        } else {
            // Set filter
            AppState.modal.activeColumnFilter = sId;
        }
        // Clear row filter when column filter changes
        AppState.modal.activeRowFilter = null;
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    // Toggle row filter - show only columns with values for this row
    toggleRowFilter(rowIndex, rules) {
        const rowKey = `row-${rowIndex}`;
        if (AppState.modal.activeRowFilter === rowKey) {
            // Clear filter
            AppState.modal.activeRowFilter = null;
            AppState.modal.rowFilterRules = null;
        } else {
            // Set filter
            AppState.modal.activeRowFilter = rowKey;
            AppState.modal.rowFilterRules = rules;
        }
        // Clear column filter when row filter changes
        AppState.modal.activeColumnFilter = null;
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    groupRulesByDetailLevel(rules) {
        const groups = {};
        const level = AppState.modal.detailLevel;

        rules.forEach(rule => {
            const ug = rule.ustGrup || 'Diğer';
            const ge = rule.grupEtiketi || 'Genel';

            if (level === 'ustgrup') {
                // Group by Ust Grup only
                if (!groups[ug]) groups[ug] = { rules: [], count: 0 };
                groups[ug].rules.push(rule);
            } else if (level === 'grupetiket') {
                // Group by Ust Grup -> Grup Etiketi
                if (!groups[ug]) groups[ug] = {};
                if (!groups[ug][ge]) groups[ug][ge] = { rules: [], count: 0 };
                groups[ug][ge].rules.push(rule);
            } else {
                // Full detail (durum)
                if (!groups[ug]) groups[ug] = {};
                if (!groups[ug][ge]) groups[ug][ge] = [];
                groups[ug][ge].push(rule);
            }
        });

        return groups;
    },

    renderTableBody(tbody, grouped, serviceIds) {
        const level = AppState.modal.detailLevel;
        let rowIndex = 0;

        // Flat list view - iterate through all rules
        Object.keys(grouped).sort().forEach((ug, ugIndex) => {
            if (level === 'ustgrup') {
                // Üst Grup level - show only üst grup with counts
                const rulesInGroup = grouped[ug].rules || [];
                this.renderUstGrupRow(tbody, ug, rulesInGroup, serviceIds, rowIndex++, ugIndex);
            } else {
                // Grup Etiketi or Durum level - show flat list
                const subGroups = grouped[ug];

                if (typeof subGroups === 'object' && !Array.isArray(subGroups)) {
                    Object.keys(subGroups).sort().forEach(ge => {
                        const items = subGroups[ge];
                        const rules = Array.isArray(items) ? items : (items.rules || []);

                        if (level === 'grupetiket') {
                            // Grup Etiketi level - show all durums combined in cell
                            this.renderGrupEtiketFlatRow(tbody, ug, ge, rules, serviceIds, rowIndex++, ugIndex);
                        } else {
                            // Durum level - show each durum as separate row
                            rules.forEach(rule => {
                                this.renderDurumFlatRow(tbody, ug, ge, rule, serviceIds, rowIndex++, ugIndex);
                            });
                        }
                    });
                }
            }
        });
    },

    // Üst Grup row - shows only counts
    renderUstGrupRow(tbody, ug, rules, serviceIds, rowIndex, ugIndex) {
        const isActive = AppState.modal.activeRowFilter === `row-${rowIndex}`;
        const row = document.createElement('tr');
        row.className = `border-b border-slate-100 ${isActive ? 'bg-amber-50' : 'hover:bg-purple-50/50'}`;
        row.setAttribute('data-row-id', `row-${rowIndex}`);

        // Count grup etiketis
        const grupCount = Object.keys(rules.reduce((acc, r) => { acc[r.grupEtiketi || 'Genel'] = true; return acc; }, {})).length;

        let html = `<td class="p-3 font-semibold bg-white sticky left-0 z-10 border-r border-slate-200 cursor-pointer hover:bg-purple-50 ${isActive ? 'bg-amber-50' : ''}">
            <span class="text-purple-600">${ug}</span>
            <span class="ml-2 text-slate-400 text-xs font-normal">(${grupCount} grup)</span>
            ${isActive ? '<span class="ml-2 text-amber-500">✓</span>' : ''}
        </td>`;

        // Service columns - show count of matches
        serviceIds.forEach(sId => {
            const matchCount = rules.filter(rule => rule.values[sId] && (rule.values[sId].val || rule.values[sId].type)).length;
            html += `<td class="p-3 text-center">
                ${matchCount > 0 ? `<span class="text-purple-600 font-bold">${matchCount}</span>` : ''}
            </td>`;
        });

        row.innerHTML = html;

        // Click to toggle row filter
        const firstCell = row.querySelector('td:first-child');
        if (firstCell) {
            firstCell.addEventListener('click', () => {
                Modal.toggleRowFilter(rowIndex, rules);
            });
        }

        tbody.appendChild(row);
    },

    // Grup Etiketi flat row - shows all durums in cell
    renderGrupEtiketFlatRow(tbody, ug, ge, rules, serviceIds, rowIndex, ugIndex) {
        const isActive = AppState.modal.activeRowFilter === `row-${rowIndex}`;
        const row = document.createElement('tr');
        row.className = `border-b border-slate-100 ${isActive ? 'bg-amber-50' : 'hover:bg-slate-50'}`;
        row.setAttribute('data-row-id', `row-${rowIndex}`);

        const durumCount = rules.length;

        let html = `<td class="p-3 bg-white sticky left-0 z-10 border-r border-slate-200 cursor-pointer hover:bg-purple-50 ${isActive ? 'bg-amber-50' : ''}">
            <span class="text-purple-600 font-medium">${ug}</span>
            <span class="mx-1.5 text-slate-300">›</span>
            <span class="text-blue-600 font-medium">${ge}</span>
            <span class="ml-2 text-slate-400 text-xs">(${durumCount} durum)</span>
            ${isActive ? '<span class="ml-2 text-amber-500">✓</span>' : ''}
        </td>`;

        // Service columns - show all durums combined
        serviceIds.forEach(sId => {
            const cellContent = this.renderCombinedCellContent(rules, sId);
            html += `<td class="p-2 align-top text-sm">${cellContent}</td>`;
        });

        row.innerHTML = html;

        // Click to toggle row filter
        const firstCell = row.querySelector('td:first-child');
        if (firstCell) {
            firstCell.addEventListener('click', () => {
                Modal.toggleRowFilter(rowIndex, rules);
            });
        }

        tbody.appendChild(row);
    },

    // Durum flat row - single durum per row
    renderDurumFlatRow(tbody, ug, ge, rule, serviceIds, rowIndex, ugIndex) {
        const isActive = AppState.modal.activeRowFilter === `row-${rowIndex}`;
        const row = document.createElement('tr');
        row.className = `border-b border-slate-100 ${isActive ? 'bg-amber-50' : 'hover:bg-slate-50'}`;
        row.setAttribute('data-row-id', `row-${rowIndex}`);

        const durum = rule.durum || rule.grupEtiketi || '';

        let html = `<td class="p-3 bg-white sticky left-0 z-10 border-r border-slate-200 cursor-pointer hover:bg-purple-50 ${isActive ? 'bg-amber-50' : ''}">
            <span class="text-purple-600">${ug}</span>
            <span class="mx-1.5 text-slate-300">›</span>
            <span class="text-blue-600">${ge}</span>
            <span class="mx-1.5 text-slate-300">›</span>
            <span class="text-slate-700">${durum}</span>
            ${isActive ? '<span class="ml-2 text-amber-500">✓</span>' : ''}
        </td>`;

        // Service columns
        serviceIds.forEach(sId => {
            const cellData = rule.values ? rule.values[sId] : null;
            html += `<td class="p-2 align-top">${this.renderCellContent(cellData)}</td>`;
        });

        row.innerHTML = html;

        // Click to toggle row filter
        const firstCell = row.querySelector('td:first-child');
        if (firstCell) {
            firstCell.addEventListener('click', () => {
                Modal.toggleRowFilter(rowIndex, [rule]);
            });
        }

        tbody.appendChild(row);
    },

    // Render combined cell content for Grup Etiketi level - shows each durum with its values
    renderCombinedCellContent(rules, sId) {
        const items = rules
            .filter(rule => rule.values && rule.values[sId] && (rule.values[sId].val || rule.values[sId].type))
            .map(rule => {
                const v = rule.values[sId];
                const durum = rule.durum || rule.grupEtiketi || '';

                let parts = [];
                if (AppState.modal.showDeger && v.val) parts.push(`<span class="text-slate-800 font-semibold">${v.val}</span>`);
                if (AppState.modal.showTur && v.type) parts.push(`<span class="text-blue-600">${v.type}</span>`);
                if (AppState.modal.showIslem && v.proc) parts.push(`<span class="text-slate-400 italic">${v.proc}</span>`);

                const valueStr = parts.join(' ');

                if (durum && durum !== rule.grupEtiketi) {
                    return `<div class="text-xs mb-2 pb-1 border-b border-slate-100 last:border-0">
                        <span class="text-slate-600 font-medium">${durum}:</span> ${valueStr}
                    </div>`;
                }
                return `<div class="text-xs mb-1">${valueStr}</div>`;
            });

        return items.join('');
    },

    renderAggregatedRow(tbody, rules, serviceIds, label) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';

        // Aggregate values across all rules
        let html = `<td class="p-3 font-medium text-slate-600 bg-white sticky left-0 z-10 border-r border-slate-200">${label}</td>`;

        // Count
        let present = 0;
        serviceIds.forEach(sId => {
            const hasValue = rules.some(rule => rule.values[sId] && (rule.values[sId].val || rule.values[sId].type));
            if (hasValue) present++;
        });
        html += `<td class="text-center font-mono text-xs p-3">
            <span class="text-green-600 font-bold">${present}</span>/<span class="text-slate-300">${serviceIds.length}</span>
        </td>`;

        // Service columns
        serviceIds.forEach(sId => {
            const cellValues = rules.map(rule => rule.values[sId]).filter(v => v && (v.val || v.type));
            html += `<td class="p-2">${this.renderCellContent(cellValues.length > 0 ? cellValues[0] : null)}</td>`;
        });

        row.innerHTML = html;
        tbody.appendChild(row);
    },

    renderGrupEtiketRow(tbody, ge, rules, serviceIds, rowIndex) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';
        row.setAttribute('data-row-id', `row-${rowIndex}`);
        row.setAttribute('oncontextmenu', `Modal.showRowContextMenu(event, 'row-${rowIndex}')`);

        let html = `<td class="p-3 font-medium text-slate-600 bg-white sticky left-0 z-10 border-r border-slate-200">${ge}</td>`;

        // Count
        let present = 0;
        serviceIds.forEach(sId => {
            const hasValue = rules.some(rule => rule.values[sId] && (rule.values[sId].val || rule.values[sId].type));
            if (hasValue) present++;
        });
        html += `<td class="text-center font-mono text-xs p-3">
            <span class="text-green-600 font-bold">${present}</span>/<span class="text-slate-300">${serviceIds.length}</span>
        </td>`;

        // Service columns
        serviceIds.forEach(sId => {
            const cellValues = rules.map(rule => rule.values[sId]).filter(v => v && (v.val || v.type));
            html += `<td class="p-2">${this.renderCellContent(cellValues.length > 0 ? cellValues[0] : null)}</td>`;
        });

        row.innerHTML = html;
        tbody.appendChild(row);
    },

    renderDurumRow(tbody, rule, serviceIds, rowIndex) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';
        row.setAttribute('data-row-id', `row-${rowIndex}`);
        row.setAttribute('oncontextmenu', `Modal.showRowContextMenu(event, 'row-${rowIndex}')`);

        // Find durum from any service value
        const firstVal = Object.values(rule.values || {}).find(v => v && v.dur);
        const durumText = firstVal ? firstVal.dur : rule.grupEtiketi || '';

        let html = `<td class="p-3 text-slate-600 bg-white sticky left-0 z-10 border-r border-slate-200">
            <span class="text-slate-500 italic text-xs">${durumText}</span>
        </td>`;

        // Count
        let present = 0;
        serviceIds.forEach(sId => {
            if (rule.values[sId] && (rule.values[sId].val || rule.values[sId].type)) present++;
        });
        html += `<td class="text-center font-mono text-xs p-3">
            <span class="text-green-600 font-bold">${present}</span>/<span class="text-slate-300">${serviceIds.length}</span>
        </td>`;

        // Service columns
        serviceIds.forEach(sId => {
            const cellData = rule.values[sId];
            html += `<td class="p-2">${this.renderCellContent(cellData)}</td>`;
        });

        row.innerHTML = html;
        tbody.appendChild(row);
    },

    renderCellContent(cellData) {
        if (!cellData || (!cellData.val && !cellData.type)) return '';

        let content = '<div class="cell-data space-y-0.5">';

        if (AppState.modal.showDeger && cellData.val) {
            content += `<div class="text-slate-700 font-medium text-xs">${cellData.val}</div>`;
        }
        if (AppState.modal.showTur && cellData.type) {
            content += `<div class="text-blue-600 text-[10px]">${cellData.type}</div>`;
        }
        if (AppState.modal.showIslem && cellData.proc) {
            content += `<div class="text-slate-400 text-[10px]">${cellData.proc}</div>`;
        }

        content += '</div>';
        return content;
    },

    // ============================================
    // CONTEXT MENUS
    // ============================================

    showColumnContextMenu(e, sId) {
        e.preventDefault();
        this.closeAllContextMenus();

        const srv = AppState.services[sId];
        if (!srv) return;

        const menu = document.createElement('div');
        menu.className = 'context-menu fixed bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 min-w-[220px]';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';

        menu.innerHTML = `
            <div class="px-3 py-1 text-xs font-bold text-slate-400 uppercase truncate">${srv.name}</div>
            <hr class="my-1 border-slate-100">
            <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2" 
                    onclick="Modal.hideColumn('${sId}')">
                <span>👁️</span> Sütunu Gizle
            </button>
            <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2"
                    onclick="Modal.filterRowsByColumn('${sId}', 'var')">
                <span>✓</span> Bu Hizmette VAR Olan Satırlar
            </button>
            <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2"
                    onclick="Modal.filterRowsByColumn('${sId}', 'yok')">
                <span>✗</span> Bu Hizmette YOK Olan Satırlar
            </button>
            <hr class="my-1 border-slate-100">
            <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-amber-600"
                    onclick="Modal.clearAllFilters()">
                <span>↺</span> Tüm Filtreleri Temizle
            </button>
        `;

        document.body.appendChild(menu);
    },

    showRowContextMenu(e, rowId) {
        e.preventDefault();
        this.closeAllContextMenus();

        const menu = document.createElement('div');
        menu.className = 'context-menu fixed bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 min-w-[220px]';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';

        menu.innerHTML = `
            <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2"
                    onclick="Modal.filterColumnsByRow('${rowId}', 'var')">
                <span>✓</span> Bu Durumda VAR Olan Sütunlar
            </button>
            <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2"
                    onclick="Modal.filterColumnsByRow('${rowId}', 'yok')">
                <span>✗</span> Bu Durumda YOK Olan Sütunlar
            </button>
            <hr class="my-1 border-slate-100">
            <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-amber-600"
                    onclick="Modal.clearAllFilters()">
                <span>↺</span> Tüm Filtreleri Temizle
            </button>
        `;

        document.body.appendChild(menu);
    },

    closeAllContextMenus() {
        document.querySelectorAll('.context-menu').forEach(m => m.remove());
    },

    hideColumn(sId) {
        this.closeAllContextMenus();
        AppState.filters.hiddenColumns.add(sId);
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    showColumn(sId) {
        AppState.filters.hiddenColumns.delete(sId);
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    updateHiddenColumnsPanel() {
        const panel = document.getElementById('hidden-columns-panel');
        const list = document.getElementById('hidden-columns-list');

        if (AppState.filters.hiddenColumns.size === 0) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');
        list.innerHTML = Array.from(AppState.filters.hiddenColumns).map(sId => {
            const srv = AppState.services[sId];
            return `<button class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium text-slate-600 flex items-center gap-1"
                    onclick="Modal.showColumn('${sId}')">
                ${srv ? srv.name : sId} <span class="text-slate-400">✕</span>
            </button>`;
        }).join('');
    },

    filterRowsByColumn(sId, type) {
        this.closeAllContextMenus();
        AppState.modal.columnRowFilter = { columnId: sId, type };
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    filterColumnsByRow(rowId, type) {
        this.closeAllContextMenus();
        AppState.modal.rowColumnFilter = { rowId, type };
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    clearAllFilters() {
        this.closeAllContextMenus();
        AppState.modal.columnRowFilter = null;
        AppState.modal.rowColumnFilter = null;
        AppState.filters.hiddenColumns.clear();
        this.renderTable(AppState.ui.currentModalNodeId);
    },

    updateFilterIndicator() {
        const indicator = document.getElementById('active-filter-indicator');
        const text = document.getElementById('filter-indicator-text');

        const filters = [];
        if (AppState.modal.columnRowFilter) {
            const srv = AppState.services[AppState.modal.columnRowFilter.columnId];
            filters.push(`${srv ? srv.name : ''} (${AppState.modal.columnRowFilter.type === 'var' ? 'VAR' : 'YOK'} satırlar)`);
        }
        if (AppState.modal.rowColumnFilter) {
            filters.push(`Satır bazlı sütun filtresi aktif`);
        }
        if (AppState.filters.hiddenColumns.size > 0) {
            filters.push(`${AppState.filters.hiddenColumns.size} sütun gizlendi`);
        }

        if (filters.length > 0) {
            indicator.classList.remove('hidden');
            text.textContent = `Aktif Filtreler: ${filters.join(', ')}`;
        } else {
            indicator.classList.add('hidden');
        }
    },

    // ============================================
    // EXCEL EXPORT - Export current matrix view
    // ============================================

    exportToExcel() {
        const nodeId = AppState.ui.currentModalNodeId;
        const node = AppState.nodes[nodeId];
        let rules = AppState.matrixData[nodeId] || [];

        // Apply same filters as renderTable
        if (AppState.modal.selectedModalUstGruplar?.size > 0) {
            rules = rules.filter(r => AppState.modal.selectedModalUstGruplar.has(r.ustGrup));
        }
        if (AppState.modal.selectedModalTurler?.size > 0) {
            rules = rules.filter(r => {
                return Object.values(r.values || {}).some(v =>
                    v && v.type && AppState.modal.selectedModalTurler.has(v.type)
                );
            });
        }
        if (AppState.modal.activeColumnFilter) {
            const filterId = AppState.modal.activeColumnFilter;
            rules = rules.filter(r => {
                return r.values && r.values[filterId] && (r.values[filterId].val || r.values[filterId].type);
            });
        }

        // Sort by fill count
        rules = rules.slice().sort((a, b) => {
            const countA = Object.values(a.values || {}).filter(v => v && (v.val || v.type)).length;
            const countB = Object.values(b.values || {}).filter(v => v && (v.val || v.type)).length;
            return countB - countA;
        });

        // Get services (filtered and sorted)
        const serviceIds = this.getTargetServicesForModal(nodeId);
        const level = AppState.modal.detailLevel;

        // Build matrix data
        const matrixData = [];
        const grouped = this.groupRulesByDetailLevel(rules);

        Object.keys(grouped).sort().forEach(ug => {
            if (level === 'ustgrup') {
                const row = { 'KRİTER TANIMI': ug };
                serviceIds.forEach(sId => {
                    const srv = AppState.services[sId];
                    const rulesInGroup = grouped[ug].rules || [];
                    const matchCount = rulesInGroup.filter(r => r.values && r.values[sId] && (r.values[sId].val || r.values[sId].type)).length;
                    row[srv ? srv.name : sId] = matchCount > 0 ? matchCount : '';
                });
                matrixData.push(row);
            } else {
                const subGroups = grouped[ug];
                if (typeof subGroups === 'object' && !Array.isArray(subGroups)) {
                    Object.keys(subGroups).sort().forEach(ge => {
                        const items = subGroups[ge];
                        const rulesForGe = Array.isArray(items) ? items : (items.rules || []);

                        if (level === 'grupetiket') {
                            const row = { 'KRİTER TANIMI': `${ug} › ${ge}` };
                            serviceIds.forEach(sId => {
                                const srv = AppState.services[sId];
                                const values = rulesForGe.filter(r => r.values && r.values[sId] && (r.values[sId].val || r.values[sId].type))
                                    .map(r => {
                                        const v = r.values[sId];
                                        const durum = r.durum || r.grupEtiketi || '';
                                        let parts = [];
                                        if (durum) parts.push(durum + ':');
                                        if (AppState.modal.showDeger && v.val) parts.push(v.val);
                                        if (AppState.modal.showTur && v.type) parts.push(v.type);
                                        if (AppState.modal.showIslem && v.proc) parts.push(v.proc);
                                        return parts.join(' ');
                                    }).join('; ');
                                row[srv ? srv.name : sId] = values;
                            });
                            matrixData.push(row);
                        } else {
                            rulesForGe.forEach(rule => {
                                const durum = rule.durum || rule.grupEtiketi || '';
                                const row = { 'KRİTER TANIMI': `${ug} › ${ge} › ${durum}` };
                                serviceIds.forEach(sId => {
                                    const srv = AppState.services[sId];
                                    const v = rule.values ? rule.values[sId] : null;
                                    if (v && (v.val || v.type)) {
                                        let parts = [];
                                        if (AppState.modal.showDeger && v.val) parts.push(v.val);
                                        if (AppState.modal.showTur && v.type) parts.push(v.type);
                                        if (AppState.modal.showIslem && v.proc) parts.push(v.proc);
                                        row[srv ? srv.name : sId] = parts.join(' ');
                                    } else {
                                        row[srv ? srv.name : sId] = '';
                                    }
                                });
                                matrixData.push(row);
                            });
                        }
                    });
                }
            }
        });

        if (matrixData.length === 0) {
            alert('Dışa aktarılacak veri bulunamadı.');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(matrixData);
        const wb = XLSX.utils.book_new();

        // Set column widths
        const colWidths = [{ wch: 50 }]; // Kriter Tanımı
        serviceIds.forEach(() => colWidths.push({ wch: 25 }));
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, "Matris");
        XLSX.writeFile(wb, `${node.name}_Matris_${level}.xlsx`);
    },

    // Edit Modal
    openEdit(nodeId) {
        // TODO: Implement node editing modal
    },

    closeEdit() {
        document.getElementById('node-edit-modal').classList.add('hidden');
    }
};

window.Modal = Modal;
