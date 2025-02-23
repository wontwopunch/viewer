import sys
import os
import openslide
from PIL import Image

def generate_tiles(input_path, output_dir, tile_size=256):
    try:
        # SVS 파일 로드
        slide = openslide.OpenSlide(input_path)
        
        # 레벨 0(최고 해상도) 크기
        width = slide.dimensions[0]
        height = slide.dimensions[1]
        
        print(f"🖼 원본 이미지 크기: {width} x {height}")
        
        # 출력 디렉토리 생성
        os.makedirs(output_dir, exist_ok=True)
        
        # 타일 생성
        for x in range(0, width, tile_size):
            for y in range(0, height, tile_size):
                tile_width = min(tile_size, width - x)
                tile_height = min(tile_size, height - y)
                
                # 타일 추출
                tile = slide.read_region((x, y), 0, (tile_width, tile_height))
                tile = tile.convert('RGB')
                
                # 저장
                tile_path = os.path.join(output_dir, f'tile_{x}_{y}.jpg')
                tile.save(tile_path, 'JPEG', quality=90)
                print(f"🖼 타일 생성: {tile_path}")
        
        slide.close()
        print("✅ 모든 타일 생성 완료!")
        return True
        
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python slide_processor.py <input_path> <output_dir>")
        sys.exit(1)
    
    generate_tiles(sys.argv[1], sys.argv[2])