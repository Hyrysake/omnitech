"""Перевірка Docker-запуску OmniTech (лабораторна 08). Лише стандартна бібліотека Python, потрібен Docker.

    python scripts/docker_smoke.py            зібрати, запустити, перевірити, зупинити (volumes видаляються)
    python scripts/docker_smoke.py --no-up    стек уже запущено (так працює GitHub Actions): збирання пропускаємо
    python scripts/docker_smoke.py --keep     після перевірки нічого не зупиняти

Порт береться зі змінної HTTP_PORT (за замовчуванням 8080), назва проєкту Compose — з COMPOSE_PROJECT_NAME.
Якщо якась частина ще є заглушкою (база lab08-base), її перевірки отримують SKIP, а не FAIL.
Код виходу 0, якщо немає жодного FAIL.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = os.environ.get('HTTP_PORT', '8080')
BASE = f'http://localhost:{PORT}'
USER = {'name': 'Smoke Test', 'email': 'smoke@example.com', 'password': 'Smoke-pass-123', 'password_confirm': 'Smoke-pass-123'}
MAX_BACKEND_MB = 250
results = {'PASS': 0, 'FAIL': 0, 'SKIP': 0}


def report(status, name, detail=''):
    results[status] += 1
    print(f'  [{status}] {name}' + (f': {detail}' if detail else ''), flush=True)


def check(name, ok, detail=''):
    report('PASS' if ok else 'FAIL', name, '' if ok else detail)
    return bool(ok)


def compose(*args, check=True):
    """Запускає `docker compose ...` у корені проєкту. Повертає (код, вивід)."""
    run = subprocess.run(['docker', 'compose', *args], cwd=ROOT, capture_output=True, text=True,
                         encoding='utf-8', errors='replace')
    out = run.stderr + run.stdout          # stdout (результат команди) в кінці
    if check and run.returncode != 0:
        raise RuntimeError(f'docker compose {" ".join(args)} -> {run.returncode}\n{out[-600:]}')
    return run.returncode, out


def http(path, method='GET', body=None, form=False):
    """Повертає (код, заголовки, тіло). Коди 4xx/5xx — не виняток."""
    data, headers = None, {}
    if body is not None:
        data = urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, resp.headers, resp.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as err:
        return err.code, err.headers, err.read().decode('utf-8', 'replace')


def login():
    form = {'username': USER['email'], 'password': USER['password']}
    return http('/api/v1/auth/token', 'POST', form, form=True)[0]


def wait_healthy(seconds=90):
    """Чекає, поки /api/health відповість 200 (наприклад, після перезапуску контейнера)."""
    end = time.time() + seconds
    while time.time() < end:
        try:
            if http('/api/health')[0] == 200:
                return True
        except OSError:
            pass
        time.sleep(2)
    return False


def docker_inspect(service, fmt):
    cid = compose('ps', '-q', service)[1].split()[-1]
    return subprocess.run(['docker', 'inspect', '--format', fmt, cid], capture_output=True, text=True).stdout.strip()


def check_config():
    print('Конфігурація')
    if not os.path.exists(os.path.join(ROOT, '.env')):
        shutil.copyfile(os.path.join(ROOT, '.env.example'), os.path.join(ROOT, '.env'))
        print('  .env створено з .env.example')
    code1, out1 = compose('config', '--quiet', check=False)
    code2, out2 = compose('-f', 'compose.dev.yaml', 'config', '--quiet', check=False)
    check('compose.yaml і compose.dev.yaml коректні (docker compose config)', code1 == 0 and code2 == 0, out1 + out2)
    return json.loads(compose('--profile', 'ops', 'config', '--format', 'json')[1])      # з профілем ops, щоб бачити й backup


def check_site(backend_stub, frontend_stub):
    print('Сайт і API через Nginx')
    if backend_stub:
        report('SKIP', 'бекенд ще заглушка', '/api/health відповідає {"status": "stub"}')
    else:
        health = http('/api/health')[2]
        check(f':{PORT}/api/health через Nginx: 200, база ok', json.loads(health) == {'status': 'ok', 'database': 'ok'}, health)
        code, _, body = http('/api/v1/products')
        check('/api/v1/products віддає JSON', code == 200 and 'items' in body, f'{code} {body[:100]}')
    if frontend_stub:
        report('SKIP', 'сайт ще заглушка', 'перевірки сторінок, 404 і /media пропущено')
        return
    codes = {p: http(p)[0] for p in ['/', '/catalog.html', '/login.html', '/register.html', '/about.html', '/admin/index.html']}
    check('публічні сторінки віддають 200', set(codes.values()) == {200}, str(codes))
    with open(os.path.join(ROOT, 'frontend', '404.html'), encoding='utf-8') as f:
        title = re.search(r'<title>(.*?)</title>', f.read()).group(1)
    code, _, body = http('/no-such-page.html')
    check('невідома сторінка: статус 404 і сторінка 404.html', code == 404 and f'<title>{title}</title>' in body, str(code))
    script = re.search(r'src="(/assets/[^"]+\.js)"', http('/')[2])
    check('збирання без адреси 127.0.0.1:8000 (сайт ходить в API відносними адресами)',
          script and '127.0.0.1:8000' not in http(script.group(1))[2], 'у зібраному JS лишилась адреса розробки')
    if backend_stub:
        return
    compose('exec', '-T', 'backend', 'python', '-c',
            "import pathlib; p = pathlib.Path('/app/media/products'); p.mkdir(parents=True, exist_ok=True); (p / 'smoke.txt').write_text('smoke')")
    code, _, body = http('/media/products/smoke.txt')
    check('/media проксується на бекенд', code == 200 and body == 'smoke', f'{code} {body[:60]}')
    compose('exec', '-T', 'backend', 'python', '-c', "import os; os.remove('/app/media/products/smoke.txt')")


def check_backend(cfg):
    print('Розмір образу')
    size = int(subprocess.run(['docker', 'image', 'inspect', '--format', '{{.Size}}', cfg['services']['backend']['image']],
                              capture_output=True, text=True).stdout or 0)
    check(f'образ бекенду менший за {MAX_BACKEND_MB} МБ', 0 < size < MAX_BACKEND_MB * 1024 * 1024, f'{size / 1024 / 1024:.0f} МБ')

    print('Збереження даних (volume)')
    http('/api/v1/auth/register', 'POST', USER)
    check('користувач зареєстрований і може увійти', login() == 200, 'вхід не вдався')
    compose('down')                                  # без -v: volumes лишаються
    compose('up', '--wait', '--wait-timeout', '120')
    check('після down і up користувач на місці (база у volume)', login() == 200, 'користувач зник')

    print('Restart policy')
    before = int(docker_inspect('backend', '{{.RestartCount}}'))
    compose('exec', '-T', 'backend', 'sh', '-c', 'kill 1')
    time.sleep(3)
    healthy = wait_healthy()
    after = int(docker_inspect('backend', '{{.RestartCount}}'))
    check('після kill 1 контейнер перезапустився сам і знову відповідає', healthy and after > before,
          f'було {before}, стало {after}, відповідає={healthy}')


def check_backup(cfg):
    print('Резервна копія й відновлення')
    if cfg['services'].get('backup', {}).get('image', '').startswith('busybox'):
        report('SKIP', 'backup/restore', 'сервіс backup ще заглушка')
        return
    run = ['--profile', 'ops', 'run', '--rm', '-T', 'backup', 'python']
    out = compose(*run, '/scripts/backup_db.py')[1]
    found = re.findall(r'(/\S+\.db)\s*$', out.strip())
    if not check('backup_db.py створив файл копії', found, out[-300:]):
        return
    compose('exec', '-T', 'backend', 'python', '-c',
            "import sqlite3; c = sqlite3.connect('/app/data/omnitech.db'); "
            f"c.execute('DELETE FROM users WHERE email = ?', ('{USER['email']}',)); c.commit()")
    check('після видалення рядка вхід не працює', login() != 200, 'рядок не видалився')
    out = compose(*run, '/scripts/restore_db.py', found[-1])[1]
    check('restore_db.py повернув видалений рядок', login() == 200, out[-300:])


def run_checks(args):
    cfg = check_config()
    if not args.no_up:
        print('Збирання й запуск (docker compose up --build --wait)')
        code, out = compose('up', '--build', '--wait', '--wait-timeout', '240', check=False)
        if not check('усі сервіси стали healthy', code == 0, out[-500:]):
            return
    ps = [json.loads(line) for line in compose('ps', '--format', 'json')[1].splitlines() if line.startswith('{')]
    bad = [f"{p['Service']}={p.get('Health') or p['State']}" for p in ps if p.get('Health') != 'healthy']
    check('docker compose ps: усі контейнери healthy', ps and not bad, ', '.join(bad))

    backend_stub = '"stub"' in http('/api/health')[2]
    frontend_stub = http('/')[1].get('X-OmniTech-Stub') == 'frontend'
    check_site(backend_stub, frontend_stub)
    if backend_stub:
        report('SKIP', 'розмір образу, збереження даних, restart policy, backup', 'бекенд ще заглушка')
        return
    check_backend(cfg)
    check_backup(cfg)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--no-up', action='store_true', help='стек уже запущено, не збирати')
    parser.add_argument('--keep', action='store_true', help='не зупиняти контейнери після перевірки')
    args = parser.parse_args()
    try:
        run_checks(args)
    except Exception as err:   # зламаний compose, Docker не запущено тощо — це теж FAIL, а не traceback
        report('FAIL', 'перевірка перервалась', str(err))
    finally:
        if not args.keep:
            compose('--profile', 'ops', 'down', '-v', check=False)      # з профілем ops, щоб видалити й volume з копіями
    print(f'SMOKE: {results["PASS"]} pass, {results["FAIL"]} fail, {results["SKIP"]} skip')
    sys.exit(1 if results['FAIL'] else 0)


if __name__ == '__main__':
    main()
