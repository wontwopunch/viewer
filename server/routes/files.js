const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// MongoDB 파일 스키마 정의
const FileSchema = new mongoose.Schema({
    name: String,
    path: String,
    public: { type: Boolean, default: true } // 기본값: 공개
});

const File = mongoose.model('File', FileSchema);

// 파일 목록 조회 API
router.get('/', async (req, res) => {
    const files = await File.find();
    res.json(files);
});

router.get('/:id', async (req, res) => {
    const file = await File.findById(req.params.id);
    if (!file) {
        return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
    }
    if (!file.public && req.session.user !== "admin") {
        return res.status(403).json({ error: "비공개 파일에는 접근할 수 없습니다." });
    }
    res.json({ name: file.name, public: file.public });
});

// 파일 공개/비공개 전환 API
router.post('/:id/toggle', async (req, res) => {
    const file = await File.findById(req.params.id);
    if (!file) {
        return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
    }

    // 상태 변경 (공개 <-> 비공개)
    file.public = !file.public;
    await file.save();

    res.json({ message: "File visibility updated", file });
});


module.exports = router;
