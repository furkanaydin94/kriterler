// Utility Functions

const Utils = {
    // Generate unique ID
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    },

    // Simple Debounce
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Create Element Helper
    createElement(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text) el.textContent = text;
        return el;
    },

    // Get connection points for a node rect
    getConnectionPoints(node) {
        // node: {x, y, width} (height approximation or exact if stored)
        // Assume Process Node Height ~100px, Method ~80px, Hub ~100px
        const height = node.type === 'hub' ? 100 : (node.type === 'method' ? 80 : 100);

        return {
            top: { x: node.x + node.width / 2, y: node.y },
            bottom: { x: node.x + node.width / 2, y: node.y + height },
            left: { x: node.x, y: node.y + height / 2 },
            right: { x: node.x + node.width, y: node.y + height / 2 }
        };
    },

    // Sort array of objects by a key
    sortBy(arr, key) {
        return arr.sort((a, b) => (a[key] > b[key]) ? 1 : ((b[key] > a[key]) ? -1 : 0));
    }
};
