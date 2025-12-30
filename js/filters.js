// Filter System

const Filters = {
    _initialized: false,  // Flag to prevent duplicate event listeners

    init() {
        // Only setup event listeners once
        if (!this._initialized) {
            this._setupEventListeners();
            this._initialized = true;
        }

        // Always re-render dropdowns and update highlights
        this.renderDropdowns();
        this.updateNodeHighlights();
    },

    _setupEventListeners() {
        // Dropdown toggle listeners (attached once to triggers)
        const mDrop = document.getElementById('main-mudurluk-dropdown');
        const mTrigger = mDrop?.querySelector('.dropdown-trigger');
        if (mTrigger) {
            mTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // Close other dropdowns first
                document.querySelectorAll('.dropdown-menu.open').forEach(el => {
                    if (el.id !== 'main-mudurluk-menu') el.classList.remove('open');
                });
                document.getElementById('main-mudurluk-menu')?.classList.toggle('open');
            });
        }

        const hDrop = document.getElementById('main-hizmet-dropdown');
        const hTrigger = hDrop?.querySelector('.dropdown-trigger');
        if (hTrigger) {
            hTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // Close other dropdowns first
                document.querySelectorAll('.dropdown-menu.open').forEach(el => {
                    if (el.id !== 'main-hizmet-menu') el.classList.remove('open');
                });
                document.getElementById('main-hizmet-menu')?.classList.toggle('open');
            });
        }

        // Global click to close all dropdowns
        document.addEventListener('click', (e) => {
            // Don't close if clicking inside a dropdown
            if (e.target.closest('.multi-select-dropdown')) return;
            document.querySelectorAll('.dropdown-menu.open').forEach(el => el.classList.remove('open'));
        });

        // Event delegation for menu items (attached to document, works after re-render)
        document.addEventListener('click', (e) => {
            const option = e.target.closest('.dropdown-option');
            if (!option) return;

            // Check if it's a mudurluk menu item
            const mMenu = document.getElementById('main-mudurluk-menu');
            const hMenu = document.getElementById('main-hizmet-menu');

            if (mMenu?.contains(option)) {
                e.stopPropagation();
                if (option.dataset.action === 'toggle-all-mudurluk') {
                    Filters.toggleAllMudurluk();
                } else if (option.dataset.mudurluk !== undefined) {
                    Filters.toggleMudurluk(option.dataset.mudurluk);
                }
            } else if (hMenu?.contains(option)) {
                e.stopPropagation();
                if (option.dataset.action === 'toggle-all-hizmet') {
                    Filters.toggleAllHizmet();
                } else if (option.dataset.hizmetId !== undefined) {
                    Filters.toggleHizmet(option.dataset.hizmetId);
                }
            }
        });
    },

    renderDropdowns() {
        // Get Unique Mudurluks (filter out empty values)
        const muds = new Set();
        const services = Object.values(AppState.services);
        services.forEach(s => {
            // Only add non-empty müdürlük values
            if (s.mudurluk && s.mudurluk.trim() !== '') {
                muds.add(s.mudurluk);
            }
        });
        const totalMudurluk = muds.size;
        const totalHizmet = services.length;

        // Debug logging
        console.log('renderDropdowns - Services:', services.length);
        console.log('renderDropdowns - Müdürlükler:', Array.from(muds));
        console.log('renderDropdowns - Total Müdürlük:', totalMudurluk);

        // Helper function to escape special characters for data attributes
        const escapeForHtml = (str) => {
            if (!str) return '';
            return str
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        };

        // Mudurluk Menu
        const mMenu = document.getElementById('main-mudurluk-menu');
        if (mMenu) {
            mMenu.innerHTML = `
                <div class="dropdown-option" data-action="toggle-all-mudurluk"><strong>Tümünü Seç/Kaldır</strong></div>
                ${Array.from(muds).sort().map(m => `
                    <div class="dropdown-option ${AppState.filters.selectedMudurlukler.has(m) ? 'selected' : ''}" 
                         data-mudurluk="${escapeForHtml(m)}">
                        <span>${m}</span>
                    </div>
                `).join('')}
            `;
        }

        // Show total when none selected (tümü seçili)
        const mudCount = AppState.filters.selectedMudurlukler.size === 0 ? totalMudurluk : AppState.filters.selectedMudurlukler.size;
        const mudCountEl = document.getElementById('main-mudurluk-count');
        if (mudCountEl) mudCountEl.textContent = mudCount;

        // Hizmet Menu (Filtered by Mudurluk)
        const hMenu = document.getElementById('main-hizmet-menu');
        const relevantServices = services.filter(s =>
            AppState.filters.selectedMudurlukler.size === 0 || AppState.filters.selectedMudurlukler.has(s.mudurluk)
        );

        if (hMenu) {
            hMenu.innerHTML = `
                <div class="dropdown-option" data-action="toggle-all-hizmet"><strong>Tümünü Seç/Kaldır</strong></div>
                ${relevantServices.sort((a, b) => a.name.localeCompare(b.name)).map(s => {
                const sId = Object.keys(AppState.services).find(k => AppState.services[k] === s);
                return `
                    <div class="dropdown-option ${AppState.filters.selectedHizmetler.has(sId) ? 'selected' : ''}" 
                         data-hizmet-id="${escapeForHtml(sId)}">
                        <span>${s.name}</span>
                    </div>
                `}).join('')}
            `;
        }

        // Show total when none selected (tümü seçili)
        const hizmetCount = AppState.filters.selectedHizmetler.size === 0 ? relevantServices.length : AppState.filters.selectedHizmetler.size;
        const hizmetCountEl = document.getElementById('main-hizmet-count');
        if (hizmetCountEl) hizmetCountEl.textContent = hizmetCount;
    },

    toggleMudurluk(m, e) {
        if (e) e.stopPropagation();

        if (AppState.filters.selectedMudurlukler.has(m)) {
            // Müdürlük seçimi kaldırılıyor - o müdürlüğe ait hizmetleri de kaldır
            AppState.filters.selectedMudurlukler.delete(m);
            Object.entries(AppState.services).forEach(([sId, srv]) => {
                if (srv.mudurluk === m) {
                    AppState.filters.selectedHizmetler.delete(sId);
                }
            });
        } else {
            // Müdürlük seçiliyor - o müdürlüğe ait hizmetleri de seç
            AppState.filters.selectedMudurlukler.add(m);
            Object.entries(AppState.services).forEach(([sId, srv]) => {
                if (srv.mudurluk === m) {
                    AppState.filters.selectedHizmetler.add(sId);
                }
            });
        }

        this.renderDropdowns();
        this.updateNodeHighlights();
    },

    toggleAllMudurluk() {
        const all = new Set();
        Object.values(AppState.services).forEach(s => all.add(s.mudurluk));

        if (AppState.filters.selectedMudurlukler.size === all.size) {
            // Tümünü kaldır - hizmetleri de temizle
            AppState.filters.selectedMudurlukler.clear();
            AppState.filters.selectedHizmetler.clear();
        } else {
            // Tümünü seç - tüm hizmetleri de seç
            AppState.filters.selectedMudurlukler = all;
            Object.keys(AppState.services).forEach(sId => {
                AppState.filters.selectedHizmetler.add(sId);
            });
        }
        this.renderDropdowns();
        this.updateNodeHighlights();
    },

    toggleHizmet(id, e) {
        if (e) e.stopPropagation();
        if (AppState.filters.selectedHizmetler.has(id)) {
            AppState.filters.selectedHizmetler.delete(id);
        } else {
            AppState.filters.selectedHizmetler.add(id);
        }
        this.renderDropdowns();
        this.updateNodeHighlights();
    },

    toggleAllHizmet() {
        const relevantSids = Object.keys(AppState.services).filter(k =>
            AppState.filters.selectedMudurlukler.size === 0 || AppState.filters.selectedMudurlukler.has(AppState.services[k].mudurluk)
        );

        const allSelected = relevantSids.every(id => AppState.filters.selectedHizmetler.has(id));

        if (allSelected) {
            relevantSids.forEach(id => AppState.filters.selectedHizmetler.delete(id));
        } else {
            relevantSids.forEach(id => AppState.filters.selectedHizmetler.add(id));
        }
        this.renderDropdowns();
        this.updateNodeHighlights();
    },

    // ============================================
    // CORE FILTER LOGIC - TEK FONKSİYON TANIMI
    // V4'TEKİ DUPLICATE HATA BURADA DÜZELTİLDİ
    // ============================================

    filterByMethod(methodId) {
        const isActive = AppState.ui.activeMethodFilter === methodId;

        // Toggle
        AppState.ui.activeMethodFilter = isActive ? null : methodId;

        // Update UI Classes
        document.querySelectorAll('.method-node').forEach(el => {
            if (AppState.ui.activeMethodFilter === el.id) el.classList.add('active');
            else el.classList.remove('active');
        });

        this.updateNodeHighlights();
    },

    updateNodeHighlights() {
        const activeMethod = AppState.ui.activeMethodFilter;
        const selectedSids = AppState.filters.selectedHizmetler;
        const selectedMuds = AppState.filters.selectedMudurlukler;

        // Empty filters means "all selected" - always highlight nodes
        const hasServices = Object.keys(AppState.services).length > 0;

        // 1. Determine "Active Services" based on all filters
        // Empty = all selected (no filtering)
        const activeServices = Object.keys(AppState.services).filter(sId => {
            const srv = AppState.services[sId];

            // Method Filter
            if (activeMethod && !srv.path.includes(activeMethod)) return false;

            // Mudurluk Filter (empty = all)
            if (selectedMuds.size > 0 && !selectedMuds.has(srv.mudurluk)) return false;

            // Hizmet Filter (empty = all)
            if (selectedSids.size > 0 && !selectedSids.has(sId)) return false;

            return true;
        });

        // 2. Determine Nodes touched by Active Services
        const touchedNodes = new Set();
        activeServices.forEach(sId => {
            AppState.services[sId].path.forEach(nId => touchedNodes.add(nId));
        });

        // Check if any filter is active
        const filtersActive = activeMethod || selectedMuds.size > 0 || selectedSids.size > 0;

        // 3. Update DOM
        Object.keys(AppState.nodes).forEach(nodeId => {
            const el = document.getElementById(nodeId);
            if (!el) return;

            if (!filtersActive) {
                el.classList.remove('highlight', 'dimmed');
                this.updateServiceBadge(nodeId, 0);
            } else {
                if (touchedNodes.has(nodeId)) {
                    el.classList.add('highlight');
                    el.classList.remove('dimmed');
                    const count = activeServices.filter(sId => AppState.services[sId].path.includes(nodeId)).length;
                    this.updateServiceBadge(nodeId, count);
                } else {
                    el.classList.add('dimmed');
                    el.classList.remove('highlight');
                    this.updateServiceBadge(nodeId, 0);
                }
            }
        });

        this.updateConnectionHighlights(touchedNodes, filtersActive);

        // Update service tags in nodes
        if (window.Nodes) Nodes.updateServiceTags();
    },

    updateServiceBadge(nodeId, count) {
        const container = document.getElementById(`service-tags-${nodeId}`);
        if (!container) return; // Hub/Method nodes don't have this

        if (count > 0) {
            container.innerHTML = `<span class="service-count-badge">${count} Hizmet</span>`;
        } else {
            container.innerHTML = '';
        }
    },

    updateConnectionHighlights(touchedNodes, filtersActive) {
        AppState.connections.forEach(conn => {
            const el = document.getElementById('line-' + conn.id);
            if (!el) return;

            if (!filtersActive) {
                el.classList.remove('highlight', 'dimmed');
            } else {
                if (touchedNodes.has(conn.from) && touchedNodes.has(conn.to)) {
                    el.classList.add('highlight');
                    el.classList.remove('dimmed');
                } else {
                    el.classList.add('dimmed');
                    el.classList.remove('highlight');
                }
            }
        });
    },

    openTargetFilterDialog() {
        // Show a simple dialog to select target nodes for filtering
        const methodNodes = Object.entries(AppState.nodes)
            .filter(([id, n]) => n.type === 'method')
            .map(([id, n]) => `<option value="${id}">${n.name}</option>`)
            .join('');

        const selected = prompt('Yöntem seçin (ID girin veya boş bırakarak filtre temizleyin):');
        if (selected === null) return; // Cancelled

        if (selected === '') {
            this.clearAllFilters();
        } else if (AppState.nodes[selected]) {
            this.filterByMethod(selected);
        }
    },

    clearAllFilters() {
        // Clear all filters
        AppState.ui.activeMethodFilter = null;
        AppState.filters.selectedMudurlukler.clear();
        AppState.filters.selectedHizmetler.clear();

        // Update UI
        this.renderDropdowns();
        this.updateNodeHighlights();

        // Clear method node active states
        document.querySelectorAll('.method-node.active').forEach(el => {
            el.classList.remove('active');
        });
    }
};

window.Filters = Filters;

