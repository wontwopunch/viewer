const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sharp = require('sharp');

const tileRouter = require('./routes/tile'); 
const authRouter = require('./routes/auth'); 
const fileRouter = require('./routes/files');
const { generateTiles } = require('./utils/vips');
const connectDB = require('./db.js');

const app = express();
const PORT = 3000;

connectDB();

// 세션 설정
app.use(session({
    secret: 'svs_viewer_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// JSON 요청 본문 처리
app.use(express.json());

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads/');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});
const upload = multer({ storage: storage });

// 클라이언트 폴더 정적 파일 제공
app.use(express.static(path.join(__dirname, '../client')));

// 라우터 연결
app.use('/api', authRouter);
app.use('/tiles', tileRouter);
app.use('/api/files', fileRouter);

// 로그인 확인 미들웨어
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// 첫 페이지 요청 시 로그인 페이지 로드
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'login.html'));
});

// 로그인 후 index.html로 이동
app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'index.html'));
});

// 로그인 페이지 접근
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'login.html'));
});

// admin 페이지 접근
app.get('/admin', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'admin.html'));
});

// 🔹 파일 업로드 엔드포인트 (픽셀 제한 오류 해결)
app.post('/upload', requireAuth, upload.single('svsFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "파일이 선택되지 않았습니다." });
    }

    try {
        const filePath = path.join(__dirname, '../uploads', req.file.filename);
        const outputDir = path.join(__dirname, '../tiles', req.file.filename);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(`🔹 업로드된 파일: ${filePath}`);

        // 🚀 이미지 크기 초과 방지를 위한 리사이징 적용
        const image = sharp(filePath);
        const metadata = await image.metadata();

        console.log(`🖼 업로드된 이미지 크기: ${metadata.width}x${metadata.height}`);

        let finalFilePath = filePath;
        if (metadata.width * metadata.height > 100000000) { // 1억 픽셀 초과 시
            console.log("⚠️ 이미지 크기가 너무 큽니다. 리사이징 적용...");
            const resizedPath = filePath.replace('.svs', '_resized.svs');

            await image.resize({
                width: Math.min(10000, metadata.width), 
                height: Math.min(10000, metadata.height),
                fit: 'inside'
            }).toFile(resizedPath);

            console.log(`📉 리사이징 완료: ${resizedPath}`);
            finalFilePath = resizedPath;
        }

        // 🚀 타일 생성 실행
        await generateTiles(finalFilePath, outputDir);
        res.json({ tileSource: req.file.filename });

    } catch (error) {
        console.error('파일 처리 오류:', error);
        res.status(500).json({ error: '파일 처리 중 오류가 발생했습니다.', details: error.message });
    }
});

// 🚀 서버 실행
app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});
