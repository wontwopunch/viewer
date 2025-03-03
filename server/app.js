const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');
const connectDB = require('./db');
const uploadRouter = require('./routes/upload');
const filesRouter = require('./routes/files');
const tileRouter = require('./routes/tile');
const authRouter = require('./routes/auth'); 
const Queue = require('bull');
const Redis = require('ioredis');
const FileModel = require('./models/file');
const { generateTiles } = require('./utils/imageProcessor');

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

// 미들웨어 설정
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/tiles', express.static(path.join(__dirname, '../tiles')));

// 라우터 연결
app.use('/api', authRouter);
app.use('/tiles', tileRouter);
app.use('/api/files', filesRouter);
app.use('/upload', uploadRouter);  // upload.js에서 처리

// 로그인 확인 미들웨어
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// 기본 라우트 설정
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
    await generateTiles(inputPath);
    job.progress(100);
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});