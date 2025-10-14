const express = require('express');
const router = express.Router();

router.post('/start', async (req, res) => {
    try {
        const serverManager = req.app.locals.serverManager;
        await serverManager.startServer();
        res.json({
            success: true,
            message: 'Server is starting...',
            status: 'starting'
        });
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
});

router.post('/stop', async (req, res) => {
    try {
        const serverManager = req.app.locals.serverManager;
        await serverManager.stopServer();
        res.json({
            success: true,
            message: 'Server is stopping...',
            status: 'stopping'
        });
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
});

router.post('/command', (req, res) => {
    try {
        const { command } = req.body;
        const serverManager = req.app.locals.serverManager;

        serverManager.executeCommand(command);
        res.json({
            success: true,
            message: `Command executed: ${command}`
        });
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
