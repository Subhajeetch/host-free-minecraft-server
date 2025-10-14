class LogParser {
    parse(message) {
        // Player join/leave events
        if (message.includes('joined the game')) {
            const playerName = message.match(/(\w+) joined the game/)?.[1];
            return { type: 'player', message: `🟢 ${playerName} joined the game` };
        }

        if (message.includes('left the game')) {
            const playerName = message.match(/(\w+) left the game/)?.[1];
            return { type: 'player', message: `🔴 ${playerName} left the game` };
        }

        // Chat messages
        if (message.includes('<') && message.includes('>')) {
            return { type: 'player', message: `💬 ${message}` };
        }

        // Server startup events
        if (message.includes('Starting minecraft server version')) {
            return { type: 'success', message: `🚀 ${message}` };
        }

        if (message.includes('Done (') && message.includes('For help, type "help"')) {
            return { type: 'success', message: `✅ Server startup complete! ${message}` };
        }

        // World generation
        if (message.includes('Preparing spawn area') || message.includes('Preparing level')) {
            return { type: 'world', message: `🌍 ${message}` };
        }

        if (message.includes('Time elapsed:')) {
            return { type: 'world', message: `⏱️ ${message}` };
        }

        // Plugin loading
        if (message.includes('Loading') && message.includes('plugin')) {
            return { type: 'info', message: `🔌 ${message}` };
        }

        if (message.includes('Enabling') && message.includes('plugin')) {
            return { type: 'success', message: `✅ ${message}` };
        }

        // Geyser and ViaVersion
        if (message.includes('Geyser') && message.includes('Started Geyser')) {
            return { type: 'success', message: `🔗 Crossplay bridge (Geyser) is ONLINE!` };
        }

        if (message.includes('ViaVersion') && message.includes('enabled')) {
            return { type: 'success', message: `🔄 Multi-version support (ViaVersion) is ONLINE!` };
        }

        // Errors and warnings
        if (message.includes('ERROR') || message.includes('SEVERE')) {
            return { type: 'error', message: `❌ ${message}` };
        }

        if (message.includes('WARN')) {
            return { type: 'warn', message: `⚠️ ${message}` };
        }

        // Default
        return { type: 'info', message: message };
    }
}

module.exports = LogParser;
