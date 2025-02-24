const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const router = express.Router();

// 타일 요청 처리
router.get('/:tileSource/tile_:coords.jpg', async (req, res) => {
    const { tileSource, coords } = req.params;
    console.log('타일 요청:', { tileSource, coords });

    try {
        // 좌표 파싱
        const [x, y] = coords.split('_').map(str => parseInt(str, 10));
        console.log('파싱된 좌표:', { x, y });

        // 좌표 유효성 검사
        if (isNaN(x) || isNaN(y)) {
            console.error('잘못된 좌표:', coords);
            return res.status(400).send('Invalid coordinates');
        }

        // 타일 파일 경로
        const tilePath = path.join(__dirname, '../../tiles', tileSource, `tile_${x}_${y}.jpg`);
        const tileDir = path.dirname(tilePath);

        // 타일 디렉토리가 없으면 생성
        if (!fs.existsSync(tileDir)) {
            fs.mkdirSync(tileDir, { recursive: true });
        }

        // 타일이 이미 존재하면 바로 전송
        if (fs.existsSync(tilePath)) {
            console.log('캐시된 타일 전송:', tilePath);
            return res.sendFile(tilePath);
        }

        // 타일이 없으면 생성
        const inputPath = path.join(__dirname, '../../uploads', tileSource);
        
        console.log('타일 생성 시작:', {
            script: path.join(__dirname, '../utils/slide_processor.py'),
            inputPath,
            tileDir,
            x,
            y
        });

        const pythonProcess = spawn('python3', [
            path.join(__dirname, '../utils/slide_processor.py'),
            inputPath,
            tileDir,
            x.toString(),
            y.toString()
        ]);

        let pythonOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            pythonOutput += data.toString();
            console.log('타일 생성 출력:', data.toString().trim());
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error('타일 생성 오류:', data.toString().trim());
        });

        pythonProcess.on('close', (code) => {
            console.log('타일 생성 완료:', { code, output: pythonOutput });
            if (code === 0 && fs.existsSync(tilePath)) {
                res.sendFile(tilePath);
            } else {
                res.status(500).send('Tile generation failed');
            }
        });

    } catch (error) {
        console.error('타일 처리 오류:', error);
        res.status(500).send('Error processing tile request');
    }
});

module.exports = router;
