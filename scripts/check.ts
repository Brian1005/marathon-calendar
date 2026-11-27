// 날짜·상태 로직 점검: npm run check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dday, dowOf, fmt, gcalRaceLink, isListed, nextOpening, showAsClosed, statusOf, type Race } from "../src/logic.ts";

const data = JSON.parse(readFileSync(new URL("../data/races.json", import.meta.url), "utf8"));
const races = data.races as Race[];
const byId = (id: string) => races.find((r) => r.id === id)!;
const at = (s: string) => new Date(`${s}+09:00`);

// 요일 표기
assert.equal(dowOf("2027-03-28"), "일");
assert.equal(fmt("2026-12-01T10:00"), "2026.12.01(화) 10:00");
assert.equal(fmt(null), "미공지");

// 데이터의 모든 대회일 요일이 실제 달력과 맞는지 (출력해서 눈으로 확인)
for (const r of races) console.log(`${r.date}(${dowOf(r.date)}) ${r.name}`);

// D-day: 한국 날짜 기준
assert.equal(dday("2026-12-01T10:00", at("2026-11-25T23:59:00")), "D-6");
assert.equal(dday("2026-12-01T10:00", at("2026-12-01T00:01:00")), "D-DAY");

// 합천: 오픈 전 → 예정, 일부 오픈 → 일부, 전부 오픈 → 접수 중
const hc = byId("hapcheon");
assert.equal(statusOf(hc, at("2026-11-30T12:00:00")).key, "soon");
assert.equal(statusOf(hc, at("2026-12-01T10:00:01")).text, "일부 종목 접수 중");
assert.equal(statusOf(hc, at("2026-12-08T00:00:00")).text, "접수 중");

// 서울시민: 마감일 3/30 당일까지는 접수 중, 3/31부터 마감 → 목록에서 숨김
const sm = byId("soaam");
assert.equal(statusOf(sm, at("2027-03-30T23:00:00")).key, "open");
assert.equal(statusOf(sm, at("2027-03-31T00:00:01")).key, "closed");
assert.equal(isListed(sm, at("2027-03-31T00:00:01")), false);

// 기장(수동 마감) → 목록에서 숨김
assert.equal(isListed(byId("gijang"), at("2026-11-25T12:00:00")), false);

// 마감된 대회 칸: 마감 후 2주까지만
assert.equal(showAsClosed(byId("gijang"), at("2026-11-18T23:00:00")), true); // 11/04 마감 + 14일
assert.equal(showAsClosed(byId("gijang"), at("2026-11-19T00:00:01")), false);
assert.equal(showAsClosed(sm, at("2027-04-13T23:00:00")), true); // 3/30 마감 + 14일
assert.equal(showAsClosed(sm, at("2027-04-14T00:00:01")), false);
assert.equal(showAsClosed(byId("seoul"), at("2026-11-27T12:00:00")), false); // 마감일 없음 → 숨김

// 접수했어요 → 대회일 캘린더 링크: 강릉 2027-04-24 08:30~11:30 KST
const link = new URL(gcalRaceLink(byId("gangneung")));
assert.equal(link.searchParams.get("dates"), "20270424T083000/20270424T113000");
assert.equal(link.searchParams.get("ctz"), "Asia/Seoul");

// 출발 시각 미공지 → 종일 일정
const seoul = new URL(gcalRaceLink(byId("seoul")));
assert.equal(seoul.searchParams.get("dates"), "20270321/20270322");

// 다음 오픈
assert.equal(nextOpening(races, at("2026-11-25T21:00:00"))?.race.id, "hapcheon");
assert.equal(nextOpening(races, at("2026-12-07T10:00:01"))?.race.id, "yangcheon");

console.log("check: 모두 통과");
