"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight,
  Bell, CalendarClock, Check, ChevronDown, ChevronRight,
  CircleHelp, CloudUpload, FileImage, Grid2X2, Instagram,
  LayoutDashboard, LockKeyhole, LogOut, Menu, Plus,
  Search, Settings2, ShieldCheck, Video, X,
} from "lucide-react";
import { demoAccounts } from "@/lib/domain";
import DashboardOverview from "./dashboard-overview";

type PageKey = "Visão geral" | "Contas" | "Biblioteca" | "Nova publicação" | "Agendamentos" | "Histórico" | "Verificações" | "Configurações";
const menu: { label: PageKey; icon: typeof LayoutDashboard; badge?: string }[] = [
  { label: "Visão geral", icon: LayoutDashboard }, { label: "Contas", icon: Instagram, badge: "05" },
  { label: "Biblioteca", icon: FileImage }, { label: "Nova publicação", icon: Plus },
  { label: "Agendamentos", icon: CalendarClock }, { label: "Histórico", icon: Activity },
  { label: "Verificações", icon: ShieldCheck, badge: "01" }, { label: "Configurações", icon: Settings2 },
];
const formatNumber = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

export default function Home({ organizationName, email }: { organizationName: string; email: string }) {
  const router = useRouter();
  const [page, setPage] = useState<PageKey>("Visão geral");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(["a1", "a2", "a4"]);
  const [period, setPeriod] = useState("Hoje");
  const [mobileNav, setMobileNav] = useState(false);
  const go = (label: PageKey) => { if (label === "Nova publicação") setComposeOpen(true); else setPage(label); setMobileNav(false); };

  return <main className="shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Activity size={19} strokeWidth={2.8}/></div><span>pulso<span className="brand-dot">.</span></span><button className="mobile-close icon-button" onClick={() => setMobileNav(false)}><X size={19}/></button></div>
      <div className="workspace-switch"><div className="workspace-logo">{organizationName.slice(0,1).toUpperCase()}</div><div className="workspace-text"><strong>{organizationName}</strong><span>Organização</span></div><ChevronDown size={15} className="muted"/></div>
      <div className="nav-label">ESPAÇO DE TRABALHO</div>
      <nav>{menu.map(({ label, icon: Icon, badge }) => <button key={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => go(label)}><Icon size={18}/><span>{label}</span>{badge && <small>{badge}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><strong>Precisa de ajuda?</strong><p>Veja como preparar suas contas para publicar.</p><button onClick={() => setPage("Configurações")}>Central de ajuda <ArrowRight size={14}/></button></div><div className="profile"><div className="profile-avatar">{email.slice(0,1).toUpperCase()}</div><div className="profile-copy"><b>{email}</b><span>Conta da organização</span></div><button className="logout-button" title="Sair" aria-label="Sair" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});router.push("/login");router.refresh()}}><LogOut size={16}/></button></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <b>{page}</b></div><div className="top-actions"><div className="demo-pill"><span/> Ambiente de demonstração</div><button className="icon-button notification" aria-label="Notificações"><Bell size={18}/><i/></button><div className="top-avatar">GE</div></div></header>

      {page === "Visão geral" ? <DashboardOverview period={period} setPeriod={setPeriod} onCompose={() => setComposeOpen(true)} setPage={setPage} /> : <div className="page-content"><SectionPage page={page} accounts={demoAccounts} setPage={setPage} setComposeOpen={setComposeOpen}/></div>}
    </section>
    {mobileNav && <button className="scrim" aria-label="Fechar menu" onClick={() => setMobileNav(false)}/>}
    {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} selected={selected} setSelected={setSelected} onSubmit={() => { setComposeOpen(false); setPage("Agendamentos"); }}/ >}
  </main>;
}

function MetricCard({ icon, label, value, delta, foot, trend, color, hint }: { icon: React.ReactNode; label: string; value: string; delta: string; foot: string; trend: "up" | "down" | "neutral"; color: string; hint: string }) {
  return <div className="metric-card"><div className="metric-top"><div className={`metric-icon ${color}`}>{icon}</div><button className="hint-button" title={hint} aria-label={hint}><CircleHelp size={15}/></button></div><span className="metric-label">{label}</span><div className="metric-value-row"><strong>{value}</strong><span className={`metric-delta ${trend}`}>{trend === "up" ? <ArrowUpRight size={13}/> : trend === "down" ? <ArrowDownRight size={13}/> : null}{delta}</span></div><span className="metric-foot">{foot}</span></div>;
}

function SectionPage({ page, setPage, setComposeOpen }: { page: PageKey; accounts: typeof demoAccounts; setPage: (p: PageKey) => void; setComposeOpen: (v: boolean) => void }) {
  const [query,setQuery]=useState("");
  const [accounts,setAccounts]=useState<Array<{id:string;username:string;createdAt:string}>>([]);
  const [media,setMedia]=useState<Array<{id:string;name:string;mimeType:string;bytes:number;url:string}>>([]);
  const [username,setUsername]=useState("");const [message,setMessage]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{if(page==="Contas")void fetch("/api/instagram/accounts").then(r=>r.ok?r.json():null).then(d=>d&&setAccounts(d.accounts)).catch(()=>{});if(page==="Biblioteca")void fetch("/api/media").then(r=>r.ok?r.json():null).then(d=>d&&setMedia(d.media)).catch(()=>{});},[page]);
  async function addAccount(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/instagram/accounts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username})});const d=await r.json();if(!r.ok)throw Error(d.error);setAccounts([d.account,...accounts]);setUsername("");setMessage("Perfil cadastrado. Nenhuma senha foi solicitada ou armazenada.");}catch(x){setError(x instanceof Error?x.message:"Falha ao cadastrar.");}finally{setBusy(false);}}
  async function upload(file:File){setBusy(true);setMessage("");setError("");try{const r=await fetch("/api/media/presign",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:file.name,mimeType:file.type,bytes:file.size})});const p=await r.json();if(!r.ok)throw Error(p.error);const put=await fetch(p.uploadUrl,{method:"PUT",headers:p.requiredHeaders,body:file});if(!put.ok)throw Error("O armazenamento recusou o upload.");const done=await fetch("/api/media/"+p.id+"/complete",{method:"POST"});const dd=await done.json();if(!done.ok)throw Error(dd.error);const list=await fetch("/api/media").then(x=>x.json());setMedia(list.media);setMessage("Mídia validada e armazenada; ainda não foi publicada.");}catch(x){setError(x instanceof Error?x.message:"Falha no upload.");}finally{setBusy(false);}}
  const titles:Record<PageKey,string>={"Visão geral":"Visão geral",Contas:"Contas do Instagram",Biblioteca:"Biblioteca de mídias","Nova publicação":"Publicação","Agendamentos":"Agendamentos",Histórico:"Histórico",Verificações:"Verificações",Configurações:"Configurações"};
  return <><div className="page-heading section-title"><div><div className="eyebrow">{page==="Contas"||page==="Biblioteca"?"DADOS DA ORGANIZAÇÃO":"PULSO SOCIAL"}</div><h1>{titles[page]}</h1><p>{page==="Contas"?"Cadastre perfis da organização.":page==="Biblioteca"?"Mídias privadas do seu espaço.":"Gerencie seu espaço."}</p></div>{(page==="Contas"||page==="Biblioteca")&&<button className="button button-primary" onClick={()=>document.getElementById(page==="Contas"?"new-profile":"media-file")?.click()}><Plus size={17}/>{page==="Contas"?"Cadastrar perfil":"Enviar mídia"}</button>}</div>
    {message&&<div className="inline-message">{message}</div>}{error&&<div className="inline-error">{error}</div>}
    {page==="Contas"?<><div className="demo-notice"><LockKeyhole size={15}/><span>Login e publicação automatizados estão desligados até haver autorização expressa do Instagram.</span></div><form className="panel add-account-form" onSubmit={addAccount}><label>Nome de usuário<input id="new-profile" value={username} onChange={e=>setUsername(e.target.value)} pattern="[A-Za-z0-9._]{1,30}" placeholder="minhaempresa" required/></label><button className="button button-primary" disabled={busy}>Cadastrar</button></form><div className="panel list-panel"><div className="list-toolbar"><div className="search-box"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar usuário"/></div><span className="capacity">{accounts.length} de 500 perfis</span></div>{accounts.filter(a=>a.username.includes(query.toLowerCase())).map(a=><div className="account-row" key={a.id}><div className="account-avatar">{a.username.slice(0,2).toUpperCase()}</div><div className="account-details"><b>@{a.username}</b><span>Sem sessão vinculada</span></div><span className="connection needs-action"><i/>Não conectada</span></div>)}{!accounts.length&&<div className="empty-state">Nenhum perfil cadastrado.</div>}</div></>:page==="Biblioteca"?<><div className="panel upload-panel"><div className="upload-icon"><CloudUpload size={24}/></div><h2>Upload privado</h2><p>JPG, PNG ou WebP até 20 MB; MP4 até 100 MB. O servidor valida o tipo do arquivo.</p><button className="button button-primary" disabled={busy} onClick={()=>document.getElementById("media-file")?.click()}>{busy?"Enviando…":"Escolher arquivo"}</button><input id="media-file" type="file" hidden accept="image/jpeg,image/png,image/webp,video/mp4" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.currentTarget.value=""}}/></div><div className="media-grid">{media.map(m=><a className="panel media-card" key={m.id} href={m.url} target="_blank" rel="noreferrer">{m.mimeType.startsWith("image/")?<div className="media-image" role="img" aria-label={m.name} style={{backgroundImage:`url(${JSON.stringify(m.url).slice(1,-1)})`}}/>:<div className="media-video"><Video size={24}/></div>}<b>{m.name}</b><span>{(m.bytes/1048576).toFixed(1)} MB</span></a>)}{!media.length&&<div className="empty-state">Biblioteca vazia.</div>}</div></>:<div className="panel empty-panel"><div className="empty-illustration"><CalendarClock size={26}/></div><h2>Publicação externa desativada</h2><p>Este projeto não envia conteúdo ao Instagram. A automação da interface depende de permissão expressa da plataforma.</p><button className="button button-primary" onClick={()=>page==="Verificações"?setPage("Contas"):setComposeOpen(false)}><ArrowRight size={16}/> Abrir contas</button></div>}</>;
}

function ComposeModal({ onClose, selected, setSelected, onSubmit }: { onClose: () => void; selected: string[]; setSelected: (s: string[]) => void; onSubmit: () => void }) {
  const [kind, setKind] = useState("REEL"); const [caption, setCaption] = useState(""); const [fileName, setFileName] = useState(""); const [schedule, setSchedule] = useState(false);
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter(s => s !== id) : [...selected,id]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="compose-modal"><div className="modal-header"><div><span className="eyebrow">NOVA PUBLICAÇÃO · DEMONSTRAÇÃO</span><h2>Prepare seu conteúdo</h2></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div><div className="modal-scroll"><div className="field-label">FORMATO</div><div className="format-choice">{[{key:"IMAGE",label:"Imagem",icon:<FileImage size={17}/>},{key:"CAROUSEL",label:"Carrossel",icon:<Grid2X2 size={17}/>},{key:"REEL",label:"Reel",icon:<Video size={17}/>}].map(v => <button key={v.key} className={kind === v.key ? "chosen" : ""} onClick={() => setKind(v.key)}>{v.icon}{v.label}{kind === v.key && <Check size={14}/>}</button>)}</div><div className="field-label field-spaced">MÍDIA</div><label className={`modal-dropzone ${fileName ? "has-file" : ""}`}><input type="file" accept="image/*,video/*" multiple={kind === "CAROUSEL"} onChange={e => setFileName(e.target.files?.[0]?.name ?? "")}/>{fileName ? <><FileImage size={20}/><b>{fileName}</b><span>Selecionado localmente · ainda não enviado</span></> : <><CloudUpload size={22}/><b>Solte o arquivo aqui ou clique para procurar</b><span>Imagens e vídeo · confira os limites da plataforma</span></>}</label><div className="field-label field-spaced">LEGENDA</div><textarea className="caption-input" maxLength={2200} placeholder="Escreva uma legenda para esta publicação..." value={caption} onChange={e => setCaption(e.target.value)}/><div className="caption-count">{caption.length}/2.200 caracteres</div><div className="field-label field-spaced">CONTAS <span className="subtle-normal">{selected.length} selecionadas</span></div><div className="account-picker">{demoAccounts.map(a => <button key={a.id} className="picker-row" onClick={() => toggle(a.id)}><span className={`checkbox ${selected.includes(a.id) ? "checked" : ""}`}>{selected.includes(a.id) && <Check size={12}/>}</span><span className="tiny-avatar">{a.initials}</span><b>@{a.username}</b><span className="picker-group">{a.group}</span></button>)}</div><label className="schedule-toggle"><input type="checkbox" checked={schedule} onChange={e => setSchedule(e.target.checked)}/><span><b>Agendar publicação</b><small>Escolha data e horário local para cada tarefa.</small></span></label>{schedule && <input className="datetime-input" type="datetime-local"/>}<div className="modal-caveat"><AlertCircle size={15}/><span>Demo: clicar em publicar não envia nada ao Instagram. Nenhuma credencial ou mídia será armazenada.</span></div></div><div className="modal-footer"><button className="button button-outline" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={!fileName || selected.length === 0} onClick={onSubmit}><Instagram size={16}/>{schedule ? "Criar agendamento demo" : `Criar ${selected.length} tarefas demo`}</button></div></div></div>;
}
