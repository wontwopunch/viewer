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

    console.log(`🔍 타일 생성 시작 (${tileKey}):`, {
        inputPath,
        tileDir,
        tilePath
    });

    // 이미 생성된 타일이 있는지 확인
    try {
        await fs.access(tilePath);
        console.log(`✅ 기존 타일 발견 (${tileKey}):`, tilePath);
        return tilePath;
    } catch (error) {
        console.log(`🔄 새 타일 생성 필요 (${tileKey})`);
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
        let stdoutData = '';

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
            console.log(`📄 Python 출력 (${tileKey}):`, data.toString().trim());
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error(`❌ Python 오류 (${tileKey}):`, data.toString().trim());
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ 타일 생성 완료 (${tileKey})`);
                resolve(tilePath);
            } else {
                console.error(`❌ 타일 생성 실패 (${tileKey}):`, errorOutput);
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
        
        // 좌표 유효성 검사
        if (isNaN(x) || isNaN(y) || x < 0 || y < 0) {
            console.error('❌ 잘못된 좌표:', { x, y });
            return res.status(400).send('잘못된 타일 좌표입니다.');
        }

        const tileKey = `${fileId}_${x}_${y}`;
        console.log(`📥 타일 요청 받음 (${tileKey})`);

        const inputPath = path.join(__dirname, '../../uploads', fileId);
        const tileDir = path.join(__dirname, '../../tiles', fileId);

        // 디렉토리 생성
        await fs.mkdir(tileDir, { recursive: true });

        // 이미 진행 중인 타일 생성이 있는지 확인
        if (inProgress.has(tileKey)) {
            console.log(`⏳ 진행 중인 타일 생성 대기 (${tileKey})`);
            const tilePath = await inProgress.get(tileKey);
            return res.sendFile(tilePath);
        }

        // 새로운 타일 생성 작업 시작
        const tilePromise = generateTile(inputPath, tileDir, x, y);
        inProgress.set(tileKey, tilePromise);

        try {
            const tilePath = await tilePromise;
            console.log(`📤 타일 전송 (${tileKey}):`, tilePath);
            res.sendFile(tilePath);
        } finally {
            inProgress.delete(tileKey);
        }

    } catch (error) {
        console.error('🚨 타일 처리 오류:', error);
        res.status(500).send('타일 생성 중 오류가 발생했습니다.');
    }
});

module.exports = router;
