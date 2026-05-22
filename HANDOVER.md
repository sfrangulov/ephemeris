# ephemeris — handover (2026-05-22)

**Что это:** dark-only дашборд аналитики npm-портфеля — история скачиваний (npm) +
звёзд (GitHub) с дельтами импульса; GitHub-логин + публичный read-only шаринг.
Имя `ephemeris` = астрономическая таблица положений во времени.

## Статус
Брейншторм завершён, дизайн провалидирован на реальных данных, **спека и план
написаны. Кода ещё нет.** Репозиторий инициализирован (`git init`), коммитов нет.

## Где что лежит
- **Спека:** `docs/superpowers/specs/2026-05-22-ephemeris-design.md` — источник истины.
- **План:** `docs/superpowers/plans/2026-05-22-ephemeris-mvp.md` — M0–M7, bite-sized задачи.
- **Мокап (UI source of truth):** `docs/design/mockup-dashboard.html` — финальный,
  на реальных данных, тёмная тема, открыть в браузере.
- **Варианты карточки:** `docs/design/mockup-card-variants.html`.
- **Прототип ingestion (работает):** `prototype/fetch.sh` + `prototype/gen.py` —
  доказали тягу к npm Downloads API + GitHub API + рендер. Логику переносить в
  `lib/npm.ts` / `lib/github.ts` / `lib/aggregate.ts` (план M2).

## Зафиксированные решения
- Стек: Next.js (App Router) · shadcn/ui + Recharts · Supabase (Postgres+Auth+RLS)
  · Vercel (хостинг + Cron) · GitHub Actions (backfill).
- Джобы — **вариант C**: ежедневный снапшот на Vercel Cron, разовый backfill истории
  звёзд в GitHub Actions (не влезает в serverless-таймаут).
- Дизайн — **Palantir Blueprint v5, только тёмная тема**, перенесён из
  `~/projects/ai-data-analyst` (Situation Center). Geist Sans/Mono, glass-card,
  status-полоска, grid-текстура.
- Карточка — **компоновка B**: заливка dl + линия ★ на одном графике, цветные
  точки-легенды у hero-чисел; версия-чип + «обновлён N дн. назад»; сетка
  сортируется по скачиваниям/нед (топ сверху).

## Важные факты / грабли
- **Реальные звёзды портфеля 1–3 на репо** → линия ★ сейчас плоская, killer-фича
  «дельта звёзд» дозреет позже; главная метрика v1 — скачивания (docx-to-md = тягач,
  ~7 230 DL/нед). Архитектура backfill готова, менять не нужно.
- **GitHub:** `gh` уже авторизован как `sfrangulov` (5000 req/ч) — для backfill
  использовать токен, не аноним (60/ч).
- **npm trademark:** не использовать «npm» в публичном бренде/имени.
- **Vercel лимиты:** Hobby-функция ≤60s (снапшот влезает), длинный backfill — только
  в Actions. Hobby-крон ~раз/сутки.
- **Домен:** `.dev`/`.app` для `ephemeris` заняты → решить составной/креативный TLD
  или Vercel-сабдомен перед публичным запуском (открытый вопрос).

## Секреты/env для следующей сессии
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, GitHub OAuth app (client id/secret),
Actions secret для backfill.

## Как продолжить (новая сессия в этом репо)
1. Прочитать спеку и план.
2. Загрузить build-time скилы: `vercel:nextjs`, `vercel:shadcn`,
   `vercel:react-best-practices`, `impeccable` (для UI).
3. Начать с **M0** плана. Исполнение — `superpowers:subagent-driven-development`
   (рекомендовано) или `superpowers:executing-plans`.
4. Сделать первый коммит после M0 (репо пока пустой по истории).

## Артефакты брейншторма (в другом репо)
Мокапы и сессия визуального компаньона жили в `~/projects/sergei/.superpowers/`
(gitignored). Финальные перенесены сюда в `docs/design/`.
