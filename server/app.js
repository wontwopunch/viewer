const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const tileRouter = require('./routes/tile'); 
const authRouter = require('./routes/auth'); 
const fileRouter = require('./routes/files');
const { generateTiles } = require('./utils/vips');
const connectDB = require('./db.js');

const app = express();
const PORT = 3000;

connectDB();

// 세션 설정 (🚀 `cookie.secure` 옵션 false 유지 → HTTPS 환경이 아니면 true 시 문제 발생)
app.use(session({
    secret: 'svs_viewer_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// JSON 요청 본문 처리
app.use(express.json());

// 파일 업로드 설정 (🚀 파일명 유지)
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

// 🚀 클라이언트 폴더 정적 파일 제공 수정 (경로 문제 해결)
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

// 🚀 첫 페이지 요청 시 `login.html`을 정상적으로 로드하도록 수정
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'login.html'));
});

// 🚀 로그인 성공 후 `index.html`로 정상 이동하도록 수정
app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'index.html'));
});

// 🚀 로그인 페이지 직접 접근 시 정상 로드되도록 수정
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'login.html'));
});

// 🚀 `admin.html`도 로그인한 사용자만 접근 가능하도록 수정
app.get('/admin', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'admin.html'));
});


// 🔹 파일 업로드 엔드포인트 (에러 디버깅 추가)
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

        if (metadata.width * metadata.height > 100000000) { // 1억 픽셀 초과 시
            console.log("⚠️ 이미지 크기가 너무 큽니다. 리사이징 적용...");
            await image.resize({ width: 10000, height: 10000, fit: 'inside' }).toBuffer();
        }

        // 🚀 타일 생성 실행
        await generateTiles(filePath, outputDir);
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
