// "접수했어요" 체크와 필터 상태를 이 브라우저에 저장 (서버 없음).
// 다른 기기와는 공유되지 않음.

const KEY_REG = "rc.registered";
const KEY_FILTER = "rc.filter";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 불가 환경(시크릿 창 등)은 무시 */
  }
}

export function getRegistered(): Set<string> {
  return new Set(read<string[]>(KEY_REG, []));
}

export function setRegistered(ids: Set<string>) {
  write(KEY_REG, [...ids]);
}

export type Filter = { status: string; region: string };

export function getFilter(): Filter {
  return read<Filter>(KEY_FILTER, { status: "all", region: "전체" });
}

export function setFilter(f: Filter) {
  write(KEY_FILTER, f);
}
