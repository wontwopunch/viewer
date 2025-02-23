const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 타일 요청 처리
router.get('/:tileSource/tile_:x_:y.jpg', (req, res) => {
    const { tileSource, x, y } = req.params;
    console.log('타일 요청:', { tileSource, x, y });

    // 좌표 파싱
    let coords = { x: 0, y: 0 };
    
    try {
        // x_y 형식으로 들어오는 경우
        if (y.includes('_')) {
            const [yX, yY] = y.split('_').map(Number);
            coords = { x: yX, y: yY };
        } else {
            // 정상적인 x, y 파라미터인 경우
            coords = {
                x: parseInt(x),
                y: parseInt(y)
            };
        }

        // 좌표 유효성 검사
        if (isNaN(coords.x) || isNaN(coords.y)) {
            console.error('잘못된 좌표:', coords);
            return res.status(400).send('Invalid coordinates');
        }

        // 타일 파일 경로
        const tilePath = path.join(__dirname, '../../tiles', tileSource, `tile_0_${coords.x}_${coords.y}.jpg`);
        console.log('타일 경로:', tilePath);

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
        console.error('타일 처리 오류:', error);
        res.status(500).send('Error processing tile request');
    }
});

module.exports = router;
