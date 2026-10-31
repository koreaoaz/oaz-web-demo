import { useCallback, useState } from "react"
import { useAsyncQuery } from "@/hooks/useAsyncQuery"
import { BoardType, BoardRow, BOARD_TABLE_MAP } from "../constants"
import { fetchPosts } from "../services/board.service"

export function useBoardPosts<B extends BoardType>(board: B) {
  const [initial] = useState<BoardRow<B>[]>([])
  const query = useCallback(() => fetchPosts(BOARD_TABLE_MAP[board]), [board])
  const state = useAsyncQuery(board, query, initial, "게시글을 불러오지 못했습니다. 다시 시도해 주세요.")

  return {
    posts: state.data,
    setPosts: state.setData,
    reload: state.reload,
    loading: state.loading,
    error: state.error,
  }
}
