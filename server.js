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
        this.serverPath = './minecraft-server';
        this.jarFile = 'paper-server.jar';
        this.javaPort = 25565;
        this.bedrockPort = 19132;
        this.localIP = this.getLocalIP();
        this.publicIP = null;
        this.serverStatus = 'offline';
        this.startTime = null;
        this.serverReady = false;
        this.logs = []; // Store recent logs
        this.maxLogs = 1000; // Maximum logs to keep in memory

        this.setupExpress();
        this.setupSocketIo();
        this.setupRoutes();
        this.setupServerProperties();
        this.getPublicIP();
    }

    setupSocketIo() {
        this.io.on('connection', (socket) => {
            console.log('📱 Web client connected');

            // Send recent logs to newly connected client
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
            type: type, // info, warn, error, success, player, world
            time: new Date().toLocaleTimeString()
        };

        // Add to logs array
        this.logs.push(logEntry);

        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Broadcast to all connected web clients
        this.io.emit('new-log', logEntry);

        // Also log to console
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
                connections: {
                    local: {
                        java: `localhost:${this.javaPort}`,
                        bedrock: `localhost:${this.bedrockPort}`
                    },
                    network: {
                        java: `${this.localIP}:${this.javaPort}`,
                        bedrock: `${this.localIP}:${this.bedrockPort}`
                    },
                    internet: this.publicIP !== 'Unable to detect' ? {
                        java: `${this.publicIP}:${this.javaPort}`,
                        bedrock: `${this.publicIP}:${this.bedrockPort}`,
                        note: "Port forwarding or ngrok required"
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

    setupServerProperties() {
        const propertiesPath = path.join(this.serverPath, 'server.properties');
        const properties = `
server-ip=0.0.0.0
server-port=${this.javaPort}
gamemode=survival
difficulty=easy
max-players=20
motd=Crossplay Minecraft Server - Friends Welcome!
server-name=CrossplayServer
online-mode=false
enforce-whitelist=false
view-distance=10
simulation-distance=10
enable-query=true
query.port=${this.javaPort}
level-name=world
allow-nether=true
enable-command-block=true
spawn-protection=0
require-resource-pack=false
        `.trim();

        if (!fs.existsSync(this.serverPath)) {
            fs.mkdirSync(this.serverPath, { recursive: true });
        }

        fs.writeFileSync(propertiesPath, properties);

        const eulaPath = path.join(this.serverPath, 'eula.txt');
        fs.writeFileSync(eulaPath, 'eula=true');
    }

    parseMinecraftLog(message) {
        // Parse different types of Minecraft logs and categorize them

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

    startMinecraftServer() {
        if (this.minecraftProcess) {
            this.broadcastLog('⚠️ Server already running', 'warn');
            return;
        }

        this.serverStatus = 'starting';
        this.serverReady = false;
        this.startTime = Date.now();

        this.broadcastLog('🚀 STARTING MINECRAFT CROSSPLAY SERVER', 'success');
        this.broadcastLog(`🏠 Local IP: ${this.localIP}`, 'info');
        this.broadcastLog(`🌐 Public IP: ${this.publicIP || 'Detecting...'}`, 'info');
        this.broadcastLog('⏳ Please wait while server initializes...', 'info');

        const javaArgs = [
            '-Xmx3G',
            '-Xms1G',
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

            // Parse and broadcast the log
            const parsedLog = this.parseMinecraftLog(message);
            this.broadcastLog(parsedLog.message, parsedLog.type);

            // Check for server ready state
            if (message.includes('Done (') && message.includes('For help, type "help"')) {
                this.serverStatus = 'online';
                this.serverReady = true;
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

            if (code !== 0) {
                this.broadcastLog('💥 Server crashed! Check the error messages above.', 'error');
            } else {
                this.broadcastLog('✅ Server stopped normally.', 'success');
            }
        });
    }

    displayConnectionInfo() {
        this.broadcastLog('🎮 MINECRAFT CROSSPLAY SERVER IS ONLINE! 🎮', 'success');
        this.broadcastLog(`📱 Java Edition: localhost:${this.javaPort}`, 'info');
        this.broadcastLog(`🎯 Bedrock Edition: localhost:${this.bedrockPort}`, 'info');

        if (this.publicIP && this.publicIP !== 'Unable to detect') {
            this.broadcastLog(`🌐 Internet Java: ${this.publicIP}:${this.javaPort}`, 'info');
            this.broadcastLog(`🌐 Internet Bedrock: ${this.publicIP}:${this.bedrockPort}`, 'info');
            this.broadcastLog('📋 Share these addresses with friends!', 'success');
        }
    }

    stopMinecraftServer() {
        if (this.minecraftProcess) {
            this.serverStatus = 'stopping';
            this.broadcastLog('⏹️ Stopping Minecraft server...', 'info');
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
