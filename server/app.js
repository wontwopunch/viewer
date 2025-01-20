const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const tileRouter = require('./routes/tile'); // 타일 라우터
const { generateTiles } = require('./utils/vips'); // 타일 생성 유틸리티
const connectDB = require('./db');
const app = express();
const PORT = 3000;

connectDB();
// Configure file upload destination
const upload = multer({ dest: 'uploads/' });

// Serve static files for the client
app.use(express.static(path.join(__dirname, '../client')));

// 타일 라우터 연결
app.use('/tiles', tileRouter);

// Endpoint to handle file uploads
app.post('/upload', upload.single('svsFile'), async (req, res) => {
    try {
        const filePath = path.join(__dirname, req.file.path); // Uploaded file path
        const outputDir = path.join(__dirname, 'tiles', req.file.filename); // Directory to save tiles

        // Create the output directory for tiles
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate tiles from the uploaded file
        await generateTiles(filePath, outputDir);

        // Return tile source information
        res.json({ tileSource: req.file.filename });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).send('Error processing the uploaded file');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
