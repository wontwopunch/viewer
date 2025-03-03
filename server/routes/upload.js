const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processSlide } = require('../utils/imageProcessor');
const File = require('../models/file');
const io = require('../utils/io');

const router = express.Router();

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now();
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 파일 업로드 처리
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '파일이 없습니다.' });
        }

        console.log('📤 파일 업로드 시작:', req.file.path);

        // 이미지 크기 정보 가져오기
        const imageInfo = await processSlide(req.file.path, 'size-only');
        console.log('📏 이미지 정보:', imageInfo);

        // MongoDB에 파일 정보 저장
        const fileDoc = new File({
            fileId: path.basename(req.file.filename, path.extname(req.file.filename)),
            width: imageInfo.width,
            height: imageInfo.height,
            uploadDate: new Date(),
            public: false
        });

        const savedDoc = await fileDoc.save();
        console.log('💾 파일 정보 저장됨:', savedDoc.toObject());

        // 웹소켓으로 진행 상황 전송
        const progress = {
            total: totalTiles,
            current: 0,
            percentage: 0
        };
        
        // 진행 상황 업데이트 이벤트 리스너
        pythonProcess.stdout.on('data', (data) => {
            if (data.includes('TILE_COMPLETE')) {
                progress.current++;
                progress.percentage = (progress.current / progress.total) * 100;
                io.emit('tileProgress', progress);
            }
        });

        res.json({
            message: '파일 업로드 성공',
            tileSource: fileDoc.fileId
        });
    } catch (error) {
        console.error('❌ 파일 업로드 오류:', error);
        res.status(500).json({ error: '파일 처리 중 오류가 발생했습니다.' });
    }
});

module.exports = router; 