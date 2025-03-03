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
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now();
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// 허용된 파일 형식 필터
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.svs', '.ndpi', '.tif', '.tiff'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('지원하지 않는 파일 형식입니다.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter
});

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

        if (!imageInfo || !imageInfo.width || !imageInfo.height) {
            throw new Error('이미지 크기 정보를 가져올 수 없습니다.');
        }

        // MongoDB에 파일 정보 저장
        const fileDoc = new File({
            fileId: path.basename(req.file.filename, path.extname(req.file.filename)),
            originalName: req.file.originalname,
            width: imageInfo.width,
            height: imageInfo.height,
            uploadDate: new Date(),
            public: false
        });

        const savedDoc = await fileDoc.save();
        console.log('💾 파일 정보 저장됨:', savedDoc.toObject());

        res.json({
            message: '파일 업로드 성공',
            tileSource: fileDoc.fileId,
            width: imageInfo.width,
            height: imageInfo.height
        });

    } catch (error) {
        console.error('❌ 파일 업로드 오류:', error);
        
        // 업로드된 파일 삭제
        if (req.file && req.file.path) {
            await io.removeFile(req.file.path).catch(console.error);
        }
        
        res.status(500).json({ 
            error: '파일 처리 중 오류가 발생했습니다.',
            details: error.message 
        });
    }
});

module.exports = router; 