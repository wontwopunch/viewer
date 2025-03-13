import multiprocessing

# 워커 설정
workers = multiprocessing.cpu_count() * 2 + 1
threads = 2
worker_class = 'gthread'

# 타임아웃 설정
timeout = 120
keepalive = 5

# 로깅 설정
accesslog = 'access.log'
errorlog = 'error.log'
loglevel = 'info'

# 바인딩
bind = '0.0.0.0:5000' 