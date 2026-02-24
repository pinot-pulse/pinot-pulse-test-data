'use client';

/**
 * Pinot Pulse Enterprise — Real-Time Ingestion Pipeline Management
 *
 * Complete UI for configuring production-grade streaming pipelines:
 *   - Apache Kafka (self-hosted)
 *   - Confluent Cloud (managed Kafka)
 *   - Amazon Kinesis Data Streams
 *   - Azure Event Hubs
 *   - Google Cloud Pub/Sub
 *
 * Features:
 *   - Pipeline dashboard with live metrics
 *   - Multi-step creation wizard with provider-specific forms
 *   - Connection testing before deployment
 *   - DLQ (Dead Letter Queue) viewer with retry/discard
 *   - Real-time throughput, latency, and error rate charts
 *   - Credential management (stored in vault, never displayed)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Check,
  CheckCircle, ChevronDown, ChevronRight, Clock, Cloud, Copy, Database,
  Eye, EyeOff, FileText, Filter, GitBranch, HardDrive, Info, Key, Landmark,
  Layers, Loader2, Lock, Mail, Pause, Play, Plus, Power,
  RefreshCw, RotateCcw, Save, Search, Server, Settings, Shield,
  Square, Trash2, TrendingUp, Upload, Wifi, WifiOff, X, XCircle, Zap
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
interface Pipeline {
  id: string; name: string; slug: string; description?: string;
  provider: string; provider_config: Record<string, any>;
  target_schema: string; target_table: string; field_mapping: Record<string, string>;
  batch_size: number; batch_timeout_ms: number; max_retries: number;
  error_threshold_pct: number; dedup_enabled: boolean;
  dlq_enabled: boolean; schema_validation_enabled: boolean;
  status: string; enabled: boolean; priority: string;
  pipeline_mode?: string; schedule_expression?: string; schedule_timezone?: string;
  incremental_enabled?: boolean; watermark_column?: string;
  started_at?: string; stopped_at?: string; last_error?: string;
  tags: string[]; owner?: string; has_credentials: boolean;
  created_at?: string; updated_at?: string;
  live_status?: any; dlq_stats?: any;
}
interface DLQEntry {
  id: string; pipeline_id: string; message_key?: string; message_value: string;
  error_type: string; error_message: string; processing_stage?: string;
  retry_count: number; max_retries: number; resolution: string; created_at?: string;
}
interface Provider { id: string; name: string; description: string; icon: string; credential_fields: CredField[]; config_schema: any; }
interface CredField { name: string; label: string; type: string; required?: boolean; visible_when?: Record<string, any>; }
type View = 'list' | 'create' | 'detail' | 'edit';

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */
const PROVIDER_META: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; category: string }> = {
  // Streaming
  kafka:       { color: 'text-gray-900',   bg: 'bg-gray-50',    border: 'border-gray-300',   icon: <Layers size={20} />,    category: 'streaming' },
  confluent:   { color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-300',   icon: <Cloud size={20} />,     category: 'streaming' },
  kinesis:     { color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-300', icon: <Zap size={20} />,       category: 'streaming' },
  eventhubs:   { color: 'text-sky-700',    bg: 'bg-sky-50',     border: 'border-sky-300',    icon: <GitBranch size={20} />, category: 'streaming' },
  pubsub:      { color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-300',    icon: <Mail size={20} />,      category: 'streaming' },
  // Batch / Warehouse
  snowflake:   { color: 'text-cyan-700',   bg: 'bg-cyan-50',    border: 'border-cyan-300',   icon: <Database size={20} />,  category: 'warehouse' },
  postgres:    { color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-300', icon: <HardDrive size={20} />, category: 'database' },
  s3:          { color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-300',  icon: <Server size={20} />,    category: 'storage' },
  sftp:        { color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-300',   icon: <Shield size={20} />,    category: 'file_transfer' },
  rest_api:    { color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-300', icon: <Wifi size={20} />,      category: 'api' },
  file_upload: { color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-300',  icon: <Upload size={20} />,    category: 'upload' },
  // Core Banking (Tier 3)
  fiserv_dna:  { color: 'text-rose-700',   bg: 'bg-rose-50',    border: 'border-rose-300',   icon: <Landmark size={20} />,  category: 'core_banking' },
  symitar:     { color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-300', icon: <Landmark size={20} />,  category: 'core_banking' },
  keystone:    { color: 'text-lime-700',   bg: 'bg-lime-50',    border: 'border-lime-300',   icon: <Landmark size={20} />,  category: 'core_banking' },
};
const STATUS_MAP: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  running:    { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle size={13} />, label: 'Running' },
  configured: { cls: 'text-blue-700 bg-blue-50 border-blue-200',     icon: <Settings size={13} />,    label: 'Configured' },
  stopped:    { cls: 'text-gray-600 bg-gray-100 border-gray-200',    icon: <Square size={13} />,      label: 'Stopped' },
  paused:     { cls: 'text-amber-700 bg-amber-50 border-amber-200',  icon: <Pause size={13} />,       label: 'Paused' },
  failed:     { cls: 'text-red-700 bg-red-50 border-red-200',        icon: <XCircle size={13} />,     label: 'Failed' },
  degraded:   { cls: 'text-orange-700 bg-orange-50 border-orange-200', icon: <AlertTriangle size={13} />, label: 'Degraded' },
  draft:      { cls: 'text-gray-500 bg-gray-50 border-gray-200',     icon: <FileText size={13} />,    label: 'Draft' },
  starting:   { cls: 'text-blue-600 bg-blue-50 border-blue-200',     icon: <Loader2 size={13} className="animate-spin" />, label: 'Starting' },
};
const TARGETS = ['transactions', 'accounts', 'members', 'loans', 'fraud_alerts', 'deposits', 'custom'];
const PRIORITIES = ['critical', 'high', 'standard', 'low'];
const PRIORITY_COLORS: Record<string, string> = { critical: 'bg-red-500', high: 'bg-orange-500', standard: 'bg-blue-500', low: 'bg-gray-400' };
const TARGET_FIELDS: Record<string, string[]> = {
  transactions: ['transaction_id', 'account_id', 'member_id', 'amount', 'transaction_type', 'description', 'transaction_date', 'posted_date', 'category', 'merchant_name', 'balance_after', 'status'],
  accounts: ['account_id', 'member_id', 'account_type', 'account_number', 'balance', 'available_balance', 'status', 'opened_date', 'closed_date', 'interest_rate', 'credit_limit'],
  members: ['member_id', 'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'ssn_last4', 'address_line1', 'city', 'state', 'zip_code', 'join_date', 'status'],
  loans: ['loan_id', 'member_id', 'account_id', 'loan_type', 'original_amount', 'current_balance', 'interest_rate', 'monthly_payment', 'origination_date', 'maturity_date', 'status', 'delinquency_days'],
  fraud_alerts: ['alert_id', 'member_id', 'account_id', 'transaction_id', 'alert_type', 'severity', 'description', 'detected_at', 'resolved_at', 'status', 'score'],
  deposits: ['deposit_id', 'account_id', 'member_id', 'amount', 'deposit_type', 'deposit_date', 'source', 'status', 'reference_number'],
  custom: [],
};

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function authHeaders(): Record<string, string> {
  const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}
async function api<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`/api/v1${path}`, { headers: authHeaders(), ...opts });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || r.statusText); }
  return r.json();
}
function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`;
}
function fmtNum(n: number): string { if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`; return n.toString(); }

/* ═══════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */
function Badge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || STATUS_MAP.draft;
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.cls}`}>{s.icon} {s.label}</span>;
}
function ProviderBadge({ provider }: { provider: string }) {
  const m = PROVIDER_META[provider] || PROVIDER_META.kafka;
  const names: Record<string, string> = { kafka: 'Kafka', confluent: 'Confluent', kinesis: 'Kinesis', eventhubs: 'Event Hubs', pubsub: 'Pub/Sub', snowflake: 'Snowflake', postgres: 'PostgreSQL', s3: 'S3 / Cloud Storage', sftp: 'SFTP', rest_api: 'REST API', file_upload: 'File Upload', fiserv_dna: 'Fiserv DNA', symitar: 'Symitar', keystone: 'KeyStone' };
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${m.bg} ${m.color} ${m.border}`}>{m.icon} {names[provider] || provider}</span>;
}
function Metric({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 min-w-0">
      <div className="text-[11px] font-medium text-gray-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="flex items-baseline gap-1 truncate">
        <span className={`text-2xl font-bold tabular-nums ${color || 'text-gray-900'}`}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
    </div>
  );
}
function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', className = '' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md'; className?: string }) {
  const base = 'inline-flex items-center gap-2 font-semibold rounded-lg transition-all disabled:opacity-50 cursor-pointer';
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm';
  const v = { primary: 'text-white', secondary: 'border hover:opacity-90', danger: 'text-white', ghost: 'hover:opacity-80' }[variant];
  const inlineStyle = {
    primary: { background: 'linear-gradient(135deg, var(--accent-gradient-from, #F0B429), var(--accent-gradient-to, #D49A00))', color: '#fff', boxShadow: '0 2px 8px rgba(229,161,0,0.3)' },
    secondary: { background: '#fff', color: '#374151', borderColor: '#D1D5DB' },
    danger: { background: '#DC2626', color: '#fff' },
    ghost: { background: 'transparent', color: '#6B7280' },
  }[variant];
  return <button onClick={onClick} disabled={disabled} style={inlineStyle} className={`${base} ${sz} ${v} ${className}`}>{children}</button>;
}
function Input({ label, value, onChange, placeholder, type = 'text', help, required, disabled, rows, className }: { label: string; value: any; onChange: (v: any) => void; placeholder?: string; type?: string; help?: string; required?: boolean; disabled?: boolean; rows?: number; className?: string }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'textarea' || rows ? (
        <textarea id={id} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          rows={rows || 4} disabled={disabled} style={{ border: '1px solid #D1D5DB', color: '#1F2937' }}
          className="w-full px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:opacity-60" />
      ) : (
        <input id={id} type={type} value={value || ''} onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
          placeholder={placeholder} disabled={disabled} style={{ border: '1px solid #D1D5DB', color: '#1F2937' }}
          className="w-full px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:opacity-60" />
      )}
      {help && <p className="mt-1 text-xs" style={{ color: '#9CA3AF' }}>{help}</p>}
    </div>
  );
}
function Select({ label, value, onChange, options, help, required }: { label: string; value: any; onChange: (v: any) => void; options: { value: string; label: string }[]; help?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>{label} {required && <span className="text-red-500">*</span>}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ border: '1px solid #D1D5DB', color: '#1F2937' }}
        className="w-full px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white">
        <option value="">Select...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {help && <p className="mt-1 text-xs" style={{ color: '#9CA3AF' }}>{help}</p>}
    </div>
  );
}
function Toggle({ label, value, onChange, help }: { label: string; value: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <div className="text-sm font-medium" style={{ color: '#374151' }}>{label}</div>
        {help && <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{help}</div>}
      </div>
      <button type="button" onClick={() => onChange(!value)}
        style={{ background: value ? '#2563EB' : '#D1D5DB' }}
        className="relative w-11 h-6 rounded-full transition-colors cursor-pointer">
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
function TagInput({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => { const t = input.trim(); if (t && !value.includes(t)) { onChange([...value, t]); setInput(''); } };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
            {t} <button onClick={() => onChange(value.filter(x => x !== t))} className="hover:text-red-600 cursor-pointer"><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Type and press Enter" style={{ border: "1px solid #D1D5DB", color: "#1F2937" }} className="flex-1 px-3 py-2 rounded-lg text-sm" />
        <Btn onClick={add} variant="secondary" size="sm">Add</Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROVIDER CONFIG FORMS
   ═══════════════════════════════════════════════════════════════════ */

function KafkaForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  const sec = config.security_protocol || 'SASL_SSL';
  return (
    <div className="space-y-5">
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><Server size={15} /> Connection</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Bootstrap Servers" value={config.bootstrap_servers} onChange={v => set('bootstrap_servers', v)} placeholder="broker1:9092,broker2:9092" required help="Comma-separated broker list" />
          <Input label="Consumer Group ID" value={config.consumer_group} onChange={v => set('consumer_group', v)} placeholder="pinot-pulse-ingestion" required />
        </div>
        <div className="mt-4">
          <TagInput label="Topics" value={config.topics || []} onChange={v => set('topics', v)} />
        </div>
      </div>
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><Shield size={15} /> Security</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Security Protocol" value={sec} onChange={v => set('security_protocol', v)} options={[
            { value: 'PLAINTEXT', label: 'PLAINTEXT' }, { value: 'SSL', label: 'SSL' },
            { value: 'SASL_PLAINTEXT', label: 'SASL_PLAINTEXT' }, { value: 'SASL_SSL', label: 'SASL_SSL (Recommended)' },
          ]} />
          {(sec === 'SASL_PLAINTEXT' || sec === 'SASL_SSL') && (
            <Select label="SASL Mechanism" value={config.sasl_mechanism || 'SCRAM-SHA-512'} onChange={v => set('sasl_mechanism', v)} options={[
              { value: 'PLAIN', label: 'PLAIN' }, { value: 'SCRAM-SHA-256', label: 'SCRAM-SHA-256' },
              { value: 'SCRAM-SHA-512', label: 'SCRAM-SHA-512' }, { value: 'OAUTHBEARER', label: 'OAUTHBEARER' },
            ]} />
          )}
        </div>
        <div className="mt-3">
          <Input label="Schema Registry URL" value={config.schema_registry_url} onChange={v => set('schema_registry_url', v)} placeholder="https://schema-registry:8081" />
        </div>
      </div>
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><Settings size={15} /> Consumer Tuning</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Select label="Auto Offset Reset" value={config.auto_offset_reset || 'earliest'} onChange={v => set('auto_offset_reset', v)}
            options={[{ value: 'earliest', label: 'Earliest' }, { value: 'latest', label: 'Latest' }]} />
          <Input label="Max Poll Records" value={config.max_poll_records ?? 500} onChange={v => set('max_poll_records', v)} type="number" />
          <Input label="Session Timeout (ms)" value={config.session_timeout_ms ?? 30000} onChange={v => set('session_timeout_ms', v)} type="number" />
          <Input label="Heartbeat (ms)" value={config.heartbeat_interval_ms ?? 10000} onChange={v => set('heartbeat_interval_ms', v)} type="number" />
          <Input label="Fetch Min Bytes" value={config.fetch_min_bytes ?? 1} onChange={v => set('fetch_min_bytes', v)} type="number" />
          <Input label="Fetch Max Wait (ms)" value={config.fetch_max_wait_ms ?? 500} onChange={v => set('fetch_max_wait_ms', v)} type="number" />
          <Select label="Key Format" value={config.key_format || 'string'} onChange={v => set('key_format', v)}
            options={[{ value: 'string', label: 'String' }, { value: 'json', label: 'JSON' }, { value: 'avro', label: 'Avro' }, { value: 'bytes', label: 'Bytes' }]} />
          <Select label="Value Format" value={config.value_format || 'json'} onChange={v => set('value_format', v)}
            options={[{ value: 'json', label: 'JSON' }, { value: 'avro', label: 'Avro' }, { value: 'protobuf', label: 'Protobuf' }, { value: 'string', label: 'String' }]} />
        </div>
      </div>
    </div>
  );
}

function ConfluentForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-5">
      <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200">
        <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2"><Cloud size={15} /> Confluent Cloud Connection</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Bootstrap Server" value={config.bootstrap_servers} onChange={v => set('bootstrap_servers', v)} placeholder="pkc-xxxxx.us-east-1.aws.confluent.cloud:9092" required />
          <Input label="Consumer Group ID" value={config.consumer_group} onChange={v => set('consumer_group', v)} placeholder="pinot-pulse-ingestion" required />
          <Input label="Cluster ID" value={config.cluster_id} onChange={v => set('cluster_id', v)} placeholder="lkc-xxxxxx" />
          <Input label="Environment ID" value={config.environment_id} onChange={v => set('environment_id', v)} placeholder="env-xxxxxx" />
        </div>
        <div className="mt-4">
          <TagInput label="Topics" value={config.topics || []} onChange={v => set('topics', v)} />
        </div>
      </div>
      <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200">
        <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2"><Layers size={15} /> Schema Registry</h4>
        <Input label="Schema Registry URL" value={config.schema_registry_url} onChange={v => set('schema_registry_url', v)} placeholder="https://psrc-xxxxx.us-east-1.aws.confluent.cloud" />
      </div>
      <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200">
        <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2"><Settings size={15} /> Consumer Settings</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Select label="Auto Offset Reset" value={config.auto_offset_reset || 'earliest'} onChange={v => set('auto_offset_reset', v)}
            options={[{ value: 'earliest', label: 'Earliest' }, { value: 'latest', label: 'Latest' }]} />
          <Input label="Max Poll Records" value={config.max_poll_records ?? 500} onChange={v => set('max_poll_records', v)} type="number" />
          <Select label="Value Format" value={config.value_format || 'json'} onChange={v => set('value_format', v)}
            options={[{ value: 'json', label: 'JSON' }, { value: 'avro', label: 'Avro' }, { value: 'protobuf', label: 'Protobuf' }]} />
        </div>
      </div>
    </div>
  );
}

function KinesisForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  const regions = ['us-east-1','us-east-2','us-west-1','us-west-2','eu-west-1','eu-west-2','eu-central-1','ap-southeast-1','ap-northeast-1'];
  return (
    <div className="space-y-5">
      <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-200">
        <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2"><Zap size={15} /> Kinesis Stream</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Stream Name" value={config.stream_name} onChange={v => set('stream_name', v)} placeholder="banking-transactions" required />
          <Select label="AWS Region" value={config.region || 'us-east-1'} onChange={v => set('region', v)} required
            options={regions.map(r => ({ value: r, label: r }))} />
        </div>
      </div>
      <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-200">
        <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2"><Key size={15} /> Authentication</h4>
        <Select label="Auth Method" value={config.auth_method || 'access_key'} onChange={v => set('auth_method', v)}
          options={[{ value: 'access_key', label: 'Access Key' }, { value: 'iam', label: 'IAM Instance Role' }, { value: 'assume_role', label: 'Assume Role (Cross-Account)' }]} />
        {config.auth_method === 'assume_role' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <Input label="Role ARN" value={config.role_arn} onChange={v => set('role_arn', v)} placeholder="arn:aws:iam::123456789012:role/KinesisConsumer" required />
            <Input label="External ID" value={config.external_id} onChange={v => set('external_id', v)} placeholder="Optional external ID" />
          </div>
        )}
      </div>
      <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-200">
        <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2"><Settings size={15} /> Consumer Settings</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Select label="Iterator Type" value={config.iterator_type || 'TRIM_HORIZON'} onChange={v => set('iterator_type', v)}
            options={[{ value: 'TRIM_HORIZON', label: 'From Beginning' }, { value: 'LATEST', label: 'Latest Only' }]} />
          <Input label="Max Records / Shard" value={config.max_records_per_shard ?? 10000} onChange={v => set('max_records_per_shard', v)} type="number" />
          <Input label="Checkpoint Interval (s)" value={config.checkpoint_interval_seconds ?? 60} onChange={v => set('checkpoint_interval_seconds', v)} type="number" />
        </div>
        <div className="mt-3">
          <Toggle label="Enhanced Fan-Out" value={config.enhanced_fanout || false} onChange={v => set('enhanced_fanout', v)} help="Dedicated 2 MB/s throughput per shard" />
          {config.enhanced_fanout && (
            <div className="mt-2">
              <Input label="Consumer Name" value={config.consumer_name} onChange={v => set('consumer_name', v)} placeholder="pinot-pulse-consumer" required />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventHubsForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-5">
      <div className="bg-sky-50/50 rounded-xl p-4 border border-sky-200">
        <h4 className="text-sm font-semibold text-sky-800 mb-3 flex items-center gap-2"><GitBranch size={15} /> Event Hub</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Namespace" value={config.namespace} onChange={v => set('namespace', v)} placeholder="mynamespace.servicebus.windows.net" required />
          <Input label="Event Hub Name" value={config.eventhub_name} onChange={v => set('eventhub_name', v)} required />
          <Input label="Consumer Group" value={config.consumer_group || '$Default'} onChange={v => set('consumer_group', v)} />
          <Select label="Auth Method" value={config.auth_method || 'connection_string'} onChange={v => set('auth_method', v)}
            options={[{ value: 'connection_string', label: 'Connection String' }, { value: 'managed_identity', label: 'Managed Identity' }, { value: 'client_credentials', label: 'Client Credentials (AAD)' }]} />
        </div>
        {config.auth_method === 'client_credentials' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <Input label="Azure Tenant ID" value={config.tenant_id} onChange={v => set('tenant_id', v)} required />
            <Input label="Azure Client ID" value={config.client_id} onChange={v => set('client_id', v)} required />
          </div>
        )}
      </div>
      <div className="bg-sky-50/50 rounded-xl p-4 border border-sky-200">
        <h4 className="text-sm font-semibold text-sky-800 mb-3 flex items-center gap-2"><Settings size={15} /> Consumer Settings</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Select label="Starting Position" value={config.starting_position || 'earliest'} onChange={v => set('starting_position', v)}
            options={[{ value: 'earliest', label: 'Earliest' }, { value: 'latest', label: 'Latest' }]} />
          <Input label="Prefetch Count" value={config.prefetch_count ?? 300} onChange={v => set('prefetch_count', v)} type="number" />
          <Input label="Max Batch Size" value={config.max_batch_size ?? 300} onChange={v => set('max_batch_size', v)} type="number" />
          <Input label="Max Wait Time (s)" value={config.max_wait_time ?? 60} onChange={v => set('max_wait_time', v)} type="number" />
        </div>
      </div>
      <div className="bg-sky-50/50 rounded-xl p-4 border border-sky-200">
        <h4 className="text-sm font-semibold text-sky-800 mb-3 flex items-center gap-2"><Database size={15} /> Checkpoint Store</h4>
        <Input label="Checkpoint Container" value={config.checkpoint_store_container || 'eventhub-checkpoints'} onChange={v => set('checkpoint_store_container', v)} />
      </div>
    </div>
  );
}

function PubSubForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-5">
      <div className="bg-red-50/40 rounded-xl p-4 border border-red-200">
        <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2"><Mail size={15} /> Pub/Sub Subscription</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="GCP Project ID" value={config.project_id} onChange={v => set('project_id', v)} placeholder="my-project-123" required />
          <Input label="Subscription ID" value={config.subscription_id} onChange={v => set('subscription_id', v)} placeholder="my-subscription" required />
          <Select label="Auth Method" value={config.auth_method || 'service_account'} onChange={v => set('auth_method', v)}
            options={[{ value: 'service_account', label: 'Service Account Key' }, { value: 'workload_identity', label: 'Workload Identity' }]} />
        </div>
      </div>
      <div className="bg-red-50/40 rounded-xl p-4 border border-red-200">
        <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2"><Settings size={15} /> Consumer Settings</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Input label="Max Messages / Pull" value={config.max_messages ?? 1000} onChange={v => set('max_messages', v)} type="number" />
          <Input label="Ack Deadline (s)" value={config.ack_deadline_seconds ?? 60} onChange={v => set('ack_deadline_seconds', v)} type="number" />
          <Input label="Flow Max Messages" value={config.flow_control_max_messages ?? 1000} onChange={v => set('flow_control_max_messages', v)} type="number" />
        </div>
        <div className="mt-3 space-y-2">
          <Toggle label="Message Ordering" value={config.ordering_enabled || false} onChange={v => set('ordering_enabled', v)} help="Enable ordering key support" />
          <Toggle label="Exactly-Once Delivery" value={config.exactly_once || false} onChange={v => set('exactly_once', v)} help="Requires subscription-level support" />
        </div>
      </div>
      <div className="bg-red-50/40 rounded-xl p-4 border border-red-200">
        <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2"><AlertTriangle size={15} /> Dead Letter</h4>
        <Input label="Dead Letter Topic" value={config.dead_letter_topic} onChange={v => set('dead_letter_topic', v)} placeholder="projects/my-project/topics/my-dlq" help="Native Pub/Sub DLT (in addition to app-level DLQ)" />
      </div>
    </div>
  );
}

const PROVIDER_FORMS: Record<string, React.FC<{ config: Record<string, any>; onChange: (c: Record<string, any>) => void }>> = {
  kafka: KafkaForm, confluent: ConfluentForm, kinesis: KinesisForm, eventhubs: EventHubsForm, pubsub: PubSubForm,
  snowflake: SnowflakeForm, postgres: PostgresForm, s3: S3Form, sftp: SFTPForm, rest_api: RestAPIForm, file_upload: FileUploadForm,
  fiserv_dna: FiservDNAForm, symitar: SymitarForm, keystone: KeystoneForm,
};

/* ─── Snowflake Form ───────────────────────────────────────── */
function SnowflakeForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-5">
      <div className="bg-cyan-50/40 rounded-xl p-4 border border-cyan-200">
        <h4 className="text-sm font-semibold text-cyan-800 mb-3 flex items-center gap-2"><Database size={15} /> Snowflake Connection</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Account" value={config.account} onChange={v => set('account', v)} placeholder="myorg-myaccount" required />
          <Input label="Warehouse" value={config.warehouse} onChange={v => set('warehouse', v)} placeholder="COMPUTE_WH" required />
          <Input label="Database" value={config.database} onChange={v => set('database', v)} placeholder="ANALYTICS" required />
          <Input label="Schema" value={config.schema_name ?? 'PUBLIC'} onChange={v => set('schema_name', v)} placeholder="PUBLIC" />
          <Input label="Role" value={config.role ?? 'PINOT_PULSE_READER'} onChange={v => set('role', v)} placeholder="PINOT_PULSE_READER" />
          <Select label="Auth Method" value={config.auth_method || 'password'} onChange={v => set('auth_method', v)}
            options={[{ value: 'password', label: 'Username / Password' }, { value: 'key_pair', label: 'Key Pair (RSA)' }, { value: 'oauth', label: 'OAuth' }]} />
        </div>
      </div>
      <div className="bg-cyan-50/40 rounded-xl p-4 border border-cyan-200">
        <h4 className="text-sm font-semibold text-cyan-800 mb-3 flex items-center gap-2"><FileText size={15} /> Data Source</h4>
        <Input label="Source Table (optional)" value={config.source_table} onChange={v => set('source_table', v)} placeholder="SCHEMA.TABLE_NAME" help="Or use a custom SQL query below" />
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Source Query</label>
          <textarea value={config.source_query || ''} onChange={e => set('source_query', e.target.value)} rows={4}
            placeholder="SELECT * FROM accounts WHERE modified_at >= :last_sync_timestamp"
            style={{ border: "1px solid #D1D5DB", color: "#1F2937" }} className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-cyan-500 bg-white" />
          <p className="text-xs text-gray-400 mt-1">Use <code className="bg-gray-100 px-1 rounded">:last_sync_timestamp</code> for incremental extraction</p>
        </div>
      </div>
      <div className="bg-cyan-50/40 rounded-xl p-4 border border-cyan-200">
        <h4 className="text-sm font-semibold text-cyan-800 mb-3 flex items-center gap-2"><Clock size={15} /> Schedule & Incremental</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Cron Schedule" value={config.schedule_expression ?? '0 3 * * *'} onChange={v => set('schedule_expression', v)} placeholder="0 3 * * *" help="Daily at 3 AM UTC" />
          <Select label="Timezone" value={config.schedule_timezone || 'UTC'} onChange={v => set('schedule_timezone', v)}
            options={['UTC', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific'].map(t => ({ value: t, label: t }))} />
          <Input label="Fetch Size" value={config.fetch_size ?? 10000} onChange={v => set('fetch_size', v)} type="number" />
          <Input label="Max Runtime (min)" value={config.max_runtime_minutes ?? 60} onChange={v => set('max_runtime_minutes', v)} type="number" />
        </div>
        <div className="mt-3 space-y-2">
          <Toggle label="Incremental Sync" value={config.incremental_enabled ?? true} onChange={v => set('incremental_enabled', v)} help="Only sync rows changed since last run" />
          {(config.incremental_enabled ?? true) && (
            <Input label="Watermark Column" value={config.watermark_column} onChange={v => set('watermark_column', v)} placeholder="MODIFIED_AT" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── PostgreSQL Form ──────────────────────────────────────── */
function PostgresForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-5">
      <div className="bg-indigo-50/40 rounded-xl p-4 border border-indigo-200">
        <h4 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2"><HardDrive size={15} /> Database Connection</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Host" value={config.host} onChange={v => set('host', v)} placeholder="db.example.com" required />
          <Input label="Port" value={config.port ?? 5432} onChange={v => set('port', v)} type="number" />
          <Input label="Database" value={config.database} onChange={v => set('database', v)} placeholder="core_banking" required />
          <Input label="Schema" value={config.schema_name ?? 'public'} onChange={v => set('schema_name', v)} placeholder="public" />
          <Select label="SSL Mode" value={config.ssl_mode || 'require'} onChange={v => set('ssl_mode', v)}
            options={['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'].map(m => ({ value: m, label: m }))} />
          <Input label="Pool Size" value={config.connection_pool_size ?? 5} onChange={v => set('connection_pool_size', v)} type="number" />
        </div>
      </div>
      <div className="bg-indigo-50/40 rounded-xl p-4 border border-indigo-200">
        <h4 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2"><FileText size={15} /> Data Source</h4>
        <Input label="Source Table" value={config.source_table} onChange={v => set('source_table', v)} placeholder="public.accounts" />
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Source Query</label>
          <textarea value={config.source_query || ''} onChange={e => set('source_query', e.target.value)} rows={4}
            placeholder="SELECT * FROM accounts WHERE updated_at >= :last_sync_timestamp"
            style={{ border: "1px solid #D1D5DB", color: "#1F2937" }} className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 bg-white" />
        </div>
      </div>
      <div className="bg-indigo-50/40 rounded-xl p-4 border border-indigo-200">
        <h4 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2"><Clock size={15} /> Schedule</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Cron Schedule" value={config.schedule_expression ?? '0 2 * * *'} onChange={v => set('schedule_expression', v)} placeholder="0 2 * * *" />
          <Select label="Timezone" value={config.schedule_timezone || 'UTC'} onChange={v => set('schedule_timezone', v)}
            options={['UTC', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific'].map(t => ({ value: t, label: t }))} />
          <Input label="Fetch Size" value={config.fetch_size ?? 5000} onChange={v => set('fetch_size', v)} type="number" />
          <Input label="Max Runtime (min)" value={config.max_runtime_minutes ?? 60} onChange={v => set('max_runtime_minutes', v)} type="number" />
        </div>
        <div className="mt-3">
          <Toggle label="Incremental Sync" value={config.incremental_enabled ?? true} onChange={v => set('incremental_enabled', v)} />
          {(config.incremental_enabled ?? true) && <Input label="Watermark Column" value={config.watermark_column} onChange={v => set('watermark_column', v)} placeholder="updated_at" />}
        </div>
      </div>
    </div>
  );
}

/* ─── S3 / Cloud Storage Form ──────────────────────────────── */
function S3Form({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-5">
      <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-200">
        <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2"><Server size={15} /> Storage Connection</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Storage Provider" value={config.storage_provider || 'aws_s3'} onChange={v => set('storage_provider', v)}
            options={[{ value: 'aws_s3', label: 'Amazon S3' }, { value: 'gcs', label: 'Google Cloud Storage' }, { value: 'azure_blob', label: 'Azure Blob Storage' }]} />
          <Input label="Bucket Name" value={config.bucket} onChange={v => set('bucket', v)} placeholder="my-data-bucket" required />
          <Input label="Key Prefix" value={config.prefix ?? ''} onChange={v => set('prefix', v)} placeholder="exports/transactions/" />
          {(config.storage_provider || 'aws_s3') === 'aws_s3' && (
            <Select label="Region" value={config.region || 'us-east-1'} onChange={v => set('region', v)}
              options={['us-east-1','us-east-2','us-west-1','us-west-2','eu-west-1','eu-central-1','ap-southeast-1'].map(r => ({ value: r, label: r }))} />
          )}
          <Select label="Auth Method" value={config.auth_method || 'access_key'} onChange={v => set('auth_method', v)}
            options={[{ value: 'access_key', label: 'Access Key' }, { value: 'iam_role', label: 'IAM Role' }, { value: 'assume_role', label: 'Assume Role' }, { value: 'service_account', label: 'Service Account' }]} />
          {config.auth_method === 'assume_role' && <Input label="Role ARN" value={config.role_arn} onChange={v => set('role_arn', v)} placeholder="arn:aws:iam::123456789012:role/S3Reader" />}
        </div>
      </div>
      <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-200">
        <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2"><FileText size={15} /> File Format</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select label="File Format" value={config.file_format || 'csv'} onChange={v => set('file_format', v)}
            options={['csv', 'json', 'jsonl', 'parquet', 'avro'].map(f => ({ value: f, label: f.toUpperCase() }))} />
          <Input label="File Pattern" value={config.file_pattern ?? '*'} onChange={v => set('file_pattern', v)} placeholder="*.csv" />
          <Select label="Compression" value={config.compression || 'none'} onChange={v => set('compression', v)}
            options={['none', 'gzip', 'bz2', 'snappy', 'zstd'].map(c => ({ value: c, label: c }))} />
          {(config.file_format || 'csv') === 'csv' && (
            <>
              <Input label="Delimiter" value={config.csv_delimiter ?? ','} onChange={v => set('csv_delimiter', v)} />
              <Select label="Encoding" value={config.csv_encoding || 'utf-8'} onChange={v => set('csv_encoding', v)}
                options={['utf-8', 'latin-1', 'windows-1252'].map(e => ({ value: e, label: e }))} />
              <Toggle label="Has Header Row" value={config.csv_header ?? true} onChange={v => set('csv_header', v)} />
            </>
          )}
        </div>
      </div>
      <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-200">
        <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2"><Clock size={15} /> Schedule & Archive</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Cron Schedule" value={config.schedule_expression ?? '0 4 * * *'} onChange={v => set('schedule_expression', v)} placeholder="0 4 * * *" />
          <Input label="Max Runtime (min)" value={config.max_runtime_minutes ?? 120} onChange={v => set('max_runtime_minutes', v)} type="number" />
        </div>
        <div className="mt-3 space-y-2">
          <Toggle label="Archive Processed Files" value={config.archive_processed ?? true} onChange={v => set('archive_processed', v)} />
          {config.archive_processed !== false && <Input label="Archive Prefix" value={config.archive_prefix ?? 'processed/'} onChange={v => set('archive_prefix', v)} />}
        </div>
      </div>
    </div>
  );
}

/* ─── SFTP Form ────────────────────────────────────────────── */
function SFTPForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-5">
      <div className="bg-teal-50/40 rounded-xl p-4 border border-teal-200">
        <h4 className="text-sm font-semibold text-teal-800 mb-3 flex items-center gap-2"><Shield size={15} /> SFTP Connection</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Host" value={config.host} onChange={v => set('host', v)} placeholder="sftp.corebanking.com" required />
          <Input label="Port" value={config.port ?? 22} onChange={v => set('port', v)} type="number" />
          <Input label="Remote Directory" value={config.remote_path ?? '/exports/'} onChange={v => set('remote_path', v)} placeholder="/exports/daily/" />
          <Select label="Auth Method" value={config.auth_method || 'password'} onChange={v => set('auth_method', v)}
            options={[{ value: 'password', label: 'Password' }, { value: 'private_key', label: 'SSH Private Key' }]} />
          <Toggle label="Verify Host Key" value={config.known_hosts_check ?? true} onChange={v => set('known_hosts_check', v)} />
        </div>
      </div>
      <div className="bg-teal-50/40 rounded-xl p-4 border border-teal-200">
        <h4 className="text-sm font-semibold text-teal-800 mb-3 flex items-center gap-2"><FileText size={15} /> File Settings</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select label="File Format" value={config.file_format || 'csv'} onChange={v => set('file_format', v)}
            options={['csv', 'json', 'jsonl', 'parquet'].map(f => ({ value: f, label: f.toUpperCase() }))} />
          <Input label="File Pattern" value={config.file_pattern ?? '*.csv'} onChange={v => set('file_pattern', v)} placeholder="transactions_*.csv" />
          {(config.file_format || 'csv') === 'csv' && <Input label="Delimiter" value={config.csv_delimiter ?? ','} onChange={v => set('csv_delimiter', v)} />}
        </div>
      </div>
      <div className="bg-teal-50/40 rounded-xl p-4 border border-teal-200">
        <h4 className="text-sm font-semibold text-teal-800 mb-3 flex items-center gap-2"><Clock size={15} /> Schedule</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Cron Schedule" value={config.schedule_expression ?? '0 5 * * *'} onChange={v => set('schedule_expression', v)} placeholder="0 5 * * *" />
          <Input label="Max Runtime (min)" value={config.max_runtime_minutes ?? 60} onChange={v => set('max_runtime_minutes', v)} type="number" />
        </div>
        <div className="mt-3 space-y-2">
          <Toggle label="Move Files After Processing" value={config.archive_after_download ?? true} onChange={v => set('archive_after_download', v)} />
          <Toggle label="Delete Files After Processing" value={config.delete_after_download ?? false} onChange={v => set('delete_after_download', v)} />
        </div>
      </div>
    </div>
  );
}

/* ─── REST API Form ────────────────────────────────────────── */
function RestAPIForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-5">
      <div className="bg-violet-50/40 rounded-xl p-4 border border-violet-200">
        <h4 className="text-sm font-semibold text-violet-800 mb-3 flex items-center gap-2"><Wifi size={15} /> API Connection</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Base URL" value={config.base_url} onChange={v => set('base_url', v)} placeholder="https://api.vendor.com/v1" required className="md:col-span-2" />
          <Select label="Auth Type" value={config.auth_type || 'api_key'} onChange={v => set('auth_type', v)}
            options={[{ value: 'none', label: 'None' }, { value: 'api_key', label: 'API Key' }, { value: 'bearer_token', label: 'Bearer Token' }, { value: 'basic_auth', label: 'Basic Auth' }, { value: 'oauth2', label: 'OAuth 2.0' }]} />
          {config.auth_type === 'api_key' && <Input label="API Key Header" value={config.api_key_header ?? 'Authorization'} onChange={v => set('api_key_header', v)} placeholder="X-API-Key" />}
          {config.auth_type === 'oauth2' && (
            <><Input label="OAuth Token URL" value={config.oauth_token_url} onChange={v => set('oauth_token_url', v)} placeholder="https://auth.vendor.com/token" />
            <Input label="OAuth Scope" value={config.oauth_scope} onChange={v => set('oauth_scope', v)} placeholder="read:data" /></>
          )}
          <Input label="Timeout (s)" value={config.timeout_seconds ?? 30} onChange={v => set('timeout_seconds', v)} type="number" />
          <Input label="Response Root" value={config.response_root ?? 'data'} onChange={v => set('response_root', v)} placeholder="data.results" />
        </div>
      </div>
      <div className="bg-violet-50/40 rounded-xl p-4 border border-violet-200">
        <h4 className="text-sm font-semibold text-violet-800 mb-3 flex items-center gap-2"><TrendingUp size={15} /> Rate Limiting & Pagination</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Rate Limit (req/s)" value={config.rate_limit_rps ?? 10} onChange={v => set('rate_limit_rps', v)} type="number" />
          <Input label="Burst Limit" value={config.rate_limit_burst ?? 20} onChange={v => set('rate_limit_burst', v)} type="number" />
          <Select label="Pagination" value={config.pagination_type || 'none'} onChange={v => set('pagination_type', v)}
            options={['none', 'offset', 'cursor', 'page_number', 'link_header'].map(p => ({ value: p, label: p.replace('_', ' ') }))} />
          {config.pagination_type && config.pagination_type !== 'none' && (
            <Input label="Page Size" value={config.pagination_page_size ?? 500} onChange={v => set('pagination_page_size', v)} type="number" />
          )}
          {config.pagination_type === 'cursor' && (
            <Input label="Cursor Field" value={config.pagination_cursor_field} onChange={v => set('pagination_cursor_field', v)} placeholder="next_cursor" />
          )}
        </div>
      </div>
      <div className="bg-violet-50/40 rounded-xl p-4 border border-violet-200">
        <h4 className="text-sm font-semibold text-violet-800 mb-3 flex items-center gap-2"><Clock size={15} /> Schedule</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Cron Schedule" value={config.schedule_expression ?? '0 6 * * *'} onChange={v => set('schedule_expression', v)} placeholder="0 6 * * *" />
          <Input label="Max Runtime (min)" value={config.max_runtime_minutes ?? 30} onChange={v => set('max_runtime_minutes', v)} type="number" />
          <Input label="Max Retries" value={config.max_retries ?? 5} onChange={v => set('max_retries', v)} type="number" />
        </div>
      </div>
    </div>
  );
}

/* ─── File Upload Form ─────────────────────────────────────── */
function FileUploadForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-5">
      <div className="bg-green-50/40 rounded-xl p-4 border border-green-200">
        <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2"><Upload size={15} /> File Settings</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Max File Size (MB)" value={config.max_file_size_mb ?? 500} onChange={v => set('max_file_size_mb', v)} type="number" />
          <Input label="Min Rows" value={config.min_rows ?? 1} onChange={v => set('min_rows', v)} type="number" />
          <Select label="Encoding" value={config.csv_encoding || 'utf-8'} onChange={v => set('csv_encoding', v)}
            options={['utf-8', 'latin-1', 'windows-1252', 'ascii'].map(e => ({ value: e, label: e }))} />
          <Input label="CSV Delimiter" value={config.csv_delimiter ?? ','} onChange={v => set('csv_delimiter', v)} />
          <Toggle label="Has Header Row" value={config.csv_header ?? true} onChange={v => set('csv_header', v)} />
          <Toggle label="Auto-Detect Schema" value={config.auto_detect_schema ?? true} onChange={v => set('auto_detect_schema', v)} />
        </div>
      </div>
      <div className="bg-green-50/40 rounded-xl p-4 border border-green-200">
        <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2"><Settings size={15} /> Validation</h4>
        <div className="space-y-3">
          <Input label="Required Columns (comma-separated)" value={(config.required_columns || []).join(', ')} onChange={v => set('required_columns', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="transaction_id, amount, member_id" />
          <Input label="Max Records per File" value={config.max_records_per_file ?? 10000000} onChange={v => set('max_records_per_file', v)} type="number" />
          <Toggle label="Checksum Validation" value={config.checksum_validation ?? true} onChange={v => set('checksum_validation', v)} />
        </div>
      </div>
      <div className="bg-green-50/30 rounded-xl p-4 border border-green-200 flex items-start gap-3">
        <Info size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-green-800">
          <p className="font-medium">File Upload Pipelines</p>
          <p className="text-xs text-green-600 mt-1">Files are uploaded directly through the admin UI. Supported formats: CSV, JSON, JSONL, Parquet, Avro. Column aliases can be configured to map non-standard column names to canonical fields.</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CORE BANKING FORMS (Tier 3)
   ═══════════════════════════════════════════════════════════════════ */

function CoreBankingEntitySelector({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  const ALL_ENTITIES = ['members', 'accounts', 'loans', 'transactions', 'shares', 'holds', 'gl_entries'];
  const selected: string[] = config.entities || ['members', 'accounts', 'loans', 'transactions', 'shares'];
  const toggle = (e: string) => {
    const next = selected.includes(e) ? selected.filter(x => x !== e) : [...selected, e];
    set('entities', next);
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Entities to Sync</label>
      <div className="grid grid-cols-4 gap-2">
        {ALL_ENTITIES.map(e => (
          <button key={e} onClick={() => toggle(e)} type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              selected.includes(e) ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}>{e}</button>
        ))}
      </div>
    </div>
  );
}

function FiservDNAForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="DNA API Base URL" value={config.base_url || ''} onChange={v => set('base_url', v)} placeholder="https://dna-api.fiservapps.com" required />
        <Input label="Institution ID" value={config.institution_id || ''} onChange={v => set('institution_id', v)} placeholder="123456789" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Environment" value={config.environment || 'production'} onChange={v => set('environment', v)}
          options={['production', 'sandbox', 'staging'].map(s => ({ value: s, label: s }))} />
        <Select label="Auth Method" value={config.auth_method || 'hmac'} onChange={v => set('auth_method', v)}
          options={['hmac', 'oauth2', 'basic_auth'].map(s => ({ value: s, label: s }))} />
      </div>
      <CoreBankingEntitySelector config={config} onChange={onChange} />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Sync Mode" value={config.sync_mode || 'incremental'} onChange={v => set('sync_mode', v)}
          options={['full', 'incremental', 'cdc'].map(s => ({ value: s, label: s }))} />
        <Input label="Page Size" value={config.page_size ?? 500} onChange={v => set('page_size', v)} type="number" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Rate Limit (req/sec)" value={config.rate_limit_rps ?? 15} onChange={v => set('rate_limit_rps', v)} type="number" />
        <Input label="Max Runtime (min)" value={config.max_runtime_minutes ?? 120} onChange={v => set('max_runtime_minutes', v)} type="number" />
      </div>
      <Input label="Cron Schedule" value={config.schedule_expression ?? '0 1 * * *'} onChange={v => set('schedule_expression', v)} placeholder="0 1 * * *" help="Daily at 1 AM Eastern" />
      <Select label="Timezone" value={config.schedule_timezone || 'US/Eastern'} onChange={v => set('schedule_timezone', v)}
        options={['UTC', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific'].map(s => ({ value: s, label: s }))} />
      <Toggle label="Incremental Sync" value={config.incremental_enabled ?? true} onChange={v => set('incremental_enabled', v)} help="Only sync records changed since last run" />
      {(config.incremental_enabled ?? true) && (
        <Input label="Watermark Field" value={config.watermark_column || 'modifiedDate'} onChange={v => set('watermark_column', v)} />
      )}
      <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
        <Landmark size={16} className="text-rose-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-rose-800">
          <p className="font-medium">Fiserv DNA Integration</p>
          <p className="text-xs text-rose-600 mt-1">Connects to DNA's REST API with HMAC-SHA256 signed requests. Normalizes all entities to the Pinot Pulse canonical schema for consistent analytics.</p>
        </div>
      </div>
    </div>
  );
}

function SymitarForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="SymXchange API URL" value={config.base_url || ''} onChange={v => set('base_url', v)} placeholder="https://symxchange.jackhenry.com" required />
        <Input label="Symitar Routing Number" value={config.sym_routing || ''} onChange={v => set('sym_routing', v)} placeholder="123456789" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Device ID" value={config.device_id || 'PINOT-PULSE'} onChange={v => set('device_id', v)} />
        <Select label="Environment" value={config.environment || 'production'} onChange={v => set('environment', v)}
          options={['production', 'sandbox', 'staging'].map(s => ({ value: s, label: s }))} />
      </div>
      <Select label="Auth Method" value={config.auth_method || 'session_token'} onChange={v => set('auth_method', v)}
        options={['session_token', 'certificate'].map(s => ({ value: s, label: s }))} />
      <CoreBankingEntitySelector config={config} onChange={onChange} />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Sync Mode" value={config.sync_mode || 'incremental'} onChange={v => set('sync_mode', v)}
          options={['full', 'incremental', 'cdc'].map(s => ({ value: s, label: s }))} />
        <Input label="Page Size" value={config.page_size ?? 500} onChange={v => set('page_size', v)} type="number" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Rate Limit (req/sec)" value={config.rate_limit_rps ?? 10} onChange={v => set('rate_limit_rps', v)} type="number" />
        <Input label="Session Refresh (min)" value={config.session_refresh_minutes ?? 18} onChange={v => set('session_refresh_minutes', v)} type="number" />
      </div>
      <Input label="Cron Schedule" value={config.schedule_expression ?? '0 2 * * *'} onChange={v => set('schedule_expression', v)} placeholder="0 2 * * *" help="Daily at 2 AM Eastern" />
      <Select label="Timezone" value={config.schedule_timezone || 'US/Eastern'} onChange={v => set('schedule_timezone', v)}
        options={['UTC', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific'].map(s => ({ value: s, label: s }))} />
      <Toggle label="Incremental Sync" value={config.incremental_enabled ?? true} onChange={v => set('incremental_enabled', v)} />
      {(config.incremental_enabled ?? true) && (
        <Input label="Watermark Field" value={config.watermark_column || 'lastFMDate'} onChange={v => set('watermark_column', v)} />
      )}
      <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
        <Landmark size={16} className="text-purple-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-purple-800">
          <p className="font-medium">Jack Henry Symitar Integration</p>
          <p className="text-xs text-purple-600 mt-1">Connects via SymXchange API with auto-refreshing session tokens. Handles Episys data structures and PowerOn naming conventions.</p>
        </div>
      </div>
    </div>
  );
}

function KeystoneForm({ config, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="KeyStone API URL" value={config.base_url || ''} onChange={v => set('base_url', v)} placeholder="https://api.corelationinc.com" required />
        <Input label="Tenant ID" value={config.tenant_id || ''} onChange={v => set('tenant_id', v)} placeholder="cu-12345" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Environment" value={config.environment || 'production'} onChange={v => set('environment', v)}
          options={['production', 'sandbox'].map(s => ({ value: s, label: s }))} />
        <Select label="Auth Method" value={config.auth_method || 'oauth2'} onChange={v => set('auth_method', v)}
          options={['oauth2', 'api_key'].map(s => ({ value: s, label: s }))} />
      </div>
      {config.auth_method === 'oauth2' && (
        <Input label="OAuth Scope" value={config.oauth_scope || 'read'} onChange={v => set('oauth_scope', v)} />
      )}
      <CoreBankingEntitySelector config={config} onChange={onChange} />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Sync Mode" value={config.sync_mode || 'incremental'} onChange={v => set('sync_mode', v)}
          options={['full', 'incremental'].map(s => ({ value: s, label: s }))} />
        <Input label="Page Size" value={config.page_size ?? 500} onChange={v => set('page_size', v)} type="number" />
      </div>
      <Input label="Rate Limit (req/sec)" value={config.rate_limit_rps ?? 20} onChange={v => set('rate_limit_rps', v)} type="number" />
      <Input label="Cron Schedule" value={config.schedule_expression ?? '0 1 * * *'} onChange={v => set('schedule_expression', v)} placeholder="0 1 * * *" help="Daily at 1 AM Eastern" />
      <Select label="Timezone" value={config.schedule_timezone || 'US/Eastern'} onChange={v => set('schedule_timezone', v)}
        options={['UTC', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific'].map(s => ({ value: s, label: s }))} />
      <Toggle label="Incremental Sync" value={config.incremental_enabled ?? true} onChange={v => set('incremental_enabled', v)} />
      {(config.incremental_enabled ?? true) && (
        <Input label="Watermark Field" value={config.watermark_column || 'updatedAt'} onChange={v => set('watermark_column', v)} />
      )}
      <div className="flex items-start gap-2 bg-lime-50 border border-lime-200 rounded-lg p-3">
        <Landmark size={16} className="text-lime-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-lime-800">
          <p className="font-medium">Corelation KeyStone Integration</p>
          <p className="text-xs text-lime-600 mt-1">Connects via KeyStone's modern REST API with OAuth2 client credentials. Clean JSON responses with consistent field naming for easy normalization.</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CREDENTIAL FORM (per provider)
   ═══════════════════════════════════════════════════════════════════ */
function CredentialForm({ provider, config, creds, onChange }: { provider: string; config: Record<string, any>; creds: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...creds, [k]: v });
  const fields = getCredentialFields(provider, config);
  if (fields.length === 0) return <p className="text-sm text-gray-500 italic">No credentials required for this configuration.</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <Lock size={14} /> Credentials are encrypted and stored in the vault. They are never persisted in pipeline configurations.
      </div>
      {fields.map(f => (
        <div key={f.name}>
          {f.type === 'file' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
              <textarea value={creds[f.name] || ''} onChange={e => set(f.name, e.target.value)} rows={6}
                placeholder="Paste JSON key file contents here..."
                style={{ border: "1px solid #D1D5DB", color: "#1F2937" }} className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
          ) : (
            <Input label={f.label} value={creds[f.name]} onChange={v => set(f.name, v)}
              type={f.type === 'password' ? 'password' : 'text'} required={f.required} />
          )}
        </div>
      ))}
    </div>
  );
}

function getCredentialFields(provider: string, config: Record<string, any>): CredField[] {
  const defs: Record<string, CredField[]> = {
    kafka: [
      { name: 'sasl_username', label: 'SASL Username', type: 'text' },
      { name: 'sasl_password', label: 'SASL Password', type: 'password' },
    ],
    confluent: [
      { name: 'api_key', label: 'Confluent API Key', type: 'text', required: true },
      { name: 'api_secret', label: 'Confluent API Secret', type: 'password', required: true },
    ],
    kinesis: [
      { name: 'aws_access_key_id', label: 'AWS Access Key ID', type: 'text' },
      { name: 'aws_secret_access_key', label: 'AWS Secret Access Key', type: 'password' },
    ],
    eventhubs: [
      ...(config.auth_method === 'client_credentials' ? [{ name: 'client_secret', label: 'Azure Client Secret', type: 'password', required: true }] : []),
      ...(config.auth_method !== 'managed_identity' ? [{ name: 'connection_string', label: 'Event Hub Connection String', type: 'password', required: true }] : []),
      { name: 'checkpoint_store_connection_string', label: 'Checkpoint Store Connection', type: 'password' },
    ],
    pubsub: [
      ...(config.auth_method !== 'workload_identity' ? [{ name: 'service_account_json', label: 'Service Account Key (JSON)', type: 'file' as const, required: true }] : []),
    ],
    // ── Tier 1: Batch / Warehouse ──
    snowflake: [
      { name: 'username', label: 'Snowflake Username', type: 'text', required: true },
      ...(config.auth_method !== 'key_pair' ? [{ name: 'password', label: 'Snowflake Password', type: 'password' as const, required: true }] : []),
      ...(config.auth_method === 'key_pair' ? [
        { name: 'private_key', label: 'Private Key (PEM)', type: 'file' as const, required: true },
        { name: 'passphrase', label: 'Key Passphrase', type: 'password' as const },
      ] : []),
    ],
    postgres: [
      { name: 'username', label: 'Database Username', type: 'text', required: true },
      { name: 'password', label: 'Database Password', type: 'password', required: true },
    ],
    s3: [
      ...((config.auth_method || 'access_key') === 'access_key' ? [
        { name: 'aws_access_key_id', label: 'AWS Access Key ID', type: 'text' as const, required: true },
        { name: 'aws_secret_access_key', label: 'AWS Secret Access Key', type: 'password' as const, required: true },
      ] : []),
      ...(config.storage_provider === 'gcs' ? [{ name: 'gcp_service_account_json', label: 'GCP Service Account Key', type: 'file' as const, required: true }] : []),
      ...(config.storage_provider === 'azure_blob' ? [{ name: 'azure_connection_string', label: 'Azure Connection String', type: 'password' as const, required: true }] : []),
    ],
    sftp: [
      { name: 'username', label: 'SFTP Username', type: 'text', required: true },
      ...(config.auth_method !== 'private_key' ? [{ name: 'password', label: 'SFTP Password', type: 'password' as const, required: true }] : []),
      ...(config.auth_method === 'private_key' ? [{ name: 'private_key', label: 'SSH Private Key (PEM)', type: 'file' as const, required: true }] : []),
    ],
    rest_api: [
      ...(config.auth_type === 'api_key' ? [{ name: 'api_key', label: 'API Key', type: 'password' as const, required: true }] : []),
      ...(config.auth_type === 'bearer_token' ? [{ name: 'token', label: 'Bearer Token', type: 'password' as const, required: true }] : []),
      ...(config.auth_type === 'basic_auth' ? [
        { name: 'username', label: 'Username', type: 'text' as const, required: true },
        { name: 'password', label: 'Password', type: 'password' as const, required: true },
      ] : []),
      ...(config.auth_type === 'oauth2' ? [
        { name: 'username', label: 'Client ID', type: 'text' as const, required: true },
        { name: 'password', label: 'Client Secret', type: 'password' as const, required: true },
      ] : []),
    ],
    file_upload: [],
    // ── Tier 3: Core Banking ──
    fiserv_dna: [
      { name: 'api_key', label: 'DNA API Key', type: 'text', required: true },
      { name: 'api_secret', label: 'DNA API Secret', type: 'password', required: true },
    ],
    symitar: [
      { name: 'username', label: 'SymXchange Username', type: 'text', required: true },
      { name: 'password', label: 'SymXchange Password', type: 'password', required: true },
    ],
    keystone: [
      { name: 'client_id', label: 'OAuth2 Client ID', type: 'text', required: true },
      { name: 'client_secret', label: 'OAuth2 Client Secret', type: 'password', required: true },
    ],
  };
  return defs[provider] || [];
}

/* ═══════════════════════════════════════════════════════════════════
   CREATE / EDIT WIZARD
   ═══════════════════════════════════════════════════════════════════ */
const WIZARD_STEPS = [
  { id: 'provider', title: 'Provider', desc: 'Choose data source' },
  { id: 'connection', title: 'Connection', desc: 'Configure provider settings' },
  { id: 'credentials', title: 'Credentials', desc: 'Authentication secrets' },
  { id: 'target', title: 'Target & Processing', desc: 'Where data goes' },
  { id: 'review', title: 'Review & Deploy', desc: 'Confirm configuration' },
];

function PipelineWizard({ onClose, onCreated, existing }: { onClose: () => void; onCreated: () => void; existing?: Pipeline }) {
  const [step, setStep] = useState(existing ? 1 : 0);
  const [provider, setProvider] = useState(existing?.provider || '');
  const [name, setName] = useState(existing?.name || '');
  const [slug, setSlug] = useState(existing?.slug || '');
  const [desc, setDesc] = useState(existing?.description || '');
  const [providerConfig, setProviderConfig] = useState<Record<string, any>>(existing?.provider_config || {});
  const [creds, setCreds] = useState<Record<string, any>>({});
  const [targetTable, setTargetTable] = useState(existing?.target_table || 'transactions');
  const [targetSchema, setTargetSchema] = useState(existing?.target_schema || 'analytics');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(existing?.field_mapping || {});
  const [batchSize, setBatchSize] = useState(existing?.batch_size ?? 1000);
  const [batchTimeout, setBatchTimeout] = useState(existing?.batch_timeout_ms ?? 5000);
  const [maxRetries, setMaxRetries] = useState(existing?.max_retries ?? 3);
  const [errorThreshold, setErrorThreshold] = useState(existing?.error_threshold_pct ?? 5);
  const [dedupEnabled, setDedupEnabled] = useState(existing?.dedup_enabled ?? true);
  const [dlqEnabled, setDlqEnabled] = useState(existing?.dlq_enabled ?? true);
  const [schemaVal, setSchemaVal] = useState(existing?.schema_validation_enabled ?? true);
  const [priority, setPriority] = useState(existing?.priority || 'standard');
  const [tags, setTags] = useState<string[]>(existing?.tags || []);
  const [owner, setOwner] = useState(existing?.owner || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [newSourceField, setNewSourceField] = useState('');
  const [newTargetField, setNewTargetField] = useState('');

  const autoSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const addFieldMapping = () => {
    const src = newSourceField.trim();
    const tgt = newTargetField.trim();
    if (src && tgt && !fieldMapping[src]) {
      setFieldMapping({ ...fieldMapping, [src]: tgt });
      setNewSourceField('');
      setNewTargetField('');
    }
  };
  const removeFieldMapping = (src: string) => {
    const next = { ...fieldMapping };
    delete next[src];
    setFieldMapping(next);
  };
  const targetFieldOptions = TARGET_FIELDS[targetTable] || [];

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await api('/ingestion/test-connection', {
        method: 'POST', body: JSON.stringify({ provider, provider_config: providerConfig, credentials: creds }),
      });
      setTestResult(r);
    } catch (e: any) { setTestResult({ success: false, error: e.message }); }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      // Extract batch-specific fields from providerConfig (they belong at top level in API)
      const BATCH_FIELDS = ['schedule_expression', 'schedule_timezone', 'incremental_enabled', 'watermark_column', 'source_query', 'file_format'];
      const CB_FIELDS = ['entities', 'sync_mode', 'rate_limit_rps', 'page_size', 'max_runtime_minutes'];
      const batchFields: Record<string, any> = {};
      const cbFields: Record<string, any> = {};
      const cleanProviderConfig = { ...providerConfig };
      for (const key of BATCH_FIELDS) {
        if (key in cleanProviderConfig) {
          batchFields[key] = cleanProviderConfig[key];
          delete cleanProviderConfig[key];
        }
      }
      for (const key of CB_FIELDS) {
        if (key in cleanProviderConfig) {
          cbFields[key] = cleanProviderConfig[key];
          // Keep these in provider_config too — they're needed by the consumer
        }
      }
      // Determine pipeline mode and schedule type from provider
      const BATCH_PROVS = new Set(['snowflake', 'postgres', 's3', 'sftp', 'rest_api', 'file_upload', 'fiserv_dna', 'symitar', 'keystone']);
      const CORE_BANKING_PROVS = new Set(['fiserv_dna', 'symitar', 'keystone']);
      const isBatch = BATCH_PROVS.has(provider);
      const pipelineMode = provider === 'file_upload' ? 'file_upload' : provider === 'rest_api' ? 'api_poll' : isBatch ? 'batch' : 'streaming';
      const scheduleType = isBatch && provider !== 'file_upload' ? 'cron' : provider === 'file_upload' ? 'event' : undefined;

      const body = {
        name, slug, description: desc, provider, provider_config: cleanProviderConfig,
        pipeline_mode: pipelineMode,
        credentials: Object.keys(creds).length > 0 ? creds : undefined,
        target: { target_schema: targetSchema, target_table: targetTable, field_mapping: fieldMapping },
        processing: { batch_size: batchSize, batch_timeout_ms: batchTimeout, max_retries: maxRetries, error_threshold_pct: errorThreshold, dedup_enabled: dedupEnabled },
        dlq: { enabled: dlqEnabled, max_retries: 5, retention_days: 30 },
        schema_config: { validation_enabled: schemaVal },
        priority, tags, owner, enabled: true,
        // Batch/schedule fields (only sent for batch providers)
        ...(isBatch ? {
          schedule_type: scheduleType,
          schedule_expression: batchFields.schedule_expression,
          schedule_timezone: batchFields.schedule_timezone || 'UTC',
          incremental_enabled: batchFields.incremental_enabled ?? false,
          watermark_column: batchFields.watermark_column || undefined,
          source_query: batchFields.source_query || undefined,
          file_format: batchFields.file_format || undefined,
        } : {}),
        // Core Banking fields (Tier 3)
        ...(CORE_BANKING_PROVS.has(provider) ? {
          core_banking_entities: cbFields.entities || ['members', 'accounts', 'loans', 'transactions', 'shares'],
          core_banking_sync_mode: cbFields.sync_mode || 'incremental',
        } : {}),
      };
      if (existing) {
        await api(`/ingestion/pipelines/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/ingestion/pipelines', { method: 'POST', body: JSON.stringify(body) });
      }
      onCreated();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  const ProviderForm = PROVIDER_FORMS[provider];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{existing ? 'Edit Pipeline' : 'Create Ingestion Pipeline'}</h1>
              <p className="text-xs text-gray-500 mt-0.5">Configure a data ingestion pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            Step {step + 1} of {WIZARD_STEPS.length}
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-1">
          {WIZARD_STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button onClick={() => i <= step && setStep(i)} disabled={i > step}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  i === step ? 'bg-blue-100 text-blue-700' : i < step ? 'text-emerald-700 bg-emerald-50' : 'text-gray-400'
                }`}>
                {i < step ? <Check size={13} /> : <span className="w-5 h-5 rounded-full bg-gray-200 text-[10px] flex items-center justify-center font-bold">{i+1}</span>}
                {s.title}
              </button>
              {i < WIZARD_STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 mx-1" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <XCircle size={16} /> {error}
          </div>
        )}

        {/* Step 0: Provider Selection */}
        {step === 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Select Data Source</h2>
            <p className="text-sm text-gray-500 mb-6">Choose the connector for your data source — core banking, streaming, warehouse, storage, or API</p>
            {[
              { label: 'Core Banking', desc: 'Credit union core systems — members, accounts, loans, transactions', keys: ['fiserv_dna', 'symitar', 'keystone'] },
              { label: 'Streaming', desc: 'Real-time event streams', keys: ['kafka', 'confluent', 'kinesis', 'eventhubs', 'pubsub'] },
              { label: 'Warehouse & Database', desc: 'Batch sync from data warehouses', keys: ['snowflake', 'postgres'] },
              { label: 'Storage & File Transfer', desc: 'Process files from cloud storage or SFTP', keys: ['s3', 'sftp', 'file_upload'] },
              { label: 'API', desc: 'Scheduled polling of REST APIs', keys: ['rest_api'] },
            ].map(cat => (
              <div key={cat.label} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">{cat.label}</h3>
                <p className="text-xs text-gray-400 mb-3">{cat.desc}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.keys.map(key => {
                    const meta = PROVIDER_META[key];
                    const allNames: Record<string, string> = { kafka: 'Apache Kafka', confluent: 'Confluent Cloud', kinesis: 'Amazon Kinesis', eventhubs: 'Azure Event Hubs', pubsub: 'Google Pub/Sub', snowflake: 'Snowflake', postgres: 'PostgreSQL / JDBC', s3: 'S3 / Cloud Storage', sftp: 'SFTP / FTP', rest_api: 'REST API', file_upload: 'File Upload', fiserv_dna: 'Fiserv DNA', symitar: 'Jack Henry Symitar', keystone: 'Corelation KeyStone' };
                    const allDescs: Record<string, string> = {
                      kafka: 'Self-hosted Kafka with SASL/SSL and Schema Registry',
                      confluent: 'Fully managed Kafka on Confluent Cloud',
                      kinesis: 'AWS Kinesis Data Streams with IAM and enhanced fan-out',
                      eventhubs: 'Azure Event Hubs with connection string or managed identity',
                      pubsub: 'Google Pub/Sub with service account or workload identity',
                      snowflake: 'Batch sync from Snowflake warehouse with incremental watermark',
                      postgres: 'Batch sync from PostgreSQL or any JDBC-compatible database',
                      s3: 'CSV, JSON, Parquet from Amazon S3, GCS, or Azure Blob Storage',
                      sftp: 'Download and process files from SFTP/FTP servers',
                      rest_api: 'Scheduled API polling with pagination and rate limiting',
                      file_upload: 'Upload CSV/JSON/Parquet files directly from the admin UI',
                      fiserv_dna: 'Fiserv DNA core banking — members, accounts, loans via REST API',
                      symitar: 'Jack Henry Symitar (Episys) — SymXchange session token auth',
                      keystone: 'Corelation KeyStone — modern REST/OAuth2 core banking',
                    };
                    const selected = provider === key;
                    return (
                      <button key={key} onClick={() => { setProvider(key); setProviderConfig({}); }}
                        className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          selected ? `${meta.border} ${meta.bg} ring-2 ring-blue-400/50` : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                        <div className={`flex items-center gap-2 mb-1.5 ${meta.color}`}>{meta.icon} <span className="font-bold text-sm">{allNames[key]}</span></div>
                        <p className="text-xs text-gray-500 leading-relaxed">{allDescs[key]}</p>
                        {selected && <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600"><Check size={13} /> Selected</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Provider Config */}
        {step === 1 && ProviderForm && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <ProviderBadge provider={provider} />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Connection Configuration</h2>
                <p className="text-sm text-gray-500">Configure your data source connection settings</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Input label="Pipeline Name" value={name} onChange={v => { setName(v); if (!existing) setSlug(autoSlug(v)); }} placeholder="Transaction Stream" required />
                <Input label="Pipeline Slug" value={slug} onChange={setSlug} placeholder="transaction-stream" required help="Lowercase, hyphens/underscores only" />
              </div>
              <Input label="Description" value={desc} onChange={setDesc} placeholder="Real-time transaction feed from core banking" type="textarea" rows={2} />
            </div>
            <ProviderForm config={providerConfig} onChange={setProviderConfig} />
          </div>
        )}

        {/* Step 2: Credentials */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Key size={20} className="text-amber-600" /></div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Authentication Credentials</h2>
                <p className="text-sm text-gray-500">Provide secrets for connecting to your provider</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <CredentialForm provider={provider} config={providerConfig} creds={creds} onChange={setCreds} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Test Connection</h3>
              <p className="text-xs text-gray-500 mb-4">Verify your configuration and credentials before proceeding</p>
              <div className="flex items-center gap-3">
                <Btn onClick={handleTest} disabled={testing} variant="secondary">
                  {testing ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />}
                  {testing ? 'Testing...' : 'Test Connection'}
                </Btn>
                {testResult && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {testResult.success ? <CheckCircle size={15} /> : <XCircle size={15} />}
                    {testResult.success ? `Connected (${testResult.latency_ms}ms)` : testResult.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Target & Processing */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Target & Processing</h2>
            <p className="text-sm text-gray-500 mb-6">Configure where data lands and how it&apos;s processed</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Database size={15} /> Data Target</h3>
                <Input label="Target Schema" value={targetSchema} onChange={setTargetSchema} />
                <Select label="Target Table" value={targetTable} onChange={setTargetTable}
                  options={TARGETS.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ') }))} required />
                <Select label="Priority" value={priority} onChange={setPriority}
                  options={PRIORITIES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
                <Input label="Owner" value={owner} onChange={setOwner} placeholder="data-engineering" />
                <TagInput label="Tags" value={tags} onChange={setTags} />
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Settings size={15} /> Processing</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Batch Size" value={batchSize} onChange={setBatchSize} type="number" help="Records per batch" />
                    <Input label="Batch Timeout (ms)" value={batchTimeout} onChange={setBatchTimeout} type="number" />
                    <Input label="Max Retries" value={maxRetries} onChange={setMaxRetries} type="number" />
                    <Input label="Error Threshold %" value={errorThreshold} onChange={setErrorThreshold} type="number" help="Pipeline degrades above this" />
                  </div>
                  <Toggle label="Deduplication" value={dedupEnabled} onChange={setDedupEnabled} help="Prevent duplicate records" />
                  <Toggle label="Schema Validation" value={schemaVal} onChange={setSchemaVal} help="Validate message structure" />
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><AlertTriangle size={15} /> Dead Letter Queue</h3>
                  <Toggle label="Enable DLQ" value={dlqEnabled} onChange={setDlqEnabled} help="Failed messages stored for retry/inspection" />
                </div>
              </div>
            </div>

            {/* Field Mapping */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1"><Layers size={15} /> Field Mapping</h3>
              <p className="text-xs text-gray-500 mb-4">Map source fields from your data provider to target table columns. Leave empty to use automatic field name matching.</p>
              {Object.keys(fieldMapping).length > 0 && (
                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center text-xs font-medium text-gray-500 uppercase tracking-wider px-1">
                    <span>Source Field</span><span /><span>Target Field</span><span />
                  </div>
                  {Object.entries(fieldMapping).map(([src, tgt]) => (
                    <div key={src} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                      <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-mono text-gray-700 border border-gray-200 truncate">{src}</div>
                      <ArrowRight size={14} className="text-gray-400" />
                      <div className="px-3 py-2 bg-blue-50 rounded-lg text-sm font-mono text-blue-700 border border-blue-200 truncate">{tgt}</div>
                      <button onClick={() => removeFieldMapping(src)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 cursor-pointer"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Source Field</label>
                  <input value={newSourceField} onChange={e => setNewSourceField(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFieldMapping())}
                    placeholder="e.g. acct_num" style={{ border: '1px solid #D1D5DB', color: '#1F2937' }}
                    className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-white" />
                </div>
                <ArrowRight size={14} className="text-gray-300 mb-2.5" />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Target Field</label>
                  {targetFieldOptions.length > 0 ? (
                    <select value={newTargetField} onChange={e => setNewTargetField(e.target.value)}
                      style={{ border: '1px solid #D1D5DB', color: '#1F2937' }}
                      className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-white">
                      <option value="">Select target field...</option>
                      {targetFieldOptions.filter(f => !Object.values(fieldMapping).includes(f)).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={newTargetField} onChange={e => setNewTargetField(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFieldMapping())}
                      placeholder="e.g. account_number" style={{ border: '1px solid #D1D5DB', color: '#1F2937' }}
                      className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-white" />
                  )}
                </div>
                <Btn onClick={addFieldMapping} variant="secondary" size="sm" disabled={!newSourceField.trim() || !newTargetField.trim()}>
                  <Plus size={14} /> Add
                </Btn>
              </div>
              {Object.keys(fieldMapping).length === 0 && (
                <div className="flex items-start gap-2 mt-3 text-xs text-gray-400">
                  <Info size={14} className="flex-shrink-0 mt-0.5" />
                  <span>No field mappings configured. The pipeline will attempt to match source fields to target columns by name automatically.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Review & Deploy</h2>
            <p className="text-sm text-gray-500 mb-6">Confirm your pipeline configuration before saving</p>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div className="p-5 flex items-center justify-between">
                <div><div className="text-xs text-gray-400 uppercase tracking-wide">Pipeline</div><div className="text-base font-bold text-gray-900 mt-0.5">{name}</div></div>
                <ProviderBadge provider={provider} />
              </div>
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-400">Slug</span><div className="font-mono text-gray-800">{slug}</div></div>
                <div><span className="text-gray-400">Target</span><div className="text-gray-800">{targetSchema}.{targetTable}</div></div>
                <div><span className="text-gray-400">Batch Size</span><div className="text-gray-800">{batchSize.toLocaleString()}</div></div>
                <div><span className="text-gray-400">Priority</span><div className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[priority]}`} />{priority}</div></div>
              </div>
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-400">Max Retries</span><div className="text-gray-800">{maxRetries}</div></div>
                <div><span className="text-gray-400">Error Threshold</span><div className="text-gray-800">{errorThreshold}%</div></div>
                <div><span className="text-gray-400">Dedup</span><div className="text-gray-800">{dedupEnabled ? 'Enabled' : 'Disabled'}</div></div>
                <div><span className="text-gray-400">DLQ</span><div className="text-gray-800">{dlqEnabled ? 'Enabled' : 'Disabled'}</div></div>
              </div>
              <div className="p-5">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Provider Config</div>
                <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-auto max-h-48 font-mono">{JSON.stringify(providerConfig, null, 2)}</pre>
              </div>
              {Object.keys(fieldMapping).length > 0 && (
                <div className="p-5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Field Mapping ({Object.keys(fieldMapping).length} fields)</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(fieldMapping).map(([src, tgt]) => (
                      <div key={src} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2 text-xs">
                        <span className="font-mono text-gray-600">{src}</span>
                        <ArrowRight size={10} className="text-gray-400" />
                        <span className="font-mono text-blue-600">{tgt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="p-5 flex items-center gap-2">
                <Lock size={14} className="text-amber-600" />
                <span className="text-sm text-amber-700">Credentials: {Object.keys(creds).length > 0 ? `${Object.keys(creds).length} fields configured (stored in vault)` : 'None configured'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-200">
          <Btn onClick={() => step === 0 ? onClose() : setStep(step - 1)} variant="secondary">
            <ArrowLeft size={15} /> {step === 0 ? 'Cancel' : 'Back'}
          </Btn>
          <div className="flex items-center gap-3">
            {step === 4 ? (
              <Btn onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {existing ? 'Update Pipeline' : 'Create Pipeline'}
              </Btn>
            ) : (
              <Btn onClick={() => setStep(step + 1)} disabled={
                (step === 0 && !provider) ||
                (step === 1 && (!name.trim() || !slug.trim()))
              }>
                Next <ArrowRight size={15} />
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PIPELINE DETAIL VIEW
   ═══════════════════════════════════════════════════════════════════ */
function PipelineDetail({ pipeline, onBack, onRefresh }: { pipeline: Pipeline; onBack: () => void; onRefresh: () => void }) {
  const [tab, setTab] = useState<'overview' | 'metrics' | 'dlq' | 'config'>('overview');
  const [metrics, setMetrics] = useState<any>(null);
  const [dlqEntries, setDLQ] = useState<DLQEntry[]>([]);
  const [dlqStats, setDLQStats] = useState<any>({});
  const [actionLoading, setActionLoading] = useState('');
  const [detailError, setDetailError] = useState('');

  const loadMetrics = useCallback(async () => {
    try { const r = await api(`/ingestion/pipelines/${pipeline.id}/metrics?hours=1`); setMetrics(r); } catch { setMetrics(null); }
  }, [pipeline.id]);
  const loadDLQ = useCallback(async () => {
    try { const r = await api(`/ingestion/pipelines/${pipeline.id}/dlq`); setDLQ(r.entries || []); setDLQStats(r.stats || {}); } catch { setDLQ([]); setDLQStats({}); }
  }, [pipeline.id]);

  useEffect(() => { loadMetrics(); loadDLQ(); }, [loadMetrics, loadDLQ]);

  const doAction = async (action: string) => {
    setActionLoading(action); setDetailError('');
    try { await api(`/ingestion/pipelines/${pipeline.id}/${action}`, { method: 'POST' }); onRefresh(); } catch (e: any) { setDetailError(e.message || `Failed to ${action} pipeline`); }
    setActionLoading('');
  };
  const retryDLQ = async (id: string) => {
    await api(`/ingestion/pipelines/${pipeline.id}/dlq/${id}/retry`, { method: 'POST' }); loadDLQ();
  };
  const discardDLQ = async (id: string) => {
    await api(`/ingestion/pipelines/${pipeline.id}/dlq/${id}/discard`, { method: 'POST' }); loadDLQ();
  };

  const summary = metrics?.summary || {};

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"><ArrowLeft size={18} /></button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{pipeline.name}</h1>
              <Badge status={pipeline.status} />
              <ProviderBadge provider={pipeline.provider} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{pipeline.description || pipeline.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pipeline.status !== 'running' && (
            <Btn onClick={() => doAction('start')} disabled={!!actionLoading} size="sm">
              {actionLoading === 'start' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Start
            </Btn>
          )}
          {pipeline.status === 'running' && (
            <Btn onClick={() => doAction('stop')} variant="danger" disabled={!!actionLoading} size="sm">
              {actionLoading === 'stop' ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />} Stop
            </Btn>
          )}
          <Btn onClick={() => doAction('restart')} variant="secondary" disabled={!!actionLoading} size="sm">
            <RotateCcw size={14} /> Restart
          </Btn>
          <Btn onClick={() => doAction('test')} variant="ghost" disabled={!!actionLoading} size="sm">
            <Wifi size={14} /> Test
          </Btn>
        </div>
      </div>

      {/* Error Display */}
      {detailError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2"><XCircle size={16} /> {detailError}</div>
          <button onClick={() => setDetailError('')} className="p-1 hover:bg-red-100 rounded cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Metric label="Records In" value={fmtNum(summary.total_records_in || 0)} color="text-blue-600" />
        <Metric label="Records Out" value={fmtNum(summary.total_records_out || 0)} color="text-emerald-600" />
        <Metric label="Failed" value={fmtNum(summary.total_records_failed || 0)} color={summary.total_records_failed > 0 ? 'text-red-600' : undefined} />
        <Metric label="Avg Latency" value={`${summary.avg_latency_ms || 0}`} unit="ms" />
        <Metric label="Error Rate" value={`${summary.error_rate || 0}%`} color={summary.error_rate > 1 ? 'text-red-600' : 'text-emerald-600'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(['overview', 'metrics', 'dlq', 'config'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>{t === 'dlq' ? `DLQ (${dlqStats.pending || 0})` : t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-800">Pipeline Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Slug', pipeline.slug], ['Target', `${pipeline.target_schema}.${pipeline.target_table}`],
                ['Batch Size', pipeline.batch_size.toLocaleString()], ['Priority', pipeline.priority],
                ['Created', timeAgo(pipeline.created_at)], ['Updated', timeAgo(pipeline.updated_at)],
                ['Dedup', pipeline.dedup_enabled ? 'Enabled' : 'Disabled'], ['DLQ', pipeline.dlq_enabled ? 'Enabled' : 'Disabled'],
              ].map(([k, v]) => (
                <div key={k}><span className="text-gray-400 text-xs">{k}</span><div className="text-gray-800 font-medium">{v}</div></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">DLQ Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Pending', dlqStats.pending || 0], ['Retried', dlqStats.retried || 0], ['Resolved', dlqStats.resolved || 0], ['Discarded', dlqStats.discarded || 0]].map(([k, v]) => (
                <div key={k as string}><span className="text-gray-400 text-xs">{k}</span><div className="text-gray-800 font-bold text-lg">{v}</div></div>
              ))}
            </div>
          </div>
          {pipeline.last_error && (
            <div className="lg:col-span-2 bg-red-50 rounded-xl border border-red-200 p-5">
              <h3 className="text-sm font-bold text-red-800 mb-2">Last Error</h3>
              <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">{pipeline.last_error}</pre>
            </div>
          )}
        </div>
      )}

      {tab === 'metrics' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">Throughput (Last Hour)</h3>
            <Btn onClick={loadMetrics} variant="ghost" size="sm"><RefreshCw size={14} /> Refresh</Btn>
          </div>
          {metrics?.data_points?.length > 0 ? (
            <div className="space-y-1">
              {metrics.data_points.slice(-30).map((dp: any, i: number) => {
                const maxIn = Math.max(...metrics.data_points.map((d: any) => d.records_in || 1));
                const pct = ((dp.records_in || 0) / maxIn) * 100;
                return (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="text-gray-400 w-16 tabular-nums">{new Date(dp.bucket_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-gray-600 w-16 text-right tabular-nums">{fmtNum(dp.records_in || 0)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">No metrics data yet. Start the pipeline to see throughput.</div>
          )}
        </div>
      )}

      {tab === 'dlq' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Dead Letter Queue</h3>
            <Btn onClick={loadDLQ} variant="ghost" size="sm"><RefreshCw size={14} /></Btn>
          </div>
          {dlqEntries.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {dlqEntries.map(e => (
                <div key={e.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-red-600">{e.error_type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${e.resolution === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{e.resolution}</span>
                        <span className="text-xs text-gray-400">Retry {e.retry_count}/{e.max_retries}</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">{e.error_message}</p>
                      <p className="text-xs text-gray-400 font-mono mt-1 truncate">{e.message_value?.slice(0, 200)}</p>
                    </div>
                    {e.resolution === 'pending' && (
                      <div className="flex items-center gap-1 ml-3">
                        <Btn onClick={() => retryDLQ(e.id)} variant="ghost" size="sm"><RotateCcw size={13} /></Btn>
                        <Btn onClick={() => discardDLQ(e.id)} variant="ghost" size="sm"><Trash2 size={13} /></Btn>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400 text-sm">No DLQ entries. All messages processed successfully.</div>
          )}
        </div>
      )}

      {tab === 'config' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Provider Configuration</h3>
          <pre className="bg-gray-50 rounded-lg p-4 text-xs text-gray-700 overflow-auto max-h-96 font-mono">
            {JSON.stringify(pipeline.provider_config, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function IngestionPipelinesPage() {
  const [view, setView] = useState<View>('list');
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pipeline | null>(null);
  const [editPipeline, setEditPipeline] = useState<Pipeline | undefined>();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [pageError, setPageError] = useState('');

  const fetchPipelines = useCallback(async () => {
    try {
      setLoading(true); setPageError('');
      const r = await api('/ingestion/pipelines');
      setPipelines(r.pipelines || []);
    } catch (e: any) {
      setPageError(e.message || 'Failed to load pipelines');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPipelines(); }, [fetchPipelines]);

  const filtered = useMemo(() => {
    return pipelines.filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterProvider !== 'all' && p.provider !== filterProvider) return false;
      if (filterCategory !== 'all') {
        const cat = (PROVIDER_META[p.provider] || PROVIDER_META.kafka).category;
        const catMap: Record<string, string[]> = {
          streaming: ['streaming'], batch: ['warehouse', 'database', 'storage', 'file_transfer'],
          core_banking: ['core_banking'], api: ['api'], upload: ['upload'],
        };
        if (!(catMap[filterCategory] || []).includes(cat)) return false;
      }
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.slug.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [pipelines, filterStatus, filterProvider, filterCategory, search]);

  const running = pipelines.filter(p => p.status === 'running').length;
  const failed = pipelines.filter(p => p.status === 'failed').length;
  const degraded = pipelines.filter(p => p.status === 'degraded').length;

  const openDetail = async (p: Pipeline) => {
    try { const full = await api(`/ingestion/pipelines/${p.id}`); setSelected(full); setView('detail'); }
    catch { setSelected(p); setView('detail'); }
  };

  const doAction = async (id: string, action: string, e: React.MouseEvent) => {
    e.stopPropagation(); setPageError('');
    try { await api(`/ingestion/pipelines/${id}/${action}`, { method: 'POST' }); fetchPipelines(); } catch (err: any) { setPageError(err.message || `Failed to ${action} pipeline`); }
  };

  const deletePipeline = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this pipeline? This action cannot be undone.')) return;
    try { await api(`/ingestion/pipelines/${id}`, { method: 'DELETE' }); fetchPipelines(); } catch (err: any) { setPageError(err.message || 'Failed to delete pipeline'); }
  };

  // Create/Edit view
  if (view === 'create' || view === 'edit') {
    return (
      <PipelineWizard
        existing={editPipeline}
        onClose={() => { setView('list'); setEditPipeline(undefined); }}
        onCreated={() => { setView('list'); setEditPipeline(undefined); fetchPipelines(); }}
      />
    );
  }

  // Detail view
  if (view === 'detail' && selected) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <PipelineDetail
          pipeline={selected}
          onBack={() => { setView('list'); setSelected(null); }}
          onRefresh={() => openDetail(selected)}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingestion Pipelines</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure and manage streaming, batch, and core banking data pipelines</p>
        </div>
        <Btn onClick={() => { setEditPipeline(undefined); setView('create'); }}>
          <Plus size={16} /> Create Pipeline
        </Btn>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Metric label="Total Pipelines" value={pipelines.length} />
        <Metric label="Running" value={running} color="text-emerald-600" />
        <Metric label="Failed" value={failed} color={failed > 0 ? 'text-red-600' : undefined} />
        <Metric label="Degraded" value={degraded} color={degraded > 0 ? 'text-orange-600' : undefined} />
      </div>

      {/* Error Display */}
      {pageError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2"><XCircle size={16} /> {pageError}</div>
          <button onClick={() => setPageError('')} className="p-1 hover:bg-red-100 rounded cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pipelines..."
            style={{ border: "1px solid #D1D5DB", color: "#1F2937" }} className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-white" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ border: "1px solid #D1D5DB", color: "#1F2937" }} className="px-3 py-2 rounded-lg text-sm bg-white">
          <option value="all">All Statuses</option>
          {Object.keys(STATUS_MAP).map(s => <option key={s} value={s}>{STATUS_MAP[s].label}</option>)}
        </select>
        <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)}
          style={{ border: "1px solid #D1D5DB", color: "#1F2937" }} className="px-3 py-2 rounded-lg text-sm bg-white">
          <option value="all">All Providers</option>
          {Object.keys(PROVIDER_META).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          style={{ border: "1px solid #D1D5DB", color: "#1F2937" }} className="px-3 py-2 rounded-lg text-sm bg-white">
          <option value="all">All Types</option>
          <option value="streaming">Streaming</option>
          <option value="batch">Batch / Warehouse</option>
          <option value="core_banking">Core Banking</option>
          <option value="api">API Poll</option>
          <option value="upload">File Upload</option>
        </select>
        <Btn onClick={fetchPipelines} variant="ghost" size="sm"><RefreshCw size={14} /></Btn>
      </div>

      {/* Pipeline List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4"><Activity size={28} className="text-gray-400" /></div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Pipelines Yet</h3>
          <p className="text-sm text-gray-500 mb-6">Create your first data ingestion pipeline to start syncing data</p>
          <Btn onClick={() => { setEditPipeline(undefined); setView('create'); }}><Plus size={16} /> Create Pipeline</Btn>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Pipeline</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Provider</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Mode</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Target</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Priority</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Updated</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} onClick={() => openDetail(p)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{p.slug}</div>
                  </td>
                  <td className="px-3 py-4"><ProviderBadge provider={p.provider} /></td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                      p.pipeline_mode === 'streaming' ? 'bg-emerald-50 text-emerald-700' :
                      p.pipeline_mode === 'batch' ? 'bg-blue-50 text-blue-700' :
                      p.pipeline_mode === 'api_poll' ? 'bg-violet-50 text-violet-700' :
                      'bg-green-50 text-green-700'
                    }`}>{(p.pipeline_mode || 'streaming').replace('_', ' ')}</span>
                    {p.schedule_expression && <div className="text-[10px] text-gray-400 mt-0.5 font-mono">{p.schedule_expression}</div>}
                  </td>
                  <td className="px-3 py-4"><Badge status={p.status} /></td>
                  <td className="px-3 py-4 text-sm text-gray-600">{p.target_schema}.{p.target_table}</td>
                  <td className="px-3 py-4">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[p.priority] || 'bg-gray-400'}`} />
                      {p.priority}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-xs text-gray-400">{timeAgo(p.updated_at)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {p.status !== 'running' ? (
                        <button onClick={e => doAction(p.id, 'start', e)} title="Start"
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 cursor-pointer"><Play size={14} /></button>
                      ) : (
                        <button onClick={e => doAction(p.id, 'stop', e)} title="Stop"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 cursor-pointer"><Square size={14} /></button>
                      )}
                      <button onClick={e => { e.stopPropagation(); setEditPipeline(p); setView('edit'); }} title="Edit"
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"><Settings size={14} /></button>
                      <button onClick={e => deletePipeline(p.id, e)} title="Delete"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
