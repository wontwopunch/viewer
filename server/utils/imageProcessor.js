const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');

/**
 * SVS 파일을 타일로 변환
 * @param {string} inputPath - 입력 SVS 파일 경로
 * @param {string} outputDir - 출력 타일 저장 디렉토리
 * @param {number} tileSize - 타일 크기 (기본값: 256)
 */
async function generateTiles(inputPath, outputDir, tileSize = 256) {
    try {
        console.log(`📂 처리할 SVS 파일: ${inputPath}`);

        if (!fs.existsSync(inputPath)) {
            throw new Error(`❌ 입력 파일이 존재하지 않습니다: ${inputPath}`);
        }

        // Python 스크립트 실행
        const options = {
            mode: 'text',
            pythonPath: path.join(__dirname, '../../venv/bin/python3'),
            scriptPath: path.join(__dirname),
            args: [inputPath, outputDir],
            stderrParser: (line) => console.error('Python Error:', line),
            stdoutParser: (line) => console.log('Python Output:', line)
        };

        return new Promise((resolve, reject) => {
            PythonShell.run('slide_processor.py', options, function (err) {
                if (err) {
                    console.error("❌ 타일 생성 중 오류:", err);
                    reject(err);
                } else {
                    console.log("✅ 모든 타일 생성 완료!");
                    resolve();
                }
            });
        });

    } catch (error) {
        console.error("❌ 타일 생성 중 오류:", error);
        throw error;
    }
}

module.exports = { generateTiles };