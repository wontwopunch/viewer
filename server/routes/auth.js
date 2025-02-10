const express = require('express');
const router = express.Router();

// 관리자 계정 정보
const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "admin963"
};

// 로그인 엔드포인트 (🚀 로그인 후 `index.html`로 이동하도록 수정)
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        req.session.user = username; 
        res.json({ redirect: "/index.html" }); // 🚀 응답을 JSON으로 수정
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

// 🚀 로그인 상태 확인 (check-auth API)
router.get('/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, isAdmin: req.session.user === "admin" });
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
});

module.exports = router;
