<!--
PROVENANCE
date: 2026-05-22
method: superpowers:brainstorming + impeccable (design language) + реальные данные npm/GitHub API
grounding: npm Downloads API, npm registry, GitHub API (fetched 2026-05-22); ai-data-analyst Situation Center (Palantir Blueprint v5)
design-refs: docs/design/mockup-dashboard.html (validated, real data), docs/design/mockup-card-variants.html
prototype: prototype/fetch.sh, prototype/gen.py (real-data ingestion + render proof)
-->

# ephemeris — npm portfolio situation center

> *ephemeris* — астрономическая таблица положений небесных тел во времени.
> Здесь: таблица положений твоих пакетов (скачивания + звёзды) во времени.

## 1. Что это и зачем

Дашборд аналитики npm-портфеля: история **скачиваний** (npm) и **звёзд** (GitHub)
с **дельтами импульса** («что сдвинулось за неделю»), несколько пакетов на одном
экране. Логин через GitHub — чтобы вести свой портфель; публичная read-only ссылка
(`/u/<slug>`) — чтобы шарить.

**Аудитория / регистр (impeccable):** product-регистр. Сцена — инди-OSS-мейкер
вечером с ноутбука проверяет, сдвинул ли запощенный лонгрид скачивания и звёзды.
Это *глянуть и получить диагноз*, не глубокий анализ → приоритет «что изменилось»
над «сколько всего».

## 2. Scope v1

В составе:
- GitHub-логин, портфель пакетов на пользователя (watchlist).
- Главный экран: сайдбар + сетка карточек пакетов, сортировка по скачиваниям/нед.
- Карточка: имя, **версия**, **дата обновления**, статус (рост/штиль/спад),
  скачивания (hero + спарклайн) + звёзды (вторая линия), дельты в футере.
- История скачиваний из npm (есть из коробки, ~18 мес daily).
- История звёзд через backfill из GitHub stargazers (см. §6).
- Публичный read-only дашборд по slug.

YAGNI — режем из v1:
- ❌ Алерты/дайджест (Telegram/email) → v2.
- ❌ Трекинг чистых GitHub-репо без npm-пакета → v2.
- ❌ Forks/issues/contributors, bundle size, vulnerabilities → только DL + ★.
- ❌ Сложные оверлеи сравнения версий.
- ❌ Кастомный домен — позже (Vercel-сабдомен на старте).

## 3. Архитектура

**Стек:** Next.js (App Router) · shadcn/ui + Recharts · Supabase (Postgres + Auth +
RLS) · Vercel (хостинг + Cron) · GitHub Actions (воркер backfill).

**Разделение джоб (вариант C — обосновано лимитами Vercel):**

| Задача | Где | Почему |
|---|---|---|
| Ежедневный снапшот (DL добор + текущие ★) | **Vercel Cron** → `/api/cron/snapshot` | Быстро, влезает в таймаут функции, штатно |
| Разовый backfill истории звёзд | **GitHub Actions** | Сотни пагинированных запросов = минуты, не влезает в serverless-таймаут |

Vercel-функция живёт секунды (Hobby ≤60s); backfill большого репо — минуты, поэтому
уходит в Actions (нет таймаута, щедрые бесплатные минуты). Данные — единый Postgres
в Supabase; Actions пишет через service-role key.

## 4. Поток данных

```
[Vercel Cron, daily]
  npm Downloads API (range/point) ──┐
  GitHub API (stargazers_count)   ──┤→ upsert download_daily / star_daily
                                     └→ помечает новые репо backfill_status=pending

[GitHub Actions, sweep ~15 мин]
  репо с backfill_status=pending →
  GitHub stargazers (Accept: star+json, пагинация, курсор персистится) →
  бакетизация starred_at по дням → star_daily (история) → backfill_status=done

[Next.js UI]
  читает агрегаты из Postgres (RLS) → дашборд
```

## 5. Модель данных (Postgres / Supabase)

- `packages` — глобальный реестр отслеживаемых npm-пакетов. Поля: `id`, `name`
  (unique), `repo_owner`, `repo_name` (авто-резолв из npm `repository.url`),
  `latest_version`, `last_published_at`, `backfill_status`
  (`pending`|`done`|`none`), `created_at`, `last_synced_at`. Шарится между юзерами.
- `download_daily` — `(package_id, day) → downloads`. PK составной. Источник —
  npm range API.
- `star_daily` — `(package_id, day) → stars_total, stars_delta`. **Только дневной
  агрегат** (не каждая звезда) — хранилище крошечное. Backfill заполняет прошлое,
  крон дописывает свежее.
- `watchlist` — `(user_id, package_id, added_at)`. RLS: юзер видит/правит только
  свои строки.
- `profiles` — `user_id, slug (unique), is_public`. Для `/u/<slug>`.

Auth — Supabase Auth (GitHub OAuth); `user_id` ссылается на `auth.users`.

**RLS:** `watchlist`/`profiles` приватны по `user_id`; `packages`/`download_daily`/
`star_daily` — read-only публичны (шарятся), пишет только service-role (джобы).

## 6. Ingestion-модули (чистые, тестируемые)

- `lib/npm.ts`
  - `fetchDownloadsRange(pkg, from, to)` → daily-точки. Scoped (`@scope/name`)
    кодируется `%2F`; bulk через запятую только для unscoped.
  - `fetchPackageMeta(pkg)` → `{ repoUrl, latestVersion, lastPublishedAt }`
    (из registry, поля `repository.url` и `time`).
- `lib/github.ts`
  - `fetchRepoStats(owner, repo)` → `{ stars, forks }` (текущие).
  - `backfillStargazers(owner, repo, cursor?)` → итерация stargazers с
    `Accept: application/vnd.github.star+json`, бакетизация `starred_at` по дням
    → дневные дельты. Резюмируемо по курсору. Кап GitHub: 400 страниц (~40K ★) —
    свыше помечаем «история обрезана».

Прототип уже доказал ingestion на реальных данных (`prototype/`): docx-to-md =
7 230 DL/нед, флагман; звёзды 1–3 на репо (см. §9).

## 7. UI и дизайн-система

**Язык дизайна — Palantir Blueprint v5, тёмная тема только.** Полностью перенесён
из ai-data-analyst Situation Center. Валидированный мокап на реальных данных:
`docs/design/mockup-dashboard.html`.

**Токены (dark, OKLCH):**
- `--background` `#1C2127` · `--foreground` `#F6F7F9`
- `--card` `#2F343C` · `--muted/secondary/accent` `#383E47` · `--border` `#404854`
- `--muted-foreground` `#8F99A8`
- `--primary` (blue) `#4C90F0` · `--success` `#32A467` · `--warning` `#EC9A3C`
  · `--destructive` `#E76A6E` · `--turquoise` `#13C9BA`
- chart: blue/green/orange/indigo `#BD6BBD`/turquoise
- `--radius` `0.2rem` (плотный, Blueprint)

**Типографика:** Geist Sans (UI) + Geist Mono (числа, `tabular-nums`). Заголовки —
трекинг −0.03em, weight 600.

**Паттерны:** `glass-card` — elevation через box-shadow-кольцо (не бордеры), hover
приподнимает; grid-текстура 24px; тонкие авто-скрытые скроллбары; анимации fade-up
(12px, ease-out 0.5s) + stagger 60ms; glow-pulse для live-индикаторов.

**Лейаут:**
- **Сайдбар слева** (236px, `border-r`): лого `n / situation`; навигация
  (Обзор · Скачивания · Звёзды · Алерты) с точкой-маркером активного пункта;
  список пакетов; пунктирная «Добавить пакет»; внизу — live-индикатор синка и
  user-меню. Сворачивается в `w-14` (иконки + tooltips).
- **Контент:** заголовок «Обзор портфеля» → плотный stat-strip (DL/нед, всего ★,
  скачиваний/13 нед, пакетов в норме) → секция «Портфель · импульс за неделю» с
  волосяной линией → сетка карточек.

**Карточка пакета (компоновка B — совмещённые две оси):**
- Шапка: имя (uppercase tracked) · **чип версии** `v0.2.2` · статус (▲рост/—штиль/▼спад).
- Семантическая статус-полоска слева 3px (рост=green, штиль=grey, спад=red).
  *Примечание: формально из бан-листа impeccable (side-stripe), оставлена осознанно
  как семантический индикатор статуса.*
- Hero: два числа с цветными точками-легендами — `● 7 230 dl/нед` (точка в цвет
  статуса) и `● 3 ★` (синяя точка = линия звёзд).
- График: заливка скачиваний (в цвет статуса) + линия звёзд (синяя) поверх. Точки
  на концах. Цветные точки у hero-чисел снимают неоднозначность двух осей без
  подписей.
- Футер: дельта `+X dl · +Y★` (слева) · `обновлён N дн. назад` (справа).
- **Сортировка сетки — по скачиваниям/нед, по убыванию** (топ-тягач сверху).

**Charts:** Recharts (под shadcn-charts). Спарклайн — `AreaChart` monotone,
strokeWidth 1.5, градиент-заливка 0.3→0, точка на конце.

## 8. Обработка ошибок

- npm 404 при добавлении → ошибка валидации «пакет не найден».
- scoped-пакеты → нет bulk-эндпоинта, идём per-package range (`%2F`).
- нет `repository.url` или не GitHub (напр. `@sfrangulov/shared-memory-mcp`) →
  трекаем только DL, секция звёзд: «репо не привязан».
- пакет без скачиваний (новый, напр. url-to-md) → карточка с «нет данных о
  скачиваниях», не падаем.
- GitHub rate limit → backfill через токен (5000/ч), чанки с персистом курсора.
- репо >40K ★ → кап 400 страниц + пометка «история обрезана».
- идемпотентность крона: повторный прогон за тот же день не задваивает (upsert по
  составному PK).

## 9. Killer-фича: дельты звёзд — и честная оговорка

Killer-фича — **прирост звёзд во времени** (которого нет у npm-stat). Реальные
данные портфеля (2026-05-22) показали: звёзд пока **1–3 на репо** → линия ★ почти
плоская, дельта не звучит. Это зафиксировано осознанно:

- v1 показывает звёзды честно (текущее число + плоская линия), backfill готов
  «выстрелить», когда звёзд станут десятки.
- Реальная история сейчас — про **скачивания** (docx-to-md = тягач). Поэтому
  главная метрика карточки = DL/нед, звёзды — вторая линия.
- Полная ценность дельт звёзд раскрывается на портфелях с реальной звёздной
  динамикой (или когда портфель дозреет). Архитектура backfill это уже
  поддерживает — менять не нужно.

## 10. Kill-критерии / открытые вопросы

- Открыто: домен (`.dev`/`.app` для `ephemeris` заняты → составной/креативный TLD
  или Vercel-сабдомен; решить перед публичным запуском).
- v2-кандидаты: алерты/дайджест, трекинг чистых репо, сворачиваемый сайдбар-стейт,
  сравнение версий.

## Следующий шаг

Перейти к `superpowers:writing-plans` — разложить реализацию на план с чекпойнтами.
Build-time скилы (`vercel:nextjs`, `vercel:shadcn`, `vercel:react-best-practices`)
поднять на фазе реализации, не раньше.
