const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 타일 요청 처리
router.get('/:tileSource/tile_:level_:x_:y.jpg', async (req, res) => {
    const { tileSource, level, x, y } = req.params;
    console.log('타일 요청 파라미터:', { tileSource, level, x, y });

    const tilePath = path.join(__dirname, '../../tiles', tileSource, `tile_${level}_${x}_${y}.jpg`);
    console.log('요청된 타일 경로:', tilePath);

    try {
        if (fs.existsSync(tilePath)) {
            res.sendFile(tilePath);
        } else {
            console.log('타일 없음:', tilePath);
            res.status(404).send('Tile not found');
        }
    } catch (error) {
        console.error('타일 전송 오류:', error);
        res.status(500).send('Error serving tile');
    }
});

module.exports = router;
