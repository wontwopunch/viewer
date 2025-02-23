const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// commit용


const tileRouter = require('./routes/tile'); 
const authRouter = require('./routes/auth'); 
const fileRouter = require('./routes/files');
const { generateTiles } = require('./utils/imageProcessor');
const connectDB = require('./db.js');
const FileModel = require('./models/file');  // 경로 수정

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

// 파일 업로드 처리
app.post('/upload', upload.single('svsFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "파일이 선택되지 않았습니다." });
    }

    try {
        // 이미 존재하는 파일인지 확인
        const existingFile = await FileModel.findOne({ path: req.file.filename });
        if (existingFile) {
            console.log('이미 존재하는 파일:', existingFile);
            // 이미지 크기 가져오기
            const filePath = path.join(__dirname, '../uploads', existingFile.path);
            const imageSize = await generateTiles(filePath, path.join(__dirname, '../tiles', existingFile.path));
            
            return res.json({ 
                tileSource: existingFile.path,
                width: imageSize.width,
                height: imageSize.height
            });
        }

        const filePath = path.join(__dirname, '../uploads', req.file.filename);
        const outputDir = path.join(__dirname, '../tiles', req.file.filename);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(`🔹 업로드된 파일: ${filePath}`);
        console.log('파일 정보:', req.file);

        // 타일 생성 및 이미지 크기 받기
        const imageSize = await generateTiles(filePath, outputDir);
        
        // 파일 정보를 MongoDB에 저장
        const file = new FileModel({
            name: req.file.originalname,
            path: req.file.filename,
            public: true
        });
        await file.save();
        
        const response = { 
            tileSource: req.file.filename,
            width: imageSize.width,
            height: imageSize.height
        };
        console.log('응답 데이터:', response);
        res.json(response);

    } catch (error) {
        console.error('파일 처리 오류:', error);
        res.status(500).json({ error: '파일 처리 중 오류가 발생했습니다.', details: error.message });
    }
});

// 파일 목록 확인 API 추가
app.get('/api/debug/files', async (req, res) => {
    try {
        const files = await FileModel.find();
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🚀 서버 실행
app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});
