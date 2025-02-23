const { spawn } = require('child_process');
const path = require('path');

/**
 * SVS 파일을 타일로 변환
 * @param {string} inputPath - 입력 SVS 파일 경로
 * @param {string} outputDir - 출력 타일 저장 디렉토리
 * @param {number} tileSize - 타일 크기 (기본값: 256)
 */
const generateTiles = (filePath, outputDir) => {
    return new Promise((resolve, reject) => {
        console.log('📂 처리할 SVS 파일:', filePath);
        
        const pythonProcess = spawn('python3', [
            path.join(__dirname, 'slide_processor.py'),
            filePath,
            outputDir
        ]);

        let imageSize = null;

        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('Python 출력:', output);
            
            if (output.startsWith('IMAGE_SIZE:')) {
                const [width, height] = output.split(':')[1].split(',').map(Number);
                imageSize = { width, height };
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error('Python 에러:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0 || !imageSize) {
                reject(new Error('이미지 처리 실패'));
            } else {
                resolve(imageSize);
            }
        });
    });
};

module.exports = { generateTiles };