"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { deletePost, fetchPosts, insertPost, updatePost } from "../../services/board.service"
import { persistOrder } from "../../services/order.service"
import { useDragAndDrop } from "../../hooks/useDragAndDrop"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"
import { cx } from "../../utils/cx"
import { mergeNoticeOrder } from "../../utils/noticeOrder"
import type { NoticeRow } from "@/types/editor"

type NoticeFilter = "공지" | "홍보"

export function NoticeForm() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [postType, setPostType] = useState<NoticeFilter>("공지")
  const [loading, setLoading] = useState(false)

  const [posts, setPosts] = useState<NoticeRow[]>([])
  const latestPosts = useRef(posts)
  const dragSnapshot = useRef<{ posts: NoticeRow[]; rows: NoticeRow[]; filter: NoticeFilter } | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [filter, setFilter] = useState<NoticeFilter>("공지")
  const [listError, setListError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: number; field: "text" | "description"; value: string } | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const requestVersion = useRef(0)

  const startEditing = (post: NoticeRow, field: "text" | "description") => {
    if (savingRef.current) return
    setEditError(null)
    setEditing({ id: post.id, field, value: post[field] ?? "" })
  }

  const saveEdit = async () => {
    if (!editing || savingRef.current) return
    const { id, field, value } = editing
    savingRef.current = true
    setSaving(true)
    setEditError(null)
    try {
      await updatePost(BOARD_TABLE_MAP["공지"], id, { [field]: value })
      setEditing(null)
      await loadPosts()
    } catch {
      setEditError("수정 내용을 저장하지 못했습니다. 권한과 연결 상태를 확인한 뒤 다시 시도해 주세요.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const fetchList = useCallback(() => {
    const version = ++requestVersion.current
    return fetchPosts(BOARD_TABLE_MAP["공지"]).then((data) => {
      if (version !== requestVersion.current) return
      latestPosts.current = data
      setPosts(data)
      setListError(null)
      setListLoading(false)
    }, () => {
      if (version !== requestVersion.current) return
      setListError("공지를 불러오지 못했습니다. 다시 시도해 주세요.")
      setListLoading(false)
    })
  }, [])
  const cancelPending = useCallback(() => { requestVersion.current++ }, [])

  const loadPosts = () => {
    setListLoading(true)
    setListError(null)
    return fetchList()
  }

  useEffect(() => {
    void fetchList()
    return cancelPending
  }, [fetchList, cancelPending])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    await insertPost(BOARD_TABLE_MAP["공지"], {
      text: title,
      description: body,
      created_at: new Date().toISOString(),
      is_noti: postType === "공지",
    })

    setTitle("")
    setBody("")
    setLoading(false)
    loadPosts()
  }

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return
    await deletePost(BOARD_TABLE_MAP["공지"], id)
    loadPosts()
  }

  const filteredPosts = posts.filter((post) =>
    filter === "공지" ? !!post.is_noti : !post.is_noti,
  )

  const matchesFilter = (post: { is_noti?: unknown }) =>
    filter === "공지" ? !!post.is_noti : !post.is_noti

  const drag = useDragAndDrop({
    items: filteredPosts,
    onReorder: async (reorderedFiltered) => {
      const snapshot = dragSnapshot.current
      const reorderedAll = snapshot && snapshot.posts === posts &&
        snapshot.posts === latestPosts.current && snapshot.filter === filter &&
        snapshot.rows.length === posts.length && snapshot.rows.every((row, index) => row === posts[index])
        ? mergeNoticeOrder(posts, reorderedFiltered, matchesFilter)
        : null
      dragSnapshot.current = null
      if (reorderedAll === null) {
        alert("목록이 변경되었거나 정렬 목록이 일치하지 않아 저장을 취소했습니다. 현재 목록에서 다시 드래그해 주세요.")
        return
      }

      latestPosts.current = reorderedAll
      setPosts(reorderedAll)
      await persistOrder(BOARD_TABLE_MAP["공지"], reorderedAll)
      loadPosts()
    },
  })

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">데모에서는 안전한 정렬 저장을 준비 중입니다.</p>
      {listError && <p role="alert" className="text-sm text-red-600">{listError}</p>}
      {editError && <p role="alert" className="text-sm text-red-600">{editError}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2 mb-2">
            {(["공지", "홍보"] as NoticeFilter[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPostType(type)}
                className={cx(
                  "px-3 py-1 rounded-md text-sm font-medium transition",
                  postType === type
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300",
                )}
              >
                {type}
              </button>
            ))}
          </div>
        <FormField>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="공지사항 제목을 입력하세요"
            className={`w-full ${textareaBase}`}
          />
        </FormField>

        <FormField>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="공지 내용을 입력하세요"
            className={`w-full min-h-32 ${textareaBase}`}
          />
        </FormField>

        <button
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          등록
        </button>
      </form>

      <div>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setFilter("공지")}
            className={cx(
              "px-4 py-2 rounded-md text-sm font-medium transition",
              filter === "공지"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300",
            )}
          >
            공지
          </button>
          <button
            type="button"
            onClick={() => setFilter("홍보")}
            className={cx(
              "px-4 py-2 rounded-md text-sm font-medium transition",
              filter === "홍보"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300",
            )}
          >
            홍보
          </button>
        </div>

        {listLoading ? (
          <div className="text-sm text-gray-500">불러오는 중...</div>
        ) : (
          <table className="w-full border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2 w-8"></th>
                <th className="border p-2">제목</th>
                <th className="border p-2">내용</th>
                <th className="border p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map((post, index) => (
                <tr
                  key={post.id}
                  draggable={false}
                  onDragStart={(e) => {
                    dragSnapshot.current = { posts, rows: [...posts], filter }
                    drag.handleDragStart(e, index)
                  }}
                  onDragOver={(e) => drag.handleDragOver(e, index)}
                  onDrop={(e) => drag.handleDrop(e, index)}
                  onDragEnd={() => {
                    dragSnapshot.current = null
                    drag.handleDragEnd()
                  }}
                  className={cx(
                    "hover:bg-gray-50 cursor-default",
                    drag.dragOverIndex === index &&
                      drag.dropPosition === "top" &&
                      "border-t-2 border-blue-500",
                    drag.dragOverIndex === index &&
                      drag.dropPosition === "bottom" &&
                      "border-b-2 border-blue-500",
                  )}
                >
                  <td className="border p-2 text-center text-gray-400 select-none">⠿</td>
                  {(["text", "description"] as const).map((field) => (
                    <td key={field} className="border p-2" onDoubleClick={() => { if (editing?.id !== post.id || editing.field !== field) startEditing(post, field) }}>
                      {editing?.id === post.id && editing.field === field ? (
                        <div className="space-y-2">
                          <textarea
                            aria-label={field === "text" ? "공지 제목 수정" : "공지 내용 수정"}
                            className="w-full border px-2 py-1"
                            value={editing.value}
                            disabled={saving}
                            autoFocus
                            onChange={(event) => setEditing({ ...editing, value: event.target.value })}
                          />
                          <div className="flex gap-2">
                            <button type="button" disabled={saving} onClick={() => void saveEdit()} className="rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-50">저장</button>
                            <button type="button" disabled={saving} onClick={() => { setEditing(null); setEditError(null) }} className="rounded border px-2 py-1">취소</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span>{post[field]}</span>{" "}
                          <button type="button" disabled={saving} onClick={() => startEditing(post, field)} aria-label={field === "text" ? "공지 제목 편집" : "공지 내용 편집"} className="text-blue-700 underline disabled:opacity-50">수정</button>
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="border p-2 text-center">
                    <button
                      disabled={saving}
                      onClick={() => handleDelete(post.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
