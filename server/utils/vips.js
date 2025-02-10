const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// 🚀 sharp 캐시 비활성화 및 픽셀 제한 해제
sharp.cache(false);

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

        // 🚀 Sharp 라이브러리로 이미지 메타데이터 가져오기
        const image = sharp(inputPath).limitInputPixels(false);
        const metadata = await image.metadata();
        console.log(`🖼 원본 이미지 크기: ${metadata.width} x ${metadata.height}`);

        // 🚀 1억 픽셀 이상일 경우 자동 리사이징 (최대 10,000px로 조정)
        let finalInputPath = inputPath;
        if (metadata.width * metadata.height > 100000000) {  
            console.log("⚠️ 이미지 크기가 너무 큽니다. 자동 리사이징 적용...");
            const resizedPath = inputPath.replace('.svs', '_resized.svs');
            
            await image
                .resize({ width: 10000, height: 10000, fit: 'inside' }) // 자동 크기 조정
                .toFile(resizedPath);
            
            console.log(`📉 리사이징 완료: ${resizedPath}`);
            finalInputPath = resizedPath;
        }

        // 출력 디렉토리 생성
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log("🔄 타일 생성 중...");
        for (let x = 0; x < metadata.width; x += tileSize) {
            for (let y = 0; y < metadata.height; y += tileSize) {
                const tileWidth = Math.min(tileSize, metadata.width - x);
                const tileHeight = Math.min(tileSize, metadata.height - y);
                const tilePath = path.join(outputDir, `tile_${x}_${y}.jpg`);

                console.log(`🖼 타일 생성: ${tilePath}`);

                await sharp(finalInputPath)
                    .extract({ left: x, top: y, width: tileWidth, height: tileHeight })
                    .toFile(tilePath);
            }
        }

        console.log("✅ 모든 타일 생성 완료!");
    } catch (error) {
        console.error("❌ 타일 생성 중 오류 발생:", error);
        throw error;
    }
}

module.exports = { generateTiles };
