const fs = require('fs');
const path = require('path');
const FileUtils = require('../utils/FileUtils');

class WorldService {
    constructor(configService) {
        this.configService = configService;
    }

    async checkSeedChange() {
        const config = this.configService.getConfig();
        const currentSeed = config.server.seed || "";
        const lastUsedSeed = config.world?.lastUsedSeed || "";
        const worldPath = path.join('./minecraft-server', config.server.levelName || 'world');
        const worldExists = fs.existsSync(worldPath);

        // If no world exists, create new one
        if (!worldExists) {
            const message = currentSeed
                ? `🆕 New world will use seed: ${currentSeed}`
                : `🎲 New world will use random seed`;

            this.updateWorldConfig(currentSeed);
            return { shouldCreateNew: true, reason: "no_world_exists", message };
        }

        // If seeds are different, backup and create new
        if (currentSeed !== lastUsedSeed) {
            const backupResult = await this.backupExistingWorld();
            if (backupResult.success) {
                this.updateWorldConfig(currentSeed);
                return {
                    shouldCreateNew: true,
                    reason: "seed_changed",
                    message: `🔄 Seed changed! Previous world backed up as: ${backupResult.backupPath}`
                };
            } else {
                return {
                    shouldCreateNew: false,
                    reason: "backup_failed",
                    message: `⚠️ Failed to backup world. Keeping existing world to prevent data loss.`
                };
            }
        }

        // Seeds are the same
        return {
            shouldCreateNew: false,
            reason: "seed_unchanged",
            message: `✅ Using existing world (seed unchanged)`
        };
    }

    async backupExistingWorld() {
        try {
            const config = this.configService.getConfig();
            const worldName = config.server.levelName || 'world';
            const worldPath = path.join('./minecraft-server', worldName);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `${worldName}_backup_${timestamp}`;
            const backupPath = path.join('./minecraft-server', backupName);

            // Create backup
            await FileUtils.copyDirectory(worldPath, backupPath);

            // Remove original world
            await FileUtils.removeDirectory(worldPath);

            return { success: true, backupPath: backupName };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    updateWorldConfig(seed) {
        const config = this.configService.getConfig();

        if (!config.world) {
            config.world = {};
        }

        config.world.lastUsedSeed = seed;
        config.world.currentSeed = seed;
        config.world.worldGenerated = false;

        this.configService.updateConfig(config);
    }

    markWorldAsGenerated() {
        const config = this.configService.getConfig();

        if (!config.world) {
            config.world = {};
        }

        config.world.worldGenerated = true;
        this.configService.updateConfig(config);
    }
}

module.exports = WorldService;
