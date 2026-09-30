"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity, AlertCircle, ArrowRight, CalendarClock, Check, ChevronDown, CircleHelp,
  Clock3, FileImage, Grid2X2, Instagram, ListFilter, RefreshCw, Search, Sparkles, Video,
} from "lucide-react";
import type { PublishStatus } from "@/lib/domain";

type Period = "today" | "7d";
type Kind = "IMAGE" | "CAROUSEL" | "REEL";
type DashboardData = {
  period: Period;
  timezone: string;
  summary: {
    accountCount: number; connectedAccountCount: number; publishedCount: number;
    publishingAccountCount: number; attentionCount: number; failedCount: number;
    verificationCount: number; uncertainCount: number;
    formats: Record<Kind, number>;
  };
  views: {
    value: number | null; quality: "OBSERVED" | "PARTIAL" | "CORRECTION" | "UNAVAILABLE";
    observedSeries: number; partialSeries: number; correctedSeries: number;
    lastObservedAt: string | null; updatedAccountCount: number;
  };
  recentPosts: Array<{
    id: string; title: string; kind: Kind; account: string; createdAt: string;
    publishedAt: string | null; status: PublishStatus; views: number | null;
  }>;
};
type Props = {
  period: string;
  setPeriod: (value: string) => void;
  onCompose: () => void;
  setPage: (value: "Contas" | "Histórico" | "Configurações") => void;
};

const formatNumber = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
const formatDateTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const statusLabel: Record<PublishStatus, string> = {
  QUEUED: "Na fila", PROCESSING: "Processando", PUBLISHED: "Publicado", FAILED: "Falhou",
  NEEDS_VERIFICATION: "Aguardando verificação", UNCERTAIN: "Resultado incerto", CANCELLED: "Cancelado",
};

type MetricCardProps = { icon: ReactNode; label: string; value: string; detail: string; foot: string; color: string; hint: string };
function MetricCard({ icon, label, value, detail, foot, color, hint }: MetricCardProps) {
  return <div className="metric-card">
    <div className="metric-top"><div className={"metric-icon " + color}>{icon}</div><button className="hint-button" title={hint} aria-label={hint}><CircleHelp size={15}/></button></div>
    <span className="metric-label">{label}</span>
    <div className="metric-value-row"><strong>{value}</strong><span className="metric-delta neutral">{detail}</span></div>
    <span className="metric-foot">{foot}</span>
  </div>;
}

function Status({ status }: { status: PublishStatus }) {
  const cls = status === "PUBLISHED" ? "published" : status === "FAILED" ? "failed" : status === "NEEDS_VERIFICATION" ? "waiting" : status === "UNCERTAIN" ? "uncertain" : "queued";
  return <span className={"status " + cls}><i/>{statusLabel[status]}</span>;
}

export default function DashboardOverview({ period, setPeriod, onCompose, setPage }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "published">("all");

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    setRefreshing(true);
    try {
      const response = await fetch(`/api/dashboard?period=${period === "7 dias" ? "7d" : "today"}`, { signal, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar o painel.");
      setData(result as DashboardData);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o painel.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [period]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const filteredPosts = useMemo(() => (data?.recentPosts ?? []).filter(post => {
    const matchesSearch = `${post.title} ${post.account}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (activeTab === "all" || post.status === "PUBLISHED");
  }), [data?.recentPosts, search, activeTab]);

  const summary = data?.summary;
  const views = data?.views;
  const viewLabel = period === "7 dias" ? "Visualizações nos últimos 7 dias" : "Visualizações geradas hoje";
  const qualityLabel = views?.quality === "OBSERVED" ? "Dados observados"
    : views?.quality === "PARTIAL" ? "Cobertura parcial"
      : views?.quality === "CORRECTION" ? "Contador corrigido" : "Sem métricas reais";
  const today = data ? new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: data.timezone }).format(new Date()) : "";

  return <div className="page-content">
    <div className="page-heading">
      <div><div className="eyebrow">{today || "VISÃO GERAL"} <span className="timezone">· {data?.timezone ?? "America/Sao_Paulo"}</span></div>
        <h1>Visão geral<span className="heading-period">{period === "7 dias" ? "Últimos 7 dias" : "Hoje"}</span></h1>
        <p>Indicadores e publicações registrados neste espaço de trabalho.</p>
      </div>
      <div className="heading-actions">
        <button className="button button-outline" onClick={() => setPeriod(period === "Hoje" ? "7 dias" : "Hoje")}><CalendarClock size={16}/>{period}<ChevronDown size={14}/></button>
        <button className="button button-outline" onClick={() => void load()} disabled={refreshing} aria-label="Atualizar painel"><RefreshCw size={16}/>{refreshing ? "Atualizando…" : "Atualizar"}</button>
        <button className="button button-primary" onClick={onCompose}>+ Nova publicação</button>
      </div>
    </div>

    <div className="demo-notice"><Sparkles size={15}/><span><b>Painel conectado ao sistema.</b> As métricas do Instagram aparecem somente quando forem coletadas e gravadas como dados observados.</span><button onClick={() => setPage("Configurações")}>Sobre os dados <ArrowRight size={14}/></button></div>
    {error && <div className="inline-error" role="alert">{error} <button className="text-button" onClick={() => void load()}>Tentar novamente</button></div>}

    <div className="metric-grid">
      <MetricCard icon={<Activity size={17}/>} label={viewLabel} value={views?.value === null || views?.value === undefined ? "—" : formatNumber(views.value)} detail={qualityLabel} foot={views ? `${views.observedSeries} séries observadas · ${views.partialSeries} parciais` : "Aguardando dados"} color="violet" hint="Variação dos contadores reais no período. Séries sem uma leitura inicial aparecem como parciais."/>
      <MetricCard icon={<Check size={17}/>} label="Publicações concluídas" value={summary ? formatNumber(summary.publishedCount) : "—"} detail={period} foot={summary ? `em ${summary.publishingAccountCount} contas` : "Aguardando dados"} color="green" hint="Publicações com status confirmado no período selecionado."/>
      <MetricCard icon={<Instagram size={17}/>} label="Perfis conectados" value={summary ? formatNumber(summary.connectedAccountCount) : "—"} detail={summary ? `de ${formatNumber(summary.accountCount)} perfis` : "Aguardando dados"} foot="Somente perfis com sessão válida" color="orange" hint="Perfis cadastrados com estado conectado no banco de dados."/>
      <MetricCard icon={<AlertCircle size={17}/>} label="Precisam de atenção" value={summary ? formatNumber(summary.attentionCount) : "—"} detail={summary ? `${summary.verificationCount} verificações` : "Aguardando dados"} foot={summary ? `${summary.failedCount} falhas · ${summary.uncertainCount} incertas` : "Aguardando dados"} color="pink" hint="Tarefas que falharam, aguardam verificação ou têm resultado incerto."/>
    </div>

    <div className="format-strip"><div className="format-strip-title"><b>Publicações por formato</b><span>Publicações confirmadas no período</span></div>
      <div className="format-stat"><FileImage size={15}/><span>Imagens</span><b>{summary ? formatNumber(summary.formats.IMAGE) : "—"}</b></div>
      <div className="format-stat"><Grid2X2 size={15}/><span>Carrosséis</span><b>{summary ? formatNumber(summary.formats.CAROUSEL) : "—"}</b></div>
      <div className="format-stat"><Video size={15}/><span>Reels</span><b>{summary ? formatNumber(summary.formats.REEL) : "—"}</b></div>
      <div className="format-stat videos-total"><Video size={15}/><span>Total de vídeos</span><b>{summary ? formatNumber(summary.formats.REEL) : "—"}</b></div>
    </div>

    <div className="content-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Atividade de visualizações</h2><p>Somente contadores observados e registrados</p></div></div>
        <div className="chart-total"><strong>{views?.value === null || views?.value === undefined ? "—" : formatNumber(views.value)}</strong><span className="positive">{qualityLabel}</span><small>{viewLabel}</small></div>
        <div className="chart-wrap"><div className="empty-state">{views?.value === null || views?.value === undefined ? "Ainda não há métricas reais suficientes para desenhar a atividade." : `Variação observada em ${views.observedSeries} séries de métricas.`}</div></div>
        <div className="chart-meta"><span><i className="legend-dot"/> Métricas com origem Instagram UI</span><span>Última coleta: {formatDateTime(views?.lastObservedAt ?? null)}</span></div>
        <div className="accumulated-note"><span>Contas com métrica nas últimas 24 horas</span><b>{views ? formatNumber(views.updatedAccountCount) : "—"} / {summary ? formatNumber(summary.accountCount) : "—"}</b><small>Cobertura da coleta, não contagem de visualizações acumuladas.</small></div>
      </section>
      <section className="panel coverage-panel"><div className="panel-heading"><div><h2>Cobertura dos dados</h2><p>Coleta confirmada nas últimas 24 horas</p></div></div>
        <div className="coverage-number"><strong>{views ? formatNumber(views.updatedAccountCount) : "—"}</strong><span>de {summary ? formatNumber(summary.accountCount) : "—"} perfis atualizados</span></div>
        <div className="coverage-bar"><i style={{width: `${summary?.accountCount ? Math.min(100, views!.updatedAccountCount / summary.accountCount * 100) : 0}%`}}/></div>
        <div className="coverage-stats"><div><span className="stat-dot dot-green"/>Com dados recentes<strong>{views ? `${formatNumber(views.updatedAccountCount)} perfis` : "—"}</strong></div><div><span className="stat-dot dot-amber"/>Sem dados recentes<strong>{summary && views ? `${formatNumber(Math.max(0, summary.accountCount - views.updatedAccountCount))} perfis` : "—"}</strong></div></div>
        <div className="coverage-foot"><Clock3 size={14}/> Atualização periódica; sem tempo real</div><button className="text-button" onClick={() => setPage("Contas")}>Ver contas <ArrowRight size={14}/></button>
      </section>
    </div>

    <section className="panel activity-panel"><div className="panel-heading activity-heading"><div><h2>Atividade recente</h2><p>Publicações registradas no banco de dados</p></div><div className="table-actions">
      <div className="search-box"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar publicação"/></div>
      <button className="filter-button" onClick={() => setActiveTab(activeTab === "all" ? "published" : "all")}><ListFilter size={15}/>{activeTab === "all" ? "Todas" : "Concluídas"}</button>
      <button className="text-button desktop-view" onClick={() => setPage("Histórico")}>Ver histórico <ArrowRight size={14}/></button>
    </div></div>
      <div className="table-scroll"><table><thead><tr><th>PUBLICAÇÃO</th><th>TIPO</th><th>CONTA</th><th>HORÁRIO</th><th>VISUALIZAÇÕES</th><th>STATUS</th></tr></thead><tbody>
        {filteredPosts.map(post => <tr key={post.id}><td><div className="post-title"><div className={`post-thumb thumb-${post.kind.toLowerCase()}`}>{post.kind === "REEL" ? <Video size={16}/> : <FileImage size={16}/>}</div><b>{post.title}</b></div></td>
          <td><span className={`type-tag type-${post.kind.toLowerCase()}`}>{post.kind === "IMAGE" ? "Imagem" : post.kind === "CAROUSEL" ? "Carrossel" : "Reel"}</span></td>
          <td><span className="account-name"><span className="tiny-avatar">{post.account.slice(1,3).toUpperCase()}</span>{post.account}</span></td>
          <td className="muted-cell">{formatDateTime(post.publishedAt ?? post.createdAt)}</td><td>{post.views === null ? <span className="unavailable">Não disponível</span> : <span className="view-count">{formatNumber(post.views)}</span>}</td><td><Status status={post.status}/></td>
        </tr>)}
      </tbody></table>{!loading && filteredPosts.length === 0 && <div className="empty-state">{search ? "Nenhuma publicação corresponde à busca." : "Ainda não há publicações neste período."}</div>}</div>
      <div className="table-footer"><span>{loading ? "Carregando dados…" : `${filteredPosts.length} publicações exibidas · ${period}`}</span><button className="text-button" onClick={() => setPage("Histórico")}>Abrir histórico <ArrowRight size={14}/></button></div>
    </section>
  </div>;
}
