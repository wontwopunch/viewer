import multiprocessing
import os

# 워커 설정
workers = 3
threads = 2
worker_class = 'sync'

# 타임아웃 설정
timeout = 120
keepalive = 5

# 로깅 설정
accesslog = '/root/viewer/access.log'
errorlog = '/root/viewer/error.log'
loglevel = 'debug'

# 바인딩
bind = '0.0.0.0:8000'

# 프로세스 관리
pidfile = '/tmp/viewer.pid'
daemon = False
preload_app = True

# 추가 설정
max_requests = 1000
max_requests_jitter = 50
graceful_timeout = 10 