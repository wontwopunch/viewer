import sys
import os
import openslide
from PIL import Image

def get_image_size(input_path):
    try:
        print(f"입력 파일 경로: {input_path}")
        if not os.path.exists(input_path):
            print(f"❌ 파일이 존재하지 않음: {input_path}")
            return False
            
        slide = openslide.OpenSlide(input_path)
        width, height = slide.dimensions
        print(f"IMAGE_SIZE:{width},{height}")
        slide.close()
        return True
    except Exception as e:
        print(f"❌ 이미지 크기 확인 오류: {str(e)}")
        return False

def generate_tile(input_path, output_dir, x, y, tile_size=256):
    try:
        print(f"타일 생성 시작:")
        print(f"- 입력 파일: {input_path}")
        print(f"- 출력 디렉토리: {output_dir}")
        print(f"- 좌표: ({x}, {y})")
        
        if not os.path.exists(input_path):
            print(f"❌ 입력 파일이 존재하지 않음: {input_path}")
            return False
            
        # SVS 파일 로드
        slide = openslide.OpenSlide(input_path)
        
        # 레벨 0(최고 해상도) 크기
        width = slide.dimensions[0]
        height = slide.dimensions[1]
        print(f"- 이미지 크기: {width}x{height}")
        
        # 실제 픽셀 좌표 계산
        pixel_x = x * tile_size
        pixel_y = y * tile_size
        print(f"- 픽셀 좌표: ({pixel_x}, {pixel_y})")
        
        # 타일 크기 계산 (이미지 경계에서 조정)
        current_tile_width = min(tile_size, width - pixel_x)
        current_tile_height = min(tile_size, height - pixel_y)
        print(f"- 타일 크기: {current_tile_width}x{current_tile_height}")
        
        if current_tile_width <= 0 or current_tile_height <= 0:
            print("❌ 타일 크기가 유효하지 않음")
            slide.close()
            return False
            
        # 타일 추출
        tile = slide.read_region((pixel_x, pixel_y), 0, (current_tile_width, current_tile_height))
        tile = tile.convert('RGB')
        
        # 저장
        os.makedirs(output_dir, exist_ok=True)
        tile_path = os.path.join(output_dir, f'tile_{x}_{y}.jpg')
        tile.save(tile_path, 'JPEG', quality=90)
        print(f"✅ 타일 생성 완료: {tile_path}")
        
        slide.close()
        return True
        
    except Exception as e:
        print(f"❌ 타일 생성 오류: {str(e)}")
        return False

if __name__ == "__main__":
    print(f"인자 목록: {sys.argv}")
    
    # 첫 번째 인자는 항상 input_path
    if len(sys.argv) < 3:
        print("Usage:")
        print("  이미지 크기 확인: python slide_processor.py <input_path> size-only")
        print("  타일 생성: python slide_processor.py <input_path> <output_dir> <x> <y>")
        sys.exit(1)

    input_path = sys.argv[1]
    command = sys.argv[2]

    print(f"실행 모드: {command}")

    if command == 'size-only':
        # 이미지 크기 확인 모드
        success = get_image_size(input_path)
    else:
        # 타일 생성 모드
        if len(sys.argv) != 5:
            print("타일 생성 사용법: python slide_processor.py <input_path> <output_dir> <x> <y>")
            sys.exit(1)
        
        output_dir = command  # 두 번째 인자가 output_dir
        x = int(sys.argv[3])
        y = int(sys.argv[4])
        success = generate_tile(input_path, output_dir, x, y)

    sys.exit(0 if success else 1)