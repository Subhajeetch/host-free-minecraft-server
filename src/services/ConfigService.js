const fs = require('fs');
const path = require('path');
const defaultConfig = require('../../config/default-config');

class ConfigService {
    constructor() {
        this.config = null;
        this.configPath = './config.json';
    }

    async loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                this.config = JSON.parse(configData);

                // Migrate existing config if needed
                this.migrateConfig();

                console.log('✅ Configuration loaded successfully');
            } else {
                console.log('⚠️ Config file not found, creating default config.json');
                this.config = defaultConfig;
                this.saveConfig();
            }
        } catch (error) {
            console.log(`❌ Error loading config: ${error.message}`);
            console.log('📝 Using default configuration');
            this.config = defaultConfig;
        }
    }

    migrateConfig() {
        let needsSave = false;

        // Migrate world tracking if not present
        if (!this.config.world) {
            this.config.world = {
                currentSeed: this.config.server?.seed || "",
                lastUsedSeed: this.config.server?.seed || "",
                worldGenerated: true
            };
            needsSave = true;
        }

        if (needsSave) {
            this.saveConfig();
            console.log('🔄 Config migrated to support new features');
        }
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 4));
            console.log('💾 Configuration saved successfully');
            return true;
        } catch (error) {
            console.log(`❌ Failed to save config: ${error.message}`);
            return false;
        }
    }

    getConfig() {
        return this.config;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.saveConfig();
    }

    generateServerProperties() {
        const config = this.config.server;
        const propertiesTemplate = fs.readFileSync(
            path.join(__dirname, '../../config/server-properties.template'),
            'utf8'
        );

        return propertiesTemplate
            .replace('{SEED}', config.seed || '')
            .replace('{GAMEMODE}', config.gamemode || 'survival')
            .replace('{DIFFICULTY}', config.difficulty || 'easy')
            .replace('{MAX_PLAYERS}', config.maxPlayers || 20)
            .replace('{MOTD}', config.description || 'Crossplay Minecraft Server')
            .replace('{ONLINE_MODE}', config.onlineMode || false)
            .replace('{WHITELIST}', config.enableWhitelist || false)
            .replace('{VIEW_DISTANCE}', config.viewDistance || 10)
            .replace('{SIMULATION_DISTANCE}', config.simulationDistance || 10)
            .replace('{LEVEL_NAME}', config.levelName || 'world')
            .replace('{ALLOW_NETHER}', config.allowNether !== false)
            .replace('{ALLOW_END}', config.allowEnd !== false)
            .replace('{COMMAND_BLOCK}', config.enableCommandBlock !== false)
            .replace('{SPAWN_PROTECTION}', config.spawnProtection || 0)
            .replace('{PVP}', config.pvp !== false)
            .replace('{RESOURCE_PACK}', config.forceResourcePack || false);
    }
}

module.exports = ConfigService;
