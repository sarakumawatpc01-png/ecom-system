'use client';

import { useEffect, useState } from 'react';

const options = [
  { value: 'all', label: 'All Sites' },
  { value: 'demo-site', label: 'Demo Site' },
  { value: 'fashion-site', label: 'Fashion Site' }
];

export default function SiteSelector() {
  const [selected, setSelected] = useState('all');

  useEffect(() => {
    const saved = globalThis.localStorage?.getItem('super-admin:selected-site');
    if (saved) setSelected(saved);
  }, []);

  const onChange = (value: string) => {
    setSelected(value);
    globalThis.localStorage?.setItem('super-admin:selected-site', value);
  };

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
      Site
      <select
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        style={{ background: '#242424', color: '#F1F1F1', border: '1px solid #2E2E2E', borderRadius: 6, padding: '4px 8px' }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
