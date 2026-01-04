# EasyEats – Decision Log

> Format: `DL-### – Title`  
> Status values: `APPROVED`, `SUPERSEDED`, `DEPRECATED`.  
> Only entries explicitly approved in chat are marked `APPROVED`.

## DL-001 – Core Platform Stack

- **Status:** APPROVED
- **Summary:** Use Supabase Cloud as the primary backend (Postgres + PostGIS + Auth + Storage) with Next.js (App Router) as the frontend.
- **Rationale:** Fast to MVP, managed infra, built-in RLS and storage. Data is standard Postgres.
- **Implications:** Business logic lives in Next.js route handlers + Supabase SQL/RLS rather than a separate traditional backend.

## DL-002 – Single Next App, Multi-Host

- **Status:** APPROVED
- **Summary:** Use a single Next.js App Router app to serve both `easyeats.co.zw` (public) and `app.easyeats.co.zw` (app) using host-aware routing and route groups.
- **Rationale:** One codebase simplifies development, deployment, and AI tooling (Cursor).
- **Implications:** Middleware/layouts must be host-aware; we can later split if needed without changing Supabase.

## DL-003 – Role Model & RLS

- **Status:** APPROVED
- **Summary:** Use `app_users.role` for global roles (`USER`, `OWNER`, `ADMIN`, `SUPERADMIN`) and `restaurant_members` for per-restaurant roles (`OWNER`, `MANAGER`, `STAFF`), with comprehensive RLS.
- **Rationale:** Clean separation between global capabilities and per-restaurant permissions; supports multi-restaurant ownership and staff.
- **Implications:** All queries are subject to RLS; privileged operations use service-role with explicit checks + audit logging.

## DL-004 – Restaurant + Location Modeling

- **Status:** APPROVED
- **Summary:** Store restaurant identity in `restaurants` and physical address + coordinates in `restaurant_locations` with `geography(Point, 4326)`.
- **Rationale:** Separation of metadata and geo data; supports distance queries and map features.
- **Implications:** Location-based features query `restaurant_locations.location_geog`; updates go through triggers.

## DL-005 – Menus & Items

- **Status:** APPROVED
- **Summary:** Use `menus` (per restaurant, single default) and `menu_items` (with `section_name`, `price_cents`, tags, search tsvector).
- **Rationale:** Flexible and search-friendly structure, supports CSV import and multiple menus later.
- **Implications:** Price stored as integer `price_cents`; full-text search uses `menu_items.search_tsv`.

## DL-006 – Events & Promotions Separation

- **Status:** APPROVED
- **Summary:** Model events and promotions as separate tables (`events`, `promotions`) with similar structure (banner, publish flags, time windows).
- **Rationale:** Different semantics and lifecycle; easier querying and independent toggling.
- **Implications:** Frontend can reuse patterns while querying different tables; analytics associates with both.

## DL-007 – Analytics Events Table

- **Status:** APPROVED
- **Summary:** Use `analytics_events` as a generic event table for impressions/clicks across restaurants, events, and promotions.
- **Rationale:** Central place for analytics, flexible `metadata` JSONB.
- **Implications:** Table may grow quickly; will need retention/aggregation strategy later.

## DL-008 – Audit Logging via Dedicated Table

- **Status:** APPROVED
- **Summary:** Use `audit_log` to record privileged actions (actor, source, previous + new values).
- **Rationale:** Traceability for operator/admin/chatbot edits; supports debugging + compliance.
- **Implications:** All privileged server endpoints must write audit rows; only admins/superadmins can read.

## DL-009 – Service-Role for Privileged Server APIs

- **Status:** APPROVED
- **Summary:** Use Supabase service-role key **only in server-side code** (Next.js route handlers/server actions) for admin/chatbot operations; never in clients.
- **Rationale:** Enables safe bypass of RLS when necessary; keeps client tokens least-privilege.
- **Implications:** Strong separation between browser and server; audit logging required for service-role operations.

## DL-010 – Pricing & Currency Model

- **Status:** APPROVED
- **Summary:** Store prices as `price_cents integer` with currency codes. Each restaurant has `currency_code` (3-letter ISO). Each `menu_item` can optionally override with its own `currency_code`; if null, UI uses the restaurant’s currency.
- **Rationale:** Avoids floating point issues; models single-currency restaurants while allowing per-item overrides.
- **Implications:** Any price display/logic must consider both `price_cents` and effective currency code (item override or restaurant default).

## DRAFT DL-011 – Image Galleries Model

- **Status:** DRAFT
- **Summary:** Use separate tables for galleries: `restaurant_images`, `event_images`, `promotion_images`, with `storage_path`, `position`, and `created_by`, plus `restaurant_image_type` enum for restaurant images.
- **Rationale:** Clean separation of media from core entities; supports ordered galleries and typed images; maps well to Supabase Storage.
- **Implications:** Owners/admins manage galleries; public can only read galleries for published entities.

## DRAFT DL-012 – Reviews & Aggregated Ratings

- **Status:** DRAFT
- **Summary:** Use `restaurant_reviews` as the source of EasyEats ratings, and store external ratings from Google/Tripadvisor in `restaurants`. Compute a combined rating in application code via a weighted average over all three sources.
- **Rationale:** Keeps EasyEats reviews as first-class data; external scores are treated as supplemental. Combined rating is flexible and does not require schema changes for new sources.
- **Implications:** Admin tools must manage external rating fields. The app must always consider EasyEats rating & count along with Google/Tripadvisor when displaying scores.


## DRAFT DL-013 – Storage Buckets & Path Conventions

- **Status:** DRAFT
- **Summary:** Use Supabase Storage buckets `avatars`, `restaurants`, `events`, `promotions`, and `reviews` with public read and strict RLS-based write policies. Store only object keys (e.g., `<restaurant_id>/gallery/<uuid>.webp`) in database fields.
- **Rationale:** Clear separation of media by domain, straightforward URL generation, and secure multi-tenant write access using existing role/membership tables.
- **Implications:** Upload code must follow the path conventions so storage policies work correctly. Buckets are world-readable, so only non-sensitive, presentation-focused images should be stored here.

## DL-014 (Draft) 

– Auth Strategy: “Use Supabase self-hosted Auth with Google OAuth, cookie-based sessions via @supabase/ssr, and a /auth/login + /auth/callback flow in Next.js App Router.”

## DRAFT DL-015 – Email + Password Flow

- **Status:** DRAFT
- **Summary:** Support email + password authentication alongside Google OAuth using Supabase Auth:
  - `/auth/signup` uses `signUp` with `emailRedirectTo` → `/auth/confirm`.
  - `/auth/confirm` verifies OTP (`verifyOtp`) and signs the user in.
  - `/auth/login` supports both email/password (`signInWithPassword`) and Google OAuth.
- **Rationale:** Many users expect classic email/password auth with email confirmation, and it integrates well with Supabase’s SSR PKCE flow.
- **Implications:** Requires SMTP + email templates to be configured. Adds an additional route `/auth/confirm`, but keeps the auth logic centralized in Supabase + SSR clients.

## DRAFT DL-016 – Image Upload API & Limits

- **Status:** DRAFT
- **Summary:** Use a single Next.js upload API route (`/api/uploads/images`) that accepts multipart form-data with `entityType` and an entity ID, uploads images to Supabase Storage using the authenticated user’s session, enforces limits (15 restaurant gallery images, 5 review images), and writes metadata to `restaurant_images` and `review_images`.
- **Rationale:** Centralizes validation, permission checks, and limits while still leveraging Supabase Storage RLS and Postgres RLS; supports multiple file uploads in one request.
- **Implications:** Upload flows (owner gallery, reviews) must use this API and follow the bucket/path conventions. Future entities (events/promotions) can be added as new `entityType` cases.

## DRAFT DL-017 – Admin & Owner Dashboards

- **Status:** DRAFT
- **Summary:** Provide two protected dashboards:
  - `/easy` for ADMIN/SUPERADMIN with platform-wide stats (restaurant counts, 7-day analytics events, and top restaurants).
  - `/owner` for restaurant OWNER/MANAGER roles with per-restaurant views, clicks, and saves in the last 7 days.
- **Rationale:** Gives operators and admins actionable visibility into how guests interact with restaurant profiles, events, and promotions before adding more complex features and AI tooling.
- **Implications:** All stats are currently aggregated in the application layer from `analytics_events`. Future scaling may require DB-level aggregation or materialized views.

## DRAFT DL-018 – Reviews UX & Owner Replies

- **Status:** DRAFT
- **Summary:** 
  - Guests can write a review on `/restaurants/[slug]/review`, with up to 5 photos via the centralized upload API.
  - Owners/managers can reply to reviews via `/owner/restaurants/[id]/reviews`, with one reply per review stored in a dedicated `review_replies` table.
  - Public restaurant pages show both guest reviews and owner replies.
- **Rationale:** Clean separation between guest content and owner responses improves security (owners cannot alter ratings/text) and UX (clear, structured dialogue).
- **Implications:** Future moderation features (hiding/pinning reviews or replies) can build on this model without changing the core schema.

## DRAFT DL-019 – Owner Profile, Socials & Menu Editing

- **Status:** DRAFT
- **Summary:** 
  - Owners/managers can edit restaurant basics (name, city, description), contact info (phone, WhatsApp, email, website), socials (Facebook, Instagram, TikTok), external URLs (Google Business Profile, Tripadvisor), and location (address + coordinates + maps link) via `/owner/restaurants/[id]/profile`.
  - Owners manage gallery images via `/owner/restaurants/[id]/gallery` (upload, remove, 15 image limit).
  - Owners manage default menu items (add/delete) via `/owner/restaurants/[id]/menu`.
  - Ratings & reviews remain read-only from the owner’s perspective (replies only).
- **Rationale:** Gives restaurant partners full control over how they appear on EasyEats while keeping trust-critical fields (ratings) immutable.
- **Implications:** Sets up a clean target for future AI/chatbot editing, which can call into the same server actions / APIs rather than touching the DB directly.


## DRAFT DL-020 – CSV Menu Import/Export

- **Status:** DRAFT
- **Summary:**
  - Owners/managers can export their default menu to CSV and import a CSV to fully replace that menu’s items.
  - CSV schema: section_name, name, description, price, currency_code.
  - Export produces properly quoted CSV that safely handles commas, quotes, and multi-sentence descriptions.
  - Import parses CSV on the server using a robust parser, deletes existing menu_items for the menu, and recreates them from the CSV.
- **Rationale:** Enables bulk edits and round-trip workflows (export → edit offline → re-import) while keeping a clear mental model for restaurant owners.
- **Implications:** In the future, we can extend the format (e.g., optional item IDs) to support partial updates without full replacement.

## DRAFT DL-021 – Menu Item Images

- **Status:** DRAFT
- **Summary:**
  - Each menu item may have an optional single image, stored as `image_storage_path` on `menu_items` in the existing `restaurants` storage bucket.
  - Owners/managers upload or change the image via `/owner/restaurants/[id]/menu` using the `MenuItemImageUploader` component (calling `/api/menu-item-image`).
  - Public restaurant pages show a discrete “Photo” icon per menu item (via `MenuItemImagePreview`), opening a simple overlay with the dish image.
  - CSV menu import/export remains focused on text/price, but imports preserve existing images when `section_name + name` match between the CSV and the current menu.
- **Rationale:** Brings EasyEats closer to Uber Eats / DoorDash-style visual menus while maintaining a clean, minimal data model and safe owner-only editing.
- **Implications:** Future enhancements (e.g., multi-image dishes, AI-generated thumbnails) can extend this model without breaking existing data.

## DRAFT DL-022 – Cuisines & Feature Taxonomies (Finalized Schema + Owner UI)

- **Status:** DRAFT
- **Summary:**
  - Implemented normalized taxonomies:
    - `cuisines (id int4, slug, name, category, is_active, sort_order)` + `restaurant_cuisines (restaurant_id uuid, cuisine_id int4)`.
    - `features (id int4, slug, name, category, icon_key, is_active, sort_order)` + `restaurant_features (restaurant_id uuid, feature_id int4)`.
  - Public can read active cuisines/features; owners/managers/admins manage their restaurant’s links via the owner profile page.
  - Owner UI (`/owner/restaurants/[id]/profile`) now includes:
    - A Cuisines section with chip-style checkboxes.
    - A Features & amenities section grouped by category.
  - Indexes are in place to support analytics and fast filtering by cuisine/feature.
- **Rationale:** Provides a future-proof, analytics-ready foundation for discovery (chips, filters) and AI/chatbot editing while keeping the MVP robust and adaptable.
- **Implications:** Future work will wire public chips/sections, search filters, and analytics_events logging (e.g., restaurant views and filter usage tagged with cuisine/feature slugs).

## DRAFT DL-023 – Public Cuisines & Features Display

- **Status:** DRAFT
- **Summary:**
  - Public restaurant profile pages now:
    - Show selected cuisines as chips below the restaurant name.
    - Show selected features in a “Features & amenities” section, grouped by category (dietary, amenities, services, atmosphere, bar).
  - Data is loaded server-side from `restaurant_cuisines`/`cuisines` and `restaurant_features`/`features`, respecting RLS and `is_active` flags.
- **Rationale:** Makes cuisines and amenities visible to diners, matching how modern platforms present discovery metadata (Uber Eats, DoorDash, OpenTable), and prepares the UI for cuisine/feature-based filters and analytics.
- **Implications:** Future work can add filters/search powered by these taxonomies and log analytics events tagged with cuisine/feature slugs.

## DRAFT DL-024 – Search & Autosuggest Architecture

- **Status:** DRAFT
- **Summary:**
  - Use Postgres full-text search + trigram as the primary search engine for the MVP.
  - Introduce:
    - `restaurant_search_index` (one row per restaurant; aggregated name, city, cuisines, features, description, menu text, recent reviews; weighted `tsvector` + GIN index).
    - `search_suggestions` (many rows; restaurant names, dish names, later popular queries; trigram index on normalized term).
  - Maintain `restaurant_search_index` via `refresh_restaurant_search_index(restaurant_id)` called from triggers on restaurants, menu items, reviews, cuisines, and features.
  - Expose search via a clean API layer (`/api/search`, `/api/search/suggestions`) so the front end and future mobile/chatbot clients rely on a stable contract.
- **Rationale:** Provides scalable, robust search and autosuggest on top of Supabase Postgres, while staying flexible enough to swap to an external search engine later without changing UI.
- **Implications:** Enables search over restaurant name, menu items, descriptions, and reviews with ranking & snippets, and gives us a foundation for query analytics and suggestion popularity tuning.

## DRAFT DL-025 – Search Engine Choice (Postgres-first, Typesense-ready)

- **Status:** DRAFT
- **Summary:**
  - Use Postgres full-text search + trigram as the initial search engine for EasyEats.
  - Keep `restaurant_search_index` as the canonical search document table and expose search via `/api/search` and `/api/search/suggestions`.
  - Design these APIs so the underlying engine can be swapped to Typesense in the future without changing the front-end.
- **Rationale:** Reduces operational complexity for the MVP while still delivering robust, multi-field search and autosuggest; preserves the option to adopt Typesense later if scale or feature needs demand it.
- **Implications:** Future adoption of Typesense will focus on building a sync worker from `restaurant_search_index` and updating the API implementation, not on UI refactors.

## DRAFT DL-026 – Search Index v2 (Schema-aligned)

- **Status:** DRAFT
- **Summary:**
  - Reworked `restaurant_search_index` and `refresh_restaurant_search_index` to match the actual schema: `menu_items` now joins through `menus (menu_id -> menus.id -> restaurant_id)` instead of assuming `menu_items.restaurant_id`.
  - RLS for the index no longer depends on a non-existent `restaurants.is_published` column; it now simply verifies that the restaurant exists.
  - Triggers on `restaurants`, `menus`, `menu_items`, `restaurant_reviews`, `restaurant_cuisines`, and `restaurant_features` keep the index in sync.
  - `search_suggestions` seeds now correctly associate dish suggestions with restaurants via `menus`.
- **Rationale:** Aligns the search infrastructure with the real Supabase schema so migrations run cleanly and the index stays correct as data changes.

## DRAFT DL-027 – Search Infrastructure v1 (Postgres FTS)

- Added `restaurant_id` to `menu_items` (backfilled from `menus.restaurant_id`), with FK, index, and a BEFORE INSERT/UPDATE trigger to keep it in sync.
- Created `restaurant_search_index` (one row per restaurant) with RLS, GIN index, and a `refresh_restaurant_search_index` function plus triggers on restaurants, menus, menu_items, restaurant_reviews, restaurant_cuisines, and restaurant_features.
- Created `search_suggestions` with RLS, trigram index, uniqueness index, and seed data for restaurant and dish suggestions.
- Backfilled the search index and suggestions for existing data.
