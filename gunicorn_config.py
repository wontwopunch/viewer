import multiprocessing
import os

# 워커 설정
workers = multiprocessing.cpu_count() * 2 + 1
threads = 2
worker_class = 'gthread'

# 타임아웃 설정
timeout = 120
keepalive = 5

# 로깅 설정
accesslog = '/root/viewer/access.log'
errorlog = '/root/viewer/error.log'
loglevel = 'debug'  # 디버깅을 위해 임시로 debug로 설정

# 바인딩
bind = '0.0.0.0:8000' 