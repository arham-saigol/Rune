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

  const saveSettings = () => {
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ai_provider_priority: priority,
        default_summary_mode: defaultMode,
      }),
    });
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
    <main className="max-w-3xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <Link href="/" className="text-sm text-[#5a3e2b] hover:text-[#2c1810]">
          ← Back
        </Link>
      </header>

      <section className="card p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">AI Provider</h2>
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="priority"
              value="gateway_first"
              checked={priority === 'gateway_first'}
              onChange={(e) => setPriority(e.target.value)}
            />
            Gateway First
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="priority"
              value="direct_first"
              checked={priority === 'direct_first'}
              onChange={(e) => setPriority(e.target.value)}
            />
            Direct First
          </label>
        </div>
        <h2 className="text-lg font-semibold mb-3">Default Summary Mode</h2>
        <select
          value={defaultMode}
          onChange={(e) => setDefaultMode(e.target.value)}
          className="input mb-3"
        >
          <option value="short">Short Summary</option>
          <option value="five_points">Five Points</option>
          <option value="eli5">Explain Like I'm 5</option>
          <option value="devils_advocate">Devil's Advocate</option>
        </select>
        <button onClick={saveSettings} className="btn">
          Save Preferences
        </button>
      </section>

      <section className="card p-4">
        <h2 className="text-lg font-semibold mb-3">Tags</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTag()}
            placeholder="New tag name"
            className="input flex-1"
          />
          <button onClick={createTag} className="btn">
            Add
          </button>
        </div>
        <div className="space-y-2">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between bg-[#fff8ee] rounded-lg px-3 py-2">
              <span className="text-sm font-medium">{tag.name}</span>
              {!tag.isDefault && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const name = prompt('Rename tag', tag.name);
                      if (name) {
                        renameTag(tag.id, name);
                        setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, name } : t)));
                      }
                    }}
                    className="text-xs text-[#5a3e2b] hover:text-[#2c1810]"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Delete
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
