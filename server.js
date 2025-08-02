const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class MinecraftCrossplayServer {
    constructor() {
        this.app = express();
        this.minecraftProcess = null;
        this.serverPath = './minecraft-server';
        this.jarFile = 'paper-server.jar';
        this.javaPort = 25565;
        this.bedrockPort = 19132;
        this.localIP = this.getLocalIP();
        this.publicIP = null;
        this.serverStatus = 'offline'; // offline, starting, online, stopping
        this.startTime = null;
        this.serverReady = false;

        this.setupExpress();
        this.setupRoutes();
        this.setupServerProperties();
        this.getPublicIP();
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
                    console.log(`🌐 Public IP detected: ${this.publicIP}`);
                });
            });

            req.on('error', (error) => {
                console.log('Could not detect public IP:', error.message);
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
                        note: "Port forwarding required"
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

    startMinecraftServer() {
        if (this.minecraftProcess) {
            console.log('⚠️  Server already running');
            return;
        }

        this.serverStatus = 'starting';
        this.serverReady = false;
        this.startTime = Date.now();

        console.log('\n' + '='.repeat(60));
        console.log('🚀 STARTING MINECRAFT CROSSPLAY SERVER');
        console.log('='.repeat(60));
        console.log('📡 Status: STARTING...');
        console.log(`🏠 Local IP: ${this.localIP}`);
        console.log(`🌐 Public IP: ${this.publicIP || 'Detecting...'}`);
        console.log('⏳ Please wait while server initializes...');
        console.log('='.repeat(60));

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
            console.log(`[MC]: ${message}`);

            // Check for server ready state
            if (message.includes('Done (') && message.includes('For help, type "help"')) {
                this.serverStatus = 'online';
                this.serverReady = true;
                console.log('\n' + '🎉'.repeat(20));
                console.log('✅ SERVER IS NOW ONLINE!');
                console.log('🎉'.repeat(20));
                this.displayConnectionInfo();
            }

            // Check for Geyser startup
            if (message.includes('Geyser') && message.includes('Started Geyser')) {
                console.log('🔗 Crossplay bridge (Geyser) is ONLINE!');
            }
        });

        this.minecraftProcess.stderr.on('data', (data) => {
            const error = data.toString().trim();
            console.error(`[MC ERROR]: ${error}`);
        });

        this.minecraftProcess.on('close', (code) => {
            console.log(`\n⏹️  Minecraft server exited with code ${code}`);
            this.minecraftProcess = null;
            this.serverStatus = 'offline';
            this.serverReady = false;
            this.startTime = null;

            if (code !== 0) {
                console.log('💥 Server crashed! Check the error messages above.');
            } else {
                console.log('✅ Server stopped normally.');
            }
        });
    }

    displayConnectionInfo() {
        console.log('\n' + '='.repeat(70));
        console.log('🎮 MINECRAFT CROSSPLAY SERVER IS ONLINE! 🎮');
        console.log('='.repeat(70));

        console.log('\n📱 JAVA EDITION CONNECTIONS:');
        console.log(`   🏠 Local: localhost:${this.javaPort}`);
        console.log(`   🏘️  Network: ${this.localIP}:${this.javaPort}`);
        if (this.publicIP && this.publicIP !== 'Unable to detect') {
            console.log(`   🌐 Internet: ${this.publicIP}:${this.javaPort} (requires port forwarding)`);
        }

        console.log('\n🎯 BEDROCK EDITION CONNECTIONS:');
        console.log(`   🏠 Local: localhost:${this.bedrockPort}`);
        console.log(`   🏘️  Network: ${this.localIP}:${this.bedrockPort}`);
        if (this.publicIP && this.publicIP !== 'Unable to detect') {
            console.log(`   🌐 Internet: ${this.publicIP}:${this.bedrockPort} (requires port forwarding)`);
        }

        console.log('\n🌐 Management Panel: http://localhost:3000');
        console.log('\n📋 FOR FRIENDS TO JOIN:');
        console.log('   1. Share your public IP with friends');
        console.log('   2. Set up port forwarding on your router');
        console.log('   3. Ports to forward: 25565 (Java) & 19132 (Bedrock)');
        console.log('='.repeat(70) + '\n');
    }

    stopMinecraftServer() {
        if (this.minecraftProcess) {
            this.serverStatus = 'stopping';
            console.log('\n⏹️  Stopping Minecraft server...');
            this.minecraftProcess.stdin.write('stop\n');
        }
    }

    executeCommand(command) {
        if (this.minecraftProcess && this.serverReady) {
            this.minecraftProcess.stdin.write(`${command}\n`);
            console.log(`[COMMAND]: ${command}`);
        }
    }

    start(port = 3000) {
        this.app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 Minecraft Server Manager running on port ${port}`);
            console.log(`📱 Local access: http://localhost:${port}`);
            console.log(`🌐 Network access: http://${this.localIP}:${port}`);
            console.log('='.repeat(50));
        });
    }
}

const manager = new MinecraftCrossplayServer();
manager.start();
