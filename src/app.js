const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const ServerManager = require('./models/ServerManager');
const configRoutes = require('./routes/config');
const serverRoutes = require('./routes/server');
const statusRoutes = require('./routes/status');

class MinecraftServerApp {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server);

        this.setupMiddleware();
        this.setupRoutes();
        this.initializeServerManager();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../public')));
    }

    setupRoutes() {
        this.app.use('/api/config', configRoutes);
        this.app.use('/api/server', serverRoutes);
        this.app.use('/api/status', statusRoutes);

        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });
    }

    initializeServerManager() {
        this.serverManager = new ServerManager(this.io);

        // Make server manager available to routes
        this.app.locals.serverManager = this.serverManager;
    }

    start(port = 3000) {
        this.server.listen(port, '0.0.0.0', () => {
            console.log(`🚀 Minecraft Server Manager running on port ${port}`);
            console.log(`📱 Local access: http://localhost:${port}`);
            console.log(`🌐 Network access: http://${this.serverManager.networkUtils.getLocalIP()}:${port}`);
        });
    }
}

// Start the application
const app = new MinecraftServerApp();
app.start();

module.exports = MinecraftServerApp;
