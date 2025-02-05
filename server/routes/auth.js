const express = require('express');
const router = express.Router();

// 관리자 계정 정보
const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "admin963"
};

// 로그인 엔드포인트
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        req.session.user = username; // 세션에 사용자 저장
        res.json({ message: "Login successful" });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// 로그아웃 엔드포인트
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Logout failed" });
        }
        res.json({ message: "Logged out successfully" });
    });
});

// 로그인 상태 확인 엔드포인트
router.get('/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true });
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
});

module.exports = router;
