const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 타일 요청 처리
router.get('/:tileSource/tile_:x_:y.jpg', (req, res) => {
    const { tileSource, x, y } = req.params;
    console.log('타일 요청:', { tileSource, x, y });

    // 파라미터 파싱
    const params = {
        x: parseInt(x),
        y: parseInt(y)
    };

    // 파라미터 검증
    if (Object.values(params).some(isNaN)) {
        console.error('잘못된 타일 파라미터:', params);
        return res.status(400).send('Invalid tile parameters');
    }

    // 타일 파일 경로
    const tilePath = path.join(__dirname, '../../tiles', tileSource, `tile_0_${params.x}_${params.y}.jpg`);
    console.log('타일 경로:', tilePath);

    try {
        if (fs.existsSync(tilePath)) {
            res.sendFile(tilePath);
        } else {
            // 디버깅용 디렉토리 내용 출력
            const tileDir = path.dirname(tilePath);
            if (fs.existsSync(tileDir)) {
                const files = fs.readdirSync(tileDir)
                    .filter(f => f.startsWith('tile_0_'))
                    .slice(0, 5);
                console.log('사용 가능한 타일 예시:', files);
            }
            res.status(404).send('Tile not found');
        }
    } catch (error) {
        console.error('타일 전송 오류:', error);
        res.status(500).send('Error serving tile');
    }
});

module.exports = router;
