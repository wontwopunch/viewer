const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 타일 요청 처리
router.get('/:tileSource/tile_:x_:y.jpg', (req, res) => {
    const { tileSource, x, y } = req.params;

    // 타일 경로
    const tilePath = path.join(__dirname, '../tiles', tileSource, `tile_${x}_${y}.jpg`);

    // 타일이 존재하는지 확인
    if (fs.existsSync(tilePath)) {
        res.sendFile(tilePath);
    } else {
        res.status(404).send('Tile not found');
    }
});

module.exports = router;
