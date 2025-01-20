const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * 이미지 파일을 타일로 분할
 * @param {string} inputPath - 입력 이미지 파일 경로
 * @param {string} outputDir - 출력 타일 저장 디렉토리
 * @param {number} tileSize - 타일 크기 (기본값: 256)
 */
async function generateTiles(inputPath, outputDir, tileSize = 256) {
    try {
        const image = sharp(inputPath);
        const metadata = await image.metadata();

        const { width, height } = metadata;
        console.log(`Processing image: ${inputPath}`);
        console.log(`Dimensions: ${width}x${height}`);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (let x = 0; x < width; x += tileSize) {
            for (let y = 0; y < height; y += tileSize) {
                const tileWidth = Math.min(tileSize, width - x);
                const tileHeight = Math.min(tileSize, height - y);
                const tilePath = path.join(outputDir, `tile_${x}_${y}.jpg`);

                console.log(`Creating tile: ${tilePath}`);

                await image
                    .extract({ left: x, top: y, width: tileWidth, height: tileHeight })
                    .toFile(tilePath);
            }
        }

        console.log(`Tile generation complete. Tiles saved to ${outputDir}`);
    } catch (error) {
        console.error('Error generating tiles:', error);
        throw error;
    }
}

module.exports = { generateTiles };
