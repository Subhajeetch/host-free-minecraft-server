const { spawn } = require('child_process');
const fs = require('fs');
const EventEmitter = require('events');

class PlayitService extends EventEmitter {
    constructor() {
        super();
        this.playitProcess = null;
        this.playitInstalled = false;
        this.playitPath = null;
        this.addresses = { java: null, bedrock: null };
        this.setupUrl = null;
        this.tunnelsActive = false;
        this.lastOutput = '';
    }

    checkInstallation() {
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
                    this.emit('log', `✅ Playit.gg found at: ${playitPath}`, 'success');
                    return true;
                }
            } catch (error) {
                // Continue checking other paths
            }
        }

        this.emit('log', '❌ Playit.gg is not installed - Server won\'t be available to the internet', 'warn');
        this.emit('log', '📥 Download Playit.gg from: https://playit.gg/download', 'info');
        return false;
    }

    commandExists(command) {
        try {
            require('child_process').execSync(`${command} --version`, { stdio: 'ignore' });
            return true;
        } catch (error) {
            return false;
        }
    }

    async start() {
        if (!this.playitInstalled) {
            this.emit('log', '⚠️ Playit.gg not installed - skipping tunnel creation', 'warn');
            return;
        }

        if (this.playitProcess) {
            this.emit('log', '⚠️ Playit tunnel already running', 'warn');
            return;
        }

        this.emit('log', '🌐 Starting Playit.gg tunnels for public access...', 'info');

        try {
            this.playitProcess = spawn(this.playitPath, [], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.playitProcess.stdout.on('data', (data) => {
                this.handleOutput(data.toString().trim());
            });

            this.playitProcess.stderr.on('data', (data) => {
                const error = data.toString().trim();
                this.emit('log', `[PLAYIT ERROR]: ${error}`, 'error');
            });

            this.playitProcess.on('close', (code) => {
                this.emit('log', `🌐 Playit tunnel exited with code ${code}`, code === 0 ? 'info' : 'error');
                this.reset();
            });

        } catch (error) {
            this.emit('log', `❌ Failed to start Playit tunnel: ${error.message}`, 'error');
        }
    }

    handleOutput(output) {
        if (output !== this.lastOutput) {
            this.lastOutput = output;

            const setupUrlMatch = output.match(/Visit link to setup (https:\/\/playit\.gg\/claim\/[a-zA-Z0-9]+)/);
            if (setupUrlMatch) {
                this.setupUrl = setupUrlMatch[1];
                this.emit('log', '[PLAYIT]: Setup required - Click "Setup Instructions" button for help', 'warn');
            }

            if (output.includes('Program approved')) {
                this.emit('log', '[PLAYIT]: Program approved - Setting up tunnels...', 'success');
            }

            const tunnelsFound = this.parseOutput(output);
            if (tunnelsFound && !this.tunnelsActive) {
                this.tunnelsActive = true;
                this.emit('log', '[PLAYIT]: Tunnels detected and active!', 'success');
            }
        }
    }

    parseOutput(output) {
        const lines = output.split('\n');
        let tunnelsFound = false;

        for (const line of lines) {
            const tunnelMatch = line.match(/^(.+?)\s+=>\s+127\.0\.0\.1:(\d+)/);
            if (tunnelMatch) {
                const address = tunnelMatch[1].trim();
                const port = tunnelMatch[2];
                tunnelsFound = true;

                if (port === '25565') {
                    if (this.addresses.java !== address) {
                        this.addresses.java = address;
                        this.emit('log', `🎮 Java tunnel ready: ${address}`, 'success');
                    }
                } else if (port === '19132') {
                    if (this.addresses.bedrock !== address) {
                        this.addresses.bedrock = address;
                        this.emit('log', `📱 Bedrock tunnel ready: ${address}`, 'success');
                    }
                }
            }
        }

        return tunnelsFound;
    }

    async stop() {
        if (this.playitProcess) {
            this.emit('log', '🌐 Stopping Playit tunnels...', 'info');
            this.playitProcess.kill('SIGTERM');
            this.reset();
        }
    }

    reset() {
        this.playitProcess = null;
        this.addresses.java = null;
        this.addresses.bedrock = null;
        this.tunnelsActive = false;
        this.setupUrl = null;
    }

    isInstalled() {
        return this.playitInstalled;
    }

    isRunning() {
        return this.playitProcess !== null;
    }

    getAddresses() {
        return this.addresses;
    }

    getSetupUrl() {
        return this.setupUrl;
    }

    areTunnelsActive() {
        return this.tunnelsActive;
    }
}

module.exports = PlayitService;
