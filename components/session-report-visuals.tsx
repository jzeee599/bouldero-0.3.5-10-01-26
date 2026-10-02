"use client";

import { useState } from "react";
import type { Attempt, ClimbingSession, Project } from "@/lib/types";

type Props = {
  session: ClimbingSession;
  attempts: Attempt[];
  projects: Project[];
};

const pages = ["Cover", "Rhythm", "Routes", "Breaks"] as const;
type Page = (typeof pages)[number];

function minutesBetween(start: string, end: string) {
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60000));
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function routeColor(name: string) {
  const color = name.split(" ")[0]?.toLowerCase();
  return (
    {
      pink: "#d99aaa",
      white: "#f8f8ef",
      blue: "#7898ad",
      purple: "#9984aa",
      orange: "#d59565",
      yellow: "#d6bd61",
      green: "#7f9a76",
      red: "#b8746e",
      black: "#3f443e",
    }[color] || "#86917c"
  );
}

function controlledHoldCount(attempt: Attempt, project?: Project) {
  if (!project || project.route_mode !== "mapped") return 0;
  if (attempt.topped_out) return project.holds.length;
  const end = project.holds.find((hold) => hold.id === attempt.ended_hold_id)?.order_index;
  const start = project.holds.find((hold) => hold.id === attempt.started_hold_id)?.order_index;
  if (!end) return attempt.result === "sent" ? project.holds.length : 0;
  return Math.max(1, end - (start || 1) + 1);
}

function WallIllustration({ paths, hasSend }: { paths: number; hasSend: boolean }) {
  const routePaths = [
    "M182 357 Q210 280 291 185 T411 78",
    "M254 371 Q315 287 394 221 T510 126",
    "M337 383 Q373 312 451 251 T548 178",
    "M129 331 Q177 249 226 179 T277 81",
  ].slice(0, Math.max(1, Math.min(4, paths)));
  return (
    <svg viewBox="0 0 760 440" role="img" aria-label={`${paths} routes explored on an abstract climbing wall`}>
      <path d="M65 370 112 154 231 46 399 28 582 132 621 338 525 391 207 396Z" fill="#dfe1d4" />
      <path d="M65 370 112 154 231 46 272 238 207 396Z" fill="#c9cfbd" />
      <path d="M231 46 399 28 347 212 272 238Z" fill="#ecece1" />
      <path d="M399 28 582 132 347 212Z" fill="#d5d8cc" />
      <path d="M347 212 582 132 621 338 525 391Z" fill="#cbd1c0" />
      <path d="M272 238 347 212 525 391 207 396Z" fill="#e1e2d7" />
      <g fill="none" stroke="#fafaf5" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 12">
        {routePaths.map((path) => <path d={path} key={path} />)}
      </g>
      <g fill="#78886b">
        <path d="m161 337 21-22 29 10-5 28-29 11Z" /><path d="m272 180 20-17 29 11-8 26-29 5Z" />
        <path d="m391 66 22-17 31 19-15 25-36-9Z" /><path d="m490 112 20-13 27 14-11 24-31-5Z" />
        <path d="m429 239 17-15 27 9-7 24-28 5Z" /><path d="m251 353 22-15 28 16-12 24-31-8Z" />
      </g>
      <circle cx="399" cy="70" r="23" fill={hasSend ? "#ddf58b" : "#e3e5da"} stroke="#30372d" strokeWidth="1.5" />
      {hasSend && <path d="m418 40-6-19m27 31 17-13" stroke="#879672" strokeWidth="3" strokeLinecap="round" />}
      <path d="M25 416Q184 388 365 407t341-9" fill="none" stroke="#c1c6b7" strokeWidth="3" />
      <text x="399" y="74" textAnchor="middle" fontSize="10" fontWeight="650">{hasSend ? "SEND" : "NEXT"}</text>
    </svg>
  );
}

export default function SessionReportVisuals({ session, attempts, projects }: Props) {
  const [page, setPage] = useState<Page>("Cover");
  const ordered = [...attempts].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const started = Date.parse(session.started_at);
  const ended = Date.parse(session.ended_at || ordered.at(-1)?.created_at || session.started_at);
  const duration = Math.max(1, Math.round((ended - started) / 60000));
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const routeIds = Array.from(new Set(attempts.map((attempt) => attempt.project_id)));
  const controlledHolds = attempts.reduce((sum, attempt) => sum + controlledHoldCount(attempt, projectMap.get(attempt.project_id)), 0);
  const repetitions = attempts.filter((attempt) => projectMap.get(attempt.project_id)?.route_mode === "count_only").length;
  const sends = attempts.filter((attempt) => attempt.result === "sent" && projectMap.get(attempt.project_id)?.purpose !== "warm_up").length;
  const allSends = attempts.filter((attempt) => attempt.result === "sent").length;
  const completedLines = new Set(
    attempts
      .filter((attempt) => attempt.result === "sent")
      .map((attempt) => attempt.project_id),
  ).size;
  const breaks = ordered.slice(1).map((attempt, index) => ({
    start: Date.parse(ordered[index].created_at), end: Date.parse(attempt.created_at),
    minutes: minutesBetween(ordered[index].created_at, attempt.created_at),
  })).filter((item) => item.minutes >= 15);
  const breakMinutes = breaks.reduce((sum, item) => sum + item.minutes, 0);
  const routeStats = routeIds.map((id) => {
    const project = projectMap.get(id);
    const routeAttempts = ordered.filter((attempt) => attempt.project_id === id);
    const maxProgress = routeAttempts.reduce((max, attempt) => {
      if (attempt.result === "sent" || attempt.topped_out) return 1;
      if (!project || project.route_mode !== "mapped" || project.holds.length === 0) return max;
      const end = project.holds.find((hold) => hold.id === attempt.ended_hold_id)?.order_index || 0;
      return Math.max(max, end / project.holds.length);
    }, 0);
    return { id, project, attempts: routeAttempts, progress: maxProgress };
  }).sort((a, b) => b.progress - a.progress || b.attempts.length - a.attempts.length);

  const pageIndex = pages.indexOf(page);
  const changePage = (next: number) => setPage(pages[(next + pages.length) % pages.length]);
  const activityBlocks = ordered.length ? breaks.length + 1 : 0;

  return (
    <section className="visual-report" aria-label="Visual session report">
      <nav className="visual-report-tabs" aria-label="Report pages">
        {pages.map((item, index) => <button key={item} aria-current={page === item ? "page" : undefined} onClick={() => setPage(item)}><span>0{index + 1}</span>{item}</button>)}
      </nav>
      <div className="visual-report-sheet">
        <header className="visual-report-head"><div><p>Session report</p><h3>{session.gym}</h3></div><time>{new Date(session.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}<br />{new Date(session.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–{new Date(ended).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></header>

        {page === "Cover" && <div className="visual-report-page report-cover"><div className="report-wall"><WallIllustration paths={routeIds.length} hasSend={allSends > 0} /></div><div className="report-stat-strip"><div><strong>{durationLabel(duration)}</strong><span>Duration</span></div><div><strong>{routeIds.length}</strong><span>Lines</span></div><div><strong>{attempts.length}</strong><span>Attempts</span></div><div><strong>{controlledHolds || "—"}</strong><span>Holds controlled</span></div><div><strong>{sends}</strong><span>Counted sends</span></div></div><p className="visual-report-note"><strong>{sends} send{sends === 1 ? "" : "s"}</strong> · {controlledHolds || 0} holds · {routeIds.length} lines explored{allSends !== sends ? ` · ${completedLines} completed ${completedLines === 1 ? "line" : "lines"} including warm-ups` : ""}</p></div>}

        {page === "Rhythm" && <div className="visual-report-page"><div className="visual-report-title"><div><p>Session rhythm</p><h4>Work, pause, return.</h4></div><span>Dot size = holds controlled</span></div><div className="rhythm-chart" aria-label={`${attempts.length} attempts across the session`}><div className="rhythm-baseline" />{breaks.map((item) => <i className="rhythm-break" key={item.start} style={{ left: `${((item.start - started) / Math.max(1, ended - started)) * 100}%`, width: `${((item.end - item.start) / Math.max(1, ended - started)) * 100}%` }} />)}{ordered.map((attempt, index) => { const project = projectMap.get(attempt.project_id); const holds = controlledHoldCount(attempt, project); const position = ((Date.parse(attempt.created_at) - started) / Math.max(1, ended - started)) * 100; return <span className={`rhythm-dot ${attempt.result === "sent" ? "is-send" : ""}`} key={attempt.id} style={{ left: `${Math.max(1, Math.min(99, position))}%`, bottom: `${25 + (index % 4) * 15}%`, width: `${10 + Math.min(holds, 12)}px`, height: `${10 + Math.min(holds, 12)}px` }} title={`${project?.name || "Deleted line"} · ${new Date(attempt.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`} />})}<div className="rhythm-axis"><span>{new Date(started).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span>{new Date(ended).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div></div><div className="visual-insights"><div><strong>{breaks.length}</strong><span>Long breaks</span></div><div><strong>{breakMinutes}m</strong><span>Long-break time</span></div><div><strong>{Math.max(0, duration - breakMinutes)}m</strong><span>Outside long breaks</span></div></div></div>}

        {page === "Routes" && <div className="visual-report-page"><div className="visual-report-title"><div><p>Route mix</p><h4>{routeIds.length} lines, different stories.</h4></div><span>Bar = furthest recorded progress</span></div><div className="visual-route-list">{routeStats.map(({ id, project, attempts: lineAttempts, progress }) => <div className="visual-route" key={id}><span className="route-color" style={{ background: routeColor(project?.name || "") }} /><strong>{project?.name || "Deleted line"}</strong><div className="route-progress"><i className={progress >= 1 ? "is-sent" : ""} style={{ width: `${Math.max(5, progress * 100)}%` }} /></div><small>{lineAttempts.length} {lineAttempts.length === 1 ? "try" : "tries"}</small></div>)}</div><div className="visual-insights"><div><strong>{controlledHolds || "—"}</strong><span>Holds controlled</span></div><div><strong>{repetitions || "—"}</strong><span>Reps logged</span></div><div><strong>{completedLines}</strong><span>Completed lines</span></div></div></div>}

        {page === "Breaks" && <div className="visual-report-page"><div className="visual-report-title"><div><p>Break pattern</p><h4>{ordered.length === 0 ? "No activity recorded." : breaks.length ? `The session had ${activityBlocks} chapters.` : "One continuous chapter."}</h4></div><span>15 minutes or longer</span></div>{breaks.length ? <><div className="break-stones">{breaks.map((item, index) => <div key={item.start}><strong>{item.minutes}</strong><span>minutes<br />break {index + 1}</span></div>)}</div><div className="activity-band" aria-label="Active time and long breaks"><span className="active" style={{ flex: Math.max(1, duration - breakMinutes) }} /><span className="rest" style={{ flex: breakMinutes }} /></div><div className="activity-legend"><span><i className="active" />Outside long breaks</span><span><i className="rest" />Long breaks</span></div></> : <p className="empty-visual">{ordered.length === 0 ? "This session has no attempts to visualize." : "No gap of 15 minutes or longer was recorded in this session."}</p>}<div className="visual-insights"><div><strong>{breakMinutes}m</strong><span>Total long breaks</span></div><div><strong>{breaks.length ? Math.max(...breaks.map((item) => item.minutes)) : "—"}</strong><span>Longest break</span></div><div><strong>{activityBlocks}</strong><span>Activity blocks</span></div></div></div>}
      </div>
      <footer className="visual-report-controls"><button onClick={() => changePage(pageIndex - 1)} aria-label="Previous report page">←</button><span>{String(pageIndex + 1).padStart(2, "0")} / 04</span><button onClick={() => changePage(pageIndex + 1)} aria-label="Next report page">→</button></footer>
    </section>
  );
}
