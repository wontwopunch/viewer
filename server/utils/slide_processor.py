import sys
import os
import openslide
from PIL import Image
import multiprocessing
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from functools import partial

TILE_SIZE = 512  # 타일 크기를 512로 증가
JPEG_QUALITY = 80  # JPEG 품질 조정
BATCH_SIZE = 16  # 배치 처리 크기

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

def generate_tile_batch(args):
    input_path, output_dir, batch_coords = args
    try:
        # 슬라이드를 한 번만 열기
        with openslide.OpenSlide(input_path) as slide:
            for x, y in batch_coords:
                pixel_x = x * TILE_SIZE
                pixel_y = y * TILE_SIZE
                
                # 메모리 효율적인 타일 읽기
                tile = slide.read_region((pixel_x, pixel_y), 0, (TILE_SIZE, TILE_SIZE))
                tile = tile.convert('RGB')
                
                # JPEG 최적화
                tile_path = os.path.join(output_dir, f'tile_{x}_{y}.jpg')
                tile.save(tile_path, 'JPEG', quality=JPEG_QUALITY, optimize=True)
                
                # 진행 상황 보고
                print(f"TILE_COMPLETE:{x}_{y}")
                
        return True
    except Exception as e:
        print(f"❌ 타일 생성 오류 ({x},{y}): {str(e)}")
        return False

def generate_tiles_parallel(input_path, output_dir):
    # 이미지 크기 확인
    with openslide.OpenSlide(input_path) as slide:
        width, height = slide.dimensions
    
    # 타일 좌표 계산
    x_tiles = range(0, width // TILE_SIZE + 1)
    y_tiles = range(0, height // TILE_SIZE + 1)
    coords = [(x, y) for x in x_tiles for y in y_tiles]
    
    # 배치로 분할
    batches = [coords[i:i + BATCH_SIZE] for i in range(0, len(coords), BATCH_SIZE)]
    tasks = [(input_path, output_dir, batch) for batch in batches]
    
    # CPU 코어 수 계산 (전체 코어의 75% 사용)
    num_processes = max(1, int(multiprocessing.cpu_count() * 0.75))
    
    print(f"🚀 병렬 처리 시작: {num_processes} 프로세스, {len(batches)} 배치")
    
    # 병렬 처리 실행
    with ProcessPoolExecutor(max_workers=num_processes) as executor:
        results = list(executor.map(generate_tile_batch, tasks))
    
    return all(results)

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
        success = generate_tile_batch((input_path, output_dir, [(x, y)]))

    sys.exit(0 if success else 1)