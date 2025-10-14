const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const serverManager = req.app.locals.serverManager;
    res.json(serverManager.getStatus());
});

module.exports = router;
