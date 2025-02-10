const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const tileRouter = require('./routes/tiles'); // 타일 라우터
const authRouter = require('./routes/auth'); // 로그인 관련 라우터
const fileRouter = require('./routes/files');
const { generateTiles } = require('./utils/vips'); // 타일 생성 유틸리티
const connectDB = require('./db'); // MongoDB 연결

const app = express();
const PORT = 3000;

connectDB();

// ✅ 세션 설정
app.use(session({
    secret: 'svs_viewer_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // HTTPS 환경에서는 true로 설정
}));

// ✅ CORS 설정 (필요한 경우)
app.use(cors());

// ✅ JSON 요청 본문 처리
app.use(express.json());

// ✅ 파일 업로드 설정 (저장 경로를 '../uploads/'로 설정)
const upload = multer({ dest: path.join(__dirname, '../uploads/') });

// ✅ 정적 파일 제공 (client 폴더가 server 바깥에 있으므로 '../client'로 수정)
app.use(express.static(path.join(__dirname, '../client')));

// ✅ 라우터 연결
app.use('/api', authRouter);
app.use('/tiles', tileRouter);
app.use('/api/files', fileRouter);

// ✅ 로그인 확인 미들웨어
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login.html'); // 로그인 안 했으면 로그인 페이지로 이동
    }
}

// ✅ 기본 페이지를 login.html로 설정
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'login.html'));
});

// ✅ 관리자 페이지
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'admin.html'));
});

// ✅ 로그인 페이지
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'login.html'));
});

// ✅ SVS 파일 업로드 엔드포인트
app.post('/upload', requireAuth, upload.single('svsFile'), async (req, res) => {
    try {
        const filePath = path.join(__dirname, '../', req.file.path); // 업로드된 파일 경로
        const outputDir = path.join(__dirname, '../tiles', req.file.filename); // 타일 저장 디렉토리

        // 타일 저장 디렉토리가 없으면 생성
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(`🔹 파일 업로드 완료: ${filePath}`);
        console.log(`🔹 타일 생성 시작...`);

        // 타일 생성 실행
        await generateTiles(filePath, outputDir);

        console.log(`✅ 타일 생성 완료: ${outputDir}`);

        // 타일 소스 정보 반환
        res.json({ tileSource: req.file.filename });
    } catch (error) {
        console.error('❌ 파일 처리 오류:', error);
        res.status(500).send('파일 처리 중 오류가 발생했습니다.');
    }
});

// ✅ 서버 실행
app.listen(PORT, () => {
    console.log(`🚀 서버가 실행 중입니다: http://localhost:${PORT}`);
});
