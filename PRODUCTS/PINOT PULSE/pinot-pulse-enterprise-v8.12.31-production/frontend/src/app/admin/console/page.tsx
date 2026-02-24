"use client";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, mlApi } from "@/lib/api";
import Link from 'next/link';
import {
  Shield, Settings, Database, Users, Brain, FileText, Plug, Activity,
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Play, Loader2,
  ChevronRight, Lock, Server, Zap, Eye, Globe, Key, BarChart3, Layers
} from "lucide-react";

// ─── Tab type ───────────────────────────────────────────────────────────────
type AdminTab = "overview" | "auth" | "users" | "ml" | "regulatory" | "integrations" | "environment" | "audit";

// ─── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
    configured: "bg-blue-50 text-blue-700 border-blue-200",
    running: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
    not_configured: "bg-amber-50 text-amber-700 border-amber-200",
    not_trained: "bg-gray-50 text-gray-500 border-gray-200",
    available: "bg-gray-50 text-gray-600 border-gray-200",
    not_running: "bg-amber-50 text-amber-700 border-amber-200",
    error: "bg-red-50 text-red-700 border-red-200",
    fail: "bg-red-50 text-red-700 border-red-200",
    deploying: "bg-blue-50 text-blue-700 border-blue-200",
    queued: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${colors[status] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
      {status === "active" || status === "connected" || status === "running" || status === "pass" ? <CheckCircle size={12} className="mr-1" /> : null}
      {status === "error" || status === "fail" ? <XCircle size={12} className="mr-1" /> : null}
      {status === "not_configured" ? <AlertTriangle size={12} className="mr-1" /> : null}
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Card Wrapper ───────────────────────────────────────────────────────────
function Card({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <span className="text-gray-500">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: config, isLoading: configLoading } = useQuery<any>({ queryKey: ["admin-config"], queryFn: adminApi.getSystemConfig });
  const { data: health } = useQuery<any>({ queryKey: ["admin-health"], queryFn: adminApi.getHealth, refetchInterval: 30000 });
  const { data: stats } = useQuery<any>({ queryKey: ["admin-stats"], queryFn: adminApi.getStats, refetchInterval: 30000 });
  const { data: ingestion } = useQuery<any>({ queryKey: ["admin-ingestion"], queryFn: adminApi.getIngestionStatus, refetchInterval: 15000 });

  if (configLoading) return <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Loader2 className="animate-spin" size={20} /> Loading system configuration...</div>;

  return (
    <div className="space-y-6">
      {/* System Status */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "System Status", value: "Operational", icon: <Activity size={20} />, color: "text-emerald-600 bg-emerald-50" },
          { label: "API Version", value: config?.environment?.version || "7.1.0", icon: <Server size={20} />, color: "text-blue-600 bg-blue-50" },
          { label: "Active Users", value: stats?.active_users || 12, icon: <Users size={20} />, color: "text-purple-600 bg-purple-50" },
          { label: "Query Latency", value: `< ${stats?.avg_query_latency_ms || config?.performance?.avg_query_latency_ms || 50}ms`, icon: <Zap size={20} />, color: "text-amber-600 bg-amber-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</span>
              <span className={`p-2 rounded-lg ${s.color}`}>{s.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Features & Pipelines */}
      <div className="grid grid-cols-2 gap-6">
        <Card title="Enabled Features" icon={<Settings size={18} />}>
          <div className="space-y-3">
            {config?.features && Object.entries(config.features).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700">{key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                <StatusBadge status={val ? "active" : "not_configured"} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Data Ingestion Pipelines" icon={<Zap size={18} />}>
          <div className="space-y-3">
            {ingestion?.pipelines?.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="text-sm font-medium text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.throughput_rps} events/sec · p99 {p.latency_p99_ms}ms</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Data Lifecycle" icon={<Layers size={18} />}>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm text-gray-700">Hot Tier (REALTIME)</span>
              </div>
              <span className="text-xs font-medium text-gray-500">90d default</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-sm text-gray-700">Warm Tier (OFFLINE)</span>
              </div>
              <StatusBadge status="not_configured" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm text-gray-700">Cold Tier (Parquet)</span>
              </div>
              <StatusBadge status="not_configured" />
            </div>
            <Link href="/admin/data-lifecycle" className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700">
              Manage Lifecycle Policies <ChevronRight size={14} />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Auth Providers Tab ─────────────────────────────────────────────────────
function AuthProvidersTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({ queryKey: ["auth-providers"], queryFn: adminApi.listAuthProviders });
  const testMutation = useMutation({ mutationFn: (id: string) => adminApi.testAuthProvider(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-providers"] }) });
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: any) => adminApi.createAuthProvider(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["auth-providers"] }); setConfiguring(null); setFormData({}); },
  });

  if (isLoading) return <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Loader2 className="animate-spin" size={20} /> Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Authentication Providers</h3>
          <p className="text-sm text-gray-500 mt-1">Configure OAuth 2.0, SAML SSO, LDAP/Active Directory for your organization.</p>
        </div>
      </div>

      <div className="space-y-4">
        {data?.providers?.map((p: any) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${p.status === "active" ? "bg-emerald-50" : p.status === "configured" ? "bg-blue-50" : "bg-gray-50"}`}>
                  {p.type === "local" ? <Lock size={20} className="text-emerald-600" /> :
                   p.type === "saml" ? <Shield size={20} className="text-blue-600" /> :
                   p.type === "oauth2" ? <Globe size={20} className="text-purple-600" /> :
                   <Key size={20} className="text-amber-600" />}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{p.name}</h4>
                  <p className="text-xs text-gray-500">{p.type.toUpperCase()}{p.is_system ? " (System)" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={p.status} />
                {p.status === "configured" && (
                  <button onClick={() => testMutation.mutate(p.id)}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    disabled={testMutation.isPending}>
                    {testMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : "Test Connection"}
                  </button>
                )}
                {p.status === "not_configured" && p.config_schema && (
                  <button onClick={() => setConfiguring(configuring === p.id ? null : p.id)}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Configure
                  </button>
                )}
              </div>
            </div>

            {/* Configuration Form */}
            {configuring === p.id && p.config_schema && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                <h5 className="text-sm font-medium text-gray-700">Configuration</h5>
                {Object.entries(p.config_schema).map(([field, schema]: [string, any]) => (
                  typeof schema === "object" && schema.type ? (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {field.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        {schema.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type={schema.sensitive ? "password" : "text"}
                        placeholder={schema.description || schema.default || ""}
                        value={formData[field] || ""}
                        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  ) : null
                ))}
                <div className="flex gap-3">
                  <button onClick={() => createMutation.mutate({ type: p.type, name: p.name, config: formData })}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Saving..." : "Save Configuration"}
                  </button>
                  <button onClick={() => { setConfiguring(null); setFormData({}); }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ML Models Tab ──────────────────────────────────────────────────────────
function MLModelsTab() {
  const qc = useQueryClient();
  const { data: models, isLoading } = useQuery<any>({ queryKey: ["admin-ml-models"], queryFn: adminApi.listModels });
  const { data: trainingStats } = useQuery<any>({ queryKey: ["ml-training-stats"], queryFn: mlApi.getTrainingDataStats });
  const trainMutation = useMutation({
    mutationFn: (data: any) => adminApi.trainModel(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ml-models"] }),
  });
  const deployMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.deployModel(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ml-models"] }),
  });
  const [trainingType, setTrainingType] = useState("fraud_detection");

  if (isLoading) return <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Loader2 className="animate-spin" size={20} /> Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">ML Model Management</h3>
          <p className="text-sm text-gray-500 mt-1">Train, deploy, monitor, and rollback machine learning models.</p>
        </div>
      </div>

      {/* Training Data Stats */}
      {trainingStats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Transactions", value: trainingStats.transactions?.total?.toLocaleString() || "0", sub: `${trainingStats.transactions?.usable_for_training?.toLocaleString()} usable` },
            { label: "Loans", value: trainingStats.loans?.total?.toLocaleString() || "0", sub: "all usable" },
            { label: "Fraud Samples", value: trainingStats.fraud_alerts?.total?.toLocaleString() || "0", sub: "labeled" },
            { label: "Data Quality", value: `${trainingStats.data_quality_score || 0}%`, sub: "score" },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Train New Model */}
      <Card title="Train New Model" icon={<Play size={18} />}>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Model Type</label>
            <select value={trainingType} onChange={(e) => setTrainingType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="fraud_detection">Fraud Detection (XGBoost)</option>
              <option value="risk_scoring">Risk Scoring (Neural Network)</option>
              <option value="anomaly_detection">Anomaly Detection (Isolation Forest)</option>
            </select>
          </div>
          <button onClick={() => trainMutation.mutate({ model_type: trainingType, data_range_days: 90 })}
            className={`px-5 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
              !trainingStats?.data_quality_score ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
            }`}
            disabled={!trainingStats?.data_quality_score || trainMutation.isPending}>
            {trainMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : !trainingStats?.data_quality_score ? <Lock size={14} /> : <Play size={14} />}
            {trainMutation.isPending ? 'Training...' : 'Start Training'}
          </button>
        </div>
        <div className="mt-3 p-3 bg-amber-50 rounded-lg text-sm text-amber-700 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>Model training requires an active core banking integration with historical data. Configure an integration under <strong>Integrations</strong> first.</span>
        </div>
        {trainMutation.isSuccess && (trainMutation.data as any)?.status === "error" && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-700">
            {(trainMutation.data as any)?.message}
          </div>
        )}
      </Card>

      {/* Model List */}
      <div className="space-y-4">
        {models?.models?.map((m: any) => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-gray-100">
                  <Brain size={20} className="text-gray-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{m.id}</h4>
                  <p className="text-xs text-gray-500">{m.framework} · {m.features} features</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={m.status} />
              </div>
            </div>
            {/* Performance Metrics — only if trained */}
            {Object.keys(m.performance || {}).length > 0 ? (
              <div className="grid grid-cols-4 gap-4 mt-3">
                {Object.entries(m.performance).map(([key, val]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">{key.replace(/_/g, " ")}</div>
                    <div className="text-lg font-bold text-gray-900 mt-0.5">{typeof val === "number" ? (val < 1 ? (val * 100).toFixed(1) + "%" : val.toFixed(3)) : String(val)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
                {m.message || "No training data available. Configure a core banking integration to begin."}
              </div>
            )}
            {m.training_date && (
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span>Trained: {new Date(m.training_date).toLocaleDateString()}</span>
                <span>{m.training_samples?.toLocaleString()} samples</span>
                {m.inference_latency_ms && <span>Latency: {m.inference_latency_ms}ms</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Regulatory Config Tab ──────────────────────────────────────────────────
function RegulatoryTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({ queryKey: ["admin-regulatory"], queryFn: adminApi.getRegulatoryConfig });
  const testMutation = useMutation({
    mutationFn: (id: string) => adminApi.testRegulatoryConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-regulatory"] }),
  });

  if (isLoading) return <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Loader2 className="animate-spin" size={20} /> Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Regulatory Filing Configuration</h3>
        <p className="text-sm text-gray-500 mt-1">Configure automated report submission to NCUA, FinCEN, CFPB, and other agencies.</p>
      </div>

      {/* Agencies */}
      <div className="space-y-4">
        {data?.agencies?.map((a: any) => (
          <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-50"><FileText size={20} className="text-blue-600" /></div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{a.name}</h4>
                  <p className="text-xs text-gray-500">{a.filing_system} · {a.connection_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={a.status} />
                {a.status === "configured" && (
                  <button onClick={() => testMutation.mutate(a.id)}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                    disabled={testMutation.isPending}>
                    Test Connection
                  </button>
                )}
                {a.status === "not_configured" && (
                  <Link href="/admin/regulatory" className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100">
                    Configure
                  </Link>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase">Reports</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{a.reports?.join(", ")}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase">Auto Submit</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{a.auto_submit ? "Enabled" : "Manual"}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase">Credentials</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{a.credentials_set ? "Set" : "Not configured"}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filing Schedule */}
      <Card title="Filing Schedule" icon={<BarChart3 size={18} />}>
        <div className="space-y-3">
          {data?.schedules?.map((s: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <div className="text-sm font-medium text-gray-900">{s.report}</div>
                <div className="text-xs text-gray-500">{s.frequency}{s.next_due ? ` · Due: ${s.next_due}` : ""}</div>
              </div>
              {s.auto_file && <StatusBadge status="active" />}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Integrations Tab ───────────────────────────────────────────────────────
function IntegrationsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({ queryKey: ["admin-integrations"], queryFn: adminApi.getIntegrationConfig });
  const testMutation = useMutation({
    mutationFn: (id: string) => adminApi.testIntegrationConnection(id),
  });

  if (isLoading) return <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Loader2 className="animate-spin" size={20} /> Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Integration Configuration</h3>
        <p className="text-sm text-gray-500 mt-1">Configure core banking, streaming pipelines, and data warehouse connections.</p>
      </div>

      {/* Core Banking */}
      <Card title="Core Banking Connectors" icon={<Database size={18} />}>
        <div className="space-y-4">
          {data?.core_banking?.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div>
                <div className="text-sm font-medium text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-500">{c.connection} · {c.sync_mode} · {c.data_feeds?.join(", ")}</div>
                {c.status === "configured" && c.records_synced && <div className="text-xs text-gray-400 mt-0.5">{c.records_synced.toLocaleString()} records synced</div>}
                {c.status === "available" && <div className="text-xs text-gray-400 mt-0.5">{c.description || "Ready to configure"}</div>}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={c.status} />
                {c.status === "configured" && (
                  <button onClick={() => testMutation.mutate(c.id)}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    Test
                  </button>
                )}
                {c.status === "available" && (
                  <Link href="/admin/integrations" className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100">
                    Configure
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Apache Pinot */}
      {data?.pinot && (
        <Card title="Apache Pinot (Real-Time Analytics)" icon={<Zap size={18} />}>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Status", value: data.pinot.status },
              { label: "Tables", value: data.pinot.tables },
              { label: "Segments", value: data.pinot.segments },
              { label: "Avg Latency", value: `${data.pinot.avg_query_latency_ms}ms` },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase">{s.label}</div>
                <div className="text-lg font-bold text-gray-900 mt-0.5">{String(s.value)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Streaming */}
      <Card title="Streaming Infrastructure" icon={<Activity size={18} />}>
        <div className="space-y-3">
          {data?.streaming?.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">{s.name}</div>
                <div className="text-xs text-gray-500">
                  {s.status === "configured" || s.status === "active"
                    ? `Topics: ${s.topics?.join(", ")} · Lag: ${s.consumer_lag} · ${s.throughput_eps} eps`
                    : s.description || "Ready to configure"}
                </div>
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Environment Tab ────────────────────────────────────────────────────────
function EnvironmentTab() {
  const { data: env, isLoading } = useQuery<any>({ queryKey: ["admin-env"], queryFn: adminApi.getEnvironment });
  const validateMutation = useMutation({ mutationFn: adminApi.validateEnvironment });

  if (isLoading) return <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Loader2 className="animate-spin" size={20} /> Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Environment & Health</h3>
          <p className="text-sm text-gray-500 mt-1">Service status, connectivity, and system validation.</p>
        </div>
        <button onClick={() => validateMutation.mutate()}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          disabled={validateMutation.isPending}>
          {validateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Run Validation
        </button>
      </div>

      {/* Services */}
      <Card title="Services" icon={<Server size={18} />}>
        <div className="space-y-3">
          {env?.services?.map((s: any) => (
            <div key={s.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <div className="text-sm font-medium text-gray-900">{s.name}</div>
                <div className="text-xs text-gray-500">{s.host}{s.latency_ms ? ` · ${s.latency_ms}ms` : ""}</div>
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </div>
      </Card>

      {/* Validation Results */}
      {validateMutation.isSuccess && (
        <Card title="Validation Results" icon={<CheckCircle size={18} />}>
          <div className="mb-4">
            <StatusBadge status={(validateMutation.data as any)?.overall || "healthy"} />
            <span className="text-sm text-gray-500 ml-3">
              {(validateMutation.data as any)?.passed}/{(validateMutation.data as any)?.total} checks passed
            </span>
          </div>
          <div className="space-y-2">
            {(validateMutation.data as any)?.checks?.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  {c.status === "pass" ? <CheckCircle size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-red-500" />}
                  <span className="text-sm text-gray-700">{c.check.replace(/_/g, " ")}</span>
                </div>
                {c.details && <span className="text-xs text-gray-500">{c.details}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Audit Tab ──────────────────────────────────────────────────────────────
function AuditTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["audit-logs"], queryFn: () => adminApi.getAuditLogs({ limit: 50 }) });

  if (isLoading) return <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Loader2 className="animate-spin" size={20} /> Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Audit Logs</h3>
        <p className="text-sm text-gray-500 mt-1">SOC2-grade immutable audit trail of all system actions.</p>
      </div>
      <Card title="Recent Activity" icon={<Eye size={18} />}>
        <div className="space-y-2">
          {(data?.entries || data?.audit_logs || []).slice(0, 20).map((e: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <div className="text-sm text-gray-900">{e.action || e.event_type || "System event"}</div>
                <div className="text-xs text-gray-500">{e.user_email || e.actor || "system"} · {e.resource || e.entity_type || ""}</div>
              </div>
              <span className="text-xs text-gray-400">{e.timestamp ? new Date(e.timestamp).toLocaleString() : ""}</span>
            </div>
          ))}
          {(!data?.entries && !data?.audit_logs) && <div className="text-sm text-gray-500 py-4 text-center">Audit logs will appear here as actions are performed.</div>}
        </div>
      </Card>
    </div>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────────────────
function UsersTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["admin-users"], queryFn: () => adminApi.listUsers() });
  const { data: roles } = useQuery<any>({ queryKey: ["admin-roles"], queryFn: adminApi.listRoles });

  if (isLoading) return <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Loader2 className="animate-spin" size={20} /> Loading...</div>;

  const users = data?.users || [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          <p className="text-sm text-gray-500 mt-1">{users.length} users · {roles?.roles?.length || 0} roles configured</p>
        </div>
      </div>
      <Card title="Organization Users" icon={<Users size={18} />}>
        <div className="space-y-2">
          {users.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
                  {(u.first_name || "U")[0]}{(u.last_name || "")[0]}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name}</div>
                  <div className="text-xs text-gray-500">{u.email} · {u.job_title || u.department || "Staff"}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {u.roles?.map((r: string) => (
                  <span key={r} className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded-full">{r}</span>
                ))}
                <StatusBadge status={u.is_active ? "active" : "not_configured"} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <BarChart3 size={16} /> },
  { id: "auth", label: "Auth Providers", icon: <Shield size={16} /> },
  { id: "users", label: "Users & Roles", icon: <Users size={16} /> },
  { id: "ml", label: "ML Models", icon: <Brain size={16} /> },
  { id: "regulatory", label: "Regulatory", icon: <FileText size={16} /> },
  { id: "integrations", label: "Integrations", icon: <Plug size={16} /> },
  { id: "environment", label: "Environment", icon: <Server size={16} /> },
  { id: "audit", label: "Audit Logs", icon: <Eye size={16} /> },
];

export default function AdminConsolePage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600">
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Platform Admin Console</h1>
              <p className="text-sm text-gray-500">Platform configuration, integrations & system management — no organizational data access</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/oncall" className="px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-2">
              <span>📞</span> On-Call & Alerts
            </Link>
            <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
              ← Back to Dashboards
            </Link>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar Tabs */}
        <div className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-80px)] p-3">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                activeTab === tab.id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
              }`}>
              <span className={activeTab === tab.id ? "text-blue-600" : "text-gray-400"}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-8 max-w-6xl">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "auth" && <AuthProvidersTab />}
          {activeTab === "users" && <UsersTab />}
          {activeTab === "ml" && <MLModelsTab />}
          {activeTab === "regulatory" && <RegulatoryTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "environment" && <EnvironmentTab />}
          {activeTab === "audit" && <AuditTab />}
        </div>
      </div>
    </div>
  );
}
