// Node Management - With Hover Action Buttons and Expandable Service List

const Nodes = {
    // Track expanded nodes
    expandedNodes: new Set(),
    VISIBLE_SERVICES_COUNT: 6, // İlk gösterilecek hizmet sayısı

    init() {
        this.renderAll();
    },

    renderAll() {
        const container = document.getElementById('nodes-layer');
        if (!container) {
            console.error('nodes-layer element not found!');
            return;
        }
        container.innerHTML = '';

        Object.values(AppState.nodes).forEach(node => {
            const card = this.createNodeCard(node);
            container.appendChild(card);
        });

        // Populate service tags for process nodes
        this.populateAllServiceTags();

        // Update connections after nodes render
        if (window.Connections) {
            Connections.renderAll();
        }
    },

    createNodeCard(node) {
        const el = document.createElement('div');

        // Set classes based on type
        let typeClass = '';
        if (node.type === 'hub') typeClass = 'hub-node';
        else if (node.type === 'method') typeClass = 'method-node';

        el.className = `chart-card ${typeClass}`;
        el.id = node.id;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;

        // Action buttons (visible on hover)
        const actionBtns = `
            <div class="node-actions">
                <button class="node-action-btn" onclick="event.stopPropagation(); Nodes.renameNode('${node.id}')" title="Yeniden Adlandır">✏️</button>
                <button class="node-action-btn delete" onclick="event.stopPropagation(); Nodes.deleteNode('${node.id}')" title="Sil">🗑️</button>
            </div>
        `;

        // Inner HTML based on type
        if (node.type === 'hub') {
            el.innerHTML = `
                ${actionBtns}
                <div class="node-header" style="border:none; text-align:center;">${node.name}</div>
                ${this.renderConnectionPoints()}
            `;
        } else if (node.type === 'method') {
            el.innerHTML = `
                ${actionBtns}
                <div class="node-header">${node.name}</div>
                ${this.renderConnectionPoints()}
            `;
        } else {
            // Process node with expandable service list
            el.innerHTML = `
                ${actionBtns}
                <div class="node-header">
                    <span class="node-status-dot"></span>
                    <span>${node.name}</span>
                </div>
                <div class="node-body">
                    <div id="service-tags-${node.id}" class="service-list-container"></div>
                </div>
                ${this.renderConnectionPoints()}
            `;
        }

        // Add connection point event listeners
        el.querySelectorAll('.connection-point').forEach(point => {
            point.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                if (window.Connections) Connections.startConnection(e);
            });
        });

        return el;
    },

    renderConnectionPoints() {
        return `
            <div class="connection-point top" data-pos="top"></div>
            <div class="connection-point bottom" data-pos="bottom"></div>
            <div class="connection-point left" data-pos="left"></div>
            <div class="connection-point right" data-pos="right"></div>
        `;
    },

    // Populate service tags for all process nodes
    populateAllServiceTags() {
        Object.values(AppState.nodes).forEach(node => {
            if (node.type !== 'hub' && node.type !== 'method') {
                this.populateServiceTags(node.id);
            }
        });
    },

    // Get services for a specific node (with filters applied)
    getServicesForNode(nodeId) {
        const activeMethod = AppState.ui.activeMethodFilter;
        const selectedMuds = AppState.filters.selectedMudurlukler;
        const selectedSids = AppState.filters.selectedHizmetler;

        return Object.entries(AppState.services).filter(([sId, srv]) => {
            // Must include this node in path
            if (!srv.path.includes(nodeId)) return false;

            // Method filter
            if (activeMethod && !srv.path.includes(activeMethod)) return false;

            // Mudurluk filter (empty = all)
            if (selectedMuds.size > 0 && !selectedMuds.has(srv.mudurluk)) return false;

            // Hizmet filter (empty = all)
            if (selectedSids.size > 0 && !selectedSids.has(sId)) return false;

            return true;
        });
    },

    // Populate service tags for a specific node
    populateServiceTags(nodeId) {
        const container = document.getElementById(`service-tags-${nodeId}`);
        if (!container) return;

        const services = this.getServicesForNode(nodeId);
        const totalCount = services.length;
        const isExpanded = this.expandedNodes.has(nodeId);

        if (totalCount === 0) {
            container.innerHTML = '';
            return;
        }

        // Sort services alphabetically
        services.sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr'));

        const visibleServices = isExpanded ? services : services.slice(0, this.VISIBLE_SERVICES_COUNT);
        const remainingCount = totalCount - this.VISIBLE_SERVICES_COUNT;

        let html = `
            <div class="service-total-badge">${totalCount} Hizmet</div>
            <div class="service-grid">
        `;

        visibleServices.forEach(([sId, srv]) => {
            const shortName = srv.name.length > 15 ? srv.name.substring(0, 14) + '...' : srv.name;
            html += `<span class="service-tag" title="${srv.name}">${shortName}</span>`;
        });

        html += '</div>';

        // Show expand/collapse button if there are more services
        if (totalCount > this.VISIBLE_SERVICES_COUNT) {
            if (isExpanded) {
                html += `
                    <button class="service-toggle-btn" onclick="event.stopPropagation(); Nodes.toggleExpand('${nodeId}')">
                        Kapat ▲
                    </button>
                `;
            } else {
                html += `
                    <button class="service-toggle-btn" onclick="event.stopPropagation(); Nodes.toggleExpand('${nodeId}')">
                        ve ${remainingCount} daha... ▼
                    </button>
                `;
            }
        }

        container.innerHTML = html;
    },

    // Toggle expand/collapse for a node
    toggleExpand(nodeId) {
        if (this.expandedNodes.has(nodeId)) {
            this.expandedNodes.delete(nodeId);
        } else {
            this.expandedNodes.add(nodeId);
        }
        this.populateServiceTags(nodeId);

        // Update connections after content change
        setTimeout(() => {
            if (window.Connections) Connections.renderAll();
        }, 10);
    },

    // Update service tags when filters change (called from Filters)
    updateServiceTags() {
        this.populateAllServiceTags();
    },

    renameNode(nodeId) {
        const node = AppState.nodes[nodeId];
        if (!node) return;

        const newName = prompt('Yeni ad:', node.name);
        if (newName && newName.trim()) {
            // Save state for undo
            if (window.HistoryManager) HistoryManager.saveState('Rename node');

            node.name = newName.trim();
            DataManager.saveToLocalStorage();
            this.renderAll();
        }
    },

    addNode(type, name) {
        // Save state for undo
        if (window.HistoryManager) HistoryManager.saveState('Add node');

        const id = Utils.generateId('node');
        const mainContainer = document.getElementById('main-container');

        // Position at visible center
        const x = mainContainer.scrollLeft + mainContainer.clientWidth / 2 - 130;
        const y = mainContainer.scrollTop + mainContainer.clientHeight / 2 - 50;

        AppState.nodes[id] = { id, type, name, x, y, width: 260 };
        this.renderAll();
        DataManager.saveToLocalStorage();

        return id;
    },

    deleteNode(nodeId) {
        if (!confirm('Bu öğeyi silmek istediğinize emin misiniz?')) return;

        // Save state for undo
        if (window.HistoryManager) HistoryManager.saveState('Delete node');

        delete AppState.nodes[nodeId];
        AppState.connections = AppState.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
        this.renderAll();
        DataManager.saveToLocalStorage();
    }
};

window.Nodes = Nodes;
