"use client";

import { useState } from "react";

type Day = { key: string; name: string; open: boolean; from: string; to: string; breaks: [string, string][] };

/**
 * A person's week: follow the location or set each day, plus up to four breaks a day.
 * It only draws the fields; the form it sits in posts them (open_mon, from_mon, to_mon, bf_mon, bt_mon).
 */
export function HoursEditor({ days: first, follow: followFirst, who }: { days: Day[]; follow: boolean; who: string }) {
  const [follow, setFollow] = useState(followFirst);
  const [days, setDays] = useState(first);
  const change = (key: string, patch: Partial<Day>) => setDays((all) => all.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const setBreak = (d: Day, i: number, part: 0 | 1, value: string) => change(d.key, { breaks: d.breaks.map((b, n) => (n === i ? (part === 0 ? [value, b[1]] : [b[0], value]) : b)) as [string, string][] });

  return (
    <>
      <label className="chk"><input type="checkbox" name="follow" checked={follow} onChange={(e) => setFollow(e.target.checked)} /><span><b>Follow the location hours</b></span></label>
      <div className="muted" style={{ fontSize: 12.5 }}>
        {follow ? `${who} works whenever the location is open. Untick the box to give them a week of their own. Breaks below still apply.` : `Tick the days ${who} works and set the times. A day without a tick is a day off.`}
      </div>
      <div className="hrs">
        {days.map((d) => (
          <div key={d.key} className="hday">
            <div className="hr">
              <label className="chk"><input type="checkbox" name={`open_${d.key}`} checked={d.open} disabled={follow} onChange={(e) => change(d.key, { open: e.target.checked })} />{d.name}</label>
              <input className="inp" type="time" name={`from_${d.key}`} value={d.from} disabled={follow || !d.open} onChange={(e) => change(d.key, { from: e.target.value })} aria-label={`${d.name} from`} />
              <span className="muted">to</span>
              <input className="inp" type="time" name={`to_${d.key}`} value={d.to} disabled={follow || !d.open} onChange={(e) => change(d.key, { to: e.target.value })} aria-label={`${d.name} to`} />
            </div>
            {(follow || d.open) && (
              <div className="brk">
                {d.breaks.map((b, i) => (
                  <div key={i} className="hr">
                    <span className="muted">Break</span>
                    <input className="inp" type="time" name={`bf_${d.key}`} value={b[0]} required onChange={(e) => setBreak(d, i, 0, e.target.value)} aria-label={`${d.name} break ${i + 1} from`} />
                    <span className="muted">to</span>
                    <input className="inp" type="time" name={`bt_${d.key}`} value={b[1]} required onChange={(e) => setBreak(d, i, 1, e.target.value)} aria-label={`${d.name} break ${i + 1} to`} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => change(d.key, { breaks: d.breaks.filter((_, n) => n !== i) })} aria-label={`Remove ${d.name} break ${i + 1}`}>Remove</button>
                  </div>
                ))}
                {d.breaks.length < 4 && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => change(d.key, { breaks: [...d.breaks, ["13:00", "13:30"]] })}>Add a break</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
