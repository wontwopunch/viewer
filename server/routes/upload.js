const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateTiles } = require('../utils/imageProcessor');
const FileModel = require('../models/file');
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
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 파일 업로드 처리
router.post('/', upload.single('svsFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
        }

        console.log('🔹 업로드된 파일:', req.file.path);
        console.log('파일 정보:', req.file);

        // 이미지 크기 확인
        const imageSize = await generateTiles(req.file.path);
        
        // 파일 정보를 DB에 저장
        const fileId = req.file.filename;
        const fileDoc = new FileModel({
            fileId: fileId,
            width: imageSize.width,
            height: imageSize.height,
            uploadDate: new Date()
        });

        await fileDoc.save();

        res.json({
            tileSource: fileId,
            ...imageSize
        });

    } catch (error) {
        console.error('파일 업로드 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 