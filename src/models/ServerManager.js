const ConfigService = require('../services/ConfigService');
const PlayitService = require('../services/PlayitService');
const MinecraftService = require('../services/MinecraftService');
const WorldService = require('../services/WorldService');
const NetworkUtils = require('../utils/NetworkUtils');

class ServerManager {
    constructor(io) {
        this.io = io;
        this.logs = [];
        this.maxLogs = 1000;

        // Initialize services
        this.configService = new ConfigService();
        this.networkUtils = new NetworkUtils();
        this.playitService = new PlayitService();
        this.worldService = new WorldService(this.configService);
        this.minecraftService = new MinecraftService(this.configService, this.playitService);

        // Server state
        this.serverStatus = 'offline';
        this.serverReady = false;
        this.startTime = null;

        this.setupSocketIO();
        this.initialize();
    }

    async initialize() {
        await this.configService.loadConfig();
        await this.networkUtils.getPublicIP();
        this.playitService.checkInstallation();

        // Set up event listeners
        this.setupEventListeners();

        this.broadcastLog('🎮 Minecraft Server Manager initialized', 'success');
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            console.log('📱 Web client connected');
            socket.emit('recent-logs', this.logs);

            socket.on('disconnect', () => {
                console.log('📱 Web client disconnected');
            });
        });
    }

    setupEventListeners() {
        // Minecraft service events
        this.minecraftService.on('log', (message, type) => {
            this.broadcastLog(message, type);
        });

        this.minecraftService.on('statusChange', (status) => {
            this.serverStatus = status;
            if (status === 'online') {
                this.serverReady = true;
                this.displayConnectionInfo();
            } else if (status === 'offline') {
                this.serverReady = false;
                this.startTime = null;
            }
        });

        // Playit service events
        this.playitService.on('log', (message, type) => {
            this.broadcastLog(message, type);
        });
    }

    broadcastLog(message, type = 'info') {
        const logEntry = {
            timestamp: new Date().toISOString(),
            message: message,
            type: type,
            time: new Date().toLocaleTimeString()
        };

        this.logs.push(logEntry);

        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        this.io.emit('new-log', logEntry);
        console.log(`[${logEntry.time}] ${message}`);
    }

    displayConnectionInfo() {
        const localIP = this.networkUtils.getLocalIP();
        const publicIP = this.networkUtils.getPublicIP();
        const playitAddresses = this.playitService.getAddresses();

        this.broadcastLog('🎮 MINECRAFT CROSSPLAY SERVER IS ONLINE! 🎮', 'success');
        this.broadcastLog(`📱 Java Edition Local: localhost:25565`, 'info');
        this.broadcastLog(`🎯 Bedrock Edition Local: localhost:19132`, 'info');
        this.broadcastLog(`🏘️ Network Java: ${localIP}:25565`, 'info');
        this.broadcastLog(`🏘️ Network Bedrock: ${localIP}:19132`, 'info');

        if (playitAddresses.java) {
            this.broadcastLog(`🌐 Public Java (Playit): ${playitAddresses.java}`, 'success');
        }
        if (playitAddresses.bedrock) {
            this.broadcastLog(`🌐 Public Bedrock (Playit): ${playitAddresses.bedrock}`, 'success');
        }

        this.broadcastLog('📋 Share these addresses with friends!', 'success');
    }

    async startServer() {
        if (this.serverStatus === 'starting' || this.serverStatus === 'online') {
            throw new Error('Server is already starting or running');
        }

        // Check for world changes
        const worldCheck = await this.worldService.checkSeedChange();
        if (worldCheck.shouldCreateNew) {
            this.broadcastLog(worldCheck.message, 'info');
        }

        this.serverStatus = 'starting';
        this.startTime = Date.now();

        await this.minecraftService.start();

        if (this.configService.getConfig().playit.autoStart) {
            await this.playitService.start();
        }
    }

    async stopServer() {
        if (this.serverStatus === 'offline') {
            throw new Error('Server is already offline');
        }

        this.serverStatus = 'stopping';
        await this.minecraftService.stop();
        await this.playitService.stop();
    }

    executeCommand(command) {
        if (this.serverStatus !== 'online') {
            throw new Error('Server must be online to send commands');
        }

        this.minecraftService.executeCommand(command);
        this.broadcastLog(`📤 Command executed: ${command}`, 'info');
    }

    getStatus() {
        const uptime = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
        const localIP = this.networkUtils.getLocalIP();
        const publicIP = this.networkUtils.getPublicIP();
        const playitAddresses = this.playitService.getAddresses();

        return {
            status: this.serverStatus,
            running: this.minecraftService.isRunning(),
            ready: this.serverReady,
            uptime: uptime,
            localIP: localIP,
            publicIP: publicIP,
            javaPort: 25565,
            bedrockPort: 19132,
            config: this.configService.getConfig(),
            playit: {
                installed: this.playitService.isInstalled(),
                running: this.playitService.isRunning(),
                addresses: playitAddresses,
                setupUrl: this.playitService.getSetupUrl(),
                tunnelsActive: this.playitService.areTunnelsActive()
            },
            connections: {
                local: {
                    java: `localhost:25565`,
                    bedrock: `localhost:19132`
                },
                network: {
                    java: `${localIP}:25565`,
                    bedrock: `${localIP}:19132`
                },
                playit: this.playitService.isInstalled() ? {
                    java: playitAddresses.java,
                    bedrock: playitAddresses.bedrock,
                    note: "Playit.gg tunneling"
                } : null
            }
        };
    }
}

module.exports = ServerManager;
