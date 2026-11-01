"""외부 접속 설정을 무시하고 loopback의 새 임시 PostgreSQL만 실행한다."""
import os
import secrets
import shutil
import socket
import subprocess
import tempfile
from pathlib import Path


class PostgreSQLUnavailable(RuntimeError):
    """미설치: 테스트 실패와 구분하여 호출자가 종료 코드 77을 반환한다."""


def discover_bin():
    suffix = '.exe' if os.name == 'nt' else ''
    names = ['initdb', 'pg_ctl', 'psql']
    explicit = os.environ.get('OAZ_TEST_PG_BIN')
    candidates = []
    if explicit:
        candidates.append(Path(explicit))
    else:
        for name in names:
            found = shutil.which(name)
            if found:
                candidates.append(Path(found).parent)
        config = shutil.which('pg_config')
        if config:
            result = subprocess.run([config, '--bindir'], capture_output=True, text=True, timeout=15)
            if result.returncode == 0:
                candidates.append(Path(result.stdout.strip()))
        if os.name == 'nt':
            for var in ('ProgramW6432', 'ProgramFiles', 'ProgramFiles(x86)'):
                parent = os.environ.get(var)
                if parent:
                    candidates.extend(sorted((Path(parent) / 'PostgreSQL').glob('*/bin'), reverse=True))
        else:
            candidates.extend(sorted(Path('/usr/lib/postgresql').glob('*/bin'), reverse=True))
            candidates.extend(sorted(Path('/opt/homebrew/opt').glob('postgresql*/bin'), reverse=True))
            candidates.extend(sorted(Path('/usr/local/opt').glob('postgresql*/bin'), reverse=True))
    for candidate in candidates:
        if all((candidate / (name + suffix)).is_file() and os.access(candidate / (name + suffix), os.X_OK) for name in names):
            return candidate.resolve()
    if explicit:
        raise RuntimeError('OAZ_TEST_PG_BIN에 initdb/pg_ctl/psql 실행 파일이 모두 필요합니다.')
    raise PostgreSQLUnavailable('SKIP: PostgreSQL 실행 파일 미설치. 설치 후 OAZ_TEST_PG_BIN 또는 PATH를 설정하세요. (종료 코드 77)')


class LocalPostgres:
    def __enter__(self):
        self.bin = discover_bin()
        if os.name != 'nt' and os.geteuid() == 0:
            raise RuntimeError('격리 PostgreSQL 테스트는 root가 아닌 로컬 사용자로 실행하세요.')
        self.root = Path(tempfile.mkdtemp(prefix='oaz_pg_fixture_')).resolve()
        self.data = self.root / 'data'
        self.env = {k: v for k, v in os.environ.items() if not k.upper().startswith('PG')}
        self.env['PGCLIENTENCODING'] = 'UTF8'
        self.env['PGPASSWORD'] = secrets.token_hex(32)
        self.flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            self.port = probe.getsockname()[1]
        self.psql = [self.exe('psql'), '-X', '-h', '127.0.0.1', '-p', str(self.port), '-U', 'fixture', '-d', 'postgres', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1']
        password = self.root / 'init-password'
        try:
            try:
                password.write_text(self.env['PGPASSWORD'] + '\n', encoding='ascii')
                password.chmod(0o600)
                self.control([self.exe('initdb'), '-D', str(self.data), '-U', 'fixture', '--auth=scram-sha-256', '--pwfile', str(password), '--no-locale', '--encoding=UTF8'], '초기화')
            finally:
                password.unlink(missing_ok=True)
            # Unix 소켓도 임시 디렉터리로 한정. TCP는 loopback만 허용한다.
            options = f'-h 127.0.0.1 -p {self.port}'
            if os.name != 'nt':
                options += f' -k "{self.root}"'
            self.control([self.exe('pg_ctl'), '-D', str(self.data), '-l', str(self.root / 'server.log'), '-o', options, '-w', 'start'], '시작', capture=False)
            assert self.query('SELECT 1;').stdout.strip() == '1'
            return self
        except BaseException:
            self.cleanup()
            raise

    def exe(self, name):
        return str(self.bin / (name + ('.exe' if os.name == 'nt' else '')))

    def control(self, command, label, capture=True):
        result = subprocess.run(command, stdout=subprocess.PIPE if capture else subprocess.DEVNULL, stderr=subprocess.PIPE if capture else subprocess.DEVNULL, env=self.env, timeout=120, creationflags=self.flags)
        if result.returncode:
            # 서버 로그는 임시 데이터만 담으며 비밀번호는 출력하지 않는다.
            detail = (result.stderr or b'').decode('utf8', errors='replace').replace(self.env['PGPASSWORD'], '[REDACTED]')[-1200:]
            raise RuntimeError(f'격리 PostgreSQL {label} 실패 (코드 {result.returncode}): {detail}')
        return result

    def query(self, sql, ok=True):
        result = subprocess.run(self.psql, input=sql, text=True, encoding='utf8', capture_output=True, env=self.env, timeout=60, creationflags=self.flags)
        if ok and result.returncode:
            raise AssertionError('로컬 SQL 테스트 실패: ' + result.stderr.replace(self.env['PGPASSWORD'], '[REDACTED]')[-1200:])
        return result

    def cleanup(self):
        # 생성한 정확한 data 디렉터리만 종료/정리한다. 서버 종료 실패 시 파일을 보존한다.
        if self.root.parent != Path(tempfile.gettempdir()).resolve() or not self.root.name.startswith('oaz_pg_fixture_') or self.data.parent != self.root:
            raise RuntimeError('임시 PostgreSQL 경로 검증 실패: 자동 정리 중단')
        if (self.data / 'PG_VERSION').exists():
            status = subprocess.run([self.exe('pg_ctl'), '-D', str(self.data), 'status'], capture_output=True, env=self.env, timeout=30, creationflags=self.flags)
            if status.returncode == 0:
                self.control([self.exe('pg_ctl'), '-D', str(self.data), '-m', 'fast', '-w', 'stop'], '종료')
            elif status.returncode != 3:
                raise RuntimeError('임시 서버 상태 확인 실패: 데이터 파일 보존')
        shutil.rmtree(self.root)
        print('PASS: 임시 PostgreSQL 서버 종료 및 데이터·로그 정리')

    def __exit__(self, exc_type, exc, traceback):
        self.cleanup()
