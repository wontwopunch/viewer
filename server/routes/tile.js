const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 타일 요청 처리
router.get('/:tileSource/tile_:x_:y.jpg', (req, res) => {
    const { tileSource, x, y } = req.params;
    console.log('타일 요청:', { tileSource, x, y });

    try {
        // 좌표를 숫자로 변환
        const tileX = parseInt(x);
        const tileY = parseInt(y);

        // 좌표 유효성 검사
        if (isNaN(tileX) || isNaN(tileY)) {
            console.error('잘못된 좌표:', { x, y });
            return res.status(400).send('Invalid coordinates');
        }

        // 타일 파일 경로
        const tilePath = path.join(__dirname, '../../tiles', tileSource, `tile_${tileX}_${tileY}.jpg`);
        console.log('찾는 타일:', tilePath);

        if (fs.existsSync(tilePath)) {
            res.sendFile(tilePath);
        } else {
            // 디버깅용 디렉토리 내용 출력
            const tileDir = path.dirname(tilePath);
            if (fs.existsSync(tileDir)) {
                const files = fs.readdirSync(tileDir)
                    .filter(f => f.startsWith('tile_'))
                    .slice(0, 5);
                console.log('사용 가능한 타일:', files);
            }
            res.status(404).send('Tile not found');
        }
    } catch (error) {
        console.error('타일 처리 오류:', error);
        res.status(500).send('Error processing tile request');
    }
});

module.exports = router;
