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
        cb(null, 'uploads/');
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

// 🚀 파일 업로드 엔드포인트 (진행률 표시)
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

        await generateTiles(filePath, outputDir);
        res.json({ tileSource: req.file.filename });
    } catch (error) {
        console.error('파일 처리 오류:', error);
        res.status(500).json({ error: '파일 처리 중 오류가 발생했습니다.' });
    }
});

// 🚀 서버 실행
app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});
