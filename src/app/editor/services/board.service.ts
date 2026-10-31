import { supabase } from "@/lib/supabaseClient"
import type { EditorRelation, EditorRow, EditorTable, EditorUpdate } from "@/types/editor"

// ID 필터는 모든 테이블의 공통 컬럼만 표현하고, SELECT 결과는 아래에서 실제 Row<T>로 지정한다.
type IdFilteredRelation<T extends EditorTable> = Omit<EditorRelation<T>, "Row"> & {
  Row: Pick<EditorRow, "id">
}

export async function fetchPosts<T extends EditorTable>(table: T): Promise<EditorRow<T>[]> {
  const { data, error } = await supabase
    .from<T, EditorRelation<T>>(table)
    .select<string, EditorRow<T>>(table === "editor_5_donators" ? "id,name,date,created_at" : "*")
    .order("id", { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function deletePost(table: string, id: number) {
  return supabase.from(table).delete().eq("id", id)
}

// 기존 Form의 전송 값에는 스키마 충돌이 남아 있다. 검증된 EditorInsert로 단정하지 않는다.
// unknown은 검증 전 전달 경계이며, 스키마 검사나 운영 저장 성공을 보장하지 않는다.
export async function insertPost(table: EditorTable, payload: unknown) {
  if (table === "editor_5_donators") {
    const result = await supabase.from(table).insert(payload).select<"id,name,date,created_at", EditorRow<"editor_5_donators">>("id,name,date,created_at").single()
    if (result.error) throw result.error
    return result.data
  }
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updatePost<T extends EditorTable>(
  table: T,
  id: number,
  payload: EditorUpdate<NoInfer<T>>
) {
  const query = supabase.from<T, IdFilteredRelation<T>>(table).update(payload).eq("id", id)
  const selection = table === "editor_5_donators"
    ? query.select<"id,name,date,created_at", EditorRow<T>>("id,name,date,created_at")
    : query.select<"*", EditorRow<T>>()
  const { data, error } = await selection.single()

  if (error) throw error
  return data
}
