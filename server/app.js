const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const tileRouter = require('./routes/tile');
const authRouter = require('./routes/auth');
const fileRouter = require('./routes/files');
const { generateTiles } = require('./utils/vips');
const connectDB = require('./db.js');

const app = express();
const PORT = 3000;

connectDB();

// 🚀 세션 설정 (HTTPS가 아니므로 secure: false 유지)
app.use(session({
    secret: 'svs_viewer_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// JSON 요청 본문 처리
app.use(express.json());

// 🚀 업로드 디렉토리 존재 여부 확인 후 생성
const UPLOAD_DIR = path.join(__dirname, '../uploads/');
const TILE_DIR = path.join(__dirname, '../tiles/');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(TILE_DIR)) fs.mkdirSync(TILE_DIR, { recursive: true });

// 🚀 파일 업로드 설정 (파일명 유지)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 정적 파일 제공 (클라이언트 폴더)
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

// 🚀 로그인 및 페이지 라우팅
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'login.html'));
});

app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'login.html'));
});

app.get('/admin', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'admin.html'));
});

// 🚀 파일 업로드 및 리사이징 후 타일 생성
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

        // 🚀 Sharp에서 픽셀 제한 해제 적용
        sharp.cache(false);
        const image = sharp(filePath).limitInputPixels(false);

        const metadata = await image.metadata();
        console.log(`🖼 업로드된 이미지 크기: ${metadata.width}x${metadata.height}`);

        // 🚀 1억 픽셀 이상일 경우 자동 리사이징 (가로 10,000px 이하로 조정)
        if (metadata.width * metadata.height > 100000000) {
            console.log("⚠️ 이미지 크기가 너무 큽니다. 리사이징 적용...");
            const resizedPath = filePath.replace('.svs', '_resized.svs');
            await image.resize({ width: 10000, height: 10000, fit: 'inside' }).toFile(resizedPath);
            console.log(`📉 리사이징 완료: ${resizedPath}`);
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
    console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
