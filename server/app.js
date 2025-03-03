const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');
const connectDB = require('./db');
const uploadRouter = require('./routes/upload');
const filesRouter = require('./routes/files');
const tileRouter = require('./routes/tile');

const authRouter = require('./routes/auth'); 
const { generateTiles } = require('./utils/imageProcessor');
const FileModel = require('./models/file');
const Queue = require('bull');
const Redis = require('ioredis');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB 연결
connectDB().then(() => {
    console.log('✅ MongoDB 연결 완료');
}).catch(err => {
    console.error('❌ MongoDB 연결 실패:', err);
    process.exit(1);
});

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

// 미들웨어 설정
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/tiles', express.static(path.join(__dirname, '../tiles')));

// 라우터 연결
app.use('/api', authRouter);
app.use('/tiles', tileRouter);
app.use('/api/files', filesRouter);
app.use('/upload', uploadRouter);

// 로그인 확인 미들웨어
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// 라우트 설정
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

// 파일 업로드 처리
app.post('/upload', upload.single('svsFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
        }

        // 이미지 크기 확인
        const imageSize = await generateTiles(req.file.path);
        
        // 기존 파일 정보가 있으면 업데이트, 없으면 새로 생성
        const fileDoc = await FileModel.findOneAndUpdate(
            { fileId: req.file.filename },
            {
                fileId: req.file.filename,
                width: imageSize.width,
                height: imageSize.height,
                uploadDate: new Date()
            },
            { upsert: true, new: true }
        );

        res.json({
            tileSource: req.file.filename,
            ...imageSize
        });

    } catch (error) {
        console.error('파일 처리 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 파일 목록 확인 API
app.get('/api/debug/files', async (req, res) => {
    try {
        const files = await FileModel.find();
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Redis 연결
const redis = new Redis({
    port: 6379,
    host: '127.0.0.1',
    maxRetriesPerRequest: null,
    retryStrategy: function(times) {
        return Math.min(times * 50, 2000);
    }
});

// 타일 생성 큐
const tileQueue = new Queue('tile-generation', {
    redis: {
        port: 6379,
        host: '127.0.0.1',
        maxRetriesPerRequest: null
    },
    defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        timeout: 1000 * 60 * 30  // 30분 타임아웃
    }
});

// 작업 처리기
tileQueue.process(async (job) => {
    const { inputPath, x, y } = job.data;
    await generateTile(inputPath, x, y);
    job.progress(100);
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});