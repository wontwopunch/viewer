const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 타일 요청 처리
router.get('/:tileSource/tile_:coords.jpg', (req, res) => {
    const { tileSource, coords } = req.params;
    console.log('타일 요청:', { tileSource, coords });

    try {
        // 좌표 파싱 (x_y 형식)
        const [x, y] = coords.split('_').map(str => parseInt(str, 10));
        
        // 디버그 정보 출력
        console.log('파싱된 좌표:', { x, y });

        // 좌표 유효성 검사
        if (isNaN(x) || isNaN(y)) {
            console.error('잘못된 좌표:', coords);
            return res.status(400).send('Invalid coordinates');
        }

        // 타일 파일 경로
        const tilePath = path.join(__dirname, '../../tiles', tileSource, `tile_${x}_${y}.jpg`);
        console.log('찾는 타일:', tilePath);

        if (fs.existsSync(tilePath)) {
            // 타일 찾음
            console.log('타일 찾음:', tilePath);
            res.sendFile(tilePath);
        } else {
            // 디렉토리 내용 확인
            const tileDir = path.dirname(tilePath);
            if (fs.existsSync(tileDir)) {
                const files = fs.readdirSync(tileDir)
                    .filter(f => f.startsWith('tile_'))
                    .slice(0, 5);
                console.log('디렉토리 내 타일 예시:', files);
                console.log('요청된 타일 없음:', path.basename(tilePath));
            }
            res.status(404).send('Tile not found');
        }
    } catch (error) {
        console.error('타일 처리 오류:', error);
        res.status(500).send('Error processing tile request');
    }
});

module.exports = router;
