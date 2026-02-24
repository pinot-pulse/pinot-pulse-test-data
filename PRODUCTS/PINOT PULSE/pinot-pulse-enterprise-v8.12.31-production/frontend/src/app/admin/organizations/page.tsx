'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api';
import { DashboardLayout } from '@/components/layout';
import {
  Building2,
  ChevronRight,
  RefreshCw,
  Download,
  Search,
  Plus,
  CheckCircle,
  Clock,
  Users,
  Edit3,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

const pageConfig = {
  title: "Organizations",
  description: "Manage onboarded organizations and credit unions",
  parent: "Administration",
};

interface Organization {
  id: string;
  name: string;
  display_name?: string;
  charter_number?: string;
  ncua_number?: string;
  subscription_tier?: string;
  status?: string;
  member_count?: number;
  asset_size?: string;
  onboarding_completed?: boolean;
  created_at?: string;
  updated_at?: string;
}

function StatusBadge({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
    trial: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  const s = status || 'pending';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border ${colors[s] || colors.pending}`}>
      {s === 'active' && <CheckCircle size={12} />}
      {s === 'pending' && <Clock size={12} />}
      {s === 'suspended' && <XCircle size={12} />}
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function getAuthHeaders(): Record<string, string> {
  const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', display_name: '', charter_number: '', ncua_number: '',
    subscription_tier: 'professional', asset_size: '', member_count: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const u = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Organization name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/v1/admin/organizations', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({
          name: form.name,
          display_name: form.display_name || form.name,
          charter_number: form.charter_number || undefined,
          ncua_number: form.ncua_number || undefined,
          subscription_tier: form.subscription_tier,
          asset_size: form.asset_size || undefined,
          member_count: form.member_count ? parseInt(form.member_count) : undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || res.statusText);
      }
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create organization');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add New Organization</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg cursor-pointer"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => u('name', e.target.value)} placeholder="Sunrise Federal Credit Union"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input type="text" value={form.display_name} onChange={e => u('display_name', e.target.value)} placeholder="Sunrise FCU"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Charter Number</label>
              <input type="text" value={form.charter_number} onChange={e => u('charter_number', e.target.value)} placeholder="12345"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NCUA Number</label>
              <input type="text" value={form.ncua_number} onChange={e => u('ncua_number', e.target.value)} placeholder="67890"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Tier</label>
              <select value={form.subscription_tier} onChange={e => u('subscription_tier', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Size</label>
              <input type="text" value={form.asset_size} onChange={e => u('asset_size', e.target.value)} placeholder="$500M"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Member Count</label>
            <input type="number" value={form.member_count} onChange={e => u('member_count', e.target.value)} placeholder="50000"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Creating...' : 'Create Organization'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrganizationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pageError, setPageError] = useState('');

  const { data: orgData, isLoading } = useQuery<any>({
    queryKey: ['admin-organizations'],
    queryFn: () => organizationsApi.get(),
    staleTime: 60000,
  });

  const organizations: Organization[] = (() => {
    if (!orgData) return [];
    if (Array.isArray(orgData)) return orgData;
    if (orgData.organizations) return orgData.organizations;
    if (orgData.data) return orgData.data;
    if (orgData.id) return [orgData];
    return [];
  })();

  const filtered = organizations.filter(org => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      org.name?.toLowerCase().includes(s) ||
      org.display_name?.toLowerCase().includes(s) ||
      org.charter_number?.toLowerCase().includes(s) ||
      org.ncua_number?.toLowerCase().includes(s)
    );
  });

  const handleDelete = async (id: string) => {
    setPageError('');
    try {
      const res = await fetch(`/api/v1/admin/organizations/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || res.statusText);
      }
      qc.invalidateQueries({ queryKey: ['admin-organizations'] });
    } catch (e: any) {
      setPageError(e.message || 'Failed to delete organization');
    }
    setDeleteConfirm(null);
  };

  const handleExport = () => {
    const csv = [
      ['Name', 'Charter', 'NCUA', 'Tier', 'Status', 'Members', 'Created'].join(','),
      ...organizations.map(o => [
        `"${o.name}"`, o.charter_number || '', o.ncua_number || '', o.subscription_tier || '',
        o.onboarding_completed ? 'active' : (o.status || 'pending'),
        o.member_count || '', o.created_at || ''
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'organizations.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const activeCount = organizations.filter(o => o.status === 'active' || o.onboarding_completed).length;
  const pendingCount = organizations.filter(o => !o.onboarding_completed && o.status !== 'active').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <span>Dashboard</span>
              <ChevronRight className="h-4 w-4" />
              <span>{pageConfig.parent}</span>
              <ChevronRight className="h-4 w-4" />
              <span className="text-gray-900">{pageConfig.title}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{pageConfig.title}</h1>
            <p className="text-gray-500 mt-1">{pageConfig.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search organizations..."
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64" />
            </div>
            <button onClick={() => qc.invalidateQueries({ queryKey: ['admin-organizations'] })} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer" title="Refresh">
              <RefreshCw className="h-5 w-5" />
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              <Download className="h-4 w-4" /> Export
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm cursor-pointer">
              <Plus className="h-4 w-4" /> Add Organization
            </button>
          </div>
        </div>

        {/* Error */}
        {pageError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2"><AlertTriangle size={16} /> {pageError}</div>
            <button onClick={() => setPageError('')} className="p-1 hover:bg-red-100 rounded cursor-pointer"><X size={14} /></button>
          </div>
        )}

        {/* KPI Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</span>
              <Building2 className="h-5 w-5 text-gray-300" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{organizations.length}</p>
            <p className="text-xs text-gray-400 mt-1">organizations</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active</span>
              <CheckCircle className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
            <p className="text-xs text-gray-400 mt-1">onboarding complete</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</span>
              <Clock className="h-5 w-5 text-amber-300" />
            </div>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-gray-400 mt-1">onboarding in progress</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Members</span>
              <Users className="h-5 w-5 text-blue-300" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{organizations.reduce((sum, o) => sum + (o.member_count || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">total across all orgs</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Organizations ({filtered.length})</h2>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{search ? 'No Matching Organizations' : 'No Organizations Yet'}</h3>
              <p className="text-sm text-gray-500 mb-4">{search ? 'Try a different search term.' : 'Click "Add Organization" to onboard your first credit union.'}</p>
              {!search && (
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium cursor-pointer">
                  <Plus className="h-4 w-4" /> Add Organization
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Charter / NCUA</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(org => (
                    <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">{org.display_name || org.name}</div>
                        {org.display_name && org.name !== org.display_name && (
                          <div className="text-xs text-gray-400 mt-0.5">{org.name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 font-mono">{org.charter_number || '—'}</div>
                        {org.ncua_number && <div className="text-xs text-gray-400 mt-0.5">NCUA: {org.ncua_number}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {(org.subscription_tier || 'starter').charAt(0).toUpperCase() + (org.subscription_tier || 'starter').slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={org.onboarding_completed ? 'active' : (org.status || 'pending')} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{org.member_count ? org.member_count.toLocaleString() : '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button title="Edit" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => setDeleteConfirm(org.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 cursor-pointer">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
              Showing {filtered.length} of {organizations.length} organizations
            </div>
          )}
        </div>

        {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['admin-organizations'] })} />}

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-sm mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle size={20} className="text-red-600" /></div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Organization?</h3>
              </div>
              <p className="text-sm text-gray-500 mb-6">This action cannot be undone. All organization data, users, and configurations will be permanently removed.</p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
