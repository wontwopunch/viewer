const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// 🚀 sharp 캐시 비활성화 (메모리 최적화)
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

        // 🚀 먼저 이미지 크기를 확인하고 강제 리사이징 진행
        console.log("📏 이미지 크기 확인 중...");
        let image = sharp(inputPath).limitInputPixels(false); // ✅ 픽셀 제한 해제
        let metadata;

        try {
            metadata = await image.metadata();
        } catch (error) {
            console.log("⚠️ 메타데이터 분석 실패. 강제 리사이징 시도...");

            const resizedPath = inputPath.replace('.svs', '_resized.svs');

            await sharp(inputPath)
                .resize({
                    width: 10000, // 🚀 최대 10,000px로 자동 리사이징
                    height: 10000,
                    fit: 'inside'
                })
                .toFile(resizedPath);

            console.log(`📉 리사이징 완료: ${resizedPath}`);
            inputPath = resizedPath; // ✅ 리사이징된 파일을 사용
            image = sharp(resizedPath).limitInputPixels(false); // 다시 sharp 객체 생성
            metadata = await image.metadata();
        }

        console.log(`🖼 원본 이미지 크기: ${metadata.width} x ${metadata.height}`);

        // 🚀 1억 픽셀 이상이면 강제 리사이징
        if (metadata.width * metadata.height > 100000000) {  
            console.log("⚠️ 이미지 크기가 너무 큽니다. 강제 리사이징 적용...");
            const resizedPath = inputPath.replace('.svs', '_resized2.svs');

            await sharp(inputPath)
                .resize({ width: 10000, height: 10000, fit: 'inside' })
                .toFile(resizedPath);

            console.log(`📉 강제 리사이징 완료: ${resizedPath}`);
            inputPath = resizedPath;
            image = sharp(resizedPath).limitInputPixels(false);
            metadata = await image.metadata();
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

                await sharp(inputPath)
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
