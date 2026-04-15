'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type DeploymentEvent = {
  id: string;
  phase: string;
  level: string;
  message: string;
  created_at: string;
};

type DeploymentJob = {
  id: string;
  status: string;
  current_phase: string;
  started_at?: string | null;
  finished_at?: string | null;
  error_summary?: string | null;
  events: DeploymentEvent[];
};

const phases = [
  'queued',
  'validate_input',
  'zip_security',
  'extract_workspace',
  'validate_structure',
  'prepare_runtime',
  'build_site',
  'deploy_artifact',
  'configure_nginx',
  'provision_ssl',
  'health_checks',
  'finalize',
  'rollback'
];

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

const decodeRole = (token: string) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload));
    return json.role || null;
  } catch {
    return null;
  }
};

const tokenFromStorage = () =>
  globalThis.localStorage?.getItem('access_token') ||
  globalThis.localStorage?.getItem('auth:token') ||
  globalThis.localStorage?.getItem('token') ||
  '';

export default function DeploySiteZipPage() {
  const [siteSlug, setSiteSlug] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [domain, setDomain] = useState('');
  const [optionalPort, setOptionalPort] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<DeploymentJob | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [authRole, setAuthRole] = useState<string | null>(null);

  useEffect(() => {
    const token = tokenFromStorage();
    setAuthRole(token ? decodeRole(token) : null);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      const token = tokenFromStorage();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/super-admin/deployments/${jobId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const payload = await res.json();
      if (payload?.ok && payload?.data) {
        setJob(payload.data);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [jobId]);

  const timeline = useMemo(() => {
    if (!job) return phases.map((phase) => ({ phase, state: 'pending' }));
    const doneIndex = phases.findIndex((phase) => phase === job.current_phase);
    return phases.map((phase, idx) => {
      if (job.status === 'failed' && phase === job.current_phase) return { phase, state: 'failed' };
      if (job.status === 'rolled_back' && phase === 'rollback') return { phase, state: 'done' };
      if (idx < doneIndex) return { phase, state: 'done' };
      if (phase === job.current_phase) return { phase, state: 'running' };
      return { phase, state: 'pending' };
    });
  }, [job]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    setJob(null);
    setJobId('');

    try {
      const token = tokenFromStorage();
      if (!token) throw new Error('Missing access token in localStorage');
      const form = new FormData();
      form.set('siteSlug', siteSlug);
      form.set('siteName', siteName);
      form.set('siteId', siteId);
      form.set('domain', domain);
      if (optionalPort) form.set('optionalPort', optionalPort);
      if (zipFile) form.set('zipFile', zipFile);

      const response = await fetch(`${apiBase}/api/super-admin/deployments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': `${siteSlug}:${domain}:${zipFile?.name || 'zip'}`
        },
        body: form
      });

      const payload = await response.json();
      if (!payload?.ok) {
        throw new Error(payload?.message || `Request failed (${response.status})`);
      }

      setJobId(String(payload.data.deploymentJobId));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Deployment submit failed');
    } finally {
      setBusy(false);
    }
  };

  if (authRole !== 'super_admin') {
    return (
      <section>
        <h1 style={{ marginTop: 0 }}>Deploy Site ZIP</h1>
        <p style={{ color: '#f87171' }}>Only super_admin users can access this page.</p>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h1 style={{ margin: 0 }}>Deploy Site ZIP</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 10, maxWidth: 600 }}>
        <input placeholder="Site slug" value={siteSlug} onChange={(e) => setSiteSlug(e.target.value)} required />
        <input placeholder="Site name" value={siteName} onChange={(e) => setSiteName(e.target.value)} required />
        <input placeholder="Site id (UUID)" value={siteId} onChange={(e) => setSiteId(e.target.value)} required />
        <input placeholder="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} required />
        <input placeholder="Optional port" value={optionalPort} onChange={(e) => setOptionalPort(e.target.value)} />
        <input type="file" accept=".zip" onChange={(e) => setZipFile(e.target.files?.[0] || null)} required />
        <button
          type="submit"
          disabled={busy}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #2E2E2E', background: '#2563eb', color: 'white' }}
        >
          {busy ? 'Submitting...' : 'Submit deployment'}
        </button>
      </form>

      {error ? <p style={{ color: '#f87171' }}>{error}</p> : null}
      {jobId ? <p style={{ color: '#93c5fd' }}>Deployment job: {jobId}</p> : null}

      <section>
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>Progress timeline</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {timeline.map((item) => (
            <li
              key={item.phase}
              style={{ color: item.state === 'failed' ? '#f87171' : item.state === 'done' ? '#4ade80' : item.state === 'running' ? '#facc15' : '#9CA3AF' }}
            >
              {item.phase} · {item.state}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>Logs / errors</h2>
        <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, padding: 12, maxHeight: 300, overflow: 'auto' }}>
          {(job?.events || []).map((evt) => (
            <p key={evt.id} style={{ margin: 0, fontFamily: 'monospace', color: evt.level === 'error' ? '#f87171' : '#d1d5db' }}>
              [{new Date(evt.created_at).toLocaleTimeString()}] {evt.phase}: {evt.message}
            </p>
          ))}
          {job?.error_summary ? <p style={{ marginTop: 8, color: '#f87171' }}>Error: {job.error_summary}</p> : null}
        </div>
      </section>
    </section>
  );
}
