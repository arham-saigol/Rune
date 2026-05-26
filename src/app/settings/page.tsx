'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Tag {
  id: number;
  name: string;
  slug: string;
  isDefault: number;
}

export default function SettingsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [priority, setPriority] = useState('gateway_first');
  const [defaultMode, setDefaultMode] = useState('short');

  useEffect(() => {
    fetch('/api/tags')
      .then((r) => r.json())
      .then((data) => setTags(data.tags));
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.ai_provider_priority) setPriority(data.ai_provider_priority);
        if (data.default_summary_mode) setDefaultMode(data.default_summary_mode);
      });
  }, []);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveSettings = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ai_provider_priority: priority,
          default_summary_mode: defaultMode,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const createTag = () => {
    if (!newTagName.trim()) return;
    const slug = newTagName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    fetch('/api/tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newTagName, slug }),
    })
      .then((r) => r.json())
      .then((data) => {
        setTags(data.tags);
        setNewTagName('');
      });
  };

  const renameTag = (id: number, name: string) => {
    fetch(`/api/tags/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  };

  const deleteTag = (id: number) => {
    fetch(`/api/tags/${id}`, { method: 'DELETE' })
      .then(() => setTags((prev) => prev.filter((t) => t.id !== id)));
  };

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="logotype">Settings</h1>
        <Link href="/" className="sketch-link text-sm">
          &larr; back
        </Link>
      </header>

      <section className="settings-section mb-6">
        <h2 className="section-head mb-4">AI Provider</h2>
        <div className="flex gap-5 mb-5">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="priority"
              value="gateway_first"
              checked={priority === 'gateway_first'}
              onChange={(e) => setPriority(e.target.value)}
              className="accent-[var(--ink)]"
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>Gateway First</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="priority"
              value="direct_first"
              checked={priority === 'direct_first'}
              onChange={(e) => setPriority(e.target.value)}
              className="accent-[var(--ink)]"
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>Direct First</span>
          </label>
        </div>

        <h2 className="section-head mb-4">Default Summary Mode</h2>
        <select
          value={defaultMode}
          onChange={(e) => setDefaultMode(e.target.value)}
          className="input mb-5 w-full max-w-xs border-b border-[var(--rule)]"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
        >
          <option value="short">Short Summary</option>
          <option value="five_points">Five Points</option>
          <option value="eli5">Explain Like I&apos;m 5</option>
          <option value="devils_advocate">Devil&apos;s Advocate</option>
        </select>

        <div>
          <button onClick={saveSettings} className="btn" disabled={saving}>
            {saving ? 'saving...' : 'save'}
          </button>
          {saveError && (
            <p className="text-sm text-[var(--stamp)] mt-2">{saveError}</p>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-head mb-4">Tags</h2>
        <div className="flex gap-3 mb-5">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTag()}
            placeholder="new tag name..."
            className="input flex-1"
          />
          <button onClick={createTag} className="btn">
            add
          </button>
        </div>
        <div className="space-y-2">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between bg-[var(--paper-warm)] rounded-[3px] px-4 py-2.5 border border-[var(--rule)]">
              <span className="tag-pill" style={{ transform: 'none' }}>
                {tag.name}
              </span>
              {!tag.isDefault && (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const name = prompt('Rename tag', tag.name);
                      if (name) {
                        renameTag(tag.id, name);
                        setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, name } : t)));
                      }
                    }}
                    className="sketch-link text-xs"
                  >
                    rename
                  </button>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="text-xs text-[var(--stamp)] hover:opacity-70 transition-opacity"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
