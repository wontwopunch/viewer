const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const tileRouter = require('./routes/tile'); // 타일 라우터
const authRouter = require('./routes/auth'); // 로그인 관련 라우터
const fileRouter = require('./routes/files');
const { generateTiles } = require('./utils/vips'); // 타일 생성 유틸리티
const connectDB = require('./db.js'); // 확장자 명시


const app = express();
const PORT = 3000;

connectDB();

// 세션 설정
app.use(session({
    secret: 'svs_viewer_secret',
    resave: false,
    saveUninitialized: false, // ✅ 불필요한 빈 세션 방지
    cookie: {
        secure: false,  // HTTPS 사용 시 true로 변경
        httpOnly: true, // JS에서 쿠키 접근 방지 (보안)
        maxAge: 1000 * 60 * 60 // 1시간 유지
    }
}));

// ✅ 로그인 상태를 확인하는 미들웨어 추가
app.use((req, res, next) => {
    console.log("현재 로그인 상태:", req.session.user);
    next();
});


// JSON 요청 본문 처리
app.use(express.json());


// 정적 파일 제공 (로그인 페이지 및 뷰어 페이지)
app.use(express.static(path.join(__dirname, '../client'), { index: false }));


// 라우터 연결
app.use('/api', authRouter);
app.use('/tiles', tileRouter);
app.use('/api/files', fileRouter);

// 로그인 확인 미들웨어
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login.html'); // 로그인 안 했으면 로그인 페이지로 이동
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'admin.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'login.html'));
});


// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'uploads/');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true }); //업로드 디렉토리가 없으면 생성
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // 원본 확장자 유지
    }
});

const upload = multer({ storage: storage });

// SVS 파일 업로드 엔드포인트
app.post('/upload', requireAuth, upload.single('svsFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "파일이 선택되지 않았습니다." }); // 파일이 없을 경우 에러 반환
    }

    try {
        const filePath = req.file.path; // 업로드된 파일의 경로
        const outputDir = path.join(__dirname, 'tiles', req.file.filename); // 타일 저장 디렉토리

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true }); // 타일 저장 디렉토리가 없으면 생성
        }

        // 타일 생성 실행
        await generateTiles(filePath, outputDir);

        console.log(`✅ 파일 업로드 완료: ${filePath}`);
        console.log(`✅ 타일 저장 디렉토리: ${outputDir}`);

        // ✅ 업로드 성공 응답
        res.json({
            message: "파일 업로드 성공",
            fileName: req.file.filename,
            filePath: filePath,
            tileSource: req.file.filename
        });
    } catch (error) {
        console.error('❌ 파일 처리 오류:', error);
        res.status(500).json({ error: "파일 처리 중 오류가 발생했습니다." });
    }
});


// 서버 실행
app.listen(PORT, () => {
    console.log(`서버가 실행 중입니다: http://localhost:${PORT}`);
});
