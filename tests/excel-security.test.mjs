import { test } from 'node:test';
import assert from 'node:assert/strict';
import writeExcelFile from 'write-excel-file/node';
import readExcelFile from 'read-excel-file/node';
import { unzipSync, strFromU8 } from 'fflate';

test('Excel 수식처럼 보이는 텍스트는 실제 xlsx에서 수식이 아닌 문자열이다', async () => {
  const cells = ['=1+1', '+SUM(1,2)', '-2+3', '@SUM(1)', '\t=1+1', '0012', '<script>'];
  const bytes = await writeExcelFile([cells], { sheet: 'Test' }).toBuffer();
  const rows = await readExcelFile(bytes, { trim: false });
  assert.deepEqual(rows[0], cells);
  const zip = unzipSync(bytes);
  const sheet = strFromU8(zip['xl/worksheets/sheet1.xml']);
  assert.doesNotMatch(sheet, /<f(?:\s|>)/);
});
