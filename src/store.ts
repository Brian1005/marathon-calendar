// 필터 선택만 이 브라우저에 기억 (서버 없음).

const KEY_FILTER = "rc.filter";

export type Filter = { status: string; region: string };

export function getFilter(): Filter {
  try {
    const raw = localStorage.getItem(KEY_FILTER);
    return raw ? (JSON.parse(raw) as Filter) : { status: "all", region: "전체" };
  } catch {
    return { status: "all", region: "전체" };
  }
}

export function setFilter(f: Filter) {
  try {
    localStorage.setItem(KEY_FILTER, JSON.stringify(f));
  } catch {
    /* 저장 불가 환경(시크릿 창 등)은 무시 */
  }
}
