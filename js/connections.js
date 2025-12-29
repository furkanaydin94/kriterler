// Connection Management - Based on Reference File

const Connections = {
    connectionMode: false,
    connectionStart: null,
    tempLine: null,
    container: null,

    init() {
        this.container = document.getElementById('connector-lines');
        if (!this.container) {
            console.error('connector-lines SVG element not found!');
            return;
        }
        this.renderAll();
    },

    toggleConnectionMode() {
        this.connectionMode = !this.connectionMode;
        AppState.ui.connectionMode = this.connectionMode;

        document.body.classList.toggle('connecting-mode', this.connectionMode);

        const btn = document.getElementById('toggle-connect-mode');
        if (btn) btn.classList.toggle('active', this.connectionMode);

        console.log(`Connection Mode: ${this.connectionMode ? 'ON' : 'OFF'}`);

        if (!this.connectionMode) {
            // Clean up
            if (this.tempLine) {
                this.tempLine.remove();
                this.tempLine = null;
            }
            this.connectionStart = null;
        }
    },

    startConnection(e) {
        if (!this.connectionMode) return;

        e.stopPropagation();
        e.preventDefault();

        const point = e.target;
        const card = point.closest('.chart-card');
        if (!card) return;

        this.connectionStart = {
            id: card.id,
            pos: point.dataset.pos
        };

        // Create temp line
        this.tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        this.tempLine.setAttribute('class', 'temp-connection-line');
        this.container.appendChild(this.tempLine);

        // Add listeners
        document.addEventListener('pointermove', this.drawTempConnection);
        document.addEventListener('pointerup', this.endConnection, { once: true });
    },

    drawTempConnection: function (e) {
        const self = Connections;
        if (!self.connectionStart || !self.tempLine) return;

        const fromCard = document.getElementById(self.connectionStart.id);
        if (!fromCard) return;

        const mainContainer = document.getElementById('main-container');
        const mainRect = mainContainer.getBoundingClientRect();
        const scale = Canvas.interactionState?.scale || 1;

        const from = self.getCoords(fromCard, self.connectionStart.pos);
        self.tempLine.setAttribute('x1', from.x);
        self.tempLine.setAttribute('y1', from.y);

        // Mouse position in chart coordinates
        const logicalX = (e.clientX - mainRect.left + mainContainer.scrollLeft) / scale;
        const logicalY = (e.clientY - mainRect.top + mainContainer.scrollTop) / scale;

        self.tempLine.setAttribute('x2', logicalX);
        self.tempLine.setAttribute('y2', logicalY);
    },

    endConnection: function (e) {
        const self = Connections;

        document.removeEventListener('pointermove', self.drawTempConnection);

        const toPoint = e.target.closest('.connection-point');
        if (self.connectionStart && toPoint) {
            const toCard = toPoint.closest('.chart-card');
            if (toCard && toCard.id !== self.connectionStart.id) {
                // Add connection
                const newConn = {
                    id: Utils.generateId('c'),
                    from: self.connectionStart.id,
                    to: toCard.id,
                    fromPos: self.connectionStart.pos,
                    toPos: toPoint.dataset.pos
                };

                // Check for duplicates
                const exists = AppState.connections.some(c =>
                    c.from === newConn.from && c.to === newConn.to
                );

                if (!exists) {
                    AppState.connections.push(newConn);
                    DataManager.saveToLocalStorage();
                    self.renderAll();
                    console.log('Connection added:', newConn);
                }
            }
        }

        // Cleanup
        if (self.tempLine) {
            self.tempLine.remove();
            self.tempLine = null;
        }
        self.connectionStart = null;

        // Turn off connection mode after one connection
        if (self.connectionMode) {
            self.toggleConnectionMode();
        }
    },

    renderAll() {
        if (!this.container) return;

        // Keep temp line if exists
        const temp = this.tempLine;
        this.container.innerHTML = '';
        if (temp) this.container.appendChild(temp);

        AppState.connections.forEach(conn => {
            const fromEl = document.getElementById(conn.from);
            const toEl = document.getElementById(conn.to);
            if (!fromEl || !toEl) return;

            const from = this.getCoords(fromEl, conn.fromPos || 'right');
            const to = this.getCoords(toEl, conn.toPos || 'left');

            // Create bezier path
            const midX = from.x + (to.x - from.x) / 2;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;

            path.setAttribute('d', d);
            path.setAttribute('class', 'connection-line');
            path.id = 'line-' + conn.id;

            // Right-click to delete
            path.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (confirm('Bu bağlantıyı silmek istiyor musunuz?')) {
                    this.deleteConnection(conn.id);
                }
            });

            this.container.appendChild(path);
        });
    },

    getCoords(card, pos) {
        const x = card.offsetLeft;
        const y = card.offsetTop;
        const w = card.offsetWidth;
        const h = card.offsetHeight;

        if (pos === 'top') return { x: x + w / 2, y: y };
        if (pos === 'bottom') return { x: x + w / 2, y: y + h };
        if (pos === 'left') return { x: x, y: y + h / 2 };
        if (pos === 'right') return { x: x + w, y: y + h / 2 };
        return { x, y };
    },

    deleteConnection(connId) {
        AppState.connections = AppState.connections.filter(c => c.id !== connId);
        DataManager.saveToLocalStorage();
        this.renderAll();
    },

    connectAllMode() {
        console.log('Connect All Mode - Select target node');
        const chartContainer = document.getElementById('chart-container');

        const onClick = (e) => {
            const card = e.target.closest('.chart-card');
            if (!card) return;

            const targetId = card.id;
            let count = 0;

            Object.keys(AppState.nodes).forEach(nodeId => {
                if (nodeId !== targetId) {
                    const exists = AppState.connections.some(c =>
                        c.from === targetId && c.to === nodeId
                    );
                    if (!exists) {
                        AppState.connections.push({
                            id: Utils.generateId('c'),
                            from: targetId,
                            to: nodeId,
                            fromPos: 'bottom',
                            toPos: 'top'
                        });
                        count++;
                    }
                }
            });

            DataManager.saveToLocalStorage();
            this.renderAll();
            console.log(`Created ${count} connections`);
        };

        chartContainer.addEventListener('click', onClick, { once: true });
    }
};

window.Connections = Connections;
