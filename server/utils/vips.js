const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// 🚀 Sharp의 최대 픽셀 제한 해제 (최신 버전에서 변경 가능)
sharp.cache(false);

/**
 * 이미지 파일을 타일로 변환
 */
async function generateTiles(inputPath, outputDir, tileSize = 256) {
    try {
        console.log(`📂 처리할 이미지: ${inputPath}`);

        if (!fs.existsSync(inputPath)) {
            throw new Error(`입력 파일이 존재하지 않습니다: ${inputPath}`);
        }

        const image = sharp(inputPath);
        const metadata = await image.metadata();

        console.log(`🖼 원본 이미지 크기: ${metadata.width}x${metadata.height}`);

        // 🚀 픽셀 제한 해제 (Sharp 최신 버전과 호환)
        if (metadata.width * metadata.height > 100000000) {  // 1억 픽셀 초과 시 리사이징
            console.log("⚠️ 이미지 크기가 너무 큽니다. 자동 리사이징 적용...");
            await image.resize({ width: 10000, height: 10000, fit: 'inside' }).toBuffer();
        }

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (let x = 0; x < metadata.width; x += tileSize) {
            for (let y = 0; y < metadata.height; y += tileSize) {
                const tileWidth = Math.min(tileSize, metadata.width - x);
                const tileHeight = Math.min(tileSize, metadata.height - y);
                const tilePath = path.join(outputDir, `tile_${x}_${y}.jpg`);

                console.log(`🔹 타일 생성 중: ${tilePath}`);

                await image
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
