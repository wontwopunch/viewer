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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "잘못된 파일 ID입니다." });
    }

    const file = await File.findById(req.params.id);
    if (!file) {
        return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
    }

    if (!file.public && req.session.user !== "admin") {
        return res.json({ error: "비공개", isAdmin: false });
    }

    res.json({ name: file.name, public: file.public, isAdmin: req.session.user === "admin" });
});

// 파일 공개/비공개 전환 API
router.post('/:id/toggle', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "잘못된 파일 ID입니다." });
    }

    const file = await File.findById(req.params.id);
    if (!file) {
        return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
    }

    file.public = !file.public;
    await file.save();

    res.json({ message: "파일 공개 상태가 변경되었습니다.", file });
});


module.exports = router;
