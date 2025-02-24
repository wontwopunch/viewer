const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const FileModel = require('../models/file');  // 모델 임포트
const { generateTiles } = require('../utils/imageProcessor');

// 디버그용 파일 목록 조회 API
router.get('/debug', async (req, res) => {
    try {
        const files = await FileModel.find();
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 파일 목록 조회 API
router.get('/', async (req, res) => {
    const files = await FileModel.find();
    res.json(files);
});

router.get('/:fileId', async (req, res) => {
    try {
        const filePath = path.join(__dirname, '../../uploads', req.params.fileId);
        
        // 파일이 없는 경우 DB에서 정보 조회
        if (!fs.existsSync(filePath)) {
            const fileInfo = await FileModel.findOne({ fileId: req.params.fileId });
            if (!fileInfo) {
                console.log('파일 없음:', filePath);
                return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
            }
            // DB에 정보가 있으면 해당 정보 반환
            return res.json({
                id: fileInfo.fileId,
                width: fileInfo.width,
                height: fileInfo.height
            });
        }

        // 이미지 크기 확인
        const imageSize = await generateTiles(filePath);
        console.log('응답 데이터:', {
            tileSource: req.params.fileId,
            ...imageSize
        });

        // DB에 파일 정보 저장
        await FileModel.findOneAndUpdate(
            { fileId: req.params.fileId },
            {
                fileId: req.params.fileId,
                width: imageSize.width,
                height: imageSize.height,
                uploadDate: new Date()
            },
            { upsert: true }
        );

        res.json({
            id: req.params.fileId,
            ...imageSize
        });
    } catch (error) {
        console.error('파일 정보 조회 오류:', error);
        res.status(500).json({ error: error.message });
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

// 파일 삭제 엔드포인트
router.delete('/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        
        // DB에서 파일 정보 삭제
        await FileModel.deleteOne({ fileId: fileId });
        
        // 실제 파일과 타일 디렉토리도 삭제
        const uploadPath = path.join(__dirname, '../../uploads', fileId);
        const tilePath = path.join(__dirname, '../../tiles', fileId);
        
        if (fs.existsSync(uploadPath)) {
            fs.unlinkSync(uploadPath);
        }
        
        if (fs.existsSync(tilePath)) {
            fs.rmdirSync(tilePath, { recursive: true });
        }
        
        res.json({ message: '파일이 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('파일 삭제 중 오류:', error);
        res.status(500).json({ error: '파일 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
