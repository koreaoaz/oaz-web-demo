"""서버 접속 없이 탐색/실패/정리 경계를 검증한다."""
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from helpers.local_postgres import LocalPostgres, PostgreSQLUnavailable, discover_bin


class HarnessTest(unittest.TestCase):
    def test_explicit_missing_is_configuration_error(self):
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, {'OAZ_TEST_PG_BIN': temp}, clear=True):
            with self.assertRaises(RuntimeError) as failure:
                discover_bin()
            self.assertNotIsInstance(failure.exception, PostgreSQLUnavailable)

    def test_explicit_complete_directory(self):
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, {'OAZ_TEST_PG_BIN': temp}, clear=True):
            for name in ('psql', 'initdb', 'pg_ctl'):
                path = Path(temp) / (name + ('.exe' if os.name == 'nt' else ''))
                path.write_text('fake, not executed', encoding='ascii')
                path.chmod(0o700)
            self.assertEqual(discover_bin(), Path(temp).resolve())

    def test_missing_installation_is_distinct(self):
        with patch.dict(os.environ, {}, clear=True), patch('helpers.local_postgres.shutil.which', return_value=None), patch.object(Path, 'glob', return_value=[]):
            with self.assertRaises(PostgreSQLUnavailable):
                discover_bin()

    def test_cleanup_refuses_foreign_path(self):
        pg = LocalPostgres()
        pg.root = Path(tempfile.gettempdir()).resolve() / 'not-owned'
        pg.data = pg.root / 'data'
        with self.assertRaises(RuntimeError):
            pg.cleanup()

    def test_cleanup_stops_before_removing(self):
        with tempfile.TemporaryDirectory(prefix='oaz_pg_fixture_') as temp:
            pg = LocalPostgres(); pg.root = Path(temp).resolve(); pg.data = pg.root / 'data'; pg.data.mkdir()
            (pg.data / 'PG_VERSION').write_text('17', encoding='ascii')
            pg.bin = Path(temp); pg.env = {}; pg.flags = 0
            actions = []
            with patch('helpers.local_postgres.subprocess.run', return_value=SimpleNamespace(returncode=0)), patch.object(pg, 'control', side_effect=lambda *a: actions.append('stop')), patch('helpers.local_postgres.shutil.rmtree', side_effect=lambda *a: actions.append('remove')):
                pg.cleanup()
            self.assertEqual(actions, ['stop', 'remove'])


if __name__ == '__main__':
    unittest.main()
