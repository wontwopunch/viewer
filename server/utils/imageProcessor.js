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
        let stdoutData = '';  // 전체 stdout 데이터를 저장

        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            stdoutData += output + '\n';  // stdout 데이터 누적
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
            console.error('Python 오류:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            console.log('Python 프로세스 종료:', {
                code,
                errorOutput,
                stdoutData,
                imageSize
            });

            if (imageSize) {
                resolve(imageSize);
            } else {
                reject(new Error('이미지 크기를 가져올 수 없습니다.'));
            }
        });

        pythonProcess.on('error', (error) => {
            console.error('Python 프로세스 실행 오류:', error);
            reject(new Error('Python 프로세스 실행 실패'));
        });
    });
};

module.exports = { generateTiles };