const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// MongoDB 파일 스키마 정의
const FileSchema = new mongoose.Schema({
    name: String,
    path: String,
    public: { type: Boolean, default: true } // 기본값: 공개
});

const FileModel = mongoose.model('File', FileSchema);

// 파일 목록 조회 API
router.get('/', async (req, res) => {
    const files = await FileModel.find();
    res.json(files);
});

router.get('/:fileId', async (req, res) => {
    try {
        console.log('파일 정보 요청:', req.params.fileId);
        
        const filePath = path.join(__dirname, '../../uploads', req.params.fileId);
        console.log('파일 경로:', filePath);
        
        if (!fs.existsSync(filePath)) {
            console.log('파일 없음:', filePath);
            return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
        }

        console.log('Python 스크립트 실행...');
        const pythonProcess = require('child_process').spawn('python3', [
            path.join(__dirname, '../utils/slide_processor.py'),
            filePath,
            'size-only'
        ]);

        pythonProcess.stderr.on('data', (data) => {
            console.error('Python 에러:', data.toString());
        });

        let imageSize = null;
        pythonProcess.stdout.on('data', (data) => {
            console.log('Python 출력:', data.toString());
            const output = data.toString();
            if (output.startsWith('IMAGE_SIZE:')) {
                const [width, height] = output.split(':')[1].split(',').map(Number);
                imageSize = { width, height };
            }
        });

        pythonProcess.on('close', (code) => {
            console.log('Python 프로세스 종료:', code);
            if (code !== 0 || !imageSize) {
                return res.status(500).json({ error: "이미지 크기를 가져올 수 없습니다." });
            }
            res.json({
                id: req.params.fileId,
                width: imageSize.width,
                height: imageSize.height
            });
        });

    } catch (error) {
        console.error('파일 정보 조회 중 오류:', error);
        res.status(500).json({ error: "서버 오류" });
    }
});

// 파일 공개/비공개 전환 API
router.post('/:id/toggle', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "잘못된 파일 ID입니다." });
    }

    const file = await FileModel.findById(req.params.id);
    if (!file) {
        return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
    }

    file.public = !file.public;
    await file.save();

    res.json({ message: "파일 공개 상태가 변경되었습니다.", file });
});

module.exports = router;
