'use client';

/**
 * Pinot Pulse Enterprise — Enterprise Integrations Admin
 * Multi-step configuration wizards for Fiserv DNA, Jack Henry Symitar,
 * Corelation KeyStone, streaming pipelines (Kafka), Apache Pinot,
 * Data Warehouses (Snowflake, BigQuery, Databricks), and Orchestration
 * tools (Astronomer, Airflow, dbt Cloud).
 * 
 * KEY DESIGN: UI shows actual configuration status — "Pending Configuration"
 * for anything not yet set up. No stale/mock "connected" states.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import Link from 'next/link';
import {
  Database, Settings, Server, Plug, CheckCircle, XCircle, AlertTriangle,
  ChevronRight, Loader2, Lock, Globe, Zap, Activity,
  ArrowLeft, ArrowRight, Info, RefreshCw, Clock, Shield,
  Play, Pause, BarChart3, Upload, Key,
  Radio, Layers, HardDrive, Wifi, WifiOff, AlertCircle,
  Cloud, GitBranch, X, Save
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type ConfigStatus = 'not_configured' | 'pending' | 'testing' | 'configured' | 'connected' | 'error' | 'degraded';

interface IntegrationConfig {
  id: string;
  name: string;
  vendor: string;
  type: 'core_banking' | 'streaming' | 'analytics' | 'warehouse';
  status: ConfigStatus;
  configuredAt: string | null;
  lastTestedAt: string | null;
  lastSyncAt: string | null;
  connectionDetails: Record<string, any>;
  dataFeeds: DataFeed[];
  errorMessage: string | null;
}

interface DataFeed {
  id: string;
  name: string;
  table: string;
  status: 'active' | 'pending' | 'error' | 'disabled';
  recordCount: number | null;
  lastSync: string | null;
  syncMode: 'real-time' | 'batch' | 'manual' | 'streaming';
}

type WizardStep = { id: string; title: string; description: string };

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function StatusBadge({ status, large }: { status: ConfigStatus | string; large?: boolean }) {
  const m: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
    not_configured: { bg: 'bg-gray-100 text-gray-600 border-gray-200', icon: <WifiOff size={large ? 14 : 11} />, label: 'Not Configured' },
    pending: { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock size={large ? 14 : 11} />, label: 'Pending Setup' },
    testing: { bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Loader2 size={large ? 14 : 11} className="animate-spin" />, label: 'Testing...' },
    configured: { bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Settings size={large ? 14 : 11} />, label: 'Configured' },
    connected: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={large ? 14 : 11} />, label: 'Connected' },
    error: { bg: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle size={large ? 14 : 11} />, label: 'Error' },
    degraded: { bg: 'bg-orange-50 text-orange-700 border-orange-200', icon: <AlertTriangle size={large ? 14 : 11} />, label: 'Degraded' },
    active: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={large ? 14 : 11} />, label: 'Active' },
    disabled: { bg: 'bg-gray-100 text-gray-500 border-gray-200', icon: <Pause size={large ? 14 : 11} />, label: 'Disabled' },
  };
  const s = m[status] || m.not_configured;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${large ? 'text-sm' : 'text-xs'} font-medium rounded-full border ${s.bg}`}>
      {s.icon} {s.label}
    </span>
  );
}

function PendingBanner({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
      <div className="p-2.5 bg-amber-100 rounded-xl flex-shrink-0">
        <AlertCircle size={24} className="text-amber-600" />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-amber-900">{title}</h4>
        <p className="text-sm text-amber-700 mt-1">{message}</p>
      </div>
      <button onClick={onAction} className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0">
        {actionLabel}
      </button>
    </div>
  );
}

function StepIndicator({ steps, currentStep, onStepClick }: { steps: WizardStep[]; currentStep: number; onStepClick?: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((step, i) => (
        <React.Fragment key={step.id}>
          <button
            onClick={() => onStepClick && i < currentStep && onStepClick(i)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
              i === currentStep ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200' :
              i < currentStep ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer hover:bg-emerald-100' :
              'bg-gray-50 text-gray-400 border border-gray-200'
            }`}
            disabled={i > currentStep}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              i === currentStep ? 'bg-blue-600 text-white' : i < currentStep ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'
            }`}>{i < currentStep ? '✓' : i + 1}</span>
            <span className="hidden lg:inline">{step.title}</span>
          </button>
          {i < steps.length - 1 && <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function FormField({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function InfoBox({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const s = { info: 'bg-blue-50 border-blue-200 text-blue-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', success: 'bg-emerald-50 border-emerald-200 text-emerald-800' };
  const icons = { info: <Info size={16} />, warning: <AlertTriangle size={16} />, success: <CheckCircle size={16} /> };
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${s[type]}`}>
      <span className="mt-0.5 flex-shrink-0">{icons[type]}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function DataFeedTable({ feeds, isPending }: { feeds: DataFeed[]; isPending: boolean }) {
  if (isPending) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <WifiOff size={32} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500 font-medium">Data feeds unavailable</p>
        <p className="text-xs text-gray-400 mt-1">Complete the integration configuration to activate data feeds.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Feed</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Table</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Mode</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Records</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Last Sync</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {feeds.map(f => (
            <tr key={f.id} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium text-gray-900">{f.name}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{f.table}</td>
              <td className="px-4 py-2.5">
                <span className={`text-xs px-2 py-0.5 rounded ${f.syncMode === 'real-time' ? 'bg-emerald-50 text-emerald-700' : f.syncMode === 'batch' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {f.syncMode}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-600">{f.recordCount !== null ? f.recordCount.toLocaleString() : '—'}</td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{f.lastSync || 'Never'}</td>
              <td className="px-4 py-2.5"><StatusBadge status={f.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC INTEGRATION CARD (for catalog-driven categories)
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; gradient: string; label: string }> = {
  data_warehouse: { icon: <Cloud size={18} />, color: 'sky', gradient: 'from-sky-500 to-cyan-600', label: 'Data Warehouses' },
  streaming:      { icon: <Radio size={18} />, color: 'emerald', gradient: 'from-emerald-500 to-green-600', label: 'Streaming Platforms' },
  cloud_storage:  { icon: <HardDrive size={18} />, color: 'amber', gradient: 'from-amber-500 to-orange-600', label: 'Cloud Storage' },
  orchestration:  { icon: <GitBranch size={18} />, color: 'violet', gradient: 'from-violet-500 to-purple-600', label: 'Orchestration & Pipelines' },
  digital_banking:{ icon: <Globe size={18} />, color: 'cyan', gradient: 'from-cyan-500 to-blue-600', label: 'Digital Banking' },
  card_processing:{ icon: <Shield size={18} />, color: 'pink', gradient: 'from-pink-500 to-rose-600', label: 'Card Processing' },
  crm:            { icon: <Activity size={18} />, color: 'fuchsia', gradient: 'from-fuchsia-500 to-purple-600', label: 'CRM' },
  databases:      { icon: <Database size={18} />, color: 'blue', gradient: 'from-blue-500 to-indigo-600', label: 'Databases' },
  database:       { icon: <Database size={18} />, color: 'blue', gradient: 'from-blue-500 to-indigo-600', label: 'Databases' },
  core_banking:   { icon: <Server size={18} />, color: 'sky', gradient: 'from-sky-500 to-blue-600', label: 'Core Banking' },
};

const ICON_COLORS: Record<string, string> = {
  sky: 'bg-sky-50 text-sky-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600', cyan: 'bg-cyan-50 text-cyan-600', pink: 'bg-pink-50 text-pink-600',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-600', blue: 'bg-blue-50 text-blue-600', orange: 'bg-orange-50 text-orange-600',
  indigo: 'bg-indigo-50 text-indigo-600', teal: 'bg-teal-50 text-teal-600', rose: 'bg-rose-50 text-rose-600',
};

const BTN_COLORS: Record<string, string> = {
  sky: 'bg-sky-50 text-sky-700 hover:bg-sky-100', emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100', violet: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
  cyan: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100', pink: 'bg-pink-50 text-pink-700 hover:bg-pink-100',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100', blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  orange: 'bg-orange-50 text-orange-700 hover:bg-orange-100', indigo: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
  teal: 'bg-teal-50 text-teal-700 hover:bg-teal-100', rose: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
};

function DynamicIntegrationCard({ item, color, onConfigure, onTest, testPending }: {
  item: any; color: string; onConfigure: () => void; onTest: () => void; testPending: boolean;
}) {
  const status = item.status || 'not_configured';
  const hasConfig = status !== 'not_configured' && item.config;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${ICON_COLORS[color] || ICON_COLORS.blue}`}>
          {CATEGORY_META[item.type]?.icon || CATEGORY_META[item.category]?.icon || <Plug size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h4>
          <StatusBadge status={status} />
        </div>
      </div>
      {item.description && <p className="text-xs text-gray-500 mb-3">{item.description}</p>}
      {hasConfig ? (
        <div className="space-y-1.5 text-sm mb-3">
          {Object.entries(item.config).slice(0, 3).map(([k, v]: [string, any]) => (
            <p key={k}><strong>{k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}:</strong>{' '}
              <span className="font-mono text-xs">{typeof v === 'string' && (k.includes('password') || k.includes('secret') || k.includes('token') || k.includes('key')) ? '••••••' : String(v || '—')}</span>
            </p>
          ))}
        </div>
      ) : (
        <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg mb-3">
          <p className="text-xs text-gray-400 italic">Not configured. Click Configure to set up this integration.</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        {item.config_schema && (
          <button onClick={onConfigure}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 ${BTN_COLORS[color] || BTN_COLORS.blue}`}>
            <Settings size={12} /> {status === 'not_configured' ? 'Configure' : 'Edit'}
          </button>
        )}
        {status !== 'not_configured' && (
          <button onClick={onTest} disabled={testPending}
            className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-1.5">
            {testPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Test
          </button>
        )}
      </div>
    </div>
  );
}

function CategorySection({ category, items, color, icon, label, onConfigure, onTest, testPending }: {
  category: string; items: any[]; color: string; icon: React.ReactNode; label: string;
  onConfigure: (item: any) => void; onTest: (id: string) => void; testPending: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className={`${ICON_COLORS[color] || ''} p-1 rounded`}>{icon}</span> {label}
      </h2>
      <div className={`grid gap-6 ${items.length >= 3 ? 'grid-cols-3' : items.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-md'}`}>
        {items.map((item: any) => (
          <DynamicIntegrationCard
            key={item.id}
            item={item}
            color={color}
            onConfigure={() => onConfigure(item)}
            onTest={() => onTest(item.id)}
            testPending={testPending}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FISERV DNA WIZARD
// ═══════════════════════════════════════════════════════════════════════════

function FiservDNAWizard({ onClose, onSave }: { onClose: () => void; onSave: (data: Record<string, any>) => void }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    // Connection
    apiEndpoint: '',
    apiVersion: 'v11',
    authMethod: 'oauth2',
    clientId: '',
    clientSecret: '',
    tokenEndpoint: '',
    tenantId: '',
    certificatePath: '',
    privateKey: '',
    caCertificate: '',
    // SOAP/WSDL (legacy)
    wsdlUrl: '',
    soapUsername: '',
    soapPassword: '',
    // Sync settings
    syncMode: 'real-time',
    batchSchedule: '*/15 * * * *',
    eventHubEnabled: true,
    eventHubConnectionString: '',
    // Data feeds
    feedMembers: true,
    feedAccounts: true,
    feedLoans: true,
    feedTransactions: true,
    feedShares: true,
    feedGL: false,
    // Field mapping
    memberIdField: 'PersonPartyId',
    accountIdField: 'AcctId',
    transactionIdField: 'TrnId',
    // Rate limiting
    maxRequestsPerSecond: '50',
    connectionTimeout: '30',
    retryAttempts: '3',
    retryBackoffMs: '1000',
    // Monitoring
    enableHealthCheck: true,
    healthCheckInterval: '60',
    alertOnSyncFailure: true,
    alertOnLatencyThreshold: true,
    latencyThresholdMs: '5000',
  });

  const steps: WizardStep[] = [
    { id: 'connection', title: 'Connection', description: 'API endpoint and authentication' },
    { id: 'auth', title: 'Authentication', description: 'OAuth2 or SOAP credentials' },
    { id: 'sync', title: 'Sync Mode', description: 'Real-time or batch synchronization' },
    { id: 'feeds', title: 'Data Feeds', description: 'Select data entities to sync' },
    { id: 'mapping', title: 'Field Mapping', description: 'Map Fiserv fields to Pinot Pulse' },
    { id: 'monitoring', title: 'Monitoring', description: 'Health checks and alerting' },
    { id: 'review', title: 'Review & Test', description: 'Verify and test connection' },
  ];

  const update = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));
  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Database size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Fiserv DNA Integration</h2>
              <p className="text-sky-200 text-sm mt-0.5">Connect via REST API (v11+), SOAP/WSDL, or Event Hub for real-time streaming</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-sm px-3 py-1 rounded-lg hover:bg-white/10">✕ Close</button>
        </div>
      </div>

      <div className="px-8 py-6">
        <StepIndicator steps={steps} currentStep={step} onStepClick={setStep} />

        {/* Step 1: Connection */}
        {step === 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Fiserv DNA Connection Details</h3>
            <InfoBox type="info">
              Fiserv DNA supports REST API (v11+), legacy SOAP/WSDL, and Event Hub for streaming. REST API is recommended for new integrations. Contact your Fiserv relationship manager for API credentials.
            </InfoBox>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="API Endpoint URL" required hint="Your Fiserv DNA API base URL">
                <input type="url" value={formData.apiEndpoint} onChange={e => update('apiEndpoint', e.target.value)}
                  placeholder="https://your-institution.fiservapis.com/dna" className={inputClass} />
              </FormField>
              <FormField label="API Version" required>
                <select value={formData.apiVersion} onChange={e => update('apiVersion', e.target.value)} className={inputClass}>
                  <option value="v11">v11 (Current — REST)</option>
                  <option value="v10">v10 (Legacy — REST)</option>
                  <option value="soap">SOAP/WSDL (Legacy)</option>
                </select>
              </FormField>
              <FormField label="Tenant / Institution ID" required hint="Fiserv-assigned institution identifier">
                <input type="text" value={formData.tenantId} onChange={e => update('tenantId', e.target.value)}
                  placeholder="e.g., INST-12345" className={inputClass} />
              </FormField>
              <FormField label="Authentication Method">
                <select value={formData.authMethod} onChange={e => update('authMethod', e.target.value)} className={inputClass}>
                  <option value="oauth2">OAuth 2.0 (Client Credentials)</option>
                  <option value="mtls">mTLS (Mutual TLS Certificate)</option>
                  <option value="apikey">API Key</option>
                  <option value="soap">SOAP WS-Security</option>
                </select>
              </FormField>
            </div>
            {formData.apiVersion === 'soap' && (
              <FormField label="WSDL URL" required hint="Fiserv DNA SOAP service WSDL location">
                <input type="url" value={formData.wsdlUrl} onChange={e => update('wsdlUrl', e.target.value)}
                  placeholder="https://your-institution.fiservapis.com/dna/services?wsdl" className={inputClass} />
              </FormField>
            )}
          </div>
        )}

        {/* Step 2: Auth */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Authentication Credentials</h3>
            <InfoBox type="warning">
              Credentials are encrypted at rest using AES-256 and never written to application logs. Only platform administrators can view or modify credentials. Error code: <code className="bg-amber-100 px-1 rounded font-mono">CORE-API-4002</code> if authentication fails.
            </InfoBox>

            {(formData.authMethod === 'oauth2' || formData.authMethod === 'apikey') && (
              <div className="p-5 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Key size={16} className="text-blue-600" /> {formData.authMethod === 'oauth2' ? 'OAuth 2.0 Client Credentials' : 'API Key Authentication'}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={formData.authMethod === 'oauth2' ? 'Client ID' : 'API Key'} required>
                    <input type="text" value={formData.clientId} onChange={e => update('clientId', e.target.value)}
                      placeholder={formData.authMethod === 'oauth2' ? 'OAuth client ID' : 'API key'} className={inputClass} />
                  </FormField>
                  {formData.authMethod === 'oauth2' && (
                    <>
                      <FormField label="Client Secret" required>
                        <input type="password" value={formData.clientSecret} onChange={e => update('clientSecret', e.target.value)}
                          placeholder="••••••••" className={inputClass} />
                      </FormField>
                      <FormField label="Token Endpoint" required hint="OAuth token URL for client credentials flow">
                        <input type="url" value={formData.tokenEndpoint} onChange={e => update('tokenEndpoint', e.target.value)}
                          placeholder="https://auth.fiservapis.com/oauth/token" className={inputClass} />
                      </FormField>
                    </>
                  )}
                </div>
              </div>
            )}

            {formData.authMethod === 'mtls' && (
              <div className="p-5 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Lock size={16} className="text-purple-600" /> Mutual TLS Certificate Authentication
                </h4>
                <InfoBox type="info">
                  Paste your PEM-encoded client certificate and private key. Certificates are validated for expiry, key size ({'≥'}2048 bits), and signature algorithm, then encrypted with AES-256 before storage. Private keys never leave the server.
                </InfoBox>
                <FormField label="Client Certificate (PEM)" required hint="Full PEM X.509 certificate including BEGIN/END markers">
                  <textarea value={formData.certificatePath} onChange={e => update('certificatePath', e.target.value)}
                    placeholder={"-----BEGIN CERTIFICATE-----\nMIIE...\n-----END CERTIFICATE-----"} rows={5}
                    className={`${inputClass} font-mono text-xs`} />
                </FormField>
                <FormField label="Private Key (PEM)" required hint="RSA/EC private key in PKCS#8 format">
                  <textarea value={formData.privateKey || ''} onChange={e => update('privateKey', e.target.value)}
                    placeholder={"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----"} rows={4}
                    className={`${inputClass} font-mono text-xs`} />
                </FormField>
                <FormField label="CA Certificate Chain (Optional)" hint="If using a private CA, paste the CA cert for chain validation">
                  <textarea value={formData.caCertificate || ''} onChange={e => update('caCertificate', e.target.value)}
                    placeholder={"-----BEGIN CERTIFICATE-----\n(CA cert)\n-----END CERTIFICATE-----"} rows={3}
                    className={`${inputClass} font-mono text-xs`} />
                </FormField>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Shield size={12} className="text-emerald-500" />
                  <span>Stored with AES-256-Fernet envelope encryption. Certificate metadata (fingerprint, expiry) is indexed for rotation alerts.</span>
                </div>
              </div>
            )}

            {formData.authMethod === 'soap' && (
              <div className="p-5 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Shield size={16} className="text-amber-600" /> SOAP WS-Security
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="SOAP Username" required>
                    <input type="text" value={formData.soapUsername} onChange={e => update('soapUsername', e.target.value)} className={inputClass} />
                  </FormField>
                  <FormField label="SOAP Password" required>
                    <input type="password" value={formData.soapPassword} onChange={e => update('soapPassword', e.target.value)} className={inputClass} />
                  </FormField>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Sync */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Synchronization Mode</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'real-time', label: 'Real-Time Streaming', desc: 'Via Fiserv Event Hub → Kafka → Pinot. Sub-second latency.', icon: <Zap size={24} />, recommended: true },
                { id: 'batch', label: 'Batch / Scheduled', desc: 'Periodic API polling on cron schedule. 15-min default.', icon: <Clock size={24} />, recommended: false },
                { id: 'manual', label: 'Manual Trigger', desc: 'On-demand sync initiated by admin. For initial loads or testing.', icon: <Play size={24} />, recommended: false },
              ].map(mode => (
                <button key={mode.id} onClick={() => update('syncMode', mode.id)}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${formData.syncMode === mode.id ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className={`mb-3 ${formData.syncMode === mode.id ? 'text-blue-600' : 'text-gray-400'}`}>{mode.icon}</div>
                  <p className="text-sm font-semibold text-gray-900">{mode.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{mode.desc}</p>
                  {mode.recommended && <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Recommended</span>}
                </button>
              ))}
            </div>

            {formData.syncMode === 'real-time' && (
              <div className="p-5 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Radio size={16} className="text-emerald-600" /> Fiserv Event Hub Configuration
                </h4>
                <div className="flex items-center gap-3 mb-3">
                  <input type="checkbox" checked={formData.eventHubEnabled} onChange={e => update('eventHubEnabled', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">Enable Event Hub streaming (requires Fiserv DNA Event Hub subscription)</span>
                </div>
                {formData.eventHubEnabled && (
                  <FormField label="Event Hub Connection String" required hint="Fiserv-provided Azure Event Hub or Kafka endpoint">
                    <input type="password" value={formData.eventHubConnectionString} onChange={e => update('eventHubConnectionString', e.target.value)}
                      placeholder="Endpoint=sb://fiserv-events.servicebus.windows.net/;SharedAccessKey=..." className={inputClass} />
                  </FormField>
                )}
              </div>
            )}

            {formData.syncMode === 'batch' && (
              <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
                <FormField label="Batch Schedule (Cron)" hint="Default: every 15 minutes. Format: MIN HOUR DOM MON DOW">
                  <input type="text" value={formData.batchSchedule} onChange={e => update('batchSchedule', e.target.value)}
                    className={`${inputClass} font-mono`} />
                </FormField>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Rate Limit (requests/second)" hint="Fiserv DNA default rate limit. Contact Fiserv to increase.">
                <input type="number" value={formData.maxRequestsPerSecond} onChange={e => update('maxRequestsPerSecond', e.target.value)}
                  min={1} max={200} className={inputClass} />
              </FormField>
              <FormField label="Connection Timeout (seconds)">
                <input type="number" value={formData.connectionTimeout} onChange={e => update('connectionTimeout', e.target.value)}
                  min={5} max={120} className={inputClass} />
              </FormField>
              <FormField label="Retry Attempts" hint="Number of retries on transient failure before raising CORE-SYNC-4001">
                <input type="number" value={formData.retryAttempts} onChange={e => update('retryAttempts', e.target.value)}
                  min={0} max={10} className={inputClass} />
              </FormField>
              <FormField label="Retry Backoff (ms)" hint="Exponential backoff base delay between retries">
                <input type="number" value={formData.retryBackoffMs} onChange={e => update('retryBackoffMs', e.target.value)}
                  min={100} max={30000} className={inputClass} />
              </FormField>
            </div>
          </div>
        )}

        {/* Step 4: Data Feeds */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Data Feed Selection</h3>
            <InfoBox type="info">
              Select the data entities to synchronize from Fiserv DNA. Each feed creates a corresponding Kafka topic and Pinot real-time table. Feeds cannot be activated until the connection test passes.
            </InfoBox>
            <div className="space-y-3">
              {[
                { key: 'feedMembers', label: 'Members / Persons', table: 'members_realtime', desc: 'Person records, demographics, contact info, membership status. Fiserv: PartyAcctRelInq.', size: '~45K records' },
                { key: 'feedAccounts', label: 'Accounts / Shares', table: 'accounts_realtime', desc: 'Share accounts, checking, savings, CDs, IRAs. Fiserv: AcctInq, DepAcctInq.', size: '~120K records' },
                { key: 'feedLoans', label: 'Loans', table: 'loans_realtime', desc: 'Consumer, mortgage, commercial loans, payment history. Fiserv: LoanInq, LnAcctInq.', size: '~35K records' },
                { key: 'feedTransactions', label: 'Transactions', table: 'transactions_realtime', desc: 'All posted and pending transactions. Fiserv: AcctTrnInq. Real-time feed via Event Hub.', size: '~2M/month', recommended: true },
                { key: 'feedShares', label: 'Share Certificates / CDs', table: 'certificates_realtime', desc: 'Certificate details, maturity dates, rates. Fiserv: CertInq.', size: '~8K records' },
                { key: 'feedGL', label: 'General Ledger', table: 'gl_entries', desc: 'GL account balances and entries for financial reporting. Fiserv: GLAcctInq.', size: '~500K entries', advanced: true },
              ].map(feed => (
                <div key={feed.key} className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                  (formData as any)[feed.key] ? 'bg-blue-50/30 border-blue-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <input type="checkbox" checked={(formData as any)[feed.key]}
                    onChange={e => update(feed.key, e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{feed.label}</p>
                      <span className="text-xs font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{feed.table}</span>
                      {(feed as any).recommended && <span className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">Recommended</span>}
                      {(feed as any).advanced && <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">Advanced</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{feed.desc}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{feed.size}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Field Mapping */}
        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Field Mapping</h3>
            <InfoBox type="info">
              Map Fiserv DNA field identifiers to Pinot Pulse internal schema. Default mappings follow Fiserv DNA v11 standard field names. Customize only if your institution uses non-standard field aliases.
            </InfoBox>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pinot Pulse Field</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fiserv DNA Field</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">API Operation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { ppField: 'member_id', fiservField: formData.memberIdField, api: 'PartyAcctRelInq', editable: true, key: 'memberIdField' },
                    { ppField: 'account_id', fiservField: formData.accountIdField, api: 'AcctInq / DepAcctInq', editable: true, key: 'accountIdField' },
                    { ppField: 'transaction_id', fiservField: formData.transactionIdField, api: 'AcctTrnInq', editable: true, key: 'transactionIdField' },
                    { ppField: 'account_balance', fiservField: 'Bal.CurAmt', api: 'AcctInq', editable: false, key: '' },
                    { ppField: 'loan_amount', fiservField: 'OrigDt / CurBal', api: 'LoanInq', editable: false, key: '' },
                    { ppField: 'transaction_amount', fiservField: 'TrnAmt.Amt', api: 'AcctTrnInq', editable: false, key: '' },
                    { ppField: 'member_name', fiservField: 'PersonName.FullName', api: 'PartyInq', editable: false, key: '' },
                    { ppField: 'account_type', fiservField: 'AcctType', api: 'AcctInq', editable: false, key: '' },
                  ].map(row => (
                    <tr key={row.ppField} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-blue-700 font-medium">{row.ppField}</td>
                      <td className="px-4 py-2.5">
                        {row.editable ? (
                          <input type="text" value={row.fiservField} onChange={e => update(row.key, e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm font-mono w-48" />
                        ) : (
                          <span className="font-mono text-gray-600">{row.fiservField}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{row.api}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 6: Monitoring */}
        {step === 5 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Health Monitoring & Alerting</h3>
            <div className="space-y-3">
              {[
                { key: 'enableHealthCheck', label: 'Automated Health Checks', desc: 'Periodic API ping to verify connectivity. Raises CORE-API-4002 on failure.' },
                { key: 'alertOnSyncFailure', label: 'Alert on Sync Failure', desc: 'Notify on-call team when a data sync fails. Error: CORE-SYNC-4001.' },
                { key: 'alertOnLatencyThreshold', label: 'Alert on High Latency', desc: `Trigger alert when API response exceeds ${formData.latencyThresholdMs}ms threshold.` },
              ].map(opt => (
                <div key={opt.key} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <input type="checkbox" checked={(formData as any)[opt.key]}
                    onChange={e => update(opt.key, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Health Check Interval (seconds)" hint="How often to ping Fiserv DNA API">
                <input type="number" value={formData.healthCheckInterval} onChange={e => update('healthCheckInterval', e.target.value)}
                  min={10} max={600} className={inputClass} />
              </FormField>
              <FormField label="Latency Alert Threshold (ms)" hint="Alert if response time exceeds this value">
                <input type="number" value={formData.latencyThresholdMs} onChange={e => update('latencyThresholdMs', e.target.value)}
                  min={100} max={30000} className={inputClass} />
              </FormField>
            </div>
          </div>
        )}

        {/* Step 7: Review */}
        {step === 6 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Review Fiserv DNA Configuration</h3>
            <InfoBox type="success">
              Review all settings. After saving, use <strong>Test Connection</strong> to verify credentials before activating data feeds. Status will change from &quot;Pending Setup&quot; → &quot;Configured&quot; → &quot;Connected&quot; after successful test.
            </InfoBox>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Connection</h4>
                <p className="text-sm"><strong>Endpoint:</strong> {formData.apiEndpoint || '—'}</p>
                <p className="text-sm"><strong>Version:</strong> {formData.apiVersion}</p>
                <p className="text-sm"><strong>Auth:</strong> {formData.authMethod}</p>
                <p className="text-sm"><strong>Tenant:</strong> {formData.tenantId || '—'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Sync</h4>
                <p className="text-sm"><strong>Mode:</strong> {formData.syncMode}</p>
                <p className="text-sm"><strong>Event Hub:</strong> {formData.eventHubEnabled ? 'Yes' : 'No'}</p>
                <p className="text-sm"><strong>Rate:</strong> {formData.maxRequestsPerSecond} req/s</p>
                <p className="text-sm"><strong>Retries:</strong> {formData.retryAttempts}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Data Feeds</h4>
                <p className="text-sm"><strong>Members:</strong> {formData.feedMembers ? '✓' : '✗'}</p>
                <p className="text-sm"><strong>Accounts:</strong> {formData.feedAccounts ? '✓' : '✗'}</p>
                <p className="text-sm"><strong>Loans:</strong> {formData.feedLoans ? '✓' : '✗'}</p>
                <p className="text-sm"><strong>Transactions:</strong> {formData.feedTransactions ? '✓' : '✗'}</p>
                <p className="text-sm"><strong>GL:</strong> {formData.feedGL ? '✓' : '✗'}</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Post-Save Workflow</h4>
              <div className="flex items-center gap-3 text-sm text-blue-700">
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">1. Pending</span>
                <ChevronRight size={14} />
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">2. Test Connection</span>
                <ChevronRight size={14} />
                <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs font-bold">3. Configured</span>
                <ChevronRight size={14} />
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">4. Connected</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <ArrowLeft size={16} /> {step === 0 ? 'Cancel' : 'Previous'}
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => {
              // Validate current step before advancing
              if (step === 0 && !formData.apiEndpoint) {
                alert('API Endpoint is required before proceeding.');
                return;
              }
              if (step === 1 && !formData.clientId) {
                alert('Client ID is required before proceeding.');
                return;
              }
              setStep(step + 1);
            }}
              className="px-6 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={() => onSave(formData)}
              className="px-6 py-2.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
              <CheckCircle size={16} /> Save & Begin Testing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// JACK HENRY SYMITAR WIZARD
// ═══════════════════════════════════════════════════════════════════════════

function SymitarWizard({ onClose, onSave }: { onClose: () => void; onSave: (data: Record<string, any>) => void }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    symxchangeHost: '', symxchangePort: '443',
    symxchangeUserId: '', symxchangePassword: '',
    powerOnEnabled: true, powerOnSpectraPath: '',
    archwizardEnabled: false, archwizardHost: '',
    batchExtractEnabled: true, extractDirectory: '/ftp/symitar/extracts',
    feedMembers: true, feedAccounts: true, feedLoans: true, feedTransactions: true,
    feedShares: true, feedCards: true,
    syncMode: 'streaming',
    kafkaTopic: 'symitar-events',
    enableHealthCheck: true,
    alertOnFailure: true,
  });

  const steps: WizardStep[] = [
    { id: 'connection', title: 'SymXchange', description: 'SymXchange API connection' },
    { id: 'poweron', title: 'PowerOn', description: 'PowerOn spectra and batch extracts' },
    { id: 'feeds', title: 'Data Feeds', description: 'Select data entities' },
    { id: 'sync', title: 'Sync & Monitor', description: 'Streaming and health checks' },
    { id: 'review', title: 'Review & Test', description: 'Verify configuration' },
  ];

  const update = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));
  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-yellow-700 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Database size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Jack Henry Symitar Integration</h2>
              <p className="text-violet-200 text-sm mt-0.5">Connect via SymXchange API, PowerOn spectra, and file-based batch extracts</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-sm px-3 py-1 rounded-lg hover:bg-white/10">✕ Close</button>
        </div>
      </div>

      <div className="px-8 py-6">
        <StepIndicator steps={steps} currentStep={step} onStepClick={setStep} />

        {step === 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">SymXchange API Connection</h3>
            <InfoBox type="info">
              SymXchange is Jack Henry&apos;s real-time API layer over the Episys/Symitar core. Configure the SymXchange endpoint to enable real-time data streaming and on-demand queries. Error code: <code className="bg-blue-100 px-1 rounded font-mono">CORE-API-4002</code> on connection failure.
            </InfoBox>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="SymXchange Host" required hint="IP or hostname of your SymXchange server">
                <input type="text" value={formData.symxchangeHost} onChange={e => update('symxchangeHost', e.target.value)}
                  placeholder="symxchange.yourcu.local" className={inputClass} />
              </FormField>
              <FormField label="Port" required>
                <input type="text" value={formData.symxchangePort} onChange={e => update('symxchangePort', e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="SymXchange User ID" required hint="Service account with read permissions">
                <input type="text" value={formData.symxchangeUserId} onChange={e => update('symxchangeUserId', e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="SymXchange Password" required>
                <input type="password" value={formData.symxchangePassword} onChange={e => update('symxchangePassword', e.target.value)} className={inputClass} />
              </FormField>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">PowerOn & Batch Extract</h3>
            <div className="space-y-4">
              <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Zap size={16} className="text-violet-600" /> PowerOn Spectra
                  </h4>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.powerOnEnabled} onChange={e => update('powerOnEnabled', e.target.checked)}
                      className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" /> Enable
                  </label>
                </div>
                {formData.powerOnEnabled && (
                  <FormField label="PowerOn Spectra Directory" hint="Server path where PowerOn spectra files are deployed">
                    <input type="text" value={formData.powerOnSpectraPath} onChange={e => update('powerOnSpectraPath', e.target.value)}
                      placeholder="/SYM/SYMnnn/LETTERSPECS/PinotPulse" className={inputClass} />
                  </FormField>
                )}
              </div>

              <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Upload size={16} className="text-blue-600" /> Batch File Extract
                  </h4>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.batchExtractEnabled} onChange={e => update('batchExtractEnabled', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> Enable
                  </label>
                </div>
                {formData.batchExtractEnabled && (
                  <FormField label="Extract Directory" hint="FTP/SFTP directory where Symitar exports batch files">
                    <input type="text" value={formData.extractDirectory} onChange={e => update('extractDirectory', e.target.value)}
                      className={inputClass} />
                  </FormField>
                )}
              </div>

              <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Server size={16} className="text-amber-600" /> ArchWizard (Optional)
                  </h4>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.archwizardEnabled} onChange={e => update('archwizardEnabled', e.target.checked)}
                      className="rounded border-gray-300 text-amber-600 focus:ring-blue-500" /> Enable
                  </label>
                </div>
                {formData.archwizardEnabled && (
                  <FormField label="ArchWizard Host" hint="For SQL-based reporting queries against Symitar data">
                    <input type="text" value={formData.archwizardHost} onChange={e => update('archwizardHost', e.target.value)}
                      placeholder="archwizard.yourcu.local" className={inputClass} />
                  </FormField>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Data Feed Selection</h3>
            <div className="space-y-3">
              {[
                { key: 'feedMembers', label: 'Members (Account Records)', table: 'members_realtime', desc: 'Name/tracking/share records. SymXchange: Account.Get' },
                { key: 'feedAccounts', label: 'Share Accounts', table: 'accounts_realtime', desc: 'All share types (savings, checking, money market). SymXchange: Share.Get' },
                { key: 'feedLoans', label: 'Loan Accounts', table: 'loans_realtime', desc: 'All loan types with payment schedules. SymXchange: Loan.Get' },
                { key: 'feedTransactions', label: 'Transaction History', table: 'transactions_realtime', desc: 'Share and loan transactions. SymXchange: ShareTransaction.Get + event streaming' },
                { key: 'feedShares', label: 'Share Certificates', table: 'certificates_realtime', desc: 'CDs and certificate details. SymXchange: Certificate.Get' },
                { key: 'feedCards', label: 'Card Records', table: 'cards_realtime', desc: 'Debit/credit card data. SymXchange: Card.Get' },
              ].map(feed => (
                <div key={feed.key} className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                  (formData as any)[feed.key] ? 'bg-violet-50/30 border-violet-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <input type="checkbox" checked={(formData as any)[feed.key]} onChange={e => update(feed.key, e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{feed.label}</p>
                      <span className="text-xs font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{feed.table}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{feed.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Sync Mode & Monitoring</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Sync Mode">
                <select value={formData.syncMode} onChange={e => update('syncMode', e.target.value)} className={inputClass}>
                  <option value="streaming">Streaming (SymXchange events → Kafka)</option>
                  <option value="batch">Batch (scheduled file extracts)</option>
                  <option value="hybrid">Hybrid (streaming + nightly batch reconciliation)</option>
                </select>
              </FormField>
              <FormField label="Kafka Topic Prefix" hint="Events published to {prefix}-{entity}">
                <input type="text" value={formData.kafkaTopic} onChange={e => update('kafkaTopic', e.target.value)} className={`${inputClass} font-mono`} />
              </FormField>
            </div>
            <div className="space-y-3">
              {[
                { key: 'enableHealthCheck', label: 'SymXchange Health Check', desc: 'Ping SymXchange every 60s' },
                { key: 'alertOnFailure', label: 'Alert on Sync Failure', desc: 'Notify on-call via configured channels. Error: CORE-SYNC-4001' },
              ].map(opt => (
                <div key={opt.key} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <input type="checkbox" checked={(formData as any)[opt.key]} onChange={e => update(opt.key, e.target.checked)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Review Symitar Configuration</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">SymXchange</h4>
                <p className="text-sm"><strong>Host:</strong> {formData.symxchangeHost || '—'}</p>
                <p className="text-sm"><strong>Port:</strong> {formData.symxchangePort}</p>
                <p className="text-sm"><strong>Auth:</strong> {formData.symxchangeUserId ? '✓' : '✗'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Features</h4>
                <p className="text-sm"><strong>PowerOn:</strong> {formData.powerOnEnabled ? '✓' : '✗'}</p>
                <p className="text-sm"><strong>Batch:</strong> {formData.batchExtractEnabled ? '✓' : '✗'}</p>
                <p className="text-sm"><strong>ArchWizard:</strong> {formData.archwizardEnabled ? '✓' : '✗'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Feeds</h4>
                {['feedMembers', 'feedAccounts', 'feedLoans', 'feedTransactions', 'feedCards'].map(k => (
                  <p key={k} className="text-sm">{(formData as any)[k] ? '✓' : '✗'} {k.replace('feed', '')}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <ArrowLeft size={16} /> {step === 0 ? 'Cancel' : 'Previous'}
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => {
              // Validate current step before advancing
              if (step === 0 && !formData.symxchangeHost) {
                alert('SymXchange Host is required before proceeding.');
                return;
              }
              setStep(step + 1);
            }}
              className="px-6 py-2.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={() => onSave(formData)}
              className="px-6 py-2.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
              <CheckCircle size={16} /> Save & Begin Testing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CORELATION KEYSTONE WIZARD
// ═══════════════════════════════════════════════════════════════════════════

function CorelationWizard({ onClose, onSave }: { onClose: () => void; onSave: (data: Record<string, any>) => void }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    apiBaseUrl: '', apiKey: '', apiSecret: '',
    webhookEnabled: true, webhookUrl: '', webhookSecret: '',
    feedMembers: true, feedAccounts: true, feedLoans: true, feedTransactions: true,
    syncMode: 'real-time',
    enableHealthCheck: true,
  });

  const steps: WizardStep[] = [
    { id: 'connection', title: 'REST API', description: 'KeyStone API connection' },
    { id: 'webhooks', title: 'Webhooks', description: 'Real-time event notifications' },
    { id: 'feeds', title: 'Data Feeds', description: 'Select data entities' },
    { id: 'review', title: 'Review & Test', description: 'Verify configuration' },
  ];

  const update = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));
  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-teal-600 to-cyan-700 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Database size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Corelation KeyStone Integration</h2>
              <p className="text-teal-200 text-sm mt-0.5">Modern RESTful API with webhook notifications for real-time events</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-sm px-3 py-1 rounded-lg hover:bg-white/10">✕ Close</button>
        </div>
      </div>

      <div className="px-8 py-6">
        <StepIndicator steps={steps} currentStep={step} onStepClick={setStep} />

        {step === 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">KeyStone REST API</h3>
            <InfoBox type="info">
              Corelation KeyStone provides a modern REST API with JSON responses. API credentials are issued through the Corelation partner portal. KeyStone uses API key + secret authentication.
            </InfoBox>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="API Base URL" required hint="Your KeyStone API endpoint">
                <input type="url" value={formData.apiBaseUrl} onChange={e => update('apiBaseUrl', e.target.value)}
                  placeholder="https://api.keystone.yourcu.com/v2" className={inputClass} />
              </FormField>
              <div />
              <FormField label="API Key" required>
                <input type="text" value={formData.apiKey} onChange={e => update('apiKey', e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="API Secret" required>
                <input type="password" value={formData.apiSecret} onChange={e => update('apiSecret', e.target.value)} className={inputClass} />
              </FormField>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Webhook Notifications</h3>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <input type="checkbox" checked={formData.webhookEnabled} onChange={e => update('webhookEnabled', e.target.checked)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Enable Webhook Notifications</p>
                <p className="text-xs text-gray-500">KeyStone will POST real-time events to your endpoint for new transactions, account changes, and member updates.</p>
              </div>
            </div>
            {formData.webhookEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Webhook URL" required hint="Pinot Pulse endpoint to receive KeyStone events">
                  <input type="url" value={formData.webhookUrl} onChange={e => update('webhookUrl', e.target.value)}
                    placeholder="https://your-pinot-pulse.com/api/v1/webhooks/keystone" className={inputClass} />
                </FormField>
                <FormField label="Webhook Signing Secret" hint="For HMAC-SHA256 verification of incoming webhooks">
                  <input type="password" value={formData.webhookSecret} onChange={e => update('webhookSecret', e.target.value)} className={inputClass} />
                </FormField>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Data Feeds</h3>
            <div className="space-y-3">
              {[
                { key: 'feedMembers', label: 'Persons / Members', desc: 'GET /persons — demographics, addresses, contact info' },
                { key: 'feedAccounts', label: 'Accounts', desc: 'GET /accounts — share and deposit accounts' },
                { key: 'feedLoans', label: 'Loans', desc: 'GET /loans — all loan types, balances, payment schedules' },
                { key: 'feedTransactions', label: 'Transactions', desc: 'GET /transactions — real-time via webhook + polling fallback' },
              ].map(feed => (
                <div key={feed.key} className={`flex items-start gap-4 p-4 rounded-lg border ${(formData as any)[feed.key] ? 'bg-teal-50/30 border-teal-200' : 'bg-gray-50 border-gray-200'}`}>
                  <input type="checkbox" checked={(formData as any)[feed.key]} onChange={e => update(feed.key, e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{feed.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{feed.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Review KeyStone Configuration</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">API</h4>
                <p className="text-sm"><strong>URL:</strong> {formData.apiBaseUrl || '—'}</p>
                <p className="text-sm"><strong>Auth:</strong> {formData.apiKey ? '✓' : '✗'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Webhooks</h4>
                <p className="text-sm"><strong>Enabled:</strong> {formData.webhookEnabled ? '✓' : '✗'}</p>
                <p className="text-sm"><strong>URL:</strong> {formData.webhookUrl ? '✓ Set' : '—'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Feeds</h4>
                {['feedMembers', 'feedAccounts', 'feedLoans', 'feedTransactions'].map(k => (
                  <p key={k} className="text-sm">{(formData as any)[k] ? '✓' : '✗'} {k.replace('feed', '')}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <ArrowLeft size={16} /> {step === 0 ? 'Cancel' : 'Previous'}
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={() => onSave(formData)}
              className="px-6 py-2.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
              <CheckCircle size={16} /> Save & Begin Testing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function IntegrationsPage() {
  const [activeWizard, setActiveWizard] = useState<string | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<Record<string, boolean>>({});
  const [configModal, setConfigModal] = useState<{ id: string; type: string; name: string; fields: any[] } | null>(null);
  const [configFormData, setConfigFormData] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const { data: integConfig, isLoading } = useQuery<any>({
    queryKey: ['admin-integrations'],
    queryFn: adminApi.getIntegrationConfig,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => adminApi.testIntegrationConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-integrations'] }),
  });

  const handleSave = (vendorId: string, formData?: Record<string, any>) => {
    // 1. Persist config to integration config API
    saveMutation.mutate(
      { id: vendorId, config: formData || {} },
      {
        onSuccess: () => {
          // 2. Store sensitive fields in credential vault — await and handle errors
          if (formData) {
            const sensitiveKeys = ['clientSecret', 'client_secret', 'password', 'soapPassword', 'apiKey', 'api_key', 'secret_key', 'webhookSecret', 'token', 'private_key'];
            const hasSensitive = sensitiveKeys.some(k => formData[k]);
            if (hasSensitive) {
              try {
                await adminApi.storeCredentials(vendorId, formData);
              } catch (err) {
                console.error('Vault storage failed:', err);
                // Notify user that credentials need attention
                if (typeof window !== 'undefined' && (window as any).__toast) {
                  (window as any).__toast.warning('Credential vault storage failed', 'Configuration was saved but credentials may need to be re-entered.');
                }
              }
            }
          }
          setSavedConfigs(prev => ({ ...prev, [vendorId]: true }));
          setActiveWizard(null);
        },
      }
    );
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, config }: { id: string; config: Record<string, string> }) =>
      adminApi.updateIntegrationConfig(id, { config }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-integrations'] });
      setConfigModal(null);
      setConfigFormData({});
    },
  });

  const handleConfigSave = () => {
    if (!configModal) return;
    // 1. Persist config to DB via admin API
    saveMutation.mutate(
      { id: configModal.id, config: configFormData },
      {
        onSuccess: () => {
          // 2. Store sensitive fields in credential vault (same as wizard handleSave)
          const sensitiveKeys = ['password', 'client_secret', 'api_key', 'api_secret', 'secret_access_key',
            'ssh_key', 'private_key', 'token', 'service_account_json', 'connection_string',
            'signing_key_path', 'key_path', 'certificate_path', 'consumer_key', 'security_token'];
          const hasSensitive = sensitiveKeys.some(k =>
            Object.keys(configFormData).some(fk => fk.toLowerCase().includes(k) && configFormData[fk])
          );
          if (hasSensitive) {
            adminApi.storeCredentials(configModal.id, configFormData).catch(err =>
              console.error('Vault storage failed (config still saved):', err)
            );
          }
          setSavedConfigs(prev => ({ ...prev, [configModal.id]: true }));
        },
      }
    );
  };

  // Determine actual status — API "configured"/"connected"/"available" mapped correctly
  const getActualStatus = (vendorId: string, apiStatus?: string): ConfigStatus => {
    if (savedConfigs[vendorId]) return 'configured';
    if (apiStatus === 'configured' || apiStatus === 'connected') return apiStatus as ConfigStatus;
    if (apiStatus === 'available') return 'not_configured'; // "available" means installable but not yet configured
    return 'not_configured';
  };

  // Derive data feed status from actual backend state
  const getFeedStatus = (vendorId: string): 'pending' | 'active' | 'error' | 'not_configured' => {
    const vendorStatus = getActualStatus(vendorId, integConfig?.core_banking?.find((c: any) => c.id === vendorId)?.status);
    if (vendorStatus === 'connected') return 'active';
    if (vendorStatus === 'configured') return 'pending';
    return 'not_configured';
  };

  const buildFeeds = (vendorId: string, feeds: Array<{ id: string; name: string; table: string; syncMode: 'real-time' | 'streaming' }>) => {
    const feedStatus = getFeedStatus(vendorId);
    const vendorData = integConfig?.core_banking?.find((c: any) => c.id === vendorId);
    return feeds.map(f => ({
      ...f,
      status: feedStatus as 'pending' | 'active' | 'error' | 'not_configured',
      recordCount: vendorData?.record_counts?.[f.id] ?? null,
      lastSync: vendorData?.last_sync_at ?? null,
    }));
  };

  const coreBankingVendors = [
    {
      id: 'fiserv-dna', name: 'Fiserv DNA', vendor: 'Fiserv',
      desc: 'Full-service core banking platform. REST API v11+, SOAP/WSDL, and Event Hub streaming.',
      connectionMethods: ['REST API (v11)', 'SOAP/WSDL', 'Event Hub', 'ODBC'],
      gradient: 'from-sky-500 to-blue-600',
      status: getActualStatus('fiserv-dna', integConfig?.core_banking?.find((c: any) => c.id === 'fiserv-dna')?.status),
      dataFeeds: buildFeeds('fiserv-dna', [
        { id: 'members', name: 'Members', table: 'members_realtime', syncMode: 'real-time' as const },
        { id: 'accounts', name: 'Accounts', table: 'accounts_realtime', syncMode: 'real-time' as const },
        { id: 'loans', name: 'Loans', table: 'loans_realtime', syncMode: 'real-time' as const },
        { id: 'transactions', name: 'Transactions', table: 'transactions_realtime', syncMode: 'real-time' as const },
      ]),
    },
    {
      id: 'jack-henry-symitar', name: 'Jack Henry Symitar', vendor: 'Jack Henry',
      desc: 'Credit union core via SymXchange API, PowerOn spectra, and batch file extracts.',
      connectionMethods: ['SymXchange API', 'PowerOn', 'Batch Extract', 'ArchWizard'],
      gradient: 'from-amber-500 to-yellow-600',
      status: getActualStatus('jack-henry-symitar', integConfig?.core_banking?.find((c: any) => c.id === 'jack-henry-symitar')?.status),
      dataFeeds: buildFeeds('jack-henry-symitar', [
        { id: 'members', name: 'Members', table: 'members_realtime', syncMode: 'real-time' as const },
        { id: 'accounts', name: 'Share Accounts', table: 'accounts_realtime', syncMode: 'real-time' as const },
        { id: 'loans', name: 'Loans', table: 'loans_realtime', syncMode: 'real-time' as const },
        { id: 'transactions', name: 'Transactions', table: 'transactions_realtime', syncMode: 'streaming' as const },
      ]),
    },
    {
      id: 'corelation-keystone', name: 'Corelation KeyStone', vendor: 'Corelation',
      desc: 'Modern cloud-native core with RESTful API and webhook notifications.',
      connectionMethods: ['REST API (v2)', 'Webhooks', 'Bulk Export'],
      gradient: 'from-teal-500 to-cyan-600',
      status: getActualStatus('corelation-keystone', integConfig?.core_banking?.find((c: any) => c.id === 'corelation-keystone')?.status),
      dataFeeds: buildFeeds('corelation-keystone', [
        { id: 'persons', name: 'Persons', table: 'members_realtime', syncMode: 'real-time' as const },
        { id: 'accounts', name: 'Accounts', table: 'accounts_realtime', syncMode: 'real-time' as const },
        { id: 'loans', name: 'Loans', table: 'loans_realtime', syncMode: 'real-time' as const },
        { id: 'transactions', name: 'Transactions', table: 'transactions_realtime', syncMode: 'real-time' as const },
      ]),
    },
  ];

  // Streaming & infrastructure — show actual API data when available
  const kafkaConfig = integConfig?.streaming?.find((s: any) => s.id === 'kafka');
  const pinotConfig = integConfig?.pinot;
  const warehouseConfig = integConfig?.data_warehouses?.find((d: any) => d.id === 'postgres');
  
  // All dynamic categories from API
  const dataWarehouses = integConfig?.data_warehouses?.filter((d: any) => d.id !== 'postgres') || [];
  const streamingPlatforms = integConfig?.streaming?.filter((s: any) => s.id !== 'kafka') || [];
  const cloudStorage = integConfig?.cloud_storage || [];
  const orchestrationTools = integConfig?.orchestration || [];
  const digitalBanking = integConfig?.digital_banking || [];
  const cardProcessing = integConfig?.card_processing || [];
  const crmTools = integConfig?.crm || [];
  const databases = integConfig?.databases || [];

  const openCatalogConfig = (item: any) => {
    if (!item.config_schema) return;
    const fields = Object.entries(item.config_schema).map(([key, val]: [string, any]) => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      type: val?.type === 'textarea' || key.includes('json') ? 'textarea' :
            val?.type === 'password' || key.includes('password') || key.includes('secret') || key.includes('api_key') || key.includes('token') || key.includes('ssh_key') ? 'password' : 'text',
      placeholder: val?.description || val?.default || '',
      required: val?.required === true,
    }));
    setConfigFormData({});
    setConfigModal({ id: item.id, type: item.type || item.category || 'integration', name: item.name, fields });
  };

  const pendingCount = coreBankingVendors.filter(v => v.status === 'not_configured').length;
  const configuredCount = coreBankingVendors.filter(v => v.status === 'configured' || v.status === 'connected').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600">
              <Database size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Enterprise Integrations</h1>
              <p className="text-sm text-gray-500">
                {configuredCount > 0
                  ? `${configuredCount} core banking configured · Data warehouses & orchestration available`
                  : 'Configure core banking, data warehouses, and orchestration tools'
                }
              </p>
            </div>
          </div>
          <Link href="/admin/console" className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <Settings size={14} /> Admin Console
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8">
        {/* Active wizard */}
        {activeWizard && (
          <div className="mb-8">
            {activeWizard === 'fiserv-dna' && <FiservDNAWizard onClose={() => setActiveWizard(null)} onSave={(data) => handleSave('fiserv-dna', data)} />}
            {activeWizard === 'jack-henry-symitar' && <SymitarWizard onClose={() => setActiveWizard(null)} onSave={(data) => handleSave('jack-henry-symitar', data)} />}
            {activeWizard === 'corelation-keystone' && <CorelationWizard onClose={() => setActiveWizard(null)} onSave={(data) => handleSave('corelation-keystone', data)} />}
          </div>
        )}

        {!activeWizard && (
          <div className="space-y-8">
            {/* Pending configuration banner */}
            {pendingCount === 3 && (
              <PendingBanner
                title="No Core Banking System Configured"
                message="Pinot Pulse requires at least one core banking integration to populate dashboards with real data. Without a configured connection, all analytics pages will show placeholder data. Select your core banking vendor below to begin setup."
                actionLabel="Start Configuration"
                onAction={() => {}}
              />
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Core Banking</span>
                  <StatusBadge status={configuredCount > 0 ? 'connected' : 'not_configured'} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{configuredCount}/3</p>
                <p className="text-xs text-gray-500 mt-1">vendors configured</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Kafka</span>
                  <StatusBadge status={kafkaConfig?.status || 'not_configured'} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{kafkaConfig?.throughput_eps || '—'}</p>
                <p className="text-xs text-gray-500 mt-1">{kafkaConfig ? 'events/sec' : 'not streaming'}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Pinot</span>
                  <StatusBadge status={pinotConfig?.status === 'connected' ? 'connected' : 'not_configured'} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{pinotConfig?.avg_query_latency_ms ? `${pinotConfig.avg_query_latency_ms}ms` : '—'}</p>
                <p className="text-xs text-gray-500 mt-1">{pinotConfig ? `${pinotConfig.tables} tables` : 'not connected'}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Database</span>
                  <StatusBadge status={warehouseConfig?.status === 'active' ? 'connected' : 'not_configured'} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{warehouseConfig?.size_gb ? `${warehouseConfig.size_gb} GB` : '—'}</p>
                <p className="text-xs text-gray-500 mt-1">{warehouseConfig ? `${warehouseConfig.tables} tables` : 'not connected'}</p>
              </div>
            </div>

            {/* Integration Catalog Overview */}
            {(() => {
              const allCatalog = [
                ...streamingPlatforms, ...dataWarehouses,
                ...cloudStorage, ...orchestrationTools, ...digitalBanking, ...cardProcessing, ...crmTools, ...databases
              ];
              const configuredTotal = allCatalog.filter((i: any) => i.status === 'configured' || i.status === 'connected').length;
              return allCatalog.length > 0 ? (
                <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-gray-500"><strong className="text-gray-900">{allCatalog.length}</strong> integrations available</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-500"><strong className="text-emerald-600">{configuredTotal}</strong> configured</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-500"><strong className="text-amber-600">{allCatalog.length - configuredTotal}</strong> pending</span>
                  </div>
                  <span className="text-xs text-gray-400">Streaming · Warehouses · Storage · Orchestration · Digital Banking · Cards · CRM · Databases</span>
                </div>
              ) : null;
            })()}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Database size={20} className="text-blue-600" /> Core Banking Connectors
              </h2>
              <div className="space-y-6">
                {coreBankingVendors.map(vendor => (
                  <div key={vendor.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className={`bg-gradient-to-r ${vendor.gradient} px-6 py-4`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Database size={20} className="text-white" />
                          <div>
                            <h3 className="text-base font-bold text-white">{vendor.name}</h3>
                            <p className="text-white/70 text-xs mt-0.5">{vendor.connectionMethods.join(' · ')}</p>
                          </div>
                        </div>
                        <StatusBadge status={vendor.status} large />
                      </div>
                    </div>

                    <div className="p-6">
                      <p className="text-sm text-gray-600 mb-4">{vendor.desc}</p>

                      {/* Show pending warning if not configured */}
                      {vendor.status === 'not_configured' && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                          <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
                          <p className="text-sm text-amber-800">
                            <strong>Pending Configuration</strong> — This integration has not been configured. Data feeds are inactive and dashboard data for this source is unavailable.
                          </p>
                        </div>
                      )}

                      {vendor.status === 'configured' && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                          <Info size={16} className="text-blue-600 flex-shrink-0" />
                          <p className="text-sm text-blue-800">
                            <strong>Configuration Saved</strong> — Run &quot;Test Connection&quot; to verify credentials and activate data feeds.
                          </p>
                        </div>
                      )}

                      {/* Data feeds table */}
                      <div className="mb-5">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Data Feeds</h4>
                        <DataFeedTable feeds={vendor.dataFeeds} isPending={vendor.status === 'not_configured'} />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button onClick={() => setActiveWizard(vendor.id)}
                          className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                            vendor.status === 'not_configured'
                              ? `bg-gradient-to-r ${vendor.gradient} text-white hover:opacity-90`
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}>
                          <Settings size={14} /> {vendor.status === 'not_configured' ? 'Configure Integration' : 'Edit Configuration'}
                        </button>
                        {(vendor.status === 'configured' || vendor.status === 'connected') && (
                          <button onClick={() => testMutation.mutate(vendor.id)}
                            disabled={testMutation.isPending}
                            className="px-4 py-2.5 text-sm font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-2">
                            {testMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            Test Connection
                          </button>
                        )}
                        {vendor.status === 'not_configured' && (
                          <span className="text-xs text-gray-400 italic">Test Connection available after configuration</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Pipeline Status */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Layers size={20} className="text-indigo-600" /> Data Pipeline Infrastructure
              </h2>
              <div className="grid grid-cols-3 gap-6">
                {/* Kafka */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-50 rounded-lg"><Radio size={18} className="text-emerald-600" /></div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Apache Kafka</h4>
                      <StatusBadge status={kafkaConfig?.status || 'not_configured'} />
                    </div>
                  </div>
                  {kafkaConfig ? (
                    <div className="space-y-2 text-sm">
                      <p><strong>Brokers:</strong> <span className="font-mono text-xs">{kafkaConfig.brokers}</span></p>
                      <p><strong>Topics:</strong> {kafkaConfig.topics?.join(', ')}</p>
                      <p><strong>Consumer Lag:</strong> {kafkaConfig.consumer_lag}</p>
                      <p><strong>Throughput:</strong> {kafkaConfig.throughput_eps} events/sec</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Kafka not configured. Required for real-time streaming.</p>
                  )}
                </div>

                {/* Pinot */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg"><Zap size={18} className="text-blue-600" /></div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Apache Pinot</h4>
                      <StatusBadge status={pinotConfig?.status === 'connected' ? 'connected' : 'not_configured'} />
                    </div>
                  </div>
                  {pinotConfig ? (
                    <div className="space-y-2 text-sm">
                      <p><strong>Controller:</strong> <span className="font-mono text-xs">{pinotConfig.controller}</span></p>
                      <p><strong>Tables:</strong> {pinotConfig.tables} ({pinotConfig.segments} segments)</p>
                      <p><strong>Ingestion:</strong> {pinotConfig.ingestion_mode}</p>
                      <p><strong>Avg Latency:</strong> {pinotConfig.avg_query_latency_ms}ms</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Pinot not connected. Required for real-time analytics.</p>
                  )}
                </div>

                {/* PostgreSQL */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-50 rounded-lg"><HardDrive size={18} className="text-purple-600" /></div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">PostgreSQL</h4>
                      <StatusBadge status={warehouseConfig?.status === 'active' ? 'connected' : 'not_configured'} />
                    </div>
                  </div>
                  {warehouseConfig ? (
                    <div className="space-y-2 text-sm">
                      <p><strong>Status:</strong> {warehouseConfig.status}</p>
                      <p><strong>Tables:</strong> {warehouseConfig.tables}</p>
                      <p><strong>Size:</strong> {warehouseConfig.size_gb} GB</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Database not configured.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Dynamic Integration Categories */}
            <CategorySection
              category="streaming" items={streamingPlatforms} color="emerald"
              icon={<Radio size={20} />} label="Streaming Platforms (Confluent, Kinesis, Event Hubs, Pub/Sub)"
              onConfigure={openCatalogConfig} onTest={(id) => testMutation.mutate(id)} testPending={testMutation.isPending}
            />

            <CategorySection
              category="data_warehouse" items={dataWarehouses} color="sky"
              icon={<Cloud size={20} />} label="Data Warehouses"
              onConfigure={openCatalogConfig} onTest={(id) => testMutation.mutate(id)} testPending={testMutation.isPending}
            />

            <CategorySection
              category="cloud_storage" items={cloudStorage} color="amber"
              icon={<HardDrive size={20} />} label="Cloud Storage"
              onConfigure={openCatalogConfig} onTest={(id) => testMutation.mutate(id)} testPending={testMutation.isPending}
            />

            <CategorySection
              category="orchestration" items={orchestrationTools} color="violet"
              icon={<GitBranch size={20} />} label="Orchestration & Data Pipelines"
              onConfigure={openCatalogConfig} onTest={(id) => testMutation.mutate(id)} testPending={testMutation.isPending}
            />

            <CategorySection
              category="digital_banking" items={digitalBanking} color="cyan"
              icon={<Globe size={20} />} label="Digital Banking"
              onConfigure={openCatalogConfig} onTest={(id) => testMutation.mutate(id)} testPending={testMutation.isPending}
            />

            <CategorySection
              category="card_processing" items={cardProcessing} color="pink"
              icon={<Shield size={20} />} label="Card Processing"
              onConfigure={openCatalogConfig} onTest={(id) => testMutation.mutate(id)} testPending={testMutation.isPending}
            />

            <CategorySection
              category="crm" items={crmTools} color="fuchsia"
              icon={<Activity size={20} />} label="CRM"
              onConfigure={openCatalogConfig} onTest={(id) => testMutation.mutate(id)} testPending={testMutation.isPending}
            />

            <CategorySection
              category="databases" items={databases} color="indigo"
              icon={<Database size={20} />} label="Additional Databases"
              onConfigure={openCatalogConfig} onTest={(id) => testMutation.mutate(id)} testPending={testMutation.isPending}
            />
          </div>
        )}
      </div>

      {/* Configuration Modal for Data Warehouses & Orchestration */}
      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfigModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                {CATEGORY_META[configModal.type]?.icon || <Plug size={20} className="text-gray-600" />}
                <div>
                  <h3 className="text-base font-bold text-gray-900">Configure {configModal.name}</h3>
                  <p className="text-xs text-gray-500">{CATEGORY_META[configModal.type]?.label || configModal.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} Integration</p>
                </div>
              </div>
              <button onClick={() => setConfigModal(null)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {configModal.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  {field.type === 'textarea' || field.key.includes('json') ? (
                    <textarea
                      value={configFormData[field.key] || ''}
                      onChange={(e) => setConfigFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                      rows={4}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono text-xs"
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={configFormData[field.key] || ''}
                      onChange={(e) => setConfigFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
              <button onClick={() => setConfigModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => testMutation.mutate(configModal.id)} disabled={testMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center gap-1.5">
                  {testMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Test Connection
                </button>
                <button onClick={handleConfigSave} disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:opacity-90 flex items-center gap-1.5">
                  {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
