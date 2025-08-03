const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const socketIo = require('socket.io');

class MinecraftCrossplayServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server);
        this.minecraftProcess = null;
        this.playitProcess = null;
        this.serverPath = './minecraft-server';
        this.jarFile = 'paper-server.jar';
        this.javaPort = 25565;
        this.bedrockPort = 19132;
        this.localIP = this.getLocalIP();
        this.publicIP = null;
        this.serverStatus = 'offline';
        this.startTime = null;
        this.serverReady = false;
        this.logs = [];
        this.maxLogs = 1000;

        // Load configuration
        this.config = this.loadConfig();

        // Playit.gg integration
        this.playitInstalled = false;
        this.playitAddresses = {
            java: null,
            bedrock: null
        };
        this.lastPlayitOutput = '';
        this.playitTunnelsDetected = false;
        this.playitSetupUrl = null;

        this.checkPlayitInstallation();
        this.setupExpress();
        this.setupSocketIo();
        this.setupRoutes();
        this.setupServerProperties();
        this.getPublicIP();
    }

    // UPDATED: Load configuration with migration for existing configs
    loadConfig() {
        const configPath = './config.json';
        try {
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configData);

                // Migrate existing config to include world tracking
                if (!config.world) {
                    config.world = {
                        currentSeed: config.server.seed || "",
                        lastUsedSeed: config.server.seed || "",
                        worldGenerated: true // Assume existing worlds are already generated
                    };

                    // Save the migrated config
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
                    this.broadcastLog('🔄 Config migrated to support seed change detection', 'info');
                }

                this.broadcastLog('✅ Configuration loaded successfully', 'success');
                return config;
            } else {
                this.broadcastLog('⚠️ Config file not found, creating default config.json', 'warn');
                return this.createDefaultConfig();
            }
        } catch (error) {
            this.broadcastLog(`❌ Error loading config: ${error.message}`, 'error');
            this.broadcastLog('📝 Using default configuration', 'info');
            return this.createDefaultConfig();
        }
    }

    // NEW: Create default configuration file
    createDefaultConfig() {
        const defaultConfig = {
            "server": {
                "seed": "",
                "maxPlayers": 20,
                "description": "Welcome to our Minecraft Crossplay Server! Java & Bedrock players welcome!",
                "gamemode": "survival",
                "difficulty": "easy",
                "pvp": true,
                "enableCommandBlock": true,
                "allowNether": true,
                "allowEnd": true,
                "spawnProtection": 0,
                "viewDistance": 10,
                "simulationDistance": 10,
                "levelName": "world",
                "onlineMode": false,
                "enableWhitelist": false,
                "forceResourcePack": false
            },
            "performance": {
                "maxMemory": "3G",
                "minMemory": "1G"
            },
            "playit": {
                "autoStart": true
            },
            "world": {
                "currentSeed": "",
                "lastUsedSeed": "",
                "worldGenerated": false
            }
        };

        try {
            fs.writeFileSync('./config.json', JSON.stringify(defaultConfig, null, 4));
            this.broadcastLog('📄 Default config.json created', 'success');
        } catch (error) {
            this.broadcastLog(`❌ Failed to create config file: ${error.message}`, 'error');
        }

        return defaultConfig;
    }

    // NEW: Save configuration changes
    saveConfig() {
        try {
            fs.writeFileSync('./config.json', JSON.stringify(this.config, null, 4));
            this.broadcastLog('💾 Configuration saved successfully', 'success');
            return true;
        } catch (error) {
            this.broadcastLog(`❌ Failed to save config: ${error.message}`, 'error');
            return false;
        }
    }

    // NEW: Check if seed has changed and handle world creation accordingly
    checkSeedChange() {
        const currentSeed = this.config.server.seed || "";
        const lastUsedSeed = this.config.world?.lastUsedSeed || "";
        const worldPath = path.join(this.serverPath, this.config.server.levelName || 'world');
        const worldExists = fs.existsSync(worldPath);

        this.broadcastLog(`🌱 Checking world seed configuration...`, 'info');

        // If no world exists, we'll create a new one
        if (!worldExists) {
            this.broadcastLog(`🆕 No existing world found - will generate new world`, 'info');
            if (currentSeed) {
                this.broadcastLog(`🌱 New world will use seed: ${currentSeed}`, 'info');
            } else {
                this.broadcastLog(`🎲 New world will use random seed`, 'info');
            }
            this.updateWorldConfig(currentSeed);
            return { shouldCreateNew: true, reason: "no_world_exists" };
        }

        // If seeds are different, backup old world and create new one
        if (currentSeed !== lastUsedSeed) {
            this.broadcastLog(`🔄 Seed change detected!`, 'warn');
            this.broadcastLog(`📊 Previous seed: "${lastUsedSeed}"`, 'info');
            this.broadcastLog(`🆕 New seed: "${currentSeed}"`, 'info');

            const backupResult = this.backupExistingWorld();
            if (backupResult.success) {
                this.updateWorldConfig(currentSeed);
                return {
                    shouldCreateNew: true,
                    reason: "seed_changed",
                    backupPath: backupResult.backupPath
                };
            } else {
                this.broadcastLog(`❌ Failed to backup world: ${backupResult.error}`, 'error');
                this.broadcastLog(`⚠️ Keeping existing world to prevent data loss`, 'warn');
                return { shouldCreateNew: false, reason: "backup_failed" };
            }
        }

        // Seeds are the same, use existing world
        this.broadcastLog(`✅ Using existing world (seed unchanged)`, 'success');
        return { shouldCreateNew: false, reason: "seed_unchanged" };
    }

    // NEW: Backup existing world before creating new one
    backupExistingWorld() {
        try {
            const worldName = this.config.server.levelName || 'world';
            const worldPath = path.join(this.serverPath, worldName);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `${worldName}_backup_${timestamp}`;
            const backupPath = path.join(this.serverPath, backupName);

            this.broadcastLog(`📦 Creating backup of existing world...`, 'info');

            // Create backup directory
            fs.mkdirSync(backupPath, { recursive: true });

            // Copy world files
            this.copyDirectorySync(worldPath, backupPath);

            this.broadcastLog(`✅ World backup created: ${backupName}`, 'success');
            this.broadcastLog(`📁 Backup location: ${backupPath}`, 'info');

            // Remove original world
            this.removeDirectorySync(worldPath);
            this.broadcastLog(`🗑️ Original world removed to make space for new world`, 'info');

            return { success: true, backupPath: backupName };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // NEW: Utility function to copy directory recursively
    copyDirectorySync(src, dest) {
        const stats = fs.statSync(src);
        if (stats.isDirectory()) {
            fs.mkdirSync(dest, { recursive: true });
            const files = fs.readdirSync(src);
            files.forEach(file => {
                this.copyDirectorySync(path.join(src, file), path.join(dest, file));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    }

    // NEW: Utility function to remove directory recursively
    removeDirectorySync(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }

    // NEW: Update world configuration
    updateWorldConfig(seed) {
        if (!this.config.world) {
            this.config.world = {};
        }

        this.config.world.lastUsedSeed = seed;
        this.config.world.currentSeed = seed;
        this.config.world.worldGenerated = false;

        this.saveConfig();
    }

    // NEW: Mark world as generated
    markWorldAsGenerated() {
        if (!this.config.world) {
            this.config.world = {};
        }

        this.config.world.worldGenerated = true;
        this.saveConfig();
    }

    checkPlayitInstallation() {
        const playitPaths = [
            './playit.exe',
            './playit',
            'playit.exe',
            'playit'
        ];

        for (const playitPath of playitPaths) {
            try {
                if (fs.existsSync(playitPath) || this.commandExists(playitPath)) {
                    this.playitInstalled = true;
                    this.playitPath = playitPath;
                    console.log(`✅ Playit.gg found at: ${playitPath}`);
                    this.broadcastLog('✅ Playit.gg is installed - Public tunneling available!', 'success');
                    break;
                }
            } catch (error) {
                // Continue checking other paths
            }
        }

        if (!this.playitInstalled) {
            console.log('❌ Playit.gg is not installed - Server won\'t be available to the internet');
            console.log('📥 For downloading Playit.gg go here: https://playit.gg/download');
            this.broadcastLog('❌ Playit.gg is not installed - Server won\'t be available to the internet', 'warn');
            this.broadcastLog('📥 Download Playit.gg from: https://playit.gg/download', 'info');
        }
    }

    commandExists(command) {
        try {
            require('child_process').execSync(`${command} --version`, { stdio: 'ignore' });
            return true;
        } catch (error) {
            return false;
        }
    }

    parsePlayitOutput(output) {
        const lines = output.split('\n');
        let tunnelsFound = false;

        for (const line of lines) {
            const tunnelMatch = line.match(/^(.+?)\s+=>\s+127\.0\.0\.1:(\d+)/);
            if (tunnelMatch) {
                const address = tunnelMatch[1].trim();
                const port = tunnelMatch[2];
                tunnelsFound = true;

                if (port === '25565') {
                    if (this.playitAddresses.java !== address) {
                        this.playitAddresses.java = address;
                        this.broadcastLog(`🎮 Java tunnel ready: ${address}`, 'success');
                    }
                } else if (port === '19132') {
                    if (this.playitAddresses.bedrock !== address) {
                        this.playitAddresses.bedrock = address;
                        this.broadcastLog(`📱 Bedrock tunnel ready: ${address}`, 'success');
                    }
                }
            }
        }

        return tunnelsFound;
    }

    startPlayitTunnel() {
        if (!this.playitInstalled) {
            this.broadcastLog('⚠️ Playit.gg not installed - skipping tunnel creation', 'warn');
            return;
        }

        if (this.playitProcess) {
            this.broadcastLog('⚠️ Playit tunnel already running', 'warn');
            return;
        }

        this.broadcastLog('🌐 Starting Playit.gg tunnels for public access...', 'info');

        try {
            this.playitProcess = spawn(this.playitPath, [], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.playitProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();

                if (output !== this.lastPlayitOutput) {
                    this.lastPlayitOutput = output;

                    const setupUrlMatch = output.match(/Visit link to setup (https:\/\/playit\.gg\/claim\/[a-zA-Z0-9]+)/);
                    if (setupUrlMatch) {
                        this.playitSetupUrl = setupUrlMatch[1];
                        this.broadcastLog('[PLAYIT]: Setup required - Click "Setup Instructions" button for help', 'warn');
                    }

                    if (output.includes('Program approved')) {
                        this.broadcastLog('[PLAYIT]: Program approved - Setting up tunnels...', 'success');
                    }

                    const tunnelsFound = this.parsePlayitOutput(output);
                    if (tunnelsFound && !this.playitTunnelsDetected) {
                        this.playitTunnelsDetected = true;
                        this.broadcastLog('[PLAYIT]: Tunnels detected and active!', 'success');
                    }
                }
            });

            this.playitProcess.stderr.on('data', (data) => {
                const error = data.toString().trim();
                this.broadcastLog(`[PLAYIT ERROR]: ${error}`, 'error');
            });

            this.playitProcess.on('close', (code) => {
                this.broadcastLog(`🌐 Playit tunnel exited with code ${code}`, code === 0 ? 'info' : 'error');
                this.playitProcess = null;
                this.playitAddresses.java = null;
                this.playitAddresses.bedrock = null;
                this.playitTunnelsDetected = false;
            });

        } catch (error) {
            this.broadcastLog(`❌ Failed to start Playit tunnel: ${error.message}`, 'error');
        }
    }

    stopPlayitTunnel() {
        if (this.playitProcess) {
            this.broadcastLog('🌐 Stopping Playit tunnels...', 'info');
            this.playitProcess.kill('SIGTERM');
            this.playitProcess = null;
            this.playitAddresses.java = null;
            this.playitAddresses.bedrock = null;
            this.playitTunnelsDetected = false;
        }
    }

    resetPlayitState() {
        this.playitAddresses.java = null;
        this.playitAddresses.bedrock = null;
        this.playitTunnelsDetected = false;
        this.playitSetupUrl = null;
    }

    setupSocketIo() {
        this.io.on('connection', (socket) => {
            console.log('📱 Web client connected');
            socket.emit('recent-logs', this.logs);

            socket.on('disconnect', () => {
                console.log('📱 Web client disconnected');
            });
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

    getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const networkInterface of interfaces[name]) {
                if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                    return networkInterface.address;
                }
            }
        }
        return 'localhost';
    }

    async getPublicIP() {
        try {
            const https = require('https');
            const options = {
                hostname: 'api.ipify.org',
                port: 443,
                path: '/',
                method: 'GET'
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    this.publicIP = data.trim();
                    this.broadcastLog(`🌐 Public IP detected: ${this.publicIP}`, 'info');
                });
            });

            req.on('error', (error) => {
                this.broadcastLog(`Could not detect public IP: ${error.message}`, 'warn');
                this.publicIP = 'Unable to detect';
            });

            req.end();
        } catch (error) {
            this.publicIP = 'Unable to detect';
        }
    }

    setupExpress() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
    }

    setupRoutes() {
        // Config management routes
        this.app.get('/config', (req, res) => {
            res.json({
                success: true,
                config: this.config
            });
        });

        this.app.post('/config', (req, res) => {
            try {
                const { config } = req.body;
                if (!config) {
                    return res.json({
                        success: false,
                        message: 'No configuration data provided'
                    });
                }

                this.config = { ...this.config, ...config };
                const saved = this.saveConfig();

                if (saved) {
                    // Regenerate server.properties with new config
                    this.setupServerProperties();
                    res.json({
                        success: true,
                        message: 'Configuration updated successfully. Restart server to apply changes.',
                        config: this.config
                    });
                } else {
                    res.json({
                        success: false,
                        message: 'Failed to save configuration'
                    });
                }
            } catch (error) {
                res.json({
                    success: false,
                    message: `Error updating config: ${error.message}`
                });
            }
        });

        this.app.get('/status', (req, res) => {
            const uptime = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
            res.json({
                status: this.serverStatus,
                running: this.minecraftProcess !== null,
                ready: this.serverReady,
                uptime: uptime,
                localIP: this.localIP,
                publicIP: this.publicIP,
                javaPort: this.javaPort,
                bedrockPort: this.bedrockPort,
                config: this.config,
                playit: {
                    installed: this.playitInstalled,
                    running: this.playitProcess !== null,
                    addresses: this.playitAddresses,
                    setupUrl: this.playitSetupUrl,
                    tunnelsActive: this.playitTunnelsDetected
                },
                connections: {
                    local: {
                        java: `localhost:${this.javaPort}`,
                        bedrock: `localhost:${this.bedrockPort}`
                    },
                    network: {
                        java: `${this.localIP}:${this.javaPort}`,
                        bedrock: `${this.localIP}:${this.bedrockPort}`
                    },
                    playit: this.playitInstalled ? {
                        java: this.playitAddresses.java,
                        bedrock: this.playitAddresses.bedrock,
                        note: "Playit.gg tunneling"
                    } : null
                }
            });
        });

        this.app.post('/start', (req, res) => {
            if (this.serverStatus === 'starting' || this.serverStatus === 'online') {
                return res.json({
                    success: false,
                    message: 'Server is already starting or running'
                });
            }

            this.startMinecraftServer();
            res.json({
                success: true,
                message: 'Server is starting...',
                status: 'starting'
            });
        });

        this.app.post('/stop', (req, res) => {
            if (this.serverStatus === 'offline') {
                return res.json({
                    success: false,
                    message: 'Server is already offline'
                });
            }

            this.stopMinecraftServer();
            res.json({
                success: true,
                message: 'Server is stopping...',
                status: 'stopping'
            });
        });

        this.app.post('/command', (req, res) => {
            const { command } = req.body;
            if (this.serverStatus !== 'online') {
                return res.json({
                    success: false,
                    message: 'Server must be online to send commands'
                });
            }

            this.executeCommand(command);
            res.json({
                success: true,
                message: `Command executed: ${command}`
            });
        });
    }

    // UPDATED: Use configuration values
    setupServerProperties() {
        const propertiesPath = path.join(this.serverPath, 'server.properties');
        const config = this.config.server;

        const properties = `
server-ip=0.0.0.0
server-port=${this.javaPort}
level-seed=${config.seed || ''}
gamemode=${config.gamemode || 'survival'}
difficulty=${config.difficulty || 'easy'}
max-players=${config.maxPlayers || 20}
motd=${config.description || 'Crossplay Minecraft Server - Friends Welcome!'}
server-name=CrossplayServer
online-mode=${config.onlineMode || false}
enforce-whitelist=${config.enableWhitelist || false}
view-distance=${config.viewDistance || 10}
simulation-distance=${config.simulationDistance || 10}
enable-query=true
query.port=${this.javaPort}
level-name=${config.levelName || 'world'}
allow-nether=${config.allowNether !== false}
allow-end=${config.allowEnd !== false}
enable-command-block=${config.enableCommandBlock !== false}
spawn-protection=${config.spawnProtection || 0}
pvp=${config.pvp !== false}
require-resource-pack=${config.forceResourcePack || false}
        `.trim();

        if (!fs.existsSync(this.serverPath)) {
            fs.mkdirSync(this.serverPath, { recursive: true });
        }

        fs.writeFileSync(propertiesPath, properties);

        const eulaPath = path.join(this.serverPath, 'eula.txt');
        fs.writeFileSync(eulaPath, 'eula=true');

        this.broadcastLog('📝 Server properties updated from configuration', 'info');
    }

    parseMinecraftLog(message) {
        // Player join/leave events
        if (message.includes('joined the game')) {
            const playerName = message.match(/(\w+) joined the game/)?.[1];
            return { type: 'player', message: `🟢 ${playerName} joined the game`, original: message };
        }

        if (message.includes('left the game')) {
            const playerName = message.match(/(\w+) left the game/)?.[1];
            return { type: 'player', message: `🔴 ${playerName} left the game`, original: message };
        }

        // Chat messages
        if (message.includes('<') && message.includes('>')) {
            return { type: 'player', message: `💬 ${message}`, original: message };
        }

        // Server startup events
        if (message.includes('Starting minecraft server version')) {
            return { type: 'success', message: `🚀 ${message}`, original: message };
        }

        if (message.includes('Done (') && message.includes('For help, type "help"')) {
            return { type: 'success', message: `✅ Server startup complete! ${message}`, original: message };
        }

        // World generation
        if (message.includes('Preparing spawn area') || message.includes('Preparing level')) {
            return { type: 'world', message: `🌍 ${message}`, original: message };
        }

        if (message.includes('Time elapsed:')) {
            return { type: 'world', message: `⏱️ ${message}`, original: message };
        }

        // Plugin loading
        if (message.includes('Loading') && message.includes('plugin')) {
            return { type: 'info', message: `🔌 ${message}`, original: message };
        }

        if (message.includes('Enabling') && message.includes('plugin')) {
            return { type: 'success', message: `✅ ${message}`, original: message };
        }

        // Geyser specific
        if (message.includes('Geyser') && message.includes('Started Geyser')) {
            return { type: 'success', message: `🔗 Crossplay bridge (Geyser) is ONLINE!`, original: message };
        }

        // ViaVersion specific
        if (message.includes('ViaVersion') && message.includes('enabled')) {
            return { type: 'success', message: `🔄 Multi-version support (ViaVersion) is ONLINE!`, original: message };
        }

        // Errors
        if (message.includes('ERROR') || message.includes('SEVERE')) {
            return { type: 'error', message: `❌ ${message}`, original: message };
        }

        // Warnings
        if (message.includes('WARN')) {
            return { type: 'warn', message: `⚠️ ${message}`, original: message };
        }

        // Default
        return { type: 'info', message: message, original: message };
    }

    // UPDATED: Start server with seed change detection
    startMinecraftServer() {
        if (this.minecraftProcess) {
            this.broadcastLog('⚠️ Server already running', 'warn');
            return;
        }

        // Check for seed changes before starting
        const seedCheck = this.checkSeedChange();

        if (seedCheck.shouldCreateNew) {
            if (seedCheck.reason === "seed_changed") {
                this.broadcastLog(`🎉 New world will be generated with seed: ${this.config.server.seed}`, 'success');
                this.broadcastLog(`📦 Previous world backed up as: ${seedCheck.backupPath}`, 'info');
            } else if (seedCheck.reason === "no_world_exists") {
                this.broadcastLog(`🆕 Generating new world...`, 'success');
            }
        }

        this.serverStatus = 'starting';
        this.serverReady = false;
        this.startTime = Date.now();

        this.broadcastLog('🚀 STARTING MINECRAFT CROSSPLAY SERVER', 'success');
        this.broadcastLog(`🏠 Local IP: ${this.localIP}`, 'info');
        this.broadcastLog(`🌐 Public IP: ${this.publicIP || 'Detecting...'}`, 'info');

        // Log current configuration
        const config = this.config.server;
        this.broadcastLog(`🎮 Game mode: ${config.gamemode}, Difficulty: ${config.difficulty}`, 'info');
        this.broadcastLog(`👥 Max players: ${config.maxPlayers}`, 'info');
        if (config.seed) {
            this.broadcastLog(`🌱 World seed: ${config.seed}`, 'info');
        }

        if (this.playitInstalled && this.config.playit.autoStart) {
            this.broadcastLog('🌐 Playit.gg detected - Starting public tunnels...', 'success');
            this.startPlayitTunnel();
        } else {
            this.broadcastLog('⚠️ Playit.gg not installed - Server will only be available locally/LAN', 'warn');
        }

        this.broadcastLog('⏳ Please wait while server initializes...', 'info');

        // Use config values for memory
        const performance = this.config.performance;
        const javaArgs = [
            `-Xmx${performance.maxMemory}`,
            `-Xms${performance.minMemory}`,
            '-XX:+UseG1GC',
            '-XX:+UnlockExperimentalVMOptions',
            '-XX:MaxGCPauseMillis=100',
            '-jar',
            this.jarFile,
            'nogui'
        ];

        this.minecraftProcess = spawn('java', javaArgs, {
            cwd: this.serverPath,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.minecraftProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            const parsedLog = this.parseMinecraftLog(message);
            this.broadcastLog(parsedLog.message, parsedLog.type);

            if (message.includes('Done (') && message.includes('For help, type "help"')) {
                this.serverStatus = 'online';
                this.serverReady = true;
                this.markWorldAsGenerated(); // Mark world as generated when server is ready
                this.broadcastLog('🎉 SERVER IS NOW ONLINE! Friends can join!', 'success');
                this.displayConnectionInfo();
            }
        });

        this.minecraftProcess.stderr.on('data', (data) => {
            const error = data.toString().trim();
            this.broadcastLog(`💥 Error: ${error}`, 'error');
        });

        this.minecraftProcess.on('close', (code) => {
            this.broadcastLog(`⏹️ Minecraft server exited with code ${code}`, code === 0 ? 'info' : 'error');
            this.minecraftProcess = null;
            this.serverStatus = 'offline';
            this.serverReady = false;
            this.startTime = null;

            this.resetPlayitState();
            this.stopPlayitTunnel();

            if (code !== 0) {
                this.broadcastLog('💥 Server crashed! Check the error messages above.', 'error');
            } else {
                this.broadcastLog('✅ Server stopped normally.', 'success');
            }
        });
    }

    displayConnectionInfo() {
        this.broadcastLog('🎮 MINECRAFT CROSSPLAY SERVER IS ONLINE! 🎮', 'success');
        this.broadcastLog(`📱 Java Edition Local: localhost:${this.javaPort}`, 'info');
        this.broadcastLog(`🎯 Bedrock Edition Local: localhost:${this.bedrockPort}`, 'info');
        this.broadcastLog(`🏘️ Network Java: ${this.localIP}:${this.javaPort}`, 'info');
        this.broadcastLog(`🏘️ Network Bedrock: ${this.localIP}:${this.bedrockPort}`, 'info');

        if (this.playitAddresses.java) {
            this.broadcastLog(`🌐 Public Java (Playit): ${this.playitAddresses.java}`, 'success');
        }
        if (this.playitAddresses.bedrock) {
            this.broadcastLog(`🌐 Public Bedrock (Playit): ${this.playitAddresses.bedrock}`, 'success');
        }

        this.broadcastLog('📋 Share these addresses with friends!', 'success');
    }

    stopMinecraftServer() {
        if (this.minecraftProcess) {
            this.serverStatus = 'stopping';
            this.broadcastLog('⏹️ Stopping Minecraft server...', 'info');

            this.resetPlayitState();
            this.stopPlayitTunnel();

            this.minecraftProcess.stdin.write('stop\n');
        }
    }

    executeCommand(command) {
        if (this.minecraftProcess && this.serverReady) {
            this.minecraftProcess.stdin.write(`${command}\n`);
            this.broadcastLog(`📤 Command executed: ${command}`, 'info');
        }
    }

    start(port = 3000) {
        this.server.listen(port, '0.0.0.0', () => {
            this.broadcastLog(`🚀 Minecraft Server Manager running on port ${port}`, 'success');
            this.broadcastLog(`📱 Local access: http://localhost:${port}`, 'info');
            this.broadcastLog(`🌐 Network access: http://${this.localIP}:${port}`, 'info');
        });
    }
}

const manager = new MinecraftCrossplayServer();
manager.start();
