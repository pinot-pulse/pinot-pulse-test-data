'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle,
  Database,
  Shield,
  Users,
  Zap,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building2,
  GitBranch,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/stores';

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Get started with Pinot Pulse',
    icon: Zap,
  },
  {
    id: 'integrations',
    title: 'Connect Data',
    description: 'Connect your data sources',
    icon: Database,
  },
  {
    id: 'team',
    title: 'Invite Team',
    description: 'Add team members',
    icon: Users,
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Configure security settings',
    icon: Shield,
  },
  {
    id: 'complete',
    title: 'Complete',
    description: 'Start using Pinot Pulse',
    icon: CheckCircle,
  },
];

const DATA_SOURCES = [
  {
    id: 'core_banking',
    name: 'Core Banking System',
    description: 'Connect your core banking platform',
    icon: Building2,
    providers: [
      { id: 'fiserv', name: 'Fiserv DNA/XP2', logo: '\u{1F3E6}' },
      { id: 'jack_henry', name: 'Jack Henry Symitar', logo: '\u{1F4B3}' },
      { id: 'corelation', name: 'Corelation Keystone', logo: '\u{1F511}' },
      { id: 'finastra', name: 'Finastra Fusion', logo: '\u{26A1}' },
      { id: 'custom', name: 'Other / Custom API', logo: '\u{1F527}' },
    ],
  },
  {
    id: 'data_warehouse',
    name: 'Data Warehouse',
    description: 'Connect your analytics data warehouse',
    icon: Database,
    providers: [
      { id: 'snowflake', name: 'Snowflake', logo: '\u{2744}\u{FE0F}' },
      { id: 'databricks', name: 'Databricks', logo: '\u{1F9F1}' },
      { id: 'bigquery', name: 'Google BigQuery', logo: '\u{1F50D}' },
      { id: 'redshift', name: 'Amazon Redshift', logo: '\u{1F4CA}' },
      { id: 'postgresql', name: 'PostgreSQL', logo: '\u{1F418}' },
    ],
  },
  {
    id: 'orchestration',
    name: 'Data Pipeline',
    description: 'Connect your ETL/ELT orchestration',
    icon: GitBranch,
    providers: [
      { id: 'astronomer', name: 'Astronomer (Airflow)', logo: '\u{1F680}' },
      { id: 'fivetran', name: 'Fivetran', logo: '\u{1F504}' },
      { id: 'dbt', name: 'dbt Cloud', logo: '\u{1F528}' },
      { id: 'airbyte', name: 'Airbyte', logo: '\u{1F4A8}' },
      { id: 'matillion', name: 'Matillion', logo: '\u{1F3AF}' },
    ],
  },
  {
    id: 'streaming',
    name: 'Real-Time Streaming',
    description: 'Connect streaming data sources',
    icon: Zap,
    providers: [
      { id: 'kafka', name: 'Apache Kafka', logo: '\u{1F4E8}' },
      { id: 'confluent', name: 'Confluent Cloud', logo: '\u{2601}\u{FE0F}' },
      { id: 'kinesis', name: 'Amazon Kinesis', logo: '\u{1F30A}' },
      { id: 'pubsub', name: 'Google Pub/Sub', logo: '\u{1F4EC}' },
    ],
  },
];

const STORAGE_KEY = 'pinot-pulse-onboarding-state';

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _isNewRegistration = searchParams.get('registered') === 'true';
  const toast = useToast();

  // Load saved state from localStorage
  const loadSavedState = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const savedState = loadSavedState();

  const [currentStep, setCurrentStep] = useState(savedState?.currentStep ?? 0);
  const [selectedIntegrations, setSelectedIntegrations] = useState<Record<string, string>>(
    savedState?.selectedIntegrations ?? {}
  );
  const [connectionStatuses, setConnectionStatuses] = useState<
    Record<string, 'idle' | 'testing' | 'success' | 'error'>
  >(savedState?.connectionStatuses ?? {});
  const [teamEmails, setTeamEmails] = useState<string[]>(savedState?.teamEmails ?? ['']);
  const [teamRoles, setTeamRoles] = useState<string[]>(savedState?.teamRoles ?? ['analyst']);
  const [securitySettings, setSecuritySettings] = useState(
    savedState?.securitySettings ?? {
      mfaRequired: true,
      ipWhitelist: false,
      sessionTimeout: '4',
      auditLogging: true,
    }
  );
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(
    new Set(savedState?.completedSteps ?? [])
  );
  const [saving, setSaving] = useState(false);

  // Persist state to localStorage on every change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const state = {
      currentStep,
      selectedIntegrations,
      connectionStatuses,
      teamEmails,
      teamRoles,
      securitySettings,
      completedSteps: Array.from(completedSteps),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [currentStep, selectedIntegrations, connectionStatuses, teamEmails, teamRoles, securitySettings, completedSteps]);

  const step = ONBOARDING_STEPS[currentStep];

  const handleIntegrationSelect = (categoryId: string, providerId: string) => {
    setSelectedIntegrations((prev) => ({
      ...prev,
      [categoryId]: providerId,
    }));
  };

  const handleTestConnection = async (categoryId: string) => {
    setConnectionStatuses((prev) => ({ ...prev, [categoryId]: 'testing' }));
    try {
      const response = await fetch('/api/v1/admin/integrations/config/' + categoryId + '/test', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const result = response.ok ? 'success' : 'error';
      setConnectionStatuses((prev) => ({ ...prev, [categoryId]: result }));
      if (result === 'error') {
        toast.warning('Connection test failed', 'Please check your configuration and try again.');
      }
    } catch {
      setConnectionStatuses((prev) => ({ ...prev, [categoryId]: 'error' }));
      toast.error('Connection test failed', 'Could not reach the server.');
    }
  };

  const handleAddTeamEmail = () => {
    setTeamEmails([...teamEmails, '']);
    setTeamRoles([...teamRoles, 'analyst']);
  };

  const handleRemoveTeamEmail = (index: number) => {
    setTeamEmails(teamEmails.filter((_, i) => i !== index));
    setTeamRoles(teamRoles.filter((_, i) => i !== index));
  };

  const handleEmailChange = (index: number, value: string) => {
    const updated = [...teamEmails];
    updated[index] = value;
    setTeamEmails(updated);
  };

  const handleRoleChange = (index: number, value: string) => {
    const updated = [...teamRoles];
    updated[index] = value;
    setTeamRoles(updated);
  };

  // Save integrations to backend when leaving Step 2
  const saveIntegrations = async () => {
    const entries = Object.entries(selectedIntegrations);
    if (entries.length === 0) return;

    for (const [category, providerId] of entries) {
      try {
        await fetch('/api/v1/integrations', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: providerId,
            integration_type: providerId,
            config: { category, setup_source: 'onboarding' },
          }),
        });
      } catch {
        // Integration creation is best-effort during onboarding
      }
    }
  };

  // Send team invites when leaving Step 3
  const sendTeamInvites = async () => {
    const validEmails = teamEmails.filter((e) => e && e.includes('@'));
    if (validEmails.length === 0) return;

    for (let i = 0; i < validEmails.length; i++) {
      try {
        await fetch('/api/v1/admin/users/invite', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            email: validEmails[i],
            role: teamRoles[i] || 'analyst',
          }),
        });
      } catch {
        // Invite is best-effort during onboarding
      }
    }
  };

  // Save security settings when leaving Step 4
  const saveSecuritySettings = async () => {
    try {
      await fetch('/api/v1/organization/settings', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          security: {
            mfa_required: securitySettings.mfaRequired,
            ip_whitelist_enabled: securitySettings.ipWhitelist,
            session_timeout_hours: parseInt(securitySettings.sessionTimeout),
            audit_logging_enabled: securitySettings.auditLogging,
          },
        }),
      });
    } catch {
      // Settings save is best-effort during onboarding
    }
  };

  // Mark step complete in backend
  const markStepComplete = async (stepId: string, stepIndex: number) => {
    try {
      await fetch('/api/v1/organization/onboarding/complete-step', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          step: stepId,
          step_index: stepIndex,
        }),
      });
    } catch {
      // Step tracking is best-effort
    }
  };

  const handleNext = async () => {
    if (currentStep >= ONBOARDING_STEPS.length - 1) return;

    setSaving(true);
    try {
      // Persist data based on current step before advancing
      if (step.id === 'integrations') {
        await saveIntegrations();
        await markStepComplete('integrations', 1);
        setCompletedSteps((prev) => new Set([...prev, 'integrations']));
      } else if (step.id === 'team') {
        await sendTeamInvites();
        await markStepComplete('team', 2);
        setCompletedSteps((prev) => new Set([...prev, 'team']));
      } else if (step.id === 'security') {
        await saveSecuritySettings();
        await markStepComplete('security', 3);
        setCompletedSteps((prev) => new Set([...prev, 'security']));
      } else if (step.id === 'welcome') {
        await markStepComplete('welcome', 0);
        setCompletedSteps((prev) => new Set([...prev, 'welcome']));
      }

      setCurrentStep(currentStep + 1);
    } catch (err) {
      toast.error('Failed to save', 'Your progress could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await markStepComplete('complete', 4);
      setCompletedSteps((prev) => new Set([...prev, 'complete']));
      // Clear onboarding state from localStorage
      localStorage.removeItem(STORAGE_KEY);
      toast.success('Setup complete', 'Welcome to Pinot Pulse!');
      router.push('/dashboard');
    } catch {
      toast.error('Error', 'Could not complete onboarding. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Pinot Pulse</span>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-slate-400 hover:text-white"
          >
            Skip setup &rarr;
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="flex items-center justify-center mb-8">
          {ONBOARDING_STEPS.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  index < currentStep || completedSteps.has(s.id)
                    ? 'bg-green-500 text-white'
                    : index === currentStep
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                {index < currentStep || completedSteps.has(s.id) ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <s.icon className="w-5 h-5" />
                )}
              </div>
              {index < ONBOARDING_STEPS.length - 1 && (
                <div
                  className={`w-16 h-1 mx-2 rounded ${
                    index < currentStep ? 'bg-green-500' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8">
          {/* Welcome Step */}
          {step.id === 'welcome' && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center mx-auto mb-6">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">
                Welcome to Pinot Pulse!
              </h1>
              <p className="text-lg text-slate-300 mb-8 max-w-xl mx-auto">
                Your real-time analytics platform for credit unions and community banks.
                Let&apos;s get you set up in just a few minutes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[
                  {
                    icon: Database,
                    title: 'Connect Data',
                    description: 'Link your data warehouse and core banking',
                  },
                  {
                    icon: Shield,
                    title: 'Real-Time Fraud',
                    description: 'Monitor transactions with ML-powered detection',
                  },
                  {
                    icon: CheckCircle,
                    title: 'Compliance',
                    description: 'Automate BSA/AML and regulatory reporting',
                  },
                ].map((feature, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white/5 rounded-xl border border-white/10"
                  >
                    <feature.icon className="w-8 h-8 text-amber-400 mb-3" />
                    <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-slate-400">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Integrations Step */}
          {step.id === 'integrations' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Connect Your Data Sources</h2>
              <p className="text-slate-400 mb-6">
                Connect at least one data source to start analyzing your data in real-time.
              </p>

              <div className="space-y-6">
                {DATA_SOURCES.map((category) => (
                  <div key={category.id} className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <div className="flex items-center gap-3 mb-4">
                      <category.icon className="w-6 h-6 text-amber-400" />
                      <div>
                        <h3 className="font-semibold text-white">{category.name}</h3>
                        <p className="text-sm text-slate-400">{category.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {category.providers.map((provider) => {
                        const isSelected = selectedIntegrations[category.id] === provider.id;
                        const status = connectionStatuses[category.id];

                        return (
                          <button
                            key={provider.id}
                            onClick={() => handleIntegrationSelect(category.id, provider.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              isSelected
                                ? 'bg-blue-500/20 border-blue-500'
                                : 'bg-white/5 border-white/10 hover:border-white/30'
                            }`}
                          >
                            <div className="text-2xl mb-2">{provider.logo}</div>
                            <div className="text-sm font-medium text-white truncate">
                              {provider.name}
                            </div>
                            {isSelected && status === 'success' && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
                                <Check className="w-3 h-3" />
                                Connected
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedIntegrations[category.id] && (
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={() => handleTestConnection(category.id)}
                          disabled={connectionStatuses[category.id] === 'testing'}
                          className="px-4 py-2 bg-blue-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-2"
                        >
                          {connectionStatuses[category.id] === 'testing' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              Test Connection
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => router.push('/admin/integrations')}
                          className="px-4 py-2 text-slate-400 text-sm hover:text-white"
                        >
                          Configure &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Step */}
          {step.id === 'team' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Invite Your Team</h2>
              <p className="text-slate-400 mb-6">
                Add team members who need access to analytics and reports.
              </p>

              <div className="space-y-3 mb-6">
                {teamEmails.map((email, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(index, e.target.value)}
                      placeholder="colleague@creditunion.org"
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <select
                      value={teamRoles[index] || 'analyst'}
                      onChange={(e) => handleRoleChange(index, e.target.value)}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="analyst" className="bg-slate-800">Analyst</option>
                      <option value="manager" className="bg-slate-800">Manager</option>
                      <option value="admin" className="bg-slate-800">Admin</option>
                    </select>
                    {teamEmails.length > 1 && (
                      <button
                        onClick={() => handleRemoveTeamEmail(index)}
                        className="p-3 text-slate-400 hover:text-red-400"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddTeamEmail}
                className="text-amber-400 hover:text-amber-300 text-sm font-medium"
              >
                + Add another team member
              </button>

              <div className="mt-8 p-4 bg-white/5 rounded-lg">
                <h4 className="font-medium text-white mb-2">Role Permissions</h4>
                <div className="text-sm text-slate-400 space-y-1">
                  <p><span className="text-white">Analyst:</span> View dashboards and reports</p>
                  <p><span className="text-white">Manager:</span> Create reports, manage alerts</p>
                  <p><span className="text-white">Admin:</span> Full access including settings</p>
                </div>
              </div>
            </div>
          )}

          {/* Security Step */}
          {step.id === 'security' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Security Settings</h2>
              <p className="text-slate-400 mb-6">
                Configure security policies for your organization.
              </p>

              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <div className="font-medium text-white">Require Two-Factor Authentication</div>
                    <div className="text-sm text-slate-400">
                      All users must enable 2FA to access the platform
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={securitySettings.mfaRequired}
                    onChange={(e) =>
                      setSecuritySettings({ ...securitySettings, mfaRequired: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <div className="font-medium text-white">IP Whitelist</div>
                    <div className="text-sm text-slate-400">
                      Restrict access to specific IP addresses
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={securitySettings.ipWhitelist}
                    onChange={(e) =>
                      setSecuritySettings({ ...securitySettings, ipWhitelist: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
                  />
                </label>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="font-medium text-white mb-2">Session Timeout</div>
                  <select
                    value={securitySettings.sessionTimeout}
                    onChange={(e) =>
                      setSecuritySettings({ ...securitySettings, sessionTimeout: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="1" className="bg-slate-800">1 hour</option>
                    <option value="4" className="bg-slate-800">4 hours</option>
                    <option value="8" className="bg-slate-800">8 hours</option>
                    <option value="24" className="bg-slate-800">24 hours</option>
                  </select>
                </div>

                <label className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <div className="font-medium text-white">Audit Logging</div>
                    <div className="text-sm text-slate-400">
                      Log all user actions for compliance
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={securitySettings.auditLogging}
                    onChange={(e) =>
                      setSecuritySettings({ ...securitySettings, auditLogging: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step.id === 'complete' && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">You&apos;re All Set!</h1>
              <p className="text-lg text-slate-300 mb-8 max-w-xl mx-auto">
                Your Pinot Pulse account is ready. Start exploring real-time analytics,
                fraud detection, and compliance monitoring.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-left">
                  <CheckCircle className="w-5 h-5 text-green-400 mb-2" />
                  <div className="text-white font-medium">Data Sources Connected</div>
                  <div className="text-sm text-slate-400">
                    {Object.keys(selectedIntegrations).length} integration(s)
                  </div>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-left">
                  <CheckCircle className="w-5 h-5 text-green-400 mb-2" />
                  <div className="text-white font-medium">Team Invited</div>
                  <div className="text-sm text-slate-400">
                    {teamEmails.filter((e) => e && e.includes('@')).length} member(s)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <button
              onClick={handleBack}
              disabled={currentStep === 0 || saving}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              {step.id !== 'complete' && step.id !== 'welcome' && (
                <button
                  onClick={handleSkip}
                  disabled={saving}
                  className="px-4 py-2 text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Skip
                </button>
              )}
              {step.id === 'complete' ? (
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium rounded-lg disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Finishing...
                    </>
                  ) : (
                    <>
                      Go to Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium rounded-lg disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OnboardingContent />
    </Suspense>
  );
}
