'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/api';
import { inr } from '@/lib/format';
import { getLocal, setLocal } from '@/lib/saved';
import { Flags, Freshness, SampleBadge } from './Badges';

interface Card {
  offerId: string;
  title: string;
  landedRs: number;
  sourceName: string;
  observedAt: string;
  url: string;
  isSample: boolean;
  flags: string[];
  why: string;
}
interface ToolLine {
  id: string;
  name: string;
  input: unknown;
  ok?: boolean;
  summary?: string;
}
interface Msg {
  role: 'user' | 'assistant';
  text: string;
  cards?: Card[];
  tools?: ToolLine[];
  grounded?: boolean;
  done?: boolean;
  model?: string;
}
interface Prefs {
  locality?: string;
  budgetRs?: number;
  vegOnly?: boolean;
}

const PREFS_KEY = 'cuc.agent.prefs.v1';

/** Streams from POST /v1/agent?stream=true (Server-Sent Events over fetch). */
export default function Chat({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('agent');
  const locale = useLocale();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ live: boolean; model: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({});
  const session = useRef<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      session.current = sessionStorage.getItem('cuc.agent.session');
    } catch {
      session.current = null;
    }
    const saved = getLocal(PREFS_KEY);
    if (saved) {
      try {
        setPrefs(JSON.parse(saved) as Prefs);
        setConsent(true);
      } catch {
        /* ignore */
      }
    }
    fetch(`${API_URL}/v1/agent/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [msgs]);

  const update = (fn: (m: Msg) => Msg) => setMsgs((all) => [...all.slice(0, -1), fn(all.at(-1)!)]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setInput('');
    setBusy(true);
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '', tools: [] }]);
    try {
      const res = await fetch(`${API_URL}/v1/agent?stream=true`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: text,
          ...(session.current ? { sessionId: session.current } : {}),
          ...(consent && Object.keys(prefs).length ? { preferences: prefs } : {}),
        }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = chunk.match(/^event: (.+)$/m)?.[1];
          const data = chunk.match(/^data: (.+)$/m)?.[1];
          if (!ev || !data) continue;
          const d = JSON.parse(data);
          if (ev === 'session') {
            session.current = d.sessionId;
            try {
              sessionStorage.setItem('cuc.agent.session', d.sessionId);
            } catch {
              /* ignore */
            }
          } else if (ev === 'text') update((m) => ({ ...m, text: m.text + d.delta }));
          else if (ev === 'tool_call')
            update((m) => ({
              ...m,
              tools: [...(m.tools ?? []), { id: d.id, name: d.name, input: d.input }],
            }));
          else if (ev === 'tool_result')
            update((m) => ({
              ...m,
              tools: (m.tools ?? []).map((x) => (x.id === d.id ? { ...x, ok: d.ok, summary: d.summary } : x)),
            }));
          else if (ev === 'done')
            update((m) => ({ ...m, text: d.text, cards: d.cards, grounded: d.grounding.ok, done: true }));
          else if (ev === 'error') update((m) => ({ ...m, text: d.message, done: true }));
        }
      }
    } catch {
      update((m) => ({ ...m, text: 'The assistant is unavailable right now.', done: true }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-col gap-3 ${compact ? 'h-full' : ''}`}>
      {status && (
        <p className="text-[13px] text-ink-3">
          {status.live ? t('live', { model: status.model }) : t('offline')}
        </p>
      )}
      <div
        className={`space-y-3 overflow-y-auto ${compact ? 'flex-1' : 'min-h-48'}`}
        aria-live="polite"
        aria-busy={busy}
      >
        {msgs.length === 0 && <p className="text-[15px] text-ink-2">{t('intro')}</p>}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <p
              key={i}
              className="ml-auto max-w-[85%] rounded-[22px] bg-grass px-4 py-2.5 text-[15px] text-accent-fg [overflow-wrap:anywhere]"
            >
              {m.text}
            </p>
          ) : (
            <div key={i} className="max-w-full card !p-5 text-[15px]">
              {!m.done && !m.text && <p className="text-ink-2">{t('thinking')}</p>}
              <p className="whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
                {m.text.replace(/```json[\s\S]*$/, '').trim()}
              </p>
              {m.model?.includes('unavailable') && (
                <p className="mt-2 rounded-[14px] bg-sky-tint px-3 py-2 text-[13px]">{t('fallback')}</p>
              )}
              {m.grounded === false && (
                <p className="mt-2 rounded bg-warn-bg p-2 text-[13px] text-warn-fg">{t('ungrounded')}</p>
              )}
              {m.cards && m.cards.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {m.cards.map((c) => (
                    <li key={c.offerId} className="inset">
                      <p className="font-medium [overflow-wrap:anywhere]">{c.title}</p>
                      <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
                        <strong className="tabular text-[15px] text-ink">
                          {inr(Math.round(c.landedRs * 100), locale)}
                        </strong>
                        {c.sourceName} {c.isSample && <SampleBadge />} <Freshness iso={c.observedAt} />
                      </p>
                      {c.why && <p className="text-[13px] text-ink-2">{c.why}</p>}
                      <Flags flags={c.flags} />
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="link text-[13px]"
                      >
                        {c.sourceName.replace(' (sample)', '')} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {m.tools && m.tools.length > 0 && (
                <details className="mt-2 text-[13px] text-ink-2">
                  <summary className="cursor-pointer">
                    {t('checked')} ({m.tools.length})
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {m.tools.map((x) => (
                      <li key={x.id} className="[overflow-wrap:anywhere]">
                        <code>{x.name}</code> {JSON.stringify(x.input)} → {x.summary ?? '…'}{' '}
                        {x.ok === false && '⚠'}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex gap-2"
      >
        <label htmlFor={compact ? 'chat-in-c' : 'chat-in'} className="sr-only">
          {t('placeholder')}
        </label>
        <input
          id={compact ? 'chat-in-c' : 'chat-in'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder')}
          maxLength={2000}
          className="field min-w-0 flex-1 !rounded-full"
        />
        <button type="submit" disabled={busy} className="btn btn-primary">
          {t('send')}
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              setLocal(PREFS_KEY, e.target.checked ? JSON.stringify(prefs) : null);
            }}
          />
          {t('consent')}
        </label>
        <button
          type="button"
          className="underline"
          onClick={() => {
            if (session.current)
              fetch(`${API_URL}/v1/agent/sessions/${session.current}`, { method: 'DELETE' }).catch(() => {});
            session.current = null;
            try {
              sessionStorage.removeItem('cuc.agent.session');
            } catch {
              /* ignore */
            }
            setMsgs([]);
          }}
        >
          {t('clear')}
        </button>
      </div>
      {consent && (
        <div className="flex flex-wrap gap-2 text-[13px]">
          <input
            aria-label="Locality"
            placeholder="Locality"
            value={prefs.locality ?? ''}
            onChange={(e) => {
              const p = { ...prefs, locality: e.target.value || undefined };
              setPrefs(p);
              setLocal(PREFS_KEY, JSON.stringify(p));
            }}
            className="field !w-28 !py-1.5 !text-[15px]"
          />
          <input
            aria-label="Budget ₹"
            placeholder="Budget ₹"
            inputMode="numeric"
            value={prefs.budgetRs ?? ''}
            onChange={(e) => {
              const p = { ...prefs, budgetRs: Number(e.target.value) || undefined };
              setPrefs(p);
              setLocal(PREFS_KEY, JSON.stringify(p));
            }}
            className="field !w-24 !py-1.5 !text-[15px]"
          />
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={!!prefs.vegOnly}
              onChange={(e) => {
                const p = { ...prefs, vegOnly: e.target.checked || undefined };
                setPrefs(p);
                setLocal(PREFS_KEY, JSON.stringify(p));
              }}
            />{' '}
            Veg
          </label>
        </div>
      )}
    </div>
  );
}
