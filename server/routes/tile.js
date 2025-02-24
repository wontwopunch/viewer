const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

// 타일 생성 큐와 진행 중인 작업 추적
const tileQueue = new Map(); // 대기 중인 타일 요청
const inProgress = new Map(); // 생성 중인 타일

// 타일 생성 함수
async function generateTile(inputPath, tileDir, x, y) {
    const tileKey = `${x}_${y}`;
    const tilePath = path.join(tileDir, `tile_${tileKey}.jpg`);

    // 이미 생성된 타일이 있는지 확인
    try {
        await fs.access(tilePath);
        return tilePath;
    } catch (error) {
        // 파일이 없으면 생성
    }

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', [
            path.join(__dirname, '../utils/slide_processor.py'),
            inputPath,
            tileDir,
            x.toString(),
            y.toString()
        ]);

        let errorOutput = '';

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve(tilePath);
            } else {
                reject(new Error(`타일 생성 실패: ${errorOutput}`));
            }
        });
    });
}

router.get('/:fileId/tile_:x_:y.jpg', async (req, res) => {
    try {
        const { fileId } = req.params;
        const x = parseInt(req.params.x);
        const y = parseInt(req.params.y);
        
        const inputPath = path.join(__dirname, '../../uploads', fileId);
        const tileDir = path.join(__dirname, '../../tiles', fileId);
        const tileKey = `${fileId}_${x}_${y}`;

        // 디렉토리 생성
        await fs.mkdir(tileDir, { recursive: true });

        // 이미 진행 중인 타일 생성이 있는지 확인
        if (inProgress.has(tileKey)) {
            const tilePath = await inProgress.get(tileKey);
            return res.sendFile(tilePath);
        }

        // 새로운 타일 생성 작업 시작
        const tilePromise = generateTile(inputPath, tileDir, x, y);
        inProgress.set(tileKey, tilePromise);

        try {
            const tilePath = await tilePromise;
            res.sendFile(tilePath);
        } finally {
            inProgress.delete(tileKey);
        }

    } catch (error) {
        console.error('타일 처리 오류:', error);
        res.status(500).send('타일 생성 중 오류가 발생했습니다.');
    }
});

module.exports = router;
