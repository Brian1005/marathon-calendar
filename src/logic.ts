// 순수 함수 모음. 모든 시각은 한국 시간(KST, +09:00) 기준.
// 날짜 문자열 규칙: "YYYY-MM-DDTHH:mm" = 시각까지 공지, "YYYY-MM-DD" = 날짜만 공지, null = 미공지

export type Stage = {
  label: string;
  opens: string | null;
  closes: string | null;
  done?: boolean;
};

export type Race = {
  id: string;
  name: string;
  region: string;
  place: string;
  date: string; // 대회일 YYYY-MM-DD
  start: string | null; // 출발 HH:mm, null = 미공지
  startNote?: string;
  status: "auto" | "open" | "unknown" | "closed";
  statusText?: string;
  closedAt?: string; // 수동 마감(status "closed")이 공지된 날 YYYY-MM-DD
  stages: Stage[];
  note: string;
  url: string;
  verifiedAt: string;
};

export type StatusKey = "soon" | "open" | "unknown" | "closed";

const DAY = 86_400_000;
const KST = 9 * 3_600_000;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export const hasTime = (s: string) => s.includes("T");

export function toDate(s: string): Date {
  return new Date(hasTime(s) ? `${s}:00+09:00` : `${s}T00:00:00+09:00`);
}

/** 날짜만 있으면 그날 24:00, 시각이 있으면 그 시각 */
export function endOf(s: string): Date {
  return hasTime(s) ? toDate(s) : new Date(toDate(s).getTime() + DAY);
}

export function dowOf(date: string): string {
  return DOW[new Date(`${date}T12:00:00+09:00`).getUTCDay()];
}

export function fmt(s: string | null): string {
  if (!s) return "미공지";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${y}.${m}.${d}(${dowOf(s.slice(0, 10))})` + (hasTime(s) ? ` ${s.slice(11, 16)}` : "");
}

/** 한국 날짜 기준 D-day. 지났으면 null */
export function dday(s: string, now: Date): string | null {
  const kstDay = (t: number) => Math.floor((t + KST) / DAY);
  const diff = kstDay(toDate(s).getTime()) - kstDay(now.getTime());
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : null;
}

export function statusOf(r: Race, now: Date): { key: StatusKey; text: string } {
  if (r.status !== "auto") return { key: r.status, text: r.statusText ?? "" };
  if (r.stages.every((s) => s.closes && endOf(s.closes) < now)) return { key: "closed", text: "접수 마감" };
  const future = r.stages.filter((s) => s.opens && toDate(s.opens) > now);
  if (future.length === r.stages.length) return { key: "soon", text: "접수 예정" };
  if (future.length) return { key: "open", text: "일부 종목 접수 중" };
  return { key: "open", text: "접수 중" };
}

/** 대회일이 지났는지 (대회 당일까지는 false) */
export const raceOver = (r: Race, now: Date) => endOf(r.date) <= now;

/** 마감된 날: 수동 마감은 closedAt, 자동 마감은 가장 늦은 closes. 모르면 null */
export function closedOn(r: Race): string | null {
  if (r.status === "closed") return r.closedAt ?? null;
  const ends = r.stages.map((s) => s.closes!).filter(Boolean);
  return ends.length ? ends.reduce((a, b) => (endOf(a) > endOf(b) ? a : b)) : null;
}

/** "마감된 대회"에 보일지: 마감 후 2주까지만. 마감일을 모르면 숨김 */
export function showAsClosed(r: Race, now: Date): boolean {
  if (raceOver(r, now) || statusOf(r, now).key !== "closed") return false;
  const on = closedOn(r);
  return !!on && now.getTime() < endOf(on).getTime() + 14 * DAY;
}

/** 메인 목록에 보일지: 마감·지난 대회는 숨김 */
export const isListed = (r: Race, now: Date) =>
  !raceOver(r, now) && statusOf(r, now).key !== "closed";

export function nextOpening(races: Race[], now: Date): { race: Race; stage: Stage } | null {
  let best: { race: Race; stage: Stage } | null = null;
  for (const race of races) {
    if (!isListed(race, now)) continue;
    for (const stage of race.stages) {
      if (!stage.opens || toDate(stage.opens) <= now) continue;
      if (!best || toDate(stage.opens) < toDate(best.stage.opens!)) best = { race, stage };
    }
  }
  return best;
}

/** "출발 08:30 (예정)" / "출발 시각 미공지" */
export const startLabel = (r: Race) =>
  `${r.start ? `출발 ${r.start}` : "출발 시각 미공지"}${r.startNote ? ` (${r.startNote})` : ""}`;

/** 접수한 대회의 대회일 일정 → Google 캘린더 "일정 추가" 링크 (출발부터 3시간, 시각 미공지면 종일) */
export function gcalRaceLink(r: Race): string {
  let dates: string;
  if (r.start) {
    const start = `${r.date}T${r.start}`;
    const end = new Date(toDate(start).getTime() + 3 * 3_600_000 + KST).toISOString().slice(0, 16);
    dates = `${start.replace(/[-:]/g, "")}00/${end.replace(/[-:]/g, "")}00`;
  } else {
    const next = new Date(toDate(r.date).getTime() + DAY + KST).toISOString().slice(0, 10);
    dates = `${r.date.replace(/-/g, "")}/${next.replace(/-/g, "")}`;
  }
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `🏁 ${r.name}`,
    dates,
    ctz: "Asia/Seoul",
    location: r.place,
    details: `${startLabel(r)}\n공식: ${r.url}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** Google 캘린더 "일정 추가" 링크 */
export function gcalLink(r: Race, st: Stage): string {
  const s = st.opens!;
  let dates: string;
  if (hasTime(s)) {
    const end = new Date(toDate(s).getTime() + 30 * 60_000 + KST).toISOString().slice(0, 16);
    dates = `${s.replace(/[-:]/g, "")}00/${end.replace(/[-:]/g, "")}00`;
  } else {
    const next = new Date(toDate(s).getTime() + DAY + KST).toISOString().slice(0, 10);
    dates = `${s.replace(/-/g, "")}/${next.replace(/-/g, "")}`;
  }
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `${r.name} 접수 오픈 (${st.label})`,
    dates,
    ctz: "Asia/Seoul",
    details: `대회 ${r.date} ${startLabel(r)}\n공식: ${r.url}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
