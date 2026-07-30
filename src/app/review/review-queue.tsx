'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { approveEvent, rejectEvent, updateEvent } from '../actions';
import { EVENT_TYPES, EVENT_TYPE_LABELS } from '@/lib/domain';

export interface ReviewEvent {
  id: string;
  vendorName: string;
  type: string;
  severity: string;
  title: string;
  summary: string;
  sourceUrl: string;
  occurredAt: string | null;
  contentText: string | null;
}

export default function ReviewQueue({ events }: { events: ReviewEvent[] }) {
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        if (e.key === 'Escape') setEditing(null);
        return;
      }
      if (events.length === 0) return;
      const current = events[Math.min(selected, events.length - 1)];
      switch (e.key) {
        case 'j':
          setSelected((s) => Math.min(s + 1, events.length - 1));
          break;
        case 'k':
          setSelected((s) => Math.max(s - 1, 0));
          break;
        case 'a': {
          const fd = new FormData();
          fd.set('id', current.id);
          startTransition(() => approveEvent(fd));
          break;
        }
        case 'r': {
          const fd = new FormData();
          fd.set('id', current.id);
          startTransition(() => rejectEvent(fd));
          break;
        }
        case 'e':
          setEditing((cur) => (cur === current.id ? null : current.id));
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [events, selected]);

  useEffect(() => {
    listRef.current
      ?.querySelectorAll('.review-item')
      [selected]?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (events.length === 0) {
    return (
      <div className="card">
        <p style={{ margin: 0 }}>
          Queue is empty. New pending events appear here after <strong>processItems</strong> runs.
        </p>
      </div>
    );
  }

  return (
    <div ref={listRef}>
      {events.map((event, i) => (
        <div
          key={event.id}
          className={`card review-item ${event.severity === 'high' ? 'high' : ''} ${i === selected ? 'selected' : ''}`}
          onClick={() => setSelected(i)}
        >
          {editing === event.id ? (
            <form
              action={(fd) => {
                startTransition(() => updateEvent(fd));
                setEditing(null);
              }}
            >
              <input type="hidden" name="id" value={event.id} />
              <label>Title</label>
              <input type="text" name="title" defaultValue={event.title} />
              <div className="row" style={{ marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <label>Type</label>
                  <select name="type" defaultValue={event.type}>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EVENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Severity</label>
                  <select name="severity" defaultValue={event.severity}>
                    <option value="normal">normal</option>
                    <option value="high">high</option>
                  </select>
                </div>
              </div>
              <label>Summary</label>
              <textarea name="summary" defaultValue={event.summary} />
              <div className="row" style={{ marginTop: 12 }}>
                <button type="submit" name="status" value="approved" className="approve">
                  Save &amp; approve
                </button>
                <button type="submit">Save</button>
                <button type="button" className="secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="row">
                <span className="badge">{EVENT_TYPE_LABELS[event.type as keyof typeof EVENT_TYPE_LABELS] ?? event.type}</span>
                <span className={`badge ${event.severity === 'high' ? 'high' : 'muted'}`}>
                  {event.severity === 'high' ? 'HIGH' : 'normal'}
                </span>
                <strong>{event.vendorName}</strong>
                {event.occurredAt && <span className="muted">{event.occurredAt}</span>}
              </div>
              <h2 style={{ margin: '8px 0 4px' }}>{event.title}</h2>
              <p style={{ margin: '4px 0 8px' }}>{event.summary}</p>
              <p style={{ margin: '0 0 8px' }}>
                <a href={event.sourceUrl} target="_blank" rel="noreferrer">
                  Source ↗
                </a>
              </p>
              {event.contentText && (
                <details className="content-preview">
                  <summary>Extracted source text</summary>
                  <pre>{event.contentText.slice(0, 4000)}</pre>
                </details>
              )}
              <div className="row" style={{ marginTop: 10 }}>
                <form action={approveEvent} className="inline">
                  <input type="hidden" name="id" value={event.id} />
                  <button className="approve">Approve</button>
                </form>
                <button className="secondary" onClick={() => setEditing(event.id)}>
                  Edit
                </button>
                <form action={rejectEvent} className="inline">
                  <input type="hidden" name="id" value={event.id} />
                  <button className="danger">Reject</button>
                </form>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
