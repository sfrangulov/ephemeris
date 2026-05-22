# ephemeris — handover (2026-05-22)

**Что это:** dark-only дашборд аналитики npm-портфеля — история скачиваний (npm) +
звёзд (GitHub) с дельтами импульса; GitHub-логин + публичный read-only шаринг.
Имя `ephemeris` = астрономическая таблица положений во времени.

## Статус
Брейншторм завершён, дизайн провалидирован, спека и план написаны.
**M0 (scaffold & infra) почти готов** (beads-эпик `ephemeris-b42`):
- ✅ M0.1 — Next.js 16.2.6 (App Router, TS, Tailwind v4, Turbopack) + Vitest.
- ✅ M0.2 — Blueprint v5 dark-тема + shadcn (card/button/chart) + Geist;
  токены перенесены из мокапа, проверено в браузере. `app/page.tsx` —
  временная theme-check-страница (заменить в M6).
- ◐ M0.3 — клиенты Supabase (`lib/supabase/server.ts` + `admin.ts`) и
  `.env.example` готовы; **остаётся действие пользователя**: создать проект
  Supabase, заполнить `.env.local` (URL/anon/service-role) + `CRON_SECRET`.
  Это блокирует M1 (миграции). Детали — в beads `ephemeris-eim`.

**M1 (схема + RLS) готов** (beads `ephemeris-unx`/`894`): 5 таблиц + RLS
применены в проект через MCP (`supabase/migrations/2026052214*.sql`,
версии в истории проекта). Проверено: RLS включён везде, security-адвайзеры
чисты, anon read 200 / insert 401.

**M2 (ingestion-библиотека) готов** — полный TDD, **29 тестов зелёные**:
`lib/aggregate.ts` (weeklyBuckets, momentumStatus, starDailyFromTimestamps),
`lib/npm.ts` (parseRepo, downloadsUrl, fetchPackageMeta, fetchDownloadsRange),
`lib/github.ts` (parseLinkHeader, fetchRepoStats, backfillStargazers с капом
400 страниц).

Дальше по плану: **M3** — снапшот-крон (`app/api/cron/snapshot/route.ts` +
`vercel.json`), пишет через admin-клиент (secret-ключ есть). Потом M4 (Actions
backfill) → M5 (auth, нужен GitHub OAuth app) → M6 (UI) → M7 (share).
NB: в Next 16 middleware переименован в **proxy** — учесть в M5.

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
Проект Supabase **создан**: `ephemeris` (ref `hvmgpohpvlmejzhyaqng`,
регион ap-northeast-1, Postgres 17). Перешли на **новые ключи** (legacy
anon/service_role не используем):
- `NEXT_PUBLIC_SUPABASE_URL` — заполнен в `.env.local`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) — заполнен.
- `CRON_SECRET` — сгенерирован в `.env.local`.
- `SUPABASE_SECRET_KEY` (`sb_secret_…`) — **TODO: вставить из дашборда**
  (Project Settings → API Keys; MCP secret-ключ не отдаёт). Нужен для джоб (M3/M4).
- Позже: GitHub OAuth app (client id/secret) для M5, Actions secret для backfill (M4).

Supabase MCP подключён — схему M1 можно применять через `apply_migration`/`execute_sql`.

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
