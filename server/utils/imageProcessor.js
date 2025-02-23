const openslide = require('openslide');
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

        // OpenSlide로 SVS 파일 로드
        const slide = openslide.OpenSlide(inputPath);
        
        // 레벨 0(최고 해상도) 크기 가져오기
        const width = parseInt(slide.properties['openslide.level[0].width']);
        const height = parseInt(slide.properties['openslide.level[0].height']);
        console.log(`🖼 원본 이미지 크기: ${width} x ${height}`);

        // 출력 디렉토리 생성
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log("🔄 타일 생성 중...");
        for (let x = 0; x < width; x += tileSize) {
            for (let y = 0; y < height; y += tileSize) {
                const tileWidth = Math.min(tileSize, width - x);
                const tileHeight = Math.min(tileSize, height - y);
                const tilePath = path.join(outputDir, `tile_${x}_${y}.jpg`);

                console.log(`🖼 타일 생성: ${tilePath}`);

                // 타일 추출
                const tileData = slide.read(x, y, tileWidth, tileHeight);
                
                // JPEG로 저장
                fs.writeFileSync(tilePath, tileData);
            }
        }

        // 리소스 해제
        slide.close();
        console.log("✅ 모든 타일 생성 완료!");
    } catch (error) {
        console.error("❌ 타일 생성 중 오류:", error);
        throw error;
    }
}

module.exports = { generateTiles };