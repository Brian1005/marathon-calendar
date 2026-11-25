import "./style.css";
import data from "../data/races.json";
import {
  type Race, type StatusKey,
  dday, dowOf, fmt, gcalLink, hasTime, isListed, keepRegistered, nextOpening, raceOver, statusOf, toDate,
} from "./logic";
import { getFilter, getRegistered, setFilter, setRegistered } from "./store";

const races = data.races as Race[];
const BASE = import.meta.env.BASE_URL;

const STATUS_LABEL: Record<"all" | StatusKey, string> = {
  all: "전체", soon: "접수 예정", open: "접수 중", unknown: "미공지", closed: "마감",
};
const REGIONS = ["전체", "수도권", "강원", "충청", "호남", "영남", "제주"];

let filter = getFilter();
let registered = getRegistered();

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function toggleRegistered(id: string) {
  registered.has(id) ? registered.delete(id) : registered.add(id);
  setRegistered(registered);
  render();
}

function chips(el: HTMLElement, items: [string, string][], cur: string, onPick: (v: string) => void) {
  el.replaceChildren(
    ...items.map(([val, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.id = `chip-${el.id}-${val}`;
      b.textContent = label;
      b.setAttribute("aria-pressed", String(val === cur));
      b.addEventListener("click", () => onPick(val));
      return b;
    }),
  );
}

function stageRows(r: Race, now: Date): string {
  return r.stages
    .map((s) => {
      const future = !!s.opens && toDate(s.opens) > now;
      const dd = future ? dday(s.opens!, now) : null;
      return `<li>
        <span class="lab">${esc(s.label)}${s.done ? " (종료)" : ""}</span>
        <span class="t">${s.opens ? fmt(s.opens) : "시작 미공지"}${s.closes ? " → " + fmt(s.closes) : ""}</span>
        ${dd ? `<span class="dd">오픈 ${dd}</span>` : ""}
        ${future ? `<a class="cal" href="${gcalLink(r, s)}" target="_blank" rel="noopener">Google 캘린더에 추가 ↗</a>` : ""}
      </li>`;
    })
    .join("");
}

function bibCard(r: Race, now: Date): HTMLElement {
  const st = statusOf(r, now);
  const [, m, d] = r.date.split("-");
  const card = document.createElement("article");
  card.className = "bib";
  card.innerHTML = `
    <div class="bib-top"><span>${esc(r.region)}</span><span>·</span><span>${r.date.slice(0, 4)}</span></div>
    <div class="bib-num">
      <div><span class="d">${m}.${d}</span><span class="dow">${dowOf(r.date)}</span></div>
      <div class="name">${esc(r.name)}</div>
      <div class="start">출발 ${r.start}${r.startNote ? ` (${esc(r.startNote)})` : ""}</div>
    </div>
    <div class="bib-body">
      <span class="status s-${st.key}">${esc(st.text)}</span>
      <ul class="stages">${stageRows(r, now)}</ul>
      <p class="note">${esc(r.note)}</p>
    </div>
    <div class="bib-foot">
      <span>${esc(r.place)}</span>
      <span class="links">
        <a href="${BASE}ics/${r.id}.ics">.ics</a>
        <a href="${r.url}" target="_blank" rel="noopener">공식 ↗</a>
      </span>
    </div>`;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "reg";
  btn.id = `reg-${r.id}`;
  btn.textContent = "접수했어요";
  btn.addEventListener("click", () => toggleRegistered(r.id));
  card.querySelector(".bib-body")!.appendChild(btn);
  return card;
}

function myCard(r: Race, now: Date): HTMLElement {
  const over = raceOver(r, now);
  const dd = dday(r.date, now);
  const el = document.createElement("article");
  el.className = "mine";
  el.innerHTML = `
    <div class="mine-dd">${over ? "완주 축하!" : dd}</div>
    <div class="mine-main">
      <div class="mine-name">${esc(r.name)}</div>
      <div class="mine-when">${fmt(r.date)} · 출발 ${r.start}${r.startNote ? ` (${esc(r.startNote)})` : ""}</div>
      <div class="mine-where">${esc(r.place)} · <a href="${r.url}" target="_blank" rel="noopener">공식 ↗</a></div>
    </div>`;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "unreg";
  btn.id = `unreg-${r.id}`;
  btn.textContent = "체크 해제";
  btn.addEventListener("click", () => toggleRegistered(r.id));
  el.appendChild(btn);
  return el;
}

function renderNext() {
  const now = new Date();
  const el = $("next");
  const n = nextOpening(races.filter((r) => !registered.has(r.id)), now);
  if (!n) {
    el.innerHTML = `<div class="eyebrow">다음 접수 오픈</div><div class="what">예정된 접수 오픈이 없습니다.</div>`;
    return;
  }
  let ms = toDate(n.stage.opens!).getTime() - now.getTime();
  const d = Math.floor(ms / 86_400_000); ms -= d * 86_400_000;
  const h = Math.floor(ms / 3_600_000); ms -= h * 3_600_000;
  const m = Math.floor(ms / 60_000); ms -= m * 60_000;
  const s = Math.floor(ms / 1000);
  const pad = (x: number) => String(x).padStart(2, "0");
  el.innerHTML = `
    <div class="eyebrow">다음 접수 오픈</div>
    <div class="what">${esc(n.race.name)} · ${esc(n.stage.label)}</div>
    <div class="when">${fmt(n.stage.opens)}${hasTime(n.stage.opens!) ? "" : " · 시각 미공지"}</div>
    <div class="count">
      <div><b>${d}</b><span>일</span></div>
      <div><b>${pad(h)}</b><span>시간</span></div>
      <div><b>${pad(m)}</b><span>분</span></div>
      <div><b>${pad(s)}</b><span>초</span></div>
    </div>
    <div><a href="${n.race.url}" target="_blank" rel="noopener">공식 페이지 열기 ↗</a></div>`;
}

function render() {
  const now = new Date();

  // 내 대회: 접수 체크한 대회, 대회 다음 날까지
  const mine = races
    .filter((r) => registered.has(r.id) && keepRegistered(r, now))
    .sort((a, b) => a.date.localeCompare(b.date));
  $("mine-section").hidden = mine.length === 0;
  $("mine").replaceChildren(...mine.map((r) => myCard(r, now)));

  chips($("f-status"), Object.entries(STATUS_LABEL).filter(([k]) => k !== "closed"), filter.status, (v) => {
    filter = { ...filter, status: v }; setFilter(filter); render();
  });
  chips($("f-region"), REGIONS.map((r) => [r, r]), filter.region, (v) => {
    filter = { ...filter, region: v }; setFilter(filter); render();
  });

  const rows = races
    .filter((r) => !registered.has(r.id) && isListed(r, now))
    .filter((r) => filter.status === "all" || statusOf(r, now).key === filter.status)
    .filter((r) => filter.region === "전체" || r.region === filter.region)
    .sort((a, b) => a.date.localeCompare(b.date));
  const list = $("list");
  if (rows.length) list.replaceChildren(...rows.map((r) => bibCard(r, now)));
  else list.innerHTML = `<p class="empty">조건에 맞는 대회가 없습니다.</p>`;

  // 마감됐지만 아직 안 열린 대회 (이미 접수한 경우 체크용)
  const closed = races.filter((r) => !registered.has(r.id) && !isListed(r, now) && !raceOver(r, now));
  $("closed-section").hidden = closed.length === 0;
  $("closed-count").textContent = String(closed.length);
  $("closed").replaceChildren(...closed.map((r) => bibCard(r, now)));

  $("pending").innerHTML = data.pending.map((p) => `<li>${esc(p)}</li>`).join("");
  $("updated").textContent = data.updatedAt;
  renderNext();
}

render();
setInterval(renderNext, 1000);
// 자정 넘어가면 상태·D-day 다시 계산
setInterval(render, 60_000);
