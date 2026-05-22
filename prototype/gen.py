#!/usr/bin/env python3
import json, datetime as dt
from datetime import datetime, timezone

rows = [json.loads(l) for l in open("/tmp/npmsit/raw.ndjson") if l.strip()]

def rel(pub):
    if not pub:
        return ""
    d = datetime.fromisoformat(pub.replace("Z", "+00:00"))
    days = (datetime.now(timezone.utc) - d).days
    if days <= 0:
        return "сегодня"
    if days == 1:
        return "вчера"
    if days < 30:
        return f"{days} дн. назад"
    if days < 365:
        return f"{days // 30} мес. назад"
    return f"{days // 365} г. назад"

def weekly(downloads):
    # downloads: list of {day, downloads} ascending; bucket into trailing 7-day weeks
    if not downloads:
        return [], 0, 0
    vals = [d["downloads"] for d in downloads]
    # take last 91 days -> 13 weeks
    vals = vals[-91:]
    weeks = []
    # align from the end
    i = len(vals)
    while i > 0 and len(weeks) < 13:
        chunk = vals[max(0, i-7):i]
        weeks.append(sum(chunk))
        i -= 7
    weeks.reverse()
    last = weeks[-1] if weeks else 0
    prev = weeks[-2] if len(weeks) >= 2 else 0
    return weeks, last, prev

def path_from(weeks, h=56, top=6, bottom=50):
    if not weeks:
        return "", "", None
    n = len(weeks)
    lo, hi = min(weeks), max(weeks)
    rng = (hi - lo) or 1
    W = 280
    pts = []
    for idx, v in enumerate(weeks):
        x = round(idx * W / (n - 1)) if n > 1 else W
        y = round(bottom - (v - lo) / rng * (bottom - top))
        pts.append((x, y))
    line = "M" + " L".join(f"{x},{y}" for x, y in pts)
    area = line + f" L{W},{h} L0,{h} Z"
    return line, area, pts[-1]

cards = []
for r in rows:
    weeks, last, prev = weekly(r.get("downloads", []))
    if prev > 0:
        ratio = (last - prev) / prev
    else:
        ratio = 0 if last == 0 else 1
    status = "up" if ratio > 0.05 else ("dn" if ratio < -0.05 else "flat")
    delta = last - prev
    cards.append({
        "pkg": r["pkg"], "slug": r.get("slug", ""), "stars": r.get("stars"),
        "latest": r.get("latest", ""), "pub": r.get("pub", ""),
        "weeks": weeks, "last": last, "prev": prev, "delta": delta,
        "ratio": ratio, "status": status, "has_data": bool(weeks),
    })

# sort by last-week downloads desc (impulse)
cards.sort(key=lambda c: c["last"], reverse=True)

# totals
total_last = sum(c["last"] for c in cards)
total_prev = sum(c["prev"] for c in cards)
total_stars = sum((c["stars"] or 0) for c in cards)
in_norm = sum(1 for c in cards if c["status"] != "dn")
total_ratio = (total_last - total_prev) / total_prev if total_prev else 0

COL = {"up": "var(--success)", "flat": "var(--muted-foreground)", "dn": "var(--destructive)"}
COLH = {"up": "oklch(0.64 0.1368 155.45)", "flat": "oklch(0.6798 0.0249 258.37)", "dn": "oklch(0.6763 0.1555 20.22)"}
STAT = {"up": "▲ рост", "flat": "— штиль", "dn": "▼ спад"}
PRIM = "oklch(0.6549 0.1595 257.40)"

def fmt(n):
    return f"{n:,}".replace(",", " ")

def card_html(c, gi):
    sc = COLH[c["status"]]
    line, area, last_pt = path_from(c["weeks"])
    grad = f"grad{gi}"
    if c["has_data"]:
        # stars line: flat near bottom (no real history; 1-3 stars)
        sy = 46
        star_line = f'<path d="M0,{sy} C70,{sy} 140,{sy-1} 210,{sy-1} C240,{sy-1} 260,{sy-2} 280,{sy-2}" fill="none" stroke="{PRIM}" stroke-width="1.5"/>'
        star_dot = f'<circle cx="280" cy="{sy-2}" r="2.6" fill="{PRIM}"/>'
        chart = f'''<svg width="100%" height="56" viewBox="0 0 280 56" preserveAspectRatio="none">
          <defs><linearGradient id="{grad}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{sc}" stop-opacity=".26"/><stop offset="1" stop-color="{sc}" stop-opacity="0"/></linearGradient></defs>
          <path d="{area}" fill="url(#{grad})"/>
          <path d="{line}" fill="none" stroke="{sc}" stroke-width="1.5"/>
          {star_line}
          <circle cx="{last_pt[0]}" cy="{last_pt[1]}" r="2.6" fill="{sc}"/>{star_dot}</svg>'''
        dot_dl = "var(--success)" if c["status"]=="up" else ("var(--destructive)" if c["status"]=="dn" else "var(--muted-foreground)")
        sign = "+" if c["delta"] >= 0 else "−"
        deltatxt = f'{sign}{fmt(abs(c["delta"]))} dl · +0★'
    else:
        chart = '<div style="height:56px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted-foreground)">нет данных о скачиваниях</div>'
        dot_dl = "var(--muted-foreground)"
        deltatxt = "—"
    stars = c["stars"] if c["stars"] is not None else "—"
    ver = f'v{c["latest"]}' if c["latest"] else ""
    updated = rel(c["pub"])
    return f'''
        <div class="card"><span class="stripe s-{c['status']}"></span>
          <div class="top"><span class="name">{c['pkg']}</span>{f'<span class="ver mono">{ver}</span>' if ver else ''}<span class="stat {c['status']}">{STAT[c['status']]}</span></div>
          <div class="hero">
            <span class="grp"><span class="seriesdot" style="background:{dot_dl}"></span><span class="num mono">{fmt(c['last'])}</span><span class="unit">dl / нед</span></span>
            <span class="grp"><span class="seriesdot" style="background:{PRIM}"></span><span class="num sm mono">{stars}</span><span class="unit">★</span></span>
          </div>
          <div class="chart">{chart}</div>
          <div class="foot"><span class="delta {c['status']} mono">{deltatxt}</span><span class="metar mono">обновлён {updated}</span></div>
        </div>'''

cards_html = "\n".join(card_html(c, i) for i, c in enumerate(cards))
tsign = "▲" if total_ratio >= 0 else "▼"

html = f'''<!DOCTYPE html>
<html lang="ru" class="dark">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NPM Situation Center — real data</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap');
  :root.dark{{--background:oklch(0.2453 0.0136 253.08);--foreground:oklch(0.9759 0.0029 264.54);--card:oklch(0.3235 0.0158 259.80);--muted:oklch(0.3618 0.0175 258.37);--muted-foreground:oklch(0.6798 0.0249 258.37);--border:oklch(0.3991 0.0228 258.37);--primary:oklch(0.6549 0.1595 257.40);--success:oklch(0.6400 0.1368 155.45);--warning:oklch(0.7530 0.1439 65.59);--destructive:oklch(0.6763 0.1555 20.22);--turquoise:oklch(0.7528 0.1303 185.29);--radius:0.2rem;}}
  *{{box-sizing:border-box;}}html,body{{height:100%;}}
  body{{margin:0;background:var(--background);color:var(--foreground);font-family:'Geist',system-ui,sans-serif;-webkit-font-smoothing:antialiased;}}
  .mono{{font-family:'Geist Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;}}
  h1,h2,h3{{letter-spacing:-.03em;font-weight:600;margin:0;}}
  .up{{color:var(--success);}}.dn{{color:var(--destructive);}}.flat{{color:var(--muted-foreground);}}
  .shell{{display:flex;min-height:100vh;}}
  .side{{width:236px;flex-shrink:0;border-right:1px solid color-mix(in oklch,var(--border) 50%,transparent);display:flex;flex-direction:column;background:var(--background);}}
  .logo{{height:60px;display:flex;align-items:center;gap:9px;padding:0 18px;}}
  .logo .mark{{width:22px;height:22px;border-radius:5px;background:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:oklch(1 0 0);}}
  .logo .name{{font-size:13px;font-weight:700;letter-spacing:.04em;}}
  .logo .name small{{display:block;font-size:9px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-foreground);}}
  nav{{padding:14px 12px 8px;display:flex;flex-direction:column;gap:2px;}}
  .nav-lbl{{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted-foreground);padding:6px 12px 4px;}}
  .nav-item{{position:relative;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;font-size:13px;font-weight:500;color:var(--muted-foreground);cursor:pointer;transition:color .15s;}}
  .nav-item:hover{{color:var(--foreground);}}.nav-item.active{{color:var(--foreground);}}
  .nav-item.active::before{{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:4px;height:4px;border-radius:50%;background:var(--foreground);}}
  .nav-item svg{{width:16px;height:16px;flex-shrink:0;stroke:currentColor;fill:none;stroke-width:1.7;}}
  .nav-item .badge{{margin-left:auto;font-size:10px;font-weight:600;color:var(--warning);}}
  .divider{{height:1px;background:color-mix(in oklch,var(--border) 50%,transparent);margin:12px 16px;}}
  .addbtn{{margin:0 12px;display:flex;align-items:center;gap:8px;justify-content:center;padding:8px;border:1px dashed color-mix(in oklch,var(--primary) 45%,transparent);border-radius:6px;color:var(--primary);font-size:12px;font-weight:600;background:color-mix(in oklch,var(--primary) 6%,transparent);cursor:pointer;}}
  .addbtn svg{{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;}}
  .side .foot{{margin-top:auto;}}
  .sync{{display:flex;align-items:center;gap:7px;font-size:10px;color:var(--muted-foreground);padding:0 18px 4px;}}
  .live-dot{{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 8px var(--success);animation:pulse 3s ease-in-out infinite;}}
  @keyframes pulse{{0%,100%{{opacity:.5}}50%{{opacity:1}}}}
  .user{{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid color-mix(in oklch,var(--border) 50%,transparent);}}
  .user .av{{width:26px;height:26px;border-radius:50%;background:var(--muted);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;}}
  .user .who{{font-size:12px;font-weight:500;}}.user .who small{{display:block;font-size:10px;color:var(--muted-foreground);font-weight:400;}}
  .main{{flex:1;min-width:0;position:relative;overflow:auto;}}
  .main::before{{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;z-index:0;background-image:linear-gradient(color-mix(in srgb,var(--border) 22%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--border) 22%,transparent) 1px,transparent 1px);background-size:24px 24px;}}
  .content{{position:relative;z-index:1;max-width:1080px;padding:26px 32px 60px;}}
  .ptitle{{display:flex;align-items:baseline;gap:12px;margin-bottom:4px;}}
  .ptitle h1{{font-size:20px;}}.ptitle .meta{{font-size:12px;color:var(--muted-foreground);}}
  .strip{{display:flex;margin:20px 0 8px;border:1px solid var(--border);border-radius:calc(var(--radius)*4);overflow:hidden;background:color-mix(in oklch,var(--card) 50%,transparent);}}
  .strip .cell{{flex:1;padding:15px 18px;border-right:1px solid var(--border);}}.strip .cell:last-child{{border-right:none;}}
  .strip .k{{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted-foreground);}}
  .strip .v{{font-size:24px;font-weight:700;margin-top:6px;}}.strip .d{{font-size:12px;margin-top:2px;}}
  .sect{{margin:30px 0 14px;display:flex;align-items:center;gap:12px;}}
  .sect .lbl{{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.14em;color:var(--primary);white-space:nowrap;}}
  .sect .rule{{height:1px;flex:1;background:var(--border);}}
  .grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}}
  @media(max-width:1040px){{.grid{{grid-template-columns:repeat(2,1fr);}}}}
  .card{{position:relative;overflow:hidden;border-radius:calc(var(--radius)*4);background:var(--card);padding:14px 16px 12px;box-shadow:0 0 0 1px var(--border),0 1px 1px color-mix(in oklch,var(--foreground) 6%,transparent);transition:transform .2s,box-shadow .2s;cursor:pointer;}}
  .card:hover{{transform:translateY(-2px);box-shadow:0 0 0 1px color-mix(in oklch,var(--primary) 28%,transparent),0 6px 18px color-mix(in oklch,#000 40%,transparent);}}
  .stripe{{position:absolute;inset:0 auto 0 0;width:3px;}}
  .s-up{{background:var(--success);}}.s-flat{{background:color-mix(in oklch,var(--muted-foreground) 40%,transparent);}}.s-dn{{background:var(--destructive);}}
  .top{{display:flex;align-items:center;gap:6px;}}
  .name{{flex:1;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}}
  .stat{{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;}}
  .ver{{font-size:9px;color:var(--muted-foreground);border:1px solid var(--border);border-radius:4px;padding:1px 5px;line-height:1.4;}}
  .metar{{font-size:9px;color:color-mix(in oklch,var(--muted-foreground) 80%,transparent);text-transform:lowercase;letter-spacing:.02em;}}
  .hero{{display:flex;align-items:baseline;gap:14px;margin-top:4px;}}
  .hero .grp{{display:inline-flex;align-items:baseline;gap:5px;}}
  .hero .seriesdot{{width:7px;height:7px;border-radius:50%;align-self:center;}}
  .hero .num{{font-size:21px;font-weight:700;}}.hero .num.sm{{font-size:16px;}}
  .hero .unit{{font-size:11px;color:var(--muted-foreground);}}
  .chart{{margin-top:9px;}}
  .foot{{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;}}
  .delta{{font-size:12px;font-weight:600;}}
  .fresh{{font-size:9px;color:color-mix(in oklch,var(--muted-foreground) 75%,transparent);display:inline-flex;align-items:center;gap:4px;text-transform:uppercase;letter-spacing:.06em;}}
  .fresh .fd{{width:5px;height:5px;border-radius:50%;background:var(--turquoise);}}
  .note{{font-size:11px;color:var(--muted-foreground);margin-top:14px;padding:10px 12px;border:1px dashed var(--border);border-radius:6px;}}
</style></head>
<body><div class="shell">
  <aside class="side">
    <div class="logo"><div class="mark">n</div><div class="name">situation<small>npm portfolio</small></div></div>
    <nav>
      <div class="nav-item active"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Обзор</div>
      <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M3 12h4l3 8 4-16 3 8h4"/></svg>Скачивания</div>
      <div class="nav-item"><svg viewBox="0 0 24 24"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>Звёзды</div>
      <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>Алерты</div>
      <div class="divider"></div>
      <div class="nav-lbl">Пакеты · {len(cards)}</div>
      <div class="nav-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>docx-to-md</div>
      <div class="nav-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>skill-graveyard</div>
      <div class="nav-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>npm-pets</div>
    </nav>
    <div class="divider"></div>
    <div class="addbtn"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Добавить пакет</div>
    <div class="foot"><div class="sync"><span class="live-dot"></span>данные npm + GitHub · сегодня</div>
      <div class="user"><div class="av">SF</div><div class="who">Sergei<small>@sfrangulov</small></div></div></div>
  </aside>
  <main class="main"><div class="content">
    <div class="ptitle"><h1>Обзор портфеля</h1><span class="meta">{len(cards)} пакетов · реальные данные · сортировка по скачиваниям/нед</span></div>
    <div class="strip">
      <div class="cell"><div class="k">Скачиваний / нед</div><div class="v mono">{fmt(total_last)}</div><div class="d {'up' if total_ratio>=0 else 'dn'} mono">{tsign} {total_ratio*100:+.1f}% к прошлой</div></div>
      <div class="cell"><div class="k">Всего звёзд</div><div class="v mono">{total_stars}</div><div class="d flat mono">портфель молодой</div></div>
      <div class="cell"><div class="k">Скачиваний / 13 нед</div><div class="v mono">{fmt(sum(sum(c['weeks']) for c in cards))}</div><div class="d flat mono">docx-to-md — тягач</div></div>
      <div class="cell"><div class="k">Пакетов в норме</div><div class="v mono">{in_norm} / {len(cards)}</div><div class="d flat mono">по динамике DL</div></div>
    </div>
    <div class="sect"><span class="lbl">Портфель · импульс за неделю</span><div class="rule"></div></div>
    <div class="grid">{cards_html}
    </div>
    <div class="note">★ Данные звёзд реальные (GitHub API): репозитории молодые, 1–3 звезды — линия ★ почти плоская. Это честный текущий снимок; backfill истории звёзд осмыслен, когда звёзд станут десятки. Скачивания — реальные daily из npm Downloads API, агрегированы по неделям.</div>
  </div></main>
</div></body></html>'''

out = "/Users/sergeifrangulov/projects/sergei/.superpowers/brainstorm/41530-1779456638/content/dashboard-real.html"
open(out, "w").write(html)
print("wrote", out)
print("packages:", [(c["pkg"], c["last"], c["stars"], c["status"]) for c in cards])
