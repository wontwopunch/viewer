const { spawn } = require('child_process');
const path = require('path');

/**
 * SVS 파일을 타일로 변환
 * @param {string} inputPath - 입력 SVS 파일 경로
 * @param {string} outputDir - 출력 타일 저장 디렉토리
 * @param {number} tileSize - 타일 크기 (기본값: 256)
 */
const generateTiles = (inputPath, outputDir) => {
    return new Promise((resolve, reject) => {
        console.log('📂 처리할 SVS 파일:', inputPath);
        
        const pythonProcess = spawn('python3', [
            path.join(__dirname, 'slide_processor.py'),
            inputPath,
            'size-only'
        ]);

        let imageSize = null;
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            console.log('Python 출력:', output);
            
            if (output.startsWith('IMAGE_SIZE:')) {
                try {
                    const [width, height] = output.split(':')[1].trim().split(',').map(Number);
                    if (!isNaN(width) && !isNaN(height)) {
                        imageSize = { width, height };
                        console.log('이미지 크기 파싱 성공:', imageSize);
                    }
                } catch (error) {
                    console.error('이미지 크기 파싱 오류:', error);
                }
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error('Python 오류:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            if (imageSize) {
                resolve(imageSize);
            } else {
                console.error('Python 프로세스 종료:', { code, errorOutput });
                reject(new Error('이미지 처리 실패'));
            }
        });
    });
};

module.exports = { generateTiles };