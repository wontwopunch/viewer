const vips = require('vips');

async function processImage() {
  try {
    // 이미지 로드
    const image = vips.Image.newFromFile('input.jpg');

    // 이미지 리사이즈 (예: 500x500)
    const resized = image.resize(500/image.width);

    // 이미지 포맷 변환 및 저장
    await resized.writeToFile('output.jpg');

    console.log('이미지 처리가 완료되었습니다.');
  } catch (error) {
    console.error('이미지 처리 중 오류 발생:', error);
  }
}

processImage(); 