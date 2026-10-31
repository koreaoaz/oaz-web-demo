export async function persistOrder<T extends { id: number }>(_table: string, _items: T[]) {
  void _table; void _items;
  throw new Error("데모에서 ID를 변경하는 정렬 저장은 지원하지 않습니다.");
}
