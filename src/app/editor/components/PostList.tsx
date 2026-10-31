"use client"

import { useState } from "react"
import { BoardType, BoardRow, BOARD_TABLE_MAP } from "../constants"
import type { EditorTable, EditorTextFields, EditorTextKey } from "@/types/editor"
import { useDragAndDrop } from "../hooks/useDragAndDrop"
import { persistOrder } from "../services/order.service"
import { deletePost, fetchPosts, updatePost} from "../services/board.service"
import { ImageFromStorage } from "./ImageFromStorage"
import { cx } from "../utils/cx"
import { getFirstImageFilename } from "../utils/parsing_first"
import * as XLSX from "xlsx"

type Props<B extends BoardType> = {
  board: B
  posts: BoardRow<B>[]
  loading: boolean
  reload: () => void
  setPosts: React.Dispatch<React.SetStateAction<BoardRow<B>[]>>
}

const BOARD_COLUMNS = {
    "공지": [
      { label: "내용", field: "text" },
      { label: "설명", field: "description" },
    ],
    "프로젝트": [
      { label: "프로젝트명", field: "project_name" },
      { label: "설명", field: "description" },
    ],
    "스터디": [
      { label: "스터디명", field: "study_name" },
      { label: "개요", field: "outline" },
    ],
    "행사": [
      { label: "제목", field: "title" },
      { label: "설명", field: "description" },
    ],
    "일정": [
      { label: "설명", field: "description" },
      { label: "시작일", field: "start_date" },
      { label: "종료일", field: "end_date" },
    ],
    "학회실 사용 시간표": [
      { label: "스터디명", field: "study_name" },
      { label: "리더", field: "leader" },
      { label: "시작시간", field: "start_time" },
      { label: "종료시간", field: "end_time" },
    ],
    "명예의 전당": [
      { label: "이름", field: "name" },
      { label: "날짜", field: "date" },
    ],
    "등록회원": [
      { label: "이름", field: "name" },
      { label: "학번", field: "student_id" },
      { label: "학과", field: "department" },
      { label: "기수", field: "generation" },
      { label: "이메일", field: "email" },
      { label: "전화번호", field: "phone_number" },
    ],
    "승인email":[
      { label: "이름", field: "name" },
      { label: "이메일", field: "email" }
    ],
    "관리자id":[
      { label: "이름", field: "name" },
      { label: "이메일", field: "email"},
      { label: "uuid", field: "uuid" }
    ]
  } as const satisfies {
    [B in BoardType]: readonly { label: string; field: EditorTextKey<BoardRow<B>> }[]
  }

export function PostList<B extends BoardType>({ board, posts, setPosts, reload, loading }: Props<B>) {
  const drag = useDragAndDrop({
    items: posts,
    onReorder: async (newPosts) => {
      setPosts(newPosts)
      await persistOrder(BOARD_TABLE_MAP[board], newPosts)
    },
  })


  const [editingCell, setEditingCell] = useState<{
    id: number
    field: PropertyKey
  } | null>(null)

  const handleExcelDownload = async () => {
    try {
    const data = await fetchPosts(BOARD_TABLE_MAP[board])

    const formatted = data.map((row: EditorTextFields) => {
      const obj: Record<string, unknown> = {}
      BOARD_COLUMNS[board].forEach((col) => {
        obj[col.label] = row[col.field]
      })
      return obj
    })

    const worksheet = XLSX.utils.json_to_sheet(formatted)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, board)

    XLSX.writeFile(workbook, `${board}.xlsx`)
    } catch {
      alert("엑셀 데이터를 불러오지 못했습니다. 다시 시도해 주세요.")
    }
  }

  const [editingValue, setEditingValue] = useState("")

  const handleSave = async (postId: number, field: string) => {
    let value: string | number = editingValue

    // 숫자 필드 자동 변환
    if (!isNaN(Number(editingValue)) && editingValue.trim() !== "") {
      value = Number(editingValue)
    }

    try {
      // 동적 열 편집의 기존 string/number 전송 경계. 정적 컬럼 호출의 검증은 서비스에 유지한다.
      await updatePost<EditorTable>(BOARD_TABLE_MAP[board], postId, {
        [field]: value,
      })

      setEditingCell(null)
      reload()
    } catch (err) {
      console.error("Update error:", err)
      alert("업데이트 실패")
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">불러오는 중...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between p-2">
        <h2 className="text-xl font-bold text-gray-900">
          목록
        </h2>
        {(board=="등록회원") && (
          <button
            onClick={handleExcelDownload}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            excel-download
          </button>
        )}
      </div>
      
      <p className="mb-2 text-sm text-gray-500">데모에서는 안전한 정렬 저장을 준비 중입니다.</p>
      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2 w-8"></th>

            {(board === "프로젝트" || board === "스터디" || board === "행사") && (
              <th className="border p-2">이미지</th>
            )}

            {BOARD_COLUMNS[board].map((col) => (
              <th key={col.field} className="border p-2">
                {col.label}
              </th>
            ))}

          </tr>
        </thead>

        <tbody>
          {posts.map((post, index) => {
            const textFields: EditorTextFields = post
            const filename = "filename" in post && typeof post.filename === "string" ? post.filename : null
            const eventFilename = getFirstImageFilename("filenames" in post ? post.filenames : null)
            return (
            <tr
              key={post.id}
              draggable={false}
              onDragStart={(e) => drag.handleDragStart(e, index)}
              onDragOver={(e) => drag.handleDragOver(e, index)}
              onDrop={(e) => drag.handleDrop(e, index)}
              onDragEnd={drag.handleDragEnd}
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

            {(board === "프로젝트" || board === "스터디") && (
              <td className="border p-2">
                {filename ? (
                  <ImageFromStorage
                    board={board}
                    filename={filename}
                    className="w-16 h-16 rounded-md object-cover border"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-md border flex items-center justify-center">
                    <span className="text-xs text-gray-400">없음</span>
                  </div>
                )}
              </td>
            )}

            {/* ✅ 행사 이미지 */}
            {board === "행사" && (
              <td className="border p-2">
                {eventFilename ? (
                  <ImageFromStorage
                    board={board}
                    filename={eventFilename}
                    className="w-16 h-16 rounded-md object-cover border"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-md border flex items-center justify-center">
                    <span className="text-xs text-gray-400">없음</span>
                  </div>
                )}
              </td>
            )}

            {/* ✅ 나머지 컬럼들 */}
            {BOARD_COLUMNS[board].map((col) => (
              <td
                key={col.field}
                className="border p-2 cursor-pointer"
                onClick={() => {
                  setEditingCell({ id: post.id, field: col.field })
                  setEditingValue(textFields[col.field] ?? "")
                }}
              >
                {editingCell &&
                editingCell.id === post.id &&
                editingCell.field === col.field ? (
                  <input
                    className="w-full border px-2 py-1"
                    value={editingValue}
                    autoFocus
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => handleSave(post.id, col.field)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSave(post.id, col.field)
                      }
                    }}
                  />
                ) : (
                  textFields[col.field]
                )}
              </td>
            ))}

            {/* 삭제 버튼 */}
            <td className="border p-2 text-center">
              <button
                onClick={async () => {
                  if (!confirm("삭제하시겠습니까?")) return
                  await deletePost(BOARD_TABLE_MAP[board], post.id)
                  reload()
                }}
                className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                삭제
              </button>
            </td>
          </tr>
          )})}
        </tbody>
      </table>
      
    </div>
  )
}
