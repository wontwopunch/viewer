from flask import Flask, send_file, jsonify, request, send_from_directory, make_response, session
import openslide
from flask_cors import CORS
import os
import json
from functools import lru_cache, wraps
from cachetools import TTLCache, LRUCache
import io
import PIL.Image
import PIL.ImageDraw
from pathlib import Path
import logging  # 로깅 추가
from werkzeug.utils import secure_filename
from flask_session import Session
from datetime import timedelta
import sys

# 로깅 설정 수정
logging.basicConfig(
    filename='/root/viewer/app.log',  # 절대 경로 사용
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 콘솔 출력 추가
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

app = Flask(__name__, 
    static_url_path='',
    static_folder='static'
)
# 배포 환경에서는 CORS 설정을 제한적으로
CORS(app, resources={
    r"/*": {
        "origins": ["http://188.166.255.196", "https://188.166.255.196"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    },
    r"/public/*": {"origins": "*"}
})

# 환경 변수 설정
DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
HOST = os.environ.get('FLASK_HOST', '0.0.0.0')  # 기본값 0.0.0.0
PORT = int(os.environ.get('FLASK_PORT', 5000))

# 환경 변수 추가
ADMIN_ID = os.environ.get('ADMIN_ID', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin963')

# 캐시 설정 개선
slide_cache = TTLCache(maxsize=int(os.environ.get('SLIDE_CACHE_SIZE', 20)), 
                      ttl=int(os.environ.get('SLIDE_CACHE_TTL', 3600)))
tile_cache = LRUCache(maxsize=int(os.environ.get('TILE_CACHE_SIZE', 10000)))

# 세션 설정
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
Session(app)

# secret key 설정 수정
try:
    with open('/root/viewer/secret_key.txt', 'r') as f:
        app.secret_key = f.read().strip()
except Exception as e:
    logger.error(f"Error loading secret key: {str(e)}")
    # 임시 secret key 생성
    import secrets
    app.secret_key = secrets.token_hex(16)

# 로그인 상태 확인 데코레이터
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

# 에러 핸들링 개선
@app.errorhandler(Exception)
def handle_error(error):
    logger.error(f"Unexpected error: {str(error)}", exc_info=True)
    return jsonify({
        'error': 'Internal server error',
        'message': str(error) if DEBUG else 'An unexpected error occurred'
    }), 500

# 파일 업로드 크기 제한
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1GB

# 보안 헤더 추가
@app.after_request
def add_security_headers(response):
    # 기존 헤더 유지
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # CSP 헤더 수정
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "img-src 'self' data: blob: http://188.166.255.196; "  # blob: 추가
        "script-src 'self' 'unsafe-inline' cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' cdnjs.cloudflare.com; "
        "connect-src 'self' http://188.166.255.196; "  # connect-src 추가
        "worker-src blob: 'self'"  # worker-src 추가
    )
    
    return response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
DATA_FOLDER = os.path.join(BASE_DIR, 'data')
STATIC_FOLDER = os.path.join(BASE_DIR, 'static')
PUBLIC_FILES_PATH = os.path.join(BASE_DIR, 'public_files.json')

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(DATA_FOLDER):
    os.makedirs(DATA_FOLDER)

def get_data_path(filename):
    return os.path.join(DATA_FOLDER, f"{filename}.json")

def load_file_data(filename):
    data_path = get_data_path(filename)
    if os.path.exists(data_path):
        with open(data_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'memos': [], 'annotations': []}

def save_file_data(filename, data):
    data_path = get_data_path(filename)
    with open(data_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    return send_from_directory(STATIC_FOLDER, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    try:
        return send_from_directory(STATIC_FOLDER, filename)
    except Exception as e:
        logger.error(f"Error serving static file {filename}: {str(e)}")
        return jsonify({'error': 'File not found'}), 404

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ['svs', 'ndpi']

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    try:
        logger.info("Upload request received")
        if 'file' not in request.files:
            logger.error("No file part in request")
            return jsonify({'error': '파일이 없습니다'}), 400
            
        file = request.files['file']
        if file.filename == '':
            logger.error("No selected file")
            return jsonify({'error': '선택된 파일이 없습니다'}), 400
            
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            logger.info(f"Saving file: {filename}")
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(file_path)
            logger.info(f"File saved successfully: {file_path}")
            return jsonify({'message': '파일이 업로드되었습니다'})
        else:
            logger.error("Invalid file type")
            return jsonify({'error': 'SVS 또는 NDPI 파일만 업로드 가능합니다'}), 400
            
    except Exception as e:
        logger.error(f"Upload error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

def get_tile_cache_path(filename, level, x, y):
    basename = os.path.splitext(filename)[0]
    cache_dir = os.path.join(TILE_CACHE_DIR, basename, str(level))
    os.makedirs(cache_dir, exist_ok=True)
    return os.path.join(cache_dir, f"{x}_{y}.jpg")

def get_slide(slide_path):
    try:
        if slide_path not in slide_cache:
            logger.info(f"Loading slide: {slide_path}")
            slide_cache[slide_path] = openslide.OpenSlide(slide_path)
        return slide_cache[slide_path]
    except Exception as e:
        logger.error(f"Error loading slide {slide_path}: {str(e)}")
        raise

def get_tile_image(slide_path, level, x, y, tile_size):
    try:
        cache_key = f"{slide_path}_{level}_{x}_{y}_{tile_size}"
        
        if cache_key in tile_cache:
            return tile_cache[cache_key]
            
        slide = get_slide(slide_path)
        level_dimensions = slide.level_dimensions[level]
        scale_factor = slide.level_downsamples[level]
        
        # 레벨 0 기준의 절대 좌표 계산
        x_pos = int(x * tile_size * scale_factor)  # 현재 레벨의 타일 위치를 레벨 0 좌표로 변환
        y_pos = int(y * tile_size * scale_factor)
        
        # 현재 레벨에서의 타일 크기
        level_tile_size = tile_size
        
        try:
            # 타일 읽기 - 레벨 0 기준 좌표 사용
            region = slide.read_region((x_pos, y_pos), level, (level_tile_size, level_tile_size))
            
            # RGBA를 RGB로 변환
            if region.mode == 'RGBA':
                region = region.convert('RGB')
            
            # 타일 크기가 다른 경우 리사이즈
            if region.size != (tile_size, tile_size):
                region = region.resize((tile_size, tile_size), PIL.Image.Resampling.LANCZOS)
            
            print(f"Successfully generated tile - Level: {level}, X: {x}, Y: {y}, "
                  f"Pos: ({x_pos}, {y_pos}), Size: {region.size}")
            
            # 캐시 저장
            tile_cache[cache_key] = region
            return region
            
        except Exception as e:
            print(f"Error reading region: {str(e)}")
            return PIL.Image.new('RGB', (tile_size, tile_size), 'white')
        
    except Exception as e:
        print(f"Error in get_tile_image: {str(e)}")
        return PIL.Image.new('RGB', (tile_size, tile_size), 'white')

def load_public_files():
    try:
        if os.path.exists(PUBLIC_FILES_PATH):
            with open(PUBLIC_FILES_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                print(f"Loaded public files from: {PUBLIC_FILES_PATH}")
                print(f"Loaded data: {data}")
                return data
        else:
            print(f"Public files path does not exist: {PUBLIC_FILES_PATH}")
            save_public_files({})
    except Exception as e:
        print(f"Error loading public files: {str(e)}")
        print(f"Current working directory: {os.getcwd()}")
    return {}

def save_public_files(data=None):
    try:
        if data is None:
            data = public_files
        os.makedirs(os.path.dirname(PUBLIC_FILES_PATH), exist_ok=True)
        
        with open(PUBLIC_FILES_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Successfully saved public files to: {PUBLIC_FILES_PATH}")
            print(f"Saved content: {data}")
        
        if os.path.exists(PUBLIC_FILES_PATH):
            with open(PUBLIC_FILES_PATH, 'r', encoding='utf-8') as f:
                saved_data = json.load(f)
                print(f"Verification - read back data: {saved_data}")
                return True
        return False
    except Exception as e:
        print(f"Error saving public files: {str(e)}")
        print(f"Current working directory: {os.getcwd()}")
        return False

@app.route('/files/<filename>/toggle-public', methods=['POST'])
def toggle_file_public(filename):
    try:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(file_path):
            return jsonify({'error': '파일을 찾을 수 없습니다'}), 404
        
        is_public = public_files.get(filename, False)
        public_files[filename] = not is_public
        
        if save_public_files():
            print(f"Successfully toggled public state for {filename}: {not is_public}")
            print(f"Current public files: {public_files}")
            return jsonify({
                'message': '파일이 {}되었습니다'.format('공개' if not is_public else '비공개'),
                'is_public': not is_public
            })
        else:
            return jsonify({'error': '상태 저장에 실패했습니다'}), 500
            
    except Exception as e:
        print(f"Error in toggle_public: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/files')
@login_required
def get_files():
    try:
        files = []
        for filename in os.listdir(UPLOAD_FOLDER):
            if filename.endswith('.svs'):
                file_path = os.path.join(UPLOAD_FOLDER, filename)
                stat = os.stat(file_path)
                files.append({
                    'name': filename,
                    'date': stat.st_mtime,
                    'size': stat.st_size,
                    'is_public': public_files.get(filename, False),
                    'public_url': f'/public/{filename}' if public_files.get(filename, False) else None
                })
        return jsonify(files)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/files/<filename>', methods=['DELETE'])
def delete_file(filename):
    try:
        # 파일 경로 로깅
        logger.info(f"Attempting to delete file: {filename}")
        logger.info(f"Full path: {os.path.join(UPLOAD_FOLDER, filename)}")
        
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.exists(file_path):
            # 파일 삭제
            os.remove(file_path)
            logger.info(f"File removed: {file_path}")
            
            # 관련 데이터 파일 삭제
            data_path = get_data_path(filename)
            if os.path.exists(data_path):
                os.remove(data_path)
                logger.info(f"Data file removed: {data_path}")
            
            # 캐시에서 제거
            slide_path = os.path.join(UPLOAD_FOLDER, filename)
            if slide_path in slide_cache:
                del slide_cache[slide_path]
            
            # public_files에서 제거
            if filename in public_files:
                del public_files[filename]
                save_public_files()
            
            return jsonify({'message': '파일이 삭제되었습니다'})
        else:
            logger.error(f"File not found: {file_path}")
            return jsonify({'error': '파일을 찾을 수 없습니다'}), 404
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/files/<filename>/rename', methods=['POST'])
def rename_file(filename):
    try:
        data = request.json
        new_name = data.get('newName')
        if not new_name:
            return jsonify({'error': '새 파일명이 필요합니다'}), 400

        old_path = os.path.join(UPLOAD_FOLDER, filename)
        new_path = os.path.join(UPLOAD_FOLDER, new_name)
        
        if not os.path.exists(old_path):
            return jsonify({'error': '파일을 찾을 수 없습니다'}), 404
        
        if os.path.exists(new_path):
            return jsonify({'error': '이미 존재하는 파일명입니다'}), 400
        
        os.rename(old_path, new_path)
        
        old_data_path = get_data_path(filename)
        new_data_path = get_data_path(new_name)
        if os.path.exists(old_data_path):
            os.rename(old_data_path, new_data_path)
        
        return jsonify({'message': '파일 이름이 변경되었습니다'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/public/<path:filename>')
def serve_public_file(filename):
    try:
        print(f"Accessing public file: {filename}")
        print(f"Current public files: {public_files}")
        
        if filename not in public_files:
            return "File not found", 404
            
        if not public_files[filename]:
            return "File is not public", 403
            
        return send_file('viewer.html')
        
    except Exception as e:
        print(f"Error serving public file: {str(e)}")
        return str(e), 500

@app.route('/slide/<filename>/info')
def get_slide_info(filename):
    try:
        slide_path = os.path.join(UPLOAD_FOLDER, filename)
        
        if slide_path not in slide_cache:
            slide_cache[slide_path] = openslide.OpenSlide(slide_path)
        slide = slide_cache[slide_path]
        
        tile_size = 2048
        
        info = {
            'dimensions': slide.dimensions,
            'level_count': slide.level_count,
            'level_dimensions': slide.level_dimensions,
            'level_downsamples': [float(ds) for ds in slide.level_downsamples],
            'tile_size': tile_size,
            'properties': dict(slide.properties)
        }
        
        return jsonify(info)
    except Exception as e:
        print(f"Error in get_slide_info: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/slide/<filename>/tile/<int:level>/<int:x>/<int:y>')
def get_tile(filename, level, x, y):
    try:
        slide_path = os.path.join(UPLOAD_FOLDER, filename)
        tile_size = 2048
        
        cache_key = f"{slide_path}_{level}_{x}_{y}"
        
        # 캐시된 이미지가 있는지 확인
        cached_tile = tile_cache.get(cache_key)
        if cached_tile is not None:
            output = io.BytesIO()
            cached_tile.save(output, format='JPEG', quality=90)
            output.seek(0)
            response = make_response(send_file(
                output,
                mimetype='image/jpeg',
                as_attachment=False
            ))
            response.headers['Cache-Control'] = 'public, max-age=3600'
            return response
        
        if slide_path not in slide_cache:
            slide_cache[slide_path] = openslide.OpenSlide(slide_path)
        slide = slide_cache[slide_path]
        
        tile = get_tile_image(slide_path, level, x, y, tile_size)
        # 타일 이미지를 캐시에 저장
        tile_cache[cache_key] = tile.copy()
        
        output = io.BytesIO()
        tile.save(output, format='JPEG', quality=90)
        output.seek(0)
        
        response = make_response(send_file(
            output,
            mimetype='image/jpeg',
            as_attachment=False
        ))
        
        response.headers['Cache-Control'] = 'public, max-age=3600'
        return response
        
    except Exception as e:
        print(f"Error in get_tile: {str(e)}")
        return jsonify({'error': str(e)}), 500

def pregenerate_tiles(slide_path, filename):
    slide = get_slide(slide_path)
    tile_size = 1024
    level = slide.level_count - 1
    
    dimensions = slide.level_dimensions[level]
    tiles_x = int(dimensions[0] / tile_size) + 1
    tiles_y = int(dimensions[1] / tile_size) + 1
    
    for x in range(tiles_x):
        for y in range(tiles_y):
            get_tile_image(slide_path, level, x, y, tile_size)

@app.route('/slide/<filename>/data', methods=['GET'])
def get_slide_data(filename):
    try:
        data = load_file_data(filename)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/slide/<filename>/data', methods=['POST'])
def save_slide_data(filename):
    try:
        data = request.json
        save_file_data(filename, data)
        return jsonify({'message': '저장되었습니다'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if not os.path.exists(PUBLIC_FILES_PATH):
    print(f"Creating initial public_files.json at: {PUBLIC_FILES_PATH}")
    save_public_files({})

try:
    if os.path.exists(PUBLIC_FILES_PATH):
        with open(PUBLIC_FILES_PATH, 'r') as f:
            public_files = json.load(f)
    else:
        public_files = {}
        with open(PUBLIC_FILES_PATH, 'w') as f:
            json.dump(public_files, f)
except Exception as e:
    logger.error(f"Error loading public_files: {str(e)}")
    public_files = {}

def save_public_files():
    try:
        with open(PUBLIC_FILES_PATH, 'w') as f:
            json.dump(public_files, f)
        return True
    except Exception as e:
        logger.error(f"Error saving public_files: {str(e)}")
        return False

@app.route('/public/<path:filename>/info')
def get_public_slide_info(filename):
    try:
        if filename not in public_files or not public_files[filename]:
            return jsonify({'error': 'File not accessible'}), 403
            
        slide_path = os.path.join(UPLOAD_FOLDER, filename)
        
        if slide_path not in slide_cache:
            slide_cache[slide_path] = openslide.OpenSlide(slide_path)
        slide = slide_cache[slide_path]
        
        tile_size = 2048
        
        info = {
            'dimensions': slide.dimensions,
            'level_count': slide.level_count,
            'level_dimensions': slide.level_dimensions,
            'level_downsamples': [float(ds) for ds in slide.level_downsamples],
            'tile_size': tile_size,
            'properties': dict(slide.properties)
        }
        
        return jsonify(info)
    except Exception as e:
        print(f"Error in get_public_slide_info: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/public/<path:filename>/tile/<int:level>/<int:x>/<int:y>')
def get_public_tile(filename, level, x, y):
    try:
        if filename not in public_files or not public_files[filename]:
            return jsonify({'error': 'File not accessible'}), 403
            
        slide_path = os.path.join(UPLOAD_FOLDER, filename)
        tile_size = 2048
        
        cache_key = f"{slide_path}_{level}_{x}_{y}"
        
        # 캐시된 이미지가 있는지 확인
        cached_tile = tile_cache.get(cache_key)
        if cached_tile is not None:
            output = io.BytesIO()
            cached_tile.save(output, format='JPEG', quality=90)
            output.seek(0)
            response = make_response(send_file(
                output,
                mimetype='image/jpeg',
                as_attachment=False
            ))
            response.headers['Cache-Control'] = 'public, max-age=3600'
            return response
        
        if slide_path not in slide_cache:
            slide_cache[slide_path] = openslide.OpenSlide(slide_path)
        slide = slide_cache[slide_path]
        
        tile = get_tile_image(slide_path, level, x, y, tile_size)
        # 타일 이미지를 캐시에 저장
        tile_cache[cache_key] = tile.copy()
        
        output = io.BytesIO()
        tile.save(output, format='JPEG', quality=90)
        output.seek(0)
        
        response = make_response(send_file(
            output,
            mimetype='image/jpeg',
            as_attachment=False
        ))
        
        response.headers['Cache-Control'] = 'public, max-age=3600'
        return response
        
    except Exception as e:
        print(f"Error in get_public_tile: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 로그인 엔드포인트 추가
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    if data.get('id') == ADMIN_ID and data.get('password') == ADMIN_PASSWORD:
        session['logged_in'] = True  # 세션에 로그인 상태 저장
        return jsonify({'success': True})
    return jsonify({'success': False}), 401

if __name__ == '__main__':
    # 프로덕션 환경에서는 gunicorn이나 uwsgi 사용
    app.run(host=HOST, port=PORT, debug=DEBUG)