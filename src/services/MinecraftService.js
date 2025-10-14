const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const LogParser = require('../utils/LogParser');

class MinecraftService extends EventEmitter {
    constructor(configService, playitService) {
        super();
        this.configService = configService;
        this.playitService = playitService;
        this.minecraftProcess = null;
        this.serverPath = './minecraft-server';
        this.jarFile = 'paper-server.jar';
        this.logParser = new LogParser();
    }

    async start() {
        if (this.minecraftProcess) {
            throw new Error('Server already running');
        }

        this.emit('statusChange', 'starting');
        this.emit('log', '🚀 STARTING MINECRAFT CROSSPLAY SERVER', 'success');

        // Setup server properties
        this.setupServerProperties();

        // Log configuration info
        this.logServerConfig();

        // Start the server process
        await this.startProcess();
    }

    setupServerProperties() {
        const propertiesPath = path.join(this.serverPath, 'server.properties');
        const properties = this.configService.generateServerProperties();

        if (!fs.existsSync(this.serverPath)) {
            fs.mkdirSync(this.serverPath, { recursive: true });
        }

        fs.writeFileSync(propertiesPath, properties);

        // Create EULA file
        const eulaPath = path.join(this.serverPath, 'eula.txt');
        fs.writeFileSync(eulaPath, 'eula=true');

        this.emit('log', '📝 Server properties updated from configuration', 'info');
    }

    logServerConfig() {
        const config = this.configService.getConfig().server;
        this.emit('log', `🎮 Game mode: ${config.gamemode}, Difficulty: ${config.difficulty}`, 'info');
        this.emit('log', `👥 Max players: ${config.maxPlayers}`, 'info');

        if (config.seed) {
            this.emit('log', `🌱 World seed: ${config.seed}`, 'info');
        }
    }

    async startProcess() {
        const performance = this.configService.getConfig().performance;
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

        this.emit('log', '⏳ Please wait while server initializes...', 'info');

        this.minecraftProcess = spawn('java', javaArgs, {
            cwd: this.serverPath,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.minecraftProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            const parsedLog = this.logParser.parse(message);
            this.emit('log', parsedLog.message, parsedLog.type);

            if (message.includes('Done (') && message.includes('For help, type "help"')) {
                this.emit('statusChange', 'online');
                this.emit('log', '🎉 SERVER IS NOW ONLINE! Friends can join!', 'success');
            }
        });

        this.minecraftProcess.stderr.on('data', (data) => {
            const error = data.toString().trim();
            this.emit('log', `💥 Error: ${error}`, 'error');
        });

        this.minecraftProcess.on('close', (code) => {
            this.emit('log', `⏹️ Minecraft server exited with code ${code}`, code === 0 ? 'info' : 'error');
            this.minecraftProcess = null;
            this.emit('statusChange', 'offline');

            if (code !== 0) {
                this.emit('log', '💥 Server crashed! Check the error messages above.', 'error');
            } else {
                this.emit('log', '✅ Server stopped normally.', 'success');
            }
        });
    }

    async stop() {
        if (this.minecraftProcess) {
            this.emit('statusChange', 'stopping');
            this.emit('log', '⏹️ Stopping Minecraft server...', 'info');
            this.minecraftProcess.stdin.write('stop\n');
        }
    }

    executeCommand(command) {
        if (this.minecraftProcess) {
            this.minecraftProcess.stdin.write(`${command}\n`);
        }
    }

    isRunning() {
        return this.minecraftProcess !== null;
    }
}

module.exports = MinecraftService;
