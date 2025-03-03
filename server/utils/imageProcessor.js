const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const fs = require('fs');

/**
 * SVS 파일을 타일로 변환
 * @param {string} inputPath - 입력 SVS 파일 경로
 * @param {string} outputDir - 출력 타일 저장 디렉토리
 * @param {number} tileSize - 타일 크기 (기본값: 256)
 */
async function generateTiles(inputPath) {
    return new Promise((resolve, reject) => {
        console.log('📂 처리할 SVS 파일:', inputPath);
        
        // CPU 코어 수만큼 워커 생성
        const numWorkers = os.cpus().length;
        
        const pythonProcess = spawn('python3', [
            path.join(__dirname, 'slide_processor.py'),
            inputPath,
            'parallel',  // 병렬 처리 모드
            numWorkers.toString()
        ]);

        let imageSize = null;
        let errorOutput = '';
        let stdoutData = '';

        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            stdoutData += output + '\n';
            console.log('Python 출력:', output);
            
            // IMAGE_SIZE: 문자열 찾기
            const match = output.match(/IMAGE_SIZE:(\d+),(\d+)/);
            if (match) {
                const width = parseInt(match[1], 10);
                const height = parseInt(match[2], 10);
                if (!isNaN(width) && !isNaN(height)) {
                    imageSize = { width, height };
                    console.log('이미지 크기 파싱 성공:', imageSize);
                }
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error('Python 오류:', data.toString().trim());
        });

        pythonProcess.on('close', (code) => {
            console.log('Python 프로세스 종료:', {
                code,
                errorOutput,
                stdoutData,
                imageSize
            });

            if (code === 0 && imageSize) {
                resolve(imageSize);
            } else {
                reject(new Error('이미지 처리 실패'));
            }
        });
    });
}

async function optimizeTile(tilePath) {
    await sharp(tilePath)
        .jpeg({
            quality: 80,
            progressive: true,
            force: true,
            optimizeScans: true
        })
        .toFile(tilePath + '.optimized');
    
    await fs.rename(tilePath + '.optimized', tilePath);
}

module.exports = { generateTiles };