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
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.setupMiddleware();
        this.setupRoutes();
        this.initializeServerManager();
    }

    setupMiddleware() {
        // Enable CORS for API requests
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        this.app.use(express.json());

        // Serve React build files
        this.app.use(express.static(path.join(__dirname, '../public')));
    }

    setupRoutes() {
        // API routes
        this.app.use('/api/config', configRoutes);
        this.app.use('/api/server', serverRoutes);
        this.app.use('/api/status', statusRoutes);

        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });

        // Catch all handler for React Router (serve React app for non-API routes)
        this.app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
                return next();
            }
            res.sendFile(path.join(__dirname, '../public/index.html'));
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
            console.log(`🎮 React UI served from /public directory`);
        });
    }
}

// Start the application
const app = new MinecraftServerApp();
app.start();

module.exports = MinecraftServerApp;
