const vips = require('vips');
const path = require('path');
const fs = require('fs');

/**
 * 이미지 파일을 타일로 변환
 * @param {string} inputPath - 입력 이미지 파일 경로
 * @param {string} outputDir - 출력 타일 저장 디렉토리
 * @param {number} tileSize - 타일 크기 (기본값: 256)
 */
async function generateTiles(inputPath, outputDir, tileSize = 256) {
    try {
        console.log(`📂 처리할 이미지: ${inputPath}`);

        if (!fs.existsSync(inputPath)) {
            throw new Error(`❌ 입력 파일이 존재하지 않습니다: ${inputPath}`);
        }

        // vips로 이미지 로드
        let image = vips.Image.newFromFile(inputPath);

        console.log(`🖼 원본 이미지 크기: ${image.width} x ${image.height}`);

        // 🚀 픽셀 제한 해제 (1억 픽셀 이상일 경우 자동 리사이징)
        if (image.width * image.height > 100000000) {
            console.log("⚠️ 이미지 크기가 너무 큽니다. 자동 리사이징 적용...");
            const scale = 10000 / Math.max(image.width, image.height);
            image = image.resize(scale, {
                kernel: vips.Kernel.lanczos3
            });
        }

        // 출력 디렉토리 생성
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log("🔄 타일 생성 중...");
        for (let x = 0; x < image.width; x += tileSize) {
            for (let y = 0; y < image.height; y += tileSize) {
                const tileWidth = Math.min(tileSize, image.width - x);
                const tileHeight = Math.min(tileSize, image.height - y);
                const tilePath = path.join(outputDir, `tile_${x}_${y}.jpg`);

                console.log(`🖼 타일 생성: ${tilePath}`);

                // vips로 이미지 타일 추출
                const tile = image.extract(x, y, tileWidth, tileHeight);
                
                // JPEG 품질 설정과 함께 저장
                await tile.writeToFile(tilePath, {
                    Q: 90,  // JPEG 품질 (0-100)
                    strip: true  // 메타데이터 제거
                });
            }
        }

        console.log("✅ 모든 타일 생성 완료!");
    } catch (error) {
        console.error("❌ 타일 생성 중 오류 발생:", error);
        throw error;
    }
}

module.exports = { generateTiles };
