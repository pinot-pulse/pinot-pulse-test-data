'use client';

/**
 * Pinot Pulse Enterprise — Super Admin Console
 * Route: /superadmin
 *
 * ISOLATION: This console has ZERO access to organization data, dashboards,
 * or member information. The super admin can only:
 *   - Onboard new organizations
 *   - Provision Product Admin and Org Admin accounts
 *   - Configure deployment (on-prem / cloud)
 *   - Monitor platform health (aggregate only, no org data)
 *   - Manage license keys and entitlements
 *
 * All org-specific data is invisible to this role by middleware enforcement.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import {
  Building2, UserPlus, Shield, Server, Key, ChevronRight,
  CheckCircle, Clock, AlertCircle, WifiOff, Settings, Users,
  Globe, HardDrive, ArrowRight, ArrowLeft, Lock, Eye,
  Activity, Cpu, Database, Layers, Info, Zap, RefreshCw,
  LogOut, XCircle, BarChart3, FileText, AlertTriangle
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type ConfigStatus = 'not_configured' | 'pending' | 'active' | 'error' | 'suspended';
type DeploymentMode = 'cloud' | 'on_premise' | 'hybrid';

interface OnboardOrg {
  name: string;
  charterNumber: string;
  orgType: string;
  deploymentMode: DeploymentMode;
  region: string;
  productAdminEmail: string;
  productAdminName: string;
  orgAdminEmail: string;
  orgAdminName: string;
  licenseKey: string;
  licenseTier: string;
  maxUsers: string;
  // Performance
  cpuCores: string;
  memoryGB: string;
  storageGB: string;
  pinotClusterSize: string;
  kafkaBrokers: string;
  // Capacity
  maxMembers: string;
  maxTransactionsPerDay: string;
  maxConcurrentUsers: string;
  dataRetentionDays: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: ConfigStatus | string }) {
  const m: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
    not_configured: { bg: 'bg-gray-50 text-gray-500 border-gray-200', icon: <WifiOff size={12} />, label: 'Not Set Up' },
    pending: { bg: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Clock size={12} />, label: 'Pending' },
    active: { bg: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle size={12} />, label: 'Active' },
    error: { bg: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle size={12} />, label: 'Error' },
    suspended: { bg: 'bg-gray-100 text-gray-500 border-gray-200', icon: <Lock size={12} />, label: 'Suspended' },
    provisioned: { bg: 'bg-blue-50 text-blue-600 border-blue-200', icon: <UserPlus size={12} />, label: 'Provisioned' },
  };
  const s = m[status] || m.not_configured;
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${s.bg}`}>{s.icon} {s.label}</span>;
}

function InfoBox({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const s: Record<string, string> = { info: 'bg-blue-50 border-blue-200 text-blue-700', warning: 'bg-amber-50 border-amber-200 text-amber-700', success: 'bg-emerald-50 border-emerald-200 text-emerald-700' };
  const icons: Record<string, React.ReactNode> = { info: <Info size={16} />, warning: <AlertCircle size={16} />, success: <CheckCircle size={16} /> };
  return <div className={`flex items-start gap-3 p-4 rounded-xl border ${s[type]}`}><span className="mt-0.5 flex-shrink-0">{icons[type]}</span><div className="text-sm">{children}</div></div>;
}

function FormField({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">{label} {required && <span className="text-red-400">*</span>}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const inputClass = "w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-blue-400 transition-colors";

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING WIZARD
// ═══════════════════════════════════════════════════════════════════════════

function OnboardingWizard({ onClose, onComplete }: { onClose: () => void; onComplete: (org: OnboardOrg) => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardOrg>({
    name: '', charterNumber: '', orgType: 'credit_union',
    deploymentMode: 'cloud', region: 'us-east-1',
    productAdminEmail: '', productAdminName: '',
    orgAdminEmail: '', orgAdminName: '',
    licenseKey: '', licenseTier: 'enterprise', maxUsers: '100',
    cpuCores: '8', memoryGB: '32', storageGB: '500',
    pinotClusterSize: '3', kafkaBrokers: '3',
    maxMembers: '100000', maxTransactionsPerDay: '500000',
    maxConcurrentUsers: '200', dataRetentionDays: '2555',
  });

  const steps = [
    { id: 'org', title: 'Organization', desc: 'Basic details' },
    { id: 'admins', title: 'Admin Users', desc: 'Provision admins' },
    { id: 'deployment', title: 'Deployment', desc: 'Infrastructure' },
    { id: 'performance', title: 'Performance', desc: 'Server sizing' },
    { id: 'capacity', title: 'Capacity', desc: 'Limits and quotas' },
    { id: 'license', title: 'License', desc: 'Entitlements' },
    { id: 'review', title: 'Review', desc: 'Confirm and provision' },
  ];

  const u = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-yellow-600 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
              <Building2 size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Onboard New Organization</h2>
              <p className="text-amber-200 text-sm mt-0.5">Provision Product Admin + Org Admin + Infrastructure</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">✕ Close</button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="px-8 pt-6">
        <div className="flex items-center gap-1 mb-8 flex-wrap">
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              <button onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                  i === step ? 'bg-blue-50 text-blue-600 font-semibold border border-blue-200' :
                  i < step ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-pointer hover:bg-emerald-100' :
                  'bg-gray-50 text-gray-400 border border-gray-100'
                }`} disabled={i > step}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === step ? 'bg-blue-500 text-white' : i < step ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-white'
                }`}>{i < step ? '✓' : i + 1}</span>
                <span className="hidden lg:inline">{s.title}</span>
              </button>
              {i < steps.length - 1 && <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="px-8 pb-8">
        {/* Step 1: Organization */}
        {step === 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Organization Details</h3>
            <InfoBox type="info">The organization details are used for licensing and regulatory mapping only. The Super Admin does not have access to any organization member data, account data, or operational screens.</InfoBox>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Organization Name" required hint="Legal entity name">
                <input type="text" value={form.name} onChange={e => u('name', e.target.value)} placeholder="Sunrise Federal Credit Union" className={inputClass} />
              </FormField>
              <FormField label="Charter Number" required hint="NCUA charter # or FDIC certificate #">
                <input type="text" value={form.charterNumber} onChange={e => u('charterNumber', e.target.value)} placeholder="12345" className={inputClass} />
              </FormField>
              <FormField label="Organization Type" required>
                <select value={form.orgType} onChange={e => u('orgType', e.target.value)} className={inputClass}>
                  <option value="credit_union">Credit Union (NCUA-insured)</option>
                  <option value="bank">Bank (FDIC-insured)</option>
                  <option value="cdfi">CDFI</option>
                  <option value="fintech">Fintech / Neobank</option>
                </select>
              </FormField>
            </div>
          </div>
        )}

        {/* Step 2: Admin Users */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Provision Administrator Accounts</h3>
            <InfoBox type="warning">
              <strong>Two admin accounts will be created:</strong> The Product Admin manages all product configuration (integrations, regulatory, AI chat, audits, performance, capacity). The Org Admin manages organization users, dashboards, and day-to-day operations. These roles are completely isolated — neither can access the other&apos;s screens.
            </InfoBox>

            <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-4">
              <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <Settings size={16} /> Product Admin
              </h4>
              <p className="text-xs text-blue-600">Access: /admin/* — Integrations, Regulatory Config, AI Chat, Audit Reports, Performance, Capacity, Error Framework. No access to organization dashboards or member data.</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Full Name" required>
                  <input type="text" value={form.productAdminName} onChange={e => u('productAdminName', e.target.value)} placeholder="John Smith" className={inputClass} />
                </FormField>
                <FormField label="Email" required hint="Invitation with temporary password sent here">
                  <input type="email" value={form.productAdminEmail} onChange={e => u('productAdminEmail', e.target.value)} placeholder="product-admin@org.com" className={inputClass} />
                </FormField>
              </div>
            </div>

            <div className="p-5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-4">
              <h4 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                <Users size={16} /> Organization Admin
              </h4>
              <p className="text-xs text-emerald-600">Access: /dashboard/* — All dashboards, member data, user management, reports, compliance screens. No access to product configuration or server settings.</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Full Name" required>
                  <input type="text" value={form.orgAdminName} onChange={e => u('orgAdminName', e.target.value)} placeholder="Jane Doe" className={inputClass} />
                </FormField>
                <FormField label="Email" required hint="Invitation with temporary password sent here">
                  <input type="email" value={form.orgAdminEmail} onChange={e => u('orgAdminEmail', e.target.value)} placeholder="org-admin@org.com" className={inputClass} />
                </FormField>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Deployment */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Deployment Configuration</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { val: 'cloud', icon: <Globe size={20} />, title: 'Cloud (Managed)', desc: 'Pinot Pulse managed infrastructure. Auto-scaling, backups, updates.' },
                { val: 'on_premise', icon: <HardDrive size={20} />, title: 'On-Premises', desc: 'Deployed in your data center. Full control, your security perimeter.' },
                { val: 'hybrid', icon: <Layers size={20} />, title: 'Hybrid', desc: 'Core on-prem, analytics in cloud. Best of both.' },
              ].map(opt => (
                <button key={opt.val} onClick={() => u('deploymentMode', opt.val)}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    form.deploymentMode === opt.val ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <div className={`mb-3 ${form.deploymentMode === opt.val ? 'text-blue-500' : 'text-gray-400'}`}>{opt.icon}</div>
                  <p className="text-sm font-semibold text-gray-800">{opt.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
            {form.deploymentMode !== 'cloud' && (
              <InfoBox type="warning">On-premises and hybrid deployments require the Product Admin to configure server endpoints, SSL certificates, and network connectivity after onboarding. The Product Admin will see &quot;Pending Configuration&quot; on all infrastructure screens until setup is complete.</InfoBox>
            )}
            <FormField label="Region" hint="Primary data center region for compliance (data residency)">
              <select value={form.region} onChange={e => u('region', e.target.value)} className={inputClass}>
                <option value="us-east-1">US East (Virginia)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="us-central-1">US Central (Iowa)</option>
                <option value="on-prem">On-Premises (Customer DC)</option>
              </select>
            </FormField>
          </div>
        )}

        {/* Step 4: Performance */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Performance & Server Sizing</h3>
            <InfoBox type="info">These are the initial resource allocations. The Product Admin can adjust these after onboarding from the Performance &amp; Capacity screens in their admin console.</InfoBox>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="CPU Cores" required hint="Recommended: 8+ for production">
                <select value={form.cpuCores} onChange={e => u('cpuCores', e.target.value)} className={inputClass}>
                  <option value="4">4 cores (development)</option>
                  <option value="8">8 cores (small CU, &lt;50K members)</option>
                  <option value="16">16 cores (medium CU, 50K-200K members)</option>
                  <option value="32">32 cores (large CU, 200K+ members)</option>
                  <option value="64">64 cores (enterprise)</option>
                </select>
              </FormField>
              <FormField label="Memory (GB)" required>
                <select value={form.memoryGB} onChange={e => u('memoryGB', e.target.value)} className={inputClass}>
                  <option value="16">16 GB (development)</option>
                  <option value="32">32 GB (small)</option>
                  <option value="64">64 GB (medium)</option>
                  <option value="128">128 GB (large)</option>
                  <option value="256">256 GB (enterprise)</option>
                </select>
              </FormField>
              <FormField label="Storage (GB)" required hint="SSD recommended for Pinot segments">
                <select value={form.storageGB} onChange={e => u('storageGB', e.target.value)} className={inputClass}>
                  <option value="250">250 GB</option>
                  <option value="500">500 GB</option>
                  <option value="1000">1 TB</option>
                  <option value="2000">2 TB</option>
                  <option value="5000">5 TB</option>
                </select>
              </FormField>
              <FormField label="Apache Pinot Cluster Nodes" hint="Minimum 3 for HA">
                <select value={form.pinotClusterSize} onChange={e => u('pinotClusterSize', e.target.value)} className={inputClass}>
                  <option value="1">1 node (development)</option>
                  <option value="3">3 nodes (HA minimum)</option>
                  <option value="6">6 nodes (production)</option>
                  <option value="12">12 nodes (enterprise)</option>
                </select>
              </FormField>
              <FormField label="Kafka Brokers" hint="Minimum 3 for production">
                <select value={form.kafkaBrokers} onChange={e => u('kafkaBrokers', e.target.value)} className={inputClass}>
                  <option value="1">1 broker (development)</option>
                  <option value="3">3 brokers (production)</option>
                  <option value="6">6 brokers (high throughput)</option>
                </select>
              </FormField>
            </div>
          </div>
        )}

        {/* Step 5: Capacity */}
        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Capacity Limits & Quotas</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Max Members" hint="Total member records the system will support">
                <input type="number" value={form.maxMembers} onChange={e => u('maxMembers', e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Max Transactions/Day" hint="Daily transaction volume limit">
                <input type="number" value={form.maxTransactionsPerDay} onChange={e => u('maxTransactionsPerDay', e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Max Concurrent Users" hint="Simultaneous active sessions">
                <input type="number" value={form.maxConcurrentUsers} onChange={e => u('maxConcurrentUsers', e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Data Retention (days)" hint="2555 = 7 years (NCUA recommended)">
                <select value={form.dataRetentionDays} onChange={e => u('dataRetentionDays', e.target.value)} className={inputClass}>
                  <option value="1825">1825 days (5 years — BSA minimum)</option>
                  <option value="2555">2555 days (7 years — NCUA recommended)</option>
                  <option value="3650">3650 days (10 years — conservative)</option>
                </select>
              </FormField>
              <FormField label="Max Users (license)" hint="Total user accounts allowed">
                <input type="number" value={form.maxUsers} onChange={e => u('maxUsers', e.target.value)} className={inputClass} />
              </FormField>
            </div>
          </div>
        )}

        {/* Step 6: License */}
        {step === 5 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">License & Entitlements</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="License Tier" required>
                <select value={form.licenseTier} onChange={e => u('licenseTier', e.target.value)} className={inputClass}>
                  <option value="starter">Starter (up to 25K members, 25 users)</option>
                  <option value="professional">Professional (up to 100K members, 100 users)</option>
                  <option value="enterprise">Enterprise (unlimited members, 500 users)</option>
                </select>
              </FormField>
              <FormField label="License Key" hint="Generated by Pinot Pulse licensing server">
                <input type="text" value={form.licenseKey} onChange={e => u('licenseKey', e.target.value)} placeholder="PP-ENT-XXXX-XXXX-XXXX" className={inputClass} />
              </FormField>
            </div>
          </div>
        )}

        {/* Step 7: Review */}
        {step === 6 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Review & Provision</h3>
            <InfoBox type="success">
              After provisioning, both admins receive email invitations with temporary passwords. The Product Admin will see all product configuration screens in &quot;Pending Configuration&quot; state. The Org Admin will see all dashboards in their default state, with data populating as the Product Admin completes integrations.
            </InfoBox>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Organization</h4>
                <p className="text-sm"><span className="text-gray-400">Name:</span> <strong>{form.name || '—'}</strong></p>
                <p className="text-sm"><span className="text-gray-400">Charter:</span> {form.charterNumber || '—'}</p>
                <p className="text-sm"><span className="text-gray-400">Type:</span> {form.orgType.replace('_', ' ')}</p>
                <p className="text-sm"><span className="text-gray-400">Deploy:</span> {form.deploymentMode.replace('_', '-')}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Admin Users</h4>
                <p className="text-sm"><span className="text-gray-400">Product Admin:</span> {form.productAdminName || '—'}</p>
                <p className="text-xs text-gray-400">{form.productAdminEmail}</p>
                <p className="text-sm mt-2"><span className="text-gray-400">Org Admin:</span> {form.orgAdminName || '—'}</p>
                <p className="text-xs text-gray-400">{form.orgAdminEmail}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Infrastructure</h4>
                <p className="text-sm"><span className="text-gray-400">CPU:</span> {form.cpuCores} cores</p>
                <p className="text-sm"><span className="text-gray-400">Memory:</span> {form.memoryGB} GB</p>
                <p className="text-sm"><span className="text-gray-400">Pinot:</span> {form.pinotClusterSize} nodes</p>
                <p className="text-sm"><span className="text-gray-400">License:</span> {form.licenseTier}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Post-Provisioning Workflow</h4>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg font-semibold">1. Provision</span>
                <ChevronRight size={12} className="text-gray-300" />
                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg font-semibold">2. Product Admin configures integrations</span>
                <ChevronRight size={12} className="text-gray-300" />
                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg font-semibold">3. Product Admin configures regulatory</span>
                <ChevronRight size={12} className="text-gray-300" />
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-semibold">4. Org Admin manages operations</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
          <button onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            className="px-4 py-2.5 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 flex items-center gap-2 transition-colors">
            <ArrowLeft size={16} /> {step === 0 ? 'Cancel' : 'Previous'}
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 text-sm font-medium bg-blue-500 text-white rounded-xl hover:bg-blue-600 flex items-center gap-2 transition-colors">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={() => onComplete(form)}
              className="px-6 py-2.5 text-sm font-medium bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 flex items-center gap-2 transition-colors">
              <CheckCircle size={16} /> Provision Organization
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SUPER ADMIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function SuperAdminPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [orgs, setOrgs] = useState<Array<{ name: string; status: ConfigStatus; charterNumber: string; productAdmin: string; orgAdmin: string; deploymentMode: string; provisionedAt: string }>>([]);
  const [provisionError, setProvisionError] = useState('');
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  const loadOrgs = useCallback(async () => {
    try {
      setLoadingOrgs(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/v1/tenant-admin/tenants', { headers });
      if (res.ok) {
        const data = await res.json();
        const tenants = data.tenants || data || [];
        if (Array.isArray(tenants) && tenants.length > 0) {
          setOrgs(tenants.map((t: any) => ({
            name: t.name || t.display_name || 'Unknown',
            status: (t.status || (t.onboarding_completed ? 'active' : 'pending')) as ConfigStatus,
            charterNumber: t.charter_number || '',
            productAdmin: t.product_admin_email || '',
            orgAdmin: t.org_admin_email || '',
            deploymentMode: t.deployment_mode || 'cloud',
            provisionedAt: t.created_at || '',
          })));
        }
      }
    } catch {
      // Silent — endpoint may not exist yet
    }
    setLoadingOrgs(false);
  }, []);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  const handleComplete = async (orgData: OnboardOrg) => {
    setProvisionError('');
    try {
      await adminApi.updateSystemConfig({
        action: 'provision_organization',
        organization: {
          name: orgData.name,
          charter_number: orgData.charterNumber,
          org_type: orgData.orgType,
          deployment_mode: orgData.deploymentMode,
          region: orgData.region,
          license_key: orgData.licenseKey,
          license_tier: orgData.licenseTier,
          max_users: parseInt(orgData.maxUsers),
          resources: {
            cpu_cores: parseInt(orgData.cpuCores),
            memory_gb: parseInt(orgData.memoryGB),
            storage_gb: parseInt(orgData.storageGB),
            pinot_cluster_size: parseInt(orgData.pinotClusterSize),
            kafka_brokers: parseInt(orgData.kafkaBrokers),
          },
          limits: {
            max_members: parseInt(orgData.maxMembers),
            max_transactions_per_day: parseInt(orgData.maxTransactionsPerDay),
            max_concurrent_users: parseInt(orgData.maxConcurrentUsers),
            data_retention_days: parseInt(orgData.dataRetentionDays),
          },
          product_admin: { name: orgData.productAdminName, email: orgData.productAdminEmail },
          org_admin: { name: orgData.orgAdminName, email: orgData.orgAdminEmail },
        },
      });
      setOrgs(prev => [...prev, {
        name: orgData.name,
        status: 'active',
        charterNumber: orgData.charterNumber,
        productAdmin: orgData.productAdminEmail,
        orgAdmin: orgData.orgAdminEmail,
        deploymentMode: orgData.deploymentMode,
        provisionedAt: new Date().toISOString(),
      }]);
      setShowWizard(false);
    } catch (err: any) {
      setProvisionError(err.message || 'Failed to provision organization. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Pinot Pulse — Super Admin</h1>
              <p className="text-xs text-gray-400">Platform Management · Organization Onboarding · Isolated from org data</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 flex items-center gap-1.5"><Lock size={12} /> No org data access</span>
            <button onClick={() => {}} className="px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 flex items-center gap-2 transition-colors"><LogOut size={14} /> Sign Out</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8">
        {showWizard ? (
          <OnboardingWizard onClose={() => setShowWizard(false)} onComplete={handleComplete} />
        ) : (
          <div className="space-y-8">
            {/* Provision Error */}
            {provisionError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 flex items-center justify-between">
                <div className="flex items-center gap-3"><XCircle size={18} /> {provisionError}</div>
                <button onClick={() => setProvisionError('')} className="p-1.5 hover:bg-red-100 rounded-lg cursor-pointer text-red-400 text-sm">✕</button>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Organizations', value: orgs.length, icon: <Building2 size={18} />, sub: orgs.length > 0 ? `${orgs.filter(o => o.status === 'active').length} active` : 'None onboarded' },
                { label: 'Product Admins', value: orgs.length, icon: <Settings size={18} />, sub: orgs.length > 0 ? 'Provisioned' : 'None provisioned' },
                { label: 'Org Admins', value: orgs.length, icon: <Users size={18} />, sub: orgs.length > 0 ? 'Provisioned' : 'None provisioned' },
                { label: 'Platform', value: 'Healthy', icon: <Activity size={18} />, sub: 'All systems operational' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{c.label}</span>
                    <span className="text-gray-300">{c.icon}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{c.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* No orgs banner */}
            {orgs.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                <div className="p-3 bg-amber-100 rounded-xl flex-shrink-0">
                  <AlertCircle size={24} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-amber-800">No Organizations Onboarded</h3>
                  <p className="text-sm text-amber-600 mt-1">No credit unions or banks have been provisioned on this Pinot Pulse instance. Click the button below to begin onboarding your first organization with its Product Admin and Org Admin accounts.</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-amber-500">
                    <span className="px-2 py-1 bg-amber-100 rounded-lg font-bold">1. Onboard Org</span>
                    <ChevronRight size={12} />
                    <span className="px-2 py-1 bg-amber-100 rounded-lg font-bold">2. Provision Admins</span>
                    <ChevronRight size={12} />
                    <span className="px-2 py-1 bg-amber-100 rounded-lg font-bold">3. Configure Deploy</span>
                    <ChevronRight size={12} />
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-600 rounded-lg font-bold">4. Ready ✓</span>
                  </div>
                </div>
              </div>
            )}

            {/* Onboard button */}
            <button onClick={() => setShowWizard(true)}
              className="w-full p-5 bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-3 text-gray-500 hover:text-blue-600">
              <Building2 size={20} />
              <span className="text-sm font-semibold">Onboard New Organization</span>
            </button>

            {/* Organizations list */}
            {orgs.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-base font-semibold text-gray-800">Onboarded Organizations</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/70">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Organization</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Charter</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Product Admin</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Org Admin</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Deployment</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orgs.map((org, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-medium text-gray-800">{org.name}</td>
                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">{org.charterNumber}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs">{org.productAdmin}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs">{org.orgAdmin}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs">{org.deploymentMode}</td>
                        <td className="px-6 py-4"><StatusBadge status={org.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Role isolation reference */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Shield size={18} className="text-blue-500" /> Role Isolation Matrix
              </h3>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Capability</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-blue-500 uppercase">PP Super Admin</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-indigo-500 uppercase">Product Admin</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-500 uppercase">Org Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { cap: 'Onboard organizations', pp: true, pa: false, oa: false },
                      { cap: 'Provision admin accounts', pp: true, pa: false, oa: false },
                      { cap: 'Server sizing & capacity', pp: true, pa: true, oa: false },
                      { cap: 'License management', pp: true, pa: false, oa: false },
                      { cap: 'Core banking integrations', pp: false, pa: true, oa: false },
                      { cap: 'Regulatory configuration', pp: false, pa: true, oa: false },
                      { cap: 'AI Chat configuration', pp: false, pa: true, oa: false },
                      { cap: 'Audit report workflows', pp: false, pa: true, oa: false },
                      { cap: 'Error framework & on-call', pp: false, pa: true, oa: false },
                      { cap: 'Performance monitoring', pp: false, pa: true, oa: false },
                      { cap: 'View member data', pp: false, pa: false, oa: true },
                      { cap: 'Manage org users & roles', pp: false, pa: false, oa: true },
                      { cap: 'View dashboards & reports', pp: false, pa: false, oa: true },
                      { cap: 'Run compliance reports', pp: false, pa: false, oa: true },
                      { cap: 'Day-to-day operations', pp: false, pa: false, oa: true },
                    ].map(r => (
                      <tr key={r.cap} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-gray-700">{r.cap}</td>
                        {[r.pp, r.pa, r.oa].map((v, ci) => (
                          <td key={ci} className="px-4 py-2.5 text-center">
                            {v ? <CheckCircle size={16} className="text-emerald-500 mx-auto" /> : <XCircle size={16} className="text-gray-200 mx-auto" />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Error codes */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-400" /> Platform Error Codes
              </h3>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { code: 'PLT-ONB-1001', desc: 'Organization provisioning failed', sev: 'critical', action: 'Retry provisioning → check license server' },
                      { code: 'PLT-ONB-1002', desc: 'Admin account creation failed', sev: 'critical', action: 'Check email service → retry' },
                      { code: 'PLT-ONB-1003', desc: 'License key invalid or expired', sev: 'high', action: 'Verify license → contact licensing' },
                      { code: 'PLT-ISO-2001', desc: 'Route isolation violation detected', sev: 'critical', action: 'Block access → log security event' },
                      { code: 'PLT-ISO-2002', desc: 'Cross-tier data access attempt', sev: 'critical', action: 'Deny → alert CISO → audit log' },
                      { code: 'PLT-CAP-3001', desc: 'Capacity limit approaching (>80%)', sev: 'high', action: 'Alert Product Admin → scale resources' },
                      { code: 'PLT-CAP-3002', desc: 'Capacity limit exceeded', sev: 'critical', action: 'Throttle → alert → queue expansion' },
                      { code: 'PLT-PERF-4001', desc: 'P99 latency exceeded threshold', sev: 'high', action: 'Alert Product Admin → diagnose' },
                      { code: 'PLT-PERF-4002', desc: 'Pinot cluster node down', sev: 'critical', action: 'Auto-failover → alert → page on-call' },
                    ].map(e => (
                      <tr key={e.code} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-red-600">{e.code}</td>
                        <td className="px-4 py-2.5 text-gray-700 text-xs">{e.desc}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded ${e.sev === 'critical' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>{e.sev}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{e.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
