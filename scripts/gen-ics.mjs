// data/races.json → public/ics/<id>.ics (대회별) + public/ics/all.ics (전체 접수 오픈)
// 접수 오픈(시각 있으면 30분 일정 + 알림 1일 전·10분 전, 날짜만 있으면 종일), 대회일(출발 시각) 포함.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../data/races.json", import.meta.url), "utf8"));
const outDir = new URL("../public/ics/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const ymd = (s) => s.slice(0, 10).replace(/-/g, "");
const nextDay = (s) => {
  const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
};
const local = (date, hm) => `${ymd(date)}T${hm.replace(":", "")}00`;
const startLabel = (r) => `${r.start ? `출발 ${r.start}` : "출발 시각 미공지"}${r.startNote ? ` (${r.startNote})` : ""}`;
const addMin = (date, hm, min) => {
  const d = new Date(`${date}T${hm}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + min);
  return d.toISOString().slice(0, 16).replace(/[-:]/g, "") + "00";
};
// RFC 5545: 75 octet 줄바꿈
const fold = (line) => {
  const out = [];
  let buf = "";
  for (const ch of line) {
    if (Buffer.byteLength(buf + ch) > 74) { out.push(buf); buf = " " + ch; } else buf += ch;
  }
  out.push(buf);
  return out.join("\r\n");
};

const alarms = ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:접수 오픈", "TRIGGER:-P1D", "END:VALARM",
  "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:접수 오픈", "TRIGGER:-PT10M", "END:VALARM"];

function stageEvents(r) {
  return r.stages
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.opens)
    .map(({ s, i }) => {
      const timed = s.opens.includes("T");
      const [date, hm] = s.opens.split("T");
      return [
        "BEGIN:VEVENT",
        `UID:${r.id}-open-${i}@running-calendar`,
        `DTSTAMP:${stamp}`,
        ...(timed
          ? [`DTSTART;TZID=Asia/Seoul:${local(date, hm)}`, `DTEND;TZID=Asia/Seoul:${addMin(date, hm, 30)}`]
          : [`DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${nextDay(date)}`]),
        `SUMMARY:${esc(`🏃 ${r.name} 접수 오픈 (${s.label})`)}`,
        `DESCRIPTION:${esc(`대회 ${r.date} ${startLabel(r)}${timed ? "" : "\n접수 시각 미공지"}\n${r.url}`)}`,
        `URL:${r.url}`,
        ...(timed ? alarms : []),
        "END:VEVENT",
      ];
    });
}

function raceEvent(r) {
  return [
    "BEGIN:VEVENT",
    `UID:${r.id}-race@running-calendar`,
    `DTSTAMP:${stamp}`,
    ...(r.start
      ? [`DTSTART;TZID=Asia/Seoul:${local(r.date, r.start)}`, `DTEND;TZID=Asia/Seoul:${addMin(r.date, r.start, 180)}`]
      : [`DTSTART;VALUE=DATE:${ymd(r.date)}`, `DTEND;VALUE=DATE:${nextDay(r.date)}`]),
    `SUMMARY:${esc(`🏁 ${r.name}`)}`,
    `LOCATION:${esc(r.place)}`,
    `DESCRIPTION:${esc(`${startLabel(r)}\n${r.url}`)}`,
    `URL:${r.url}`,
    "END:VEVENT",
  ];
}

const tz = ["BEGIN:VTIMEZONE", "TZID:Asia/Seoul", "BEGIN:STANDARD", "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0900", "TZOFFSETTO:+0900", "TZNAME:KST", "END:STANDARD", "END:VTIMEZONE"];

function calendar(name, events) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//running-calendar//KO", "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:Asia/Seoul", ...tz, ...events.flat(), "END:VCALENDAR"];
  return lines.map(fold).join("\r\n") + "\r\n";
}

for (const r of data.races) {
  writeFileSync(new URL(`${r.id}.ics`, outDir), calendar(r.name, [...stageEvents(r), raceEvent(r)]));
}
writeFileSync(new URL("all.ics", outDir), calendar("마라톤 접수 오픈", data.races.flatMap(stageEvents)));
console.log(`ics: ${data.races.length}개 대회 + all.ics → public/ics/`);
