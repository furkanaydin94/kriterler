// Canvas and Interaction Logic - Enhanced with Multi-Select and Keyboard Navigation

const Canvas = {
    // Interaction state
    interactionState: {
        pointers: [],
        lastDist: null,
        mode: 'none', // 'none' | 'panning' | 'potentialDrag' | 'draggingCard' | 'zooming' | 'selecting' | 'draggingMulti'
        target: null,
        startPos: { x: 0, y: 0 },
        hasMoved: false,
        scale: 1,
        // Selection box için
        selectionStart: null,
        selectionBox: null
    },
    DRAG_THRESHOLD: 5,
    KEYBOARD_SCROLL_SPEED: 50,

    init() {
        const mainContainer = document.getElementById('main-container');
        const chartContainer = document.getElementById('chart-container');

        // Set initial scale from AppState
        this.interactionState.scale = AppState.canvas.scale;

        // Make container focusable for keyboard events
        mainContainer.setAttribute('tabindex', '0');
        mainContainer.style.outline = 'none';

        // Pointer Events
        mainContainer.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        mainContainer.addEventListener('pointermove', (e) => this.onPointerMove(e));
        mainContainer.addEventListener('pointerup', (e) => this.onPointerUp(e));
        mainContainer.addEventListener('pointercancel', (e) => this.onPointerUp(e));

        // Keyboard Events for Navigation
        mainContainer.addEventListener('keydown', (e) => this.onKeyDown(e));

        // Focus container when clicking on it
        mainContainer.addEventListener('click', () => mainContainer.focus());

        // Prevent default context menu on canvas (we use right-click for selection)
        mainContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Wheel Zoom
        mainContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomIntensity = 0.1;
            const { scale } = this.interactionState;
            let newScale = scale * (1 - Math.sign(e.deltaY) * zoomIntensity);
            newScale = Math.max(0.2, Math.min(newScale, 3));

            const rect = mainContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const newScrollLeft = (mouseX + mainContainer.scrollLeft) * (newScale / scale) - mouseX;
            const newScrollTop = (mouseY + mainContainer.scrollTop) * (newScale / scale) - mouseY;

            this.interactionState.scale = newScale;
            AppState.canvas.scale = newScale;
            this.updateChartTransform();
            mainContainer.scrollLeft = newScrollLeft;
            mainContainer.scrollTop = newScrollTop;
        }, { passive: false });

        // Zoom Buttons
        document.getElementById('zoom-in')?.addEventListener('click', () => {
            this.interactionState.scale = Math.min(this.interactionState.scale + 0.1, 3);
            AppState.canvas.scale = this.interactionState.scale;
            this.updateChartTransform();
        });

        document.getElementById('zoom-out')?.addEventListener('click', () => {
            this.interactionState.scale = Math.max(this.interactionState.scale - 0.1, 0.2);
            AppState.canvas.scale = this.interactionState.scale;
            this.updateChartTransform();
        });

        document.getElementById('reset-view-btn')?.addEventListener('click', () => {
            this.interactionState.scale = 1;
            AppState.canvas.scale = 1;
            AppState.canvas.offsetX = 0;
            AppState.canvas.offsetY = 0;
            this.updateChartTransform();
        });

        // Create selection box element
        this.createSelectionBox();

        this.updateChartTransform();
        this.updateZoomLabel();
    },

    // ============================================
    // KEYBOARD NAVIGATION
    // ============================================

    onKeyDown(e) {
        const mainContainer = document.getElementById('main-container');
        const scrollAmount = this.KEYBOARD_SCROLL_SPEED;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                mainContainer.scrollTop -= scrollAmount;
                break;
            case 'ArrowDown':
                e.preventDefault();
                mainContainer.scrollTop += scrollAmount;
                break;
            case 'ArrowLeft':
                e.preventDefault();
                mainContainer.scrollLeft -= scrollAmount;
                break;
            case 'ArrowRight':
                e.preventDefault();
                mainContainer.scrollLeft += scrollAmount;
                break;
            case 'Escape':
                // Clear selection
                this.clearSelection();
                break;
            case 'a':
            case 'A':
                // Ctrl+A to select all
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.selectAllNodes();
                }
                break;
            case 'z':
            case 'Z':
                // Ctrl+Z to undo
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (window.HistoryManager) HistoryManager.undo();
                }
                break;
            case 'y':
            case 'Y':
                // Ctrl+Y to redo
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (window.HistoryManager) HistoryManager.redo();
                }
                break;
        }
    },

    // ============================================
    // MULTI-SELECT (RUBBER BAND SELECTION)
    // ============================================

    createSelectionBox() {
        const box = document.createElement('div');
        box.id = 'selection-box';
        box.style.cssText = `
            position: absolute;
            border: 2px dashed #3b82f6;
            background: rgba(59, 130, 246, 0.1);
            pointer-events: none;
            z-index: 1000;
            display: none;
        `;
        document.getElementById('chart-container').appendChild(box);
        this.interactionState.selectionBox = box;
    },

    onPointerDown(e) {
        // Skip if clicking action buttons or connection points
        if (e.target.closest('.node-action-btn') || e.target.closest('.connection-point') || e.target.closest('.node-actions')) return;

        // Skip interactive elements inside nodes (let their click handlers work)
        if (e.target.closest('.service-toggle-btn') || e.target.closest('.service-tag') || e.target.closest('.service-total-badge')) return;

        // Connection mode - don't pan/drag
        if (AppState.ui.connectionMode) return;

        const mainContainer = document.getElementById('main-container');
        const scale = this.interactionState.scale;
        const rect = mainContainer.getBoundingClientRect();

        // Calculate position in chart coordinates
        const chartX = (e.clientX - rect.left + mainContainer.scrollLeft) / scale;
        const chartY = (e.clientY - rect.top + mainContainer.scrollTop) / scale;

        this.interactionState.pointers.push(e);
        this.interactionState.startPos = { x: e.clientX, y: e.clientY };
        this.interactionState.hasMoved = false;

        const card = e.target.closest('.chart-card');

        if (this.interactionState.pointers.length === 1) {
            if (card) {
                // Check if clicking on already selected node
                if (AppState.ui.selectedNodes.has(card.id)) {
                    // Potential multi-drag
                    this.interactionState.mode = 'potentialMultiDrag';
                    this.interactionState.target = card;
                } else {
                    // Shift+click to add to selection
                    if (e.shiftKey) {
                        AppState.ui.selectedNodes.add(card.id);
                        this.updateSelectionVisuals();
                        this.interactionState.mode = 'potentialMultiDrag';
                        this.interactionState.target = card;
                    } else {
                        // Clear selection and select only this one
                        this.clearSelection();
                        this.interactionState.target = card;
                        this.interactionState.mode = 'potentialDrag';
                    }
                }
            } else {
                // Click on empty area
                // Right-click (button 2) = selection box, Left-click (button 0) = panning
                if (e.button === 2) {
                    // Right-click: Start selection box
                    if (!e.shiftKey) {
                        this.clearSelection();
                    }
                    this.interactionState.selectionStart = { x: chartX, y: chartY };
                    this.interactionState.mode = 'selecting';
                } else {
                    // Left-click: Panning
                    if (!e.shiftKey) {
                        this.clearSelection();
                    }
                    this.interactionState.mode = 'panning';
                    document.getElementById('main-container').style.cursor = 'grabbing';
                }
            }
        } else if (this.interactionState.pointers.length === 2) {
            // Pinch zoom
            this.interactionState.mode = 'zooming';
            const [p1, p2] = this.interactionState.pointers;
            this.interactionState.lastDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
        }

        mainContainer.setPointerCapture(e.pointerId);
    },

    onPointerMove(e) {
        const index = this.interactionState.pointers.findIndex(p => p.pointerId === e.pointerId);
        if (index === -1) return;

        const lastPos = this.interactionState.pointers[index];
        const moveX = e.clientX - lastPos.clientX;
        const moveY = e.clientY - lastPos.clientY;
        this.interactionState.pointers[index] = e;

        const mainContainer = document.getElementById('main-container');
        const scale = this.interactionState.scale;
        const rect = mainContainer.getBoundingClientRect();

        // Check if passed drag threshold
        if (!this.interactionState.hasMoved) {
            const dist = Math.hypot(e.clientX - this.interactionState.startPos.x, e.clientY - this.interactionState.startPos.y);
            if (dist > this.DRAG_THRESHOLD) {
                this.interactionState.hasMoved = true;
                if (this.interactionState.mode === 'potentialDrag') {
                    // Save state for undo before dragging
                    if (window.HistoryManager) HistoryManager.saveState('Move node');
                    this.interactionState.mode = 'draggingCard';
                    this.interactionState.target.classList.add('dragging');
                } else if (this.interactionState.mode === 'potentialMultiDrag') {
                    // Save state for undo before multi-dragging
                    if (window.HistoryManager) HistoryManager.saveState('Move nodes');
                    this.interactionState.mode = 'draggingMulti';
                    // Add dragging class to all selected
                    AppState.ui.selectedNodes.forEach(nodeId => {
                        const el = document.getElementById(nodeId);
                        if (el) el.classList.add('dragging');
                    });
                }
            }
        }

        if (this.interactionState.mode === 'zooming' && this.interactionState.pointers.length === 2) {
            // Pinch zoom
            const [p1, p2] = this.interactionState.pointers;
            const newDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
            const newScale = Math.max(0.2, Math.min(this.interactionState.scale * (newDist / this.interactionState.lastDist), 3));
            this.interactionState.scale = newScale;
            AppState.canvas.scale = newScale;
            this.interactionState.lastDist = newDist;
            this.updateChartTransform();
        } else if (this.interactionState.mode === 'draggingCard' && this.interactionState.target) {
            // Drag single card
            const card = this.interactionState.target;
            card.style.left = `${parseFloat(card.style.left) + moveX / scale}px`;
            card.style.top = `${parseFloat(card.style.top) + moveY / scale}px`;
            if (window.Connections) Connections.renderAll();
        } else if (this.interactionState.mode === 'draggingMulti') {
            // Drag all selected nodes
            AppState.ui.selectedNodes.forEach(nodeId => {
                const el = document.getElementById(nodeId);
                if (el) {
                    el.style.left = `${parseFloat(el.style.left) + moveX / scale}px`;
                    el.style.top = `${parseFloat(el.style.top) + moveY / scale}px`;
                }
            });
            if (window.Connections) Connections.renderAll();
        } else if (this.interactionState.mode === 'selecting' && this.interactionState.hasMoved) {
            // Draw selection box
            const chartX = (e.clientX - rect.left + mainContainer.scrollLeft) / scale;
            const chartY = (e.clientY - rect.top + mainContainer.scrollTop) / scale;
            this.updateSelectionBox(chartX, chartY);
        } else if (this.interactionState.mode === 'selecting' && !this.interactionState.hasMoved) {
            // Check if we should start panning instead
            const dist = Math.hypot(e.clientX - this.interactionState.startPos.x, e.clientY - this.interactionState.startPos.y);
            if (dist > this.DRAG_THRESHOLD) {
                this.interactionState.hasMoved = true;
            }
        } else if (this.interactionState.mode === 'panning') {
            // Pan canvas with mouse drag
            mainContainer.scrollLeft -= moveX;
            mainContainer.scrollTop -= moveY;
        }
    },

    updateSelectionBox(currentX, currentY) {
        const box = this.interactionState.selectionBox;
        const start = this.interactionState.selectionStart;
        if (!box || !start) return;

        const x = Math.min(start.x, currentX);
        const y = Math.min(start.y, currentY);
        const width = Math.abs(currentX - start.x);
        const height = Math.abs(currentY - start.y);

        box.style.display = 'block';
        box.style.left = `${x}px`;
        box.style.top = `${y}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;

        // Check which nodes intersect with selection box
        this.highlightNodesInSelection(x, y, width, height);
    },

    highlightNodesInSelection(selX, selY, selWidth, selHeight) {
        Object.keys(AppState.nodes).forEach(nodeId => {
            const el = document.getElementById(nodeId);
            if (!el) return;

            const nodeX = parseFloat(el.style.left);
            const nodeY = parseFloat(el.style.top);
            const nodeW = el.offsetWidth;
            const nodeH = el.offsetHeight;

            // Check intersection
            const intersects = !(
                nodeX + nodeW < selX ||
                nodeX > selX + selWidth ||
                nodeY + nodeH < selY ||
                nodeY > selY + selHeight
            );

            if (intersects) {
                el.classList.add('selection-preview');
            } else {
                el.classList.remove('selection-preview');
            }
        });
    },

    onPointerUp(e) {
        const mainContainer = document.getElementById('main-container');
        const scale = this.interactionState.scale;
        const rect = mainContainer.getBoundingClientRect();

        // Handle selection box completion
        if (this.interactionState.mode === 'selecting' && this.interactionState.hasMoved) {
            const chartX = (e.clientX - rect.left + mainContainer.scrollLeft) / scale;
            const chartY = (e.clientY - rect.top + mainContainer.scrollTop) / scale;
            this.finalizeSelection(chartX, chartY);
        }

        // Check if click was on interactive elements inside node (should not trigger modal)
        const clickedOnInteractive = e.target.closest('.service-toggle-btn') ||
            e.target.closest('.service-tag') ||
            e.target.closest('.service-total-badge');

        // Click action if no movement
        if (!this.interactionState.hasMoved && this.interactionState.target && !clickedOnInteractive) {
            const card = this.interactionState.target;
            const node = AppState.nodes[card.id];
            if (node) {
                if (node.type === 'method') {
                    if (window.Filters) Filters.filterByMethod(node.id);
                } else if (node.type !== 'hub') {
                    if (window.Modal) Modal.open(node.id);
                }
            }
        }

        // Save positions if cards were dragged
        if (this.interactionState.mode === 'draggingCard' && this.interactionState.target) {
            const card = this.interactionState.target;
            const node = AppState.nodes[card.id];
            if (node) {
                node.x = parseFloat(card.style.left) || 0;
                node.y = parseFloat(card.style.top) || 0;
                DataManager.saveToLocalStorage();
            }
            card.classList.remove('dragging');
            if (window.Connections) Connections.renderAll();
        } else if (this.interactionState.mode === 'draggingMulti') {
            // Save all selected node positions
            AppState.ui.selectedNodes.forEach(nodeId => {
                const el = document.getElementById(nodeId);
                const node = AppState.nodes[nodeId];
                if (el && node) {
                    node.x = parseFloat(el.style.left) || 0;
                    node.y = parseFloat(el.style.top) || 0;
                    el.classList.remove('dragging');
                }
            });
            DataManager.saveToLocalStorage();
            if (window.Connections) Connections.renderAll();
        }

        // Hide selection box
        if (this.interactionState.selectionBox) {
            this.interactionState.selectionBox.style.display = 'none';
        }

        // Clear selection preview
        document.querySelectorAll('.selection-preview').forEach(el => {
            el.classList.remove('selection-preview');
        });

        // Remove pointer from array
        const index = this.interactionState.pointers.findIndex(p => p.pointerId === e.pointerId);
        if (index > -1) this.interactionState.pointers.splice(index, 1);

        // Reset state
        if (this.interactionState.pointers.length === 0) {
            this.interactionState.mode = 'none';
            this.interactionState.target = null;
            this.interactionState.hasMoved = false;
            this.interactionState.selectionStart = null;
            document.getElementById('chart-container').style.cursor = 'grab';
        } else if (this.interactionState.pointers.length === 1) {
            this.interactionState.mode = 'panning';
            this.interactionState.startPos = { x: this.interactionState.pointers[0].clientX, y: this.interactionState.pointers[0].clientY };
        }
    },

    finalizeSelection(endX, endY) {
        const start = this.interactionState.selectionStart;
        if (!start) return;

        const x = Math.min(start.x, endX);
        const y = Math.min(start.y, endY);
        const width = Math.abs(endX - start.x);
        const height = Math.abs(endY - start.y);

        // Add nodes in selection to selected set
        Object.keys(AppState.nodes).forEach(nodeId => {
            const el = document.getElementById(nodeId);
            if (!el) return;

            const nodeX = parseFloat(el.style.left);
            const nodeY = parseFloat(el.style.top);
            const nodeW = el.offsetWidth;
            const nodeH = el.offsetHeight;

            // Check intersection
            const intersects = !(
                nodeX + nodeW < x ||
                nodeX > x + width ||
                nodeY + nodeH < y ||
                nodeY > y + height
            );

            if (intersects) {
                AppState.ui.selectedNodes.add(nodeId);
            }
        });

        this.updateSelectionVisuals();
    },

    clearSelection() {
        AppState.ui.selectedNodes.clear();
        this.updateSelectionVisuals();
    },

    selectAllNodes() {
        Object.keys(AppState.nodes).forEach(nodeId => {
            AppState.ui.selectedNodes.add(nodeId);
        });
        this.updateSelectionVisuals();
    },

    updateSelectionVisuals() {
        // Remove selected class from all
        document.querySelectorAll('.chart-card.multi-selected').forEach(el => {
            el.classList.remove('multi-selected');
        });

        // Add selected class to selected nodes
        AppState.ui.selectedNodes.forEach(nodeId => {
            const el = document.getElementById(nodeId);
            if (el) el.classList.add('multi-selected');
        });
    },

    updateChartTransform() {
        const chart = document.getElementById('chart-container');
        chart.style.transform = `scale(${this.interactionState.scale})`;
        this.updateZoomLabel();
    },

    updateZoomLabel() {
        const label = document.getElementById('zoom-level');
        if (label) label.textContent = Math.round(this.interactionState.scale * 100) + '%';
    }
};

window.Canvas = Canvas;
