"use client";

import { useMemo, useState } from "react";
import { preparePhoto } from "@/lib/photo";
import type { GymMap, Project } from "@/lib/types";

type Props = {
  gyms: string[];
  maps: GymMap[];
  projects: Project[];
  activeGym?: string;
  localMode: boolean;
  busy: boolean;
  onBack: () => void;
  onOpenProject: (project: Project) => void;
  onSave: (map: GymMap, image?: Blob) => Promise<void>;
};

export default function GymMapView({ gyms, maps, projects, activeGym, localMode, busy, onBack, onOpenProject, onSave }: Props) {
  const [gym, setGym] = useState(activeGym || gyms[0] || "");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState("");
  const map = maps.find((item) => item.gym.toLocaleLowerCase() === gym.toLocaleLowerCase());
  const gymProjects = useMemo(() => projects.filter((project) => project.gym.toLocaleLowerCase() === gym.toLocaleLowerCase()), [projects, gym]);

  async function upload(file?: File) {
    if (!file || !gym) return;
    setPreparing(true);
    setLocalError("");
    try {
      const image = await preparePhoto(file);
      const next: GymMap = map || { id: crypto.randomUUID(), gym, image_url: "", markers: [], updated_at: new Date().toISOString() };
      await onSave({ ...next, gym, updated_at: new Date().toISOString() }, image);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not prepare this map image.");
    } finally {
      setPreparing(false);
    }
  }

  async function place(event: React.MouseEvent<HTMLDivElement>) {
    if (!map || !selectedProjectId || busy) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    await onSave({ ...map, markers: [...map.markers.filter((item) => item.project_id !== selectedProjectId), { project_id: selectedProjectId, x, y }], updated_at: new Date().toISOString() });
  }

  async function remove(projectId: string) {
    if (!map || busy) return;
    await onSave({ ...map, markers: map.markers.filter((item) => item.project_id !== projectId), updated_at: new Date().toISOString() });
  }

  return <section className="gym-map-page">
    <button className="back-link" onClick={onBack}>← Back</button>
    <header className="gym-map-heading"><div><p className="eyebrow">GYM MAP</p><h1>Find the next<br /><span>move nearby.</span></h1><p>Upload a simple floor or wall map, then place the lines you have saved.</p></div><label>Gym<select value={gym} onChange={(event) => { setGym(event.target.value); setSelectedProjectId(""); setLocalError(""); }}>{gyms.map((item) => <option key={item}>{item}</option>)}</select></label></header>
    {localError && <p className="gym-map-error" role="alert">{localError}</p>}
    {!localMode ? <div className="gym-map-empty"><strong>Gym maps are not available in cloud mode yet.</strong><p>Map upload and line placement will return when gym maps can sync safely across devices.</p></div> : !gym ? <div className="gym-map-empty"><strong>No gym yet.</strong><p>Create a line or start a session to add your first gym.</p></div> : !map?.image_url ? <label className="gym-map-uploader"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])} disabled={preparing || busy} /><span>{preparing ? "Preparing map…" : "+ Upload gym map"}</span><small>A floor plan, wall overview, or quick sketch works.</small></label> : <>
      <div className="gym-map-toolbar"><label>Line to place<select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}><option value="">Choose a line</option>{gymProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label className="replace-map">Replace map<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])} disabled={preparing || busy} /></label><span>{selectedProjectId ? "Tap the map to place this line." : `${map.markers.length} of ${gymProjects.length} lines placed`}</span></div>
      <div className={`gym-map-canvas ${selectedProjectId ? "is-placing" : ""}`} onClick={place}><img src={map.image_url} alt={`${gym} map`} />{map.markers.map((marker, index) => { const project = projects.find((item) => item.id === marker.project_id); if (!project) return null; return <button key={marker.project_id} className="gym-map-marker" style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} onClick={(event) => { event.stopPropagation(); onOpenProject(project); }} aria-label={`Open ${project.name}`}><span>{index + 1}</span><strong>{project.name}</strong></button>; })}</div>
      <div className="gym-map-list"><div><p className="mini-label">PLACED LINES</p><h2>{gym}</h2></div>{map.markers.length ? map.markers.map((marker, index) => { const project = projects.find((item) => item.id === marker.project_id); if (!project) return null; return <div className="gym-map-list-row" key={marker.project_id}><span>{String(index + 1).padStart(2, "0")}</span><button onClick={() => onOpenProject(project)}><strong>{project.name}</strong><small>{project.grade} · {project.status === "sent" ? "Completed" : "Ongoing"}</small></button><button aria-label={`Remove ${project.name} from map`} onClick={() => remove(project.id)}>×</button></div>; }) : <p className="gym-map-list-empty">Choose a line above, then tap its location on the map.</p>}</div>
    </>}
  </section>;
}
