const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 타일 요청 처리
router.get('/:tileSource/tile_:level_:x_:y.jpg', (req, res) => {
    const { tileSource, level, x, y } = req.params;
    console.log('타일 요청 파라미터:', { tileSource, level, x, y });

    // 모든 파라미터가 유효한지 확인
    if (!tileSource || !level || !x || !y) {
        console.log('잘못된 타일 요청 파라미터');
        return res.status(400).send('Invalid tile parameters');
    }

    const tilePath = path.join(__dirname, '../../tiles', tileSource, `tile_${level}_${x}_${y}.jpg`);
    console.log('요청된 타일 경로:', tilePath);

    try {
        if (fs.existsSync(tilePath)) {
            res.sendFile(tilePath);
        } else {
            // 디버깅을 위한 디렉토리 내용 출력 (첫 10개만)
            const tileDir = path.dirname(tilePath);
            if (fs.existsSync(tileDir)) {
                const files = fs.readdirSync(tileDir);
                console.log('디렉토리 내용:', files.slice(0, 10), '... 외', files.length - 10, '개');
            }
            
            console.log('타일 없음:', tilePath);
            res.status(404).send('Tile not found');
        }
    } catch (error) {
        console.error('타일 전송 오류:', error);
        res.status(500).send('Error serving tile');
    }
});

module.exports = router;
