const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const serverManager = req.app.locals.serverManager;
    res.json({
        success: true,
        config: serverManager.configService.getConfig()
    });
});

router.post('/', (req, res) => {
    try {
        const { config } = req.body;
        const serverManager = req.app.locals.serverManager;

        if (!config) {
            return res.json({
                success: false,
                message: 'No configuration data provided'
            });
        }

        const saved = serverManager.configService.updateConfig(config);

        if (saved) {
            res.json({
                success: true,
                message: 'Configuration updated successfully. Restart server to apply changes.',
                config: serverManager.configService.getConfig()
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

module.exports = router;
