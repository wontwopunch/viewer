const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 타일 요청 처리
router.get('/:tileSource/tile_:x_:y.jpg', (req, res) => {
    const { tileSource, x, y } = req.params;
    console.log('타일 요청 파라미터:', { tileSource, x, y });  // 추가

    const tilePath = path.join(__dirname, '../../tiles', tileSource, `tile_${x}_${y}.jpg`);
    console.log('요청된 타일 경로:', tilePath);

    // 디렉토리 존재 확인
    const tileDir = path.join(__dirname, '../../tiles', tileSource);
    console.log('타일 디렉토리 존재:', fs.existsSync(tileDir));  // 추가
    
    // 디렉토리 내용 출력
    if (fs.existsSync(tileDir)) {
        console.log('디렉토리 내용:', fs.readdirSync(tileDir));  // 추가
    }

    // 타일이 존재하는지 확인
    if (fs.existsSync(tilePath)) {
        console.log('타일 파일 찾음');  // 추가
        res.sendFile(tilePath);
    } else {
        console.log('타일 없음:', tilePath);
        res.status(404).send('Tile not found');
    }
});

module.exports = router;
