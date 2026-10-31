"""빌드 산출물의 실제 서버 시작 안전장치를 로컬에서만 확인한다."""
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
NEXT = ROOT / "node_modules" / "next" / "dist" / "bin" / "next"
DEMO_URL = "https://ctbwaqtqubmjmltbxfzm.supabase.co"
FAKE_KEY = "sb_publishable_offline_build_only"


def check(label, url, key, expected):
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(("NEXT_PUBLIC_SUPABASE", "DEMO_VISITOR_"))}
    env["NEXT_TELEMETRY_DISABLED"] = "1"
    if url is not None:
        env["NEXT_PUBLIC_SUPABASE_URL"] = url
    if key is not None:
        env["NEXT_PUBLIC_SUPABASE_KEY"] = key
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    p = subprocess.Popen(["node", str(NEXT), "start", "-H", "127.0.0.1", "-p", str(port)],
                         cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        status = None
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if p.poll() is not None:
                break
            try:
                with urlopen(f"http://127.0.0.1:{port}/", timeout=2) as response:
                    status = response.status
                break
            except HTTPError as exc:
                status = exc.code
                break
            except (URLError, TimeoutError, ConnectionResetError, ConnectionAbortedError):
                time.sleep(0.2)
        if expected:
            assert status == 200, f"{label}: 정상 서버 응답 실패 ({status})"
            try:
                urlopen(f"http://127.0.0.1:{port}/api/visitor", timeout=3)
                raise AssertionError("방문자 비밀 설정 없이 성공 응답")
            except HTTPError as exc:
                assert exc.code == 503, "미설정 방문자 API는 503이어야 함"
        else:
            assert status != 200, f"{label}: 잘못된 설정으로 서버가 실행됨"
            assert p.poll() is not None or status is not None, f"{label}: 실행 거부를 확인하지 못함"
        print(f"PASS {label}")
    finally:
        if p.poll() is None:
            p.terminate()
            try:
                p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait()


check("정상 Demo 설정 및 미설정 방문자 API", DEMO_URL, FAKE_KEY, True)
check("운영 URL 실행 차단", "https://maoefmwpdcnugyenyiea.supabase.co", FAKE_KEY, False)
check("공개키 누락 실행 차단", DEMO_URL, None, False)
check("빌드와 다른 공개키 실행 차단", DEMO_URL, "sb_publishable_other_fake_key", False)
