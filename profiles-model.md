# Application/OS Profiles — Model Reference

Everything a client (balena-cli, balena-ui, or any other pine consumer) needs to know
about the "profiles" feature to write correct pine/OData queries, without having to
read the open-balena-api/balena-api source. Scope: build-time `image_profile`, the
derived `application_profile_catalog` (up to and including its `available_since__release`
computed field), runtime `application_profile` activation, and `device_profile_override`.
Nothing added to the model after `available_since__release` is covered here.

## Mental model

A **profile** is just a docker-compose profile name (see
https://docs.docker.com/compose/how-tos/profiles/) baked into a hostApp release's
composition — e.g. `bluetooth`, `kernel-modules`, `metrics`. Turning a profile "on"
makes the extra service(s)/image(s) tagged with that name actually get pulled and run.
Four resources implement this, layered bottom-up:

```
image_profile                    (build-time: this image, in this release, offers profile X)
        │ hook-derived, upserted/pruned automatically
        ▼
application_profile_catalog      (per fleet+profile: "X exists as an option here")
        ▲ activation, independent resource
        │
application_profile              (fleet-wide: "fleet F wants profile X on hostApp H")
        ▲ per-device override, independent resource
        │
device_profile_override          (single device: "force X on/off on hostApp H, regardless of the fleet setting")
```

`image_profile` and `application_profile_catalog` are two different views of the same
underlying fact ("this profile exists for this app") — one is per-image/release
(build-time, many rows possible), the other is the deduplicated per-app catalog entry
(hook-maintained, exactly one row per app+profile-name that currently has at least one
image carrying it, in any release regardless of status).

`application_profile` and `device_profile_override` are the two **activation** layers:
fleet-wide default, and a per-device escape hatch. Neither one reads from the other —
a device's *effective* on/off state for a profile has to be computed by the caller (see
the worked example at the end).

## ⚠️ These resources only exist on the `/resin` model

All four resources (`image_profile`, `application_profile_catalog`, `application_profile`,
`device_profile_override`) are new enough that they were never backported into any
versioned API surface (`v6`, `v7`, …) — they only exist on the base `resin` model. This
matters because **`balena-sdk` does not default to `/resin/`**: as of `balena-sdk@23.x`
(the version both balena-ui and balena-cli currently pin), the SDK's own hardcoded
default is `apiVersion: 'v7'` (`pine.js`: `apiPrefix: new URL('/${apiVersion}/', apiUrl)`),
and neither client overrides it. `v7` is a frozen, separately-compiled SBVR snapshot
(`src/translations/v7/v7.sbvr` in open-balena-api) that predates this feature entirely —
it has no `image_profile`/`application_profile`/`device_profile_override`/
`application_profile_catalog` table at all, so **none of these four resources are
reachable through the SDK's default query path, not even as a nested `$expand`/`$filter`
target several hops away from an otherwise-ordinary resource** (e.g. `device` is a v7
resource, but `device → should_be_operated_by__release → release_image → image_profile`
still fails once it hits `image_profile`, because v7's model simply doesn't declare that
table/relationship — it's not a permissions issue, it's "unknown resource").

Two consequences for every query that touches any of these four resources, directly or
transitively:

1. **You must pass `apiPrefix: '/resin/'` explicitly**, on every call, including ones
   rooted at an otherwise-versioned-safe resource like `device` or `release` if the
   query navigates into a profile resource anywhere inside it.
2. **The SDK's high-level convenience helpers can't do this.** Methods like
   `sdk.models.device.getAllByApplication(...)` have no `apiPrefix` parameter at all —
   they always go through the SDK's own internal, version-locked resource calls. If you
   need to reach into `image_profile` etc., even from `device`, you have to drop down to
   the raw `sdk.pine.get`/`.post`/`.patch`/`.delete` calls instead of the model helpers.
   (This is a real bug that had to be fixed in balena-ui's own
   `getDevicesEligibleForProfile` — it originally used
   `sdk.models.device.getAllByApplication` to reach into `release_image`/`image_profile`,
   which type-checked fine but would fail at runtime.)

On top of the model-version gap, the installed SDK's **TypeScript types** also don't
know about any of these four resources yet — not as top-level resources, and (for
`image_profile`'s navigation from `ImageIsPartOfRelease`) not even as a property name.
So every touch needs a `// @ts-expect-error` annotation (with a short reason — the
convention used everywhere already is the literal comment `experimental typing`) at
whichever point TypeScript would otherwise complain, and since the SDK's automatic
`$select`/`$expand`-aware return-type inference gives up once it can't resolve a
resource/field, the response typically needs an explicit type annotation/cast instead
of relying on inference.

**balena-ui** already does this consistently in `src/shared/api/profile.ts` — this is
the proven, working pattern to copy:

```ts
const profiles = (await sdk.pine.get({
  apiPrefix: '/resin/',
  // @ts-expect-error experimental typing
  resource: 'application_profile_catalog',
  options: {
    // @ts-expect-error experimental typing
    $select: ['catalogs__profile_name', 'description'],
    $filter: {
      // @ts-expect-error experimental typing
      application: appId,
    },
  },
})) as Array<{ catalogs__profile_name: string; description: string | null }>;
```

**balena-cli** has no equivalent code yet (verified — there's currently zero usage of
`apiPrefix` or `/resin/` anywhere in its `src/`), but the same override applies
identically: it's on the same `balena-sdk@23.1.x` line, with the same unoverridden
`v7` default and the same missing types. A CLI command would look like:

```ts
import { getBalenaSdk } from '../../utils/lazy';

const sdk = getBalenaSdk();
const catalog = (await sdk.pine.get({
  apiPrefix: '/resin/',
  // @ts-expect-error experimental typing
  resource: 'application_profile_catalog',
  options: {
    // @ts-expect-error experimental typing
    $select: ['catalogs__profile_name', 'description'],
    $filter: {
      // @ts-expect-error experimental typing
      application: appId,
    },
  },
})) as Array<{ catalogs__profile_name: string; description: string | null }>;
```

Every query example later in this document needs `apiPrefix: '/resin/'` added the same
way if you're calling it through `balena-sdk` rather than directly against the API —
it's omitted from the examples below purely to keep them focused on the query shape
itself, not because it isn't required.

## Naming convention cheat-sheet

PineJS OData property names are derived mechanically from the underlying DB column
name: spaces become a single underscore, hyphens become a double underscore.

| DB field name (SQL) | OData property name |
|---|---|
| `catalogs-profile name` | `catalogs__profile_name` |
| `activates-profile name` | `activates__profile_name` |
| `overrides-profile name` | `overrides__profile_name` |
| `on-application` | `on__application` |
| `release image` | `release_image` |
| `available since-release` | `available_since__release` |

Every resource below is given by its OData name — that's what you `$select`/`$filter`/
put in a URL; the SQL name only matters if you're reading a migration or writing a raw
SQL query.

### Navigation synonyms

A few navigation properties are exposed under more than one name (all equivalent —
pick whichever reads best):

- `release` → its images: `release_image` (also `image__is_part_of__release`,
  `contains__image`) — collection of the release/image join rows.
- that join row → its profile tags: `image_profile` (also `release_image__has__profile_name`,
  `image__is_part_of__release__has__profile_name`) — collection of `image_profile` rows.

`image_profile` is the shortest and reads best; use it.

## 1. `image_profile` (build-time)

**What it means**: this specific image, as built into this specific release, activates
profile name X. Created/removed by the build pipeline as part of a release's images —
not something an end user normally touches directly, but it's readable and the model
around it (`release_image`) is exactly what you navigate through to answer "does this
release carry profile X".

**Fields**

| Field | Type | Notes |
|---|---|---|
| `id` | Serial | |
| `created_at` | Date Time | |
| `release_image` | FK → `image__is_part_of__release` | the (image, release) pair this tag applies to |
| `profile_name` | Short Text | validated, see below |

**Validation**: `profile_name` must match `/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/` (docker-compose
profile name rules) — enforced at write time (POST/PUT/PATCH), identically on
open-balena-api and balena-api. Not a DB CHECK, so don't expect a specific SQL error
text; expect `400`.

**Uniqueness**: `UNIQUE(release_image, profile_name)` — the same image/release pair
can't be tagged with the same profile name twice (a *different* profile name on the
same image, or the same profile name on a *different* image of the same release, are
both fine and common — a release with `main` and `ext-bluetooth` services could tag
both images with `bluetooth`, or one image with two different profile names via two rows).

**Permissions**:
- open-balena-api: `resin.image_profile.all` (full access) for the default authenticated role.
- balena-api: `read` scoped by `release_image/canAccess()`; `create`/`update` scoped by
  `can_create_release` on the underlying release; `delete` scoped by `can_delete_release`.
  Allowlisted fields: `read` → `id, created_at, release_image, profile_name`;
  `create` → `release_image, profile_name`; no fields are PATCH-able (`update: []`).

**Side effect**: creating or deleting an `image_profile` row automatically
upserts/prunes the matching `application_profile_catalog` row (hook-managed, see §2) —
you never create/delete catalog rows yourself.

### Examples

List every profile name an existing release carries:
```ts
await sdk.pine.get({
  resource: 'image_profile',
  options: {
    $select: 'profile_name',
    $filter: {
      release_image: {
        $any: { $alias: 'ri', $expr: { ri: { is_part_of__release: releaseId } } },
      },
    },
  },
});
```

Tag an image with a profile (`release_image` here is the id of the specific
`image__is_part_of__release` join row, not the image id or release id):
```ts
await sdk.pine.post({
  resource: 'image_profile',
  body: { release_image: releaseImageId, profile_name: 'bluetooth' },
});
```

## 2. `application_profile_catalog` (derived catalog)

**What it means**: "profile X currently exists as an option for app A" — the
deduplicated, per-app view over `image_profile`. A row exists as long as **at least
one** `image_profile` with that name exists somewhere in the app's releases,
**regardless of release status** (draft/failed releases count for existence, same as
the build pipeline's own bookkeeping) — that's different from `available_since__release`
below, which *does* filter to successful releases only.

**Fields**

| Field | Type | Notes |
|---|---|---|
| `id` | Serial | |
| `created_at` / `modified_at` | Date Time | |
| `application` | FK → `application` | the app (fleet or hostApp) this catalog entry belongs to |
| `catalogs__profile_name` | Short Text | |
| `description` | Text, nullable, ≤4000 chars | the only user-writable field |
| `available_since__release` | computed FK → `release`, nullable | see below |

**Lifecycle**: rows are entirely hook-managed (open-balena-api's
`src/features/profiles/hooks.ts`) — created the first time a matching `image_profile`
appears, deleted once the last matching `image_profile` for that app+name is gone.
**No one can `POST` or `DELETE` this resource directly** — not even an org admin — it's
root-only internally. Expect `401` on any attempt.

**Permissions**:
- open-balena-api: `read` + `update` (no `.all`, no create/delete for anyone).
- balena-api: `read` scoped by `application/canAccess()`; `update` scoped by
  `can_modify_hostapp_profiles` on the app. Allowlisted `read`:
  `id, created_at, modified_at, application, catalogs__profile_name, description`;
  `explicitRead` (readable, but only if you explicitly `$select` it — it's not
  returned by a bare `$select=*`): `available_since__release`; `update`: `description` only.

⚠️ **Row-scoped permission gotcha**: `update` is granted as a permission *string*, with
a *filter* narrowing which rows it applies to (`can_modify_hostapp_profiles` on the
app). If you `PATCH` a row your filter doesn't cover, PineJS still returns **`200` with
an empty body** — not `401` — because you *do* hold the `update` permission in
general, it just matched zero rows. `401` only happens if you hold *no* `update`
permission string for the resource at all. **Don't infer success from a `200` alone
when patching `description`** — re-read the row afterward if you need to confirm the
write actually landed.

### `available_since__release`

The **first** (earliest, by semver) successful release that actually carries an image
tagged with this catalog entry's profile name — i.e. "available since version ___".
It's a real navigable FK (you can `$expand` it exactly like a stored one, e.g.
`should_be_running__release`), but it's *computed*, not stored: there's no migration,
no write path, and nothing to keep in sync — it's derived fresh from `release` +
`image_profile` every time it's read.

Ordering, when more than one successful release carries the profile: semver
major/minor/patch ascending, then revision ascending, then — as a tie-break only,
independent of "earliest" — variant descending (prefers a `prod` build over `dev` if
two releases are otherwise identical), then `created_at` ascending.

It resolves to `null` if the catalog entry exists (some `image_profile` row references
it) but **no successful release** carries the profile yet (e.g. it currently only
exists in a draft/failed release).

⚠️ **You cannot correlate this from a client `$filter`.** There is no real FK/navigation
from `release`/`image_profile` back to `application_profile_catalog` — the match is by
*value* (same app id + same profile name text), not by relationship, which is exactly
why this had to be a computed field server-side in the first place. A pine `$filter`
can only compare a navigated field to a literal or to another field reachable by
navigating *from the same root* — it can never say "match this release's image_profile
name against that unrelated catalog row's own name field". Practically: if you're
computing something equivalent to `available_since__release` yourself in a `$filter`
(e.g. filtering `release` directly, see the worked example at the end), you must
already know the profile name and app id going in — you can't derive/verify them
symbolically inside the query. This is not a UI/CLI limitation to work around; it's the
reason the computed field exists.

### Examples

Read a catalog entry with its earliest-carrying release expanded:
```ts
await sdk.pine.get({
  resource: 'application_profile_catalog',
  options: {
    $select: ['id', 'catalogs__profile_name', 'description'],
    $filter: { application: appId, catalogs__profile_name: 'bluetooth' },
    $expand: { available_since__release: { $select: ['id', 'raw_version'] } },
  },
});
```

List the whole catalog for an app:
```ts
await sdk.pine.get({
  resource: 'application_profile_catalog',
  options: {
    $select: ['catalogs__profile_name', 'description', 'available_since__release'],
    $filter: { application: appId },
  },
});
```

Update the description (allowed; create/delete never are):
```ts
await sdk.pine.patch({
  resource: 'application_profile_catalog',
  id: catalogEntryId,
  body: { description: 'Enables extra kernel modules' },
});
```

## 3. `application_profile` (runtime activation, fleet-wide)

**What it means**: fleet F wants profile X turned on for its devices running hostApp
H. Existence = active; there's no separate boolean — deleting the row deactivates it.

**Fields**

| Field | Type | Notes |
|---|---|---|
| `id` | Serial | |
| `created_at` | Date Time | |
| `application` | FK → `application` | the fleet activating the profile |
| `activates__profile_name` | Short Text | validated, same regex as `image_profile.profile_name` |
| `on__application` | FK → `application` | the **hostApp** the profile applies to |

**Constraints**:
- DB necessity: `on__application` must have `is_host = true` and
  `is_of__class != 'block'` (you can activate a profile only on a real hostApp, never
  on a block/regular fleet).
- balena-api additionally requires, at create time, that `on__application` is
  `is_public` and the activating fleet's device type can access it (relevant for
  private device types) — checked via a granular permission filter, not a DB rule, so
  it surfaces as `401`, not `400`.
- `UNIQUE(application, activates__profile_name, on__application)` — activating the
  same profile on the same hostApp for the same fleet twice is a `409`.

**Permissions**:
- open-balena-api: `.all`.
- balena-api: `read` scoped by `application/canAccess()`; `create` additionally
  requires `can_modify_hostapp_profiles` on the activating fleet *and* the hostApp
  public/device-type-access check above; `update`/`delete` scoped by
  `can_modify_hostapp_profiles` alone. Allowlisted fields mirror the model exactly
  (`read`/`create`: `id, created_at, application, activates__profile_name,
  on__application`; nothing is PATCH-able).

### Examples

Activate:
```ts
await sdk.pine.post({
  resource: 'application_profile',
  body: { application: fleetId, activates__profile_name: 'bluetooth', on__application: hostAppId },
});
```

Deactivate:
```ts
await sdk.pine.delete({ resource: 'application_profile', id: activationId });
```

List a fleet's active profiles for a given hostApp:
```ts
await sdk.pine.get({
  resource: 'application_profile',
  options: {
    $select: 'activates__profile_name',
    $filter: { application: fleetId, on__application: hostAppId },
  },
});
```

## 4. `device_profile_override` (per-device override)

**What it means**: force profile X on or off for one specific device on hostApp H,
independent of (and overriding) whatever the device's fleet has activated via
`application_profile`. Unlike `application_profile`, this resource *does* carry an
explicit boolean, because it has to express both "force on" and "force off".

**Fields**

| Field | Type | Notes |
|---|---|---|
| `id` | Serial | |
| `created_at` | Date Time | |
| `device` | FK → `device` | |
| `overrides__profile_name` | Short Text | same validation regex |
| `on__application` | FK → `application` | the hostApp |
| `is_active` | Boolean, required | `true` = force on, `false` = force off |

**Constraints**:
- Same DB necessity as `application_profile`: `on__application` must be a hostApp
  (`is_host` and not `block`).
- **DB rule** (not just a hook): *"each device profile override that has a device and
  has an application, has a device that should be operated by a release that belongs
  to the application"* — i.e. `on__application` **must equal** the device's own
  `should_be_operated_by__release → belongs_to__application` at write time. You cannot
  create an override for a hostApp the device isn't actually currently running; doing
  so fails (`400`). This is enforced at the database level, so it holds regardless of
  who's writing or which deployment.
- balena-api additionally requires the same `is_public`/device-type-access check on
  `on__application` as `application_profile`, at create time.
- `UNIQUE(device, overrides__profile_name, on__application)` → `409` on a duplicate.
- Cascade: deleting the device deletes its overrides.

**Permissions**:
- open-balena-api: `.all`.
- balena-api: `read` scoped by `device/canAccess()`; `create` requires
  `can_modify_hostapp_profiles` on the device's fleet plus the hostApp
  public/device-type check; `update`/`delete` scoped by `can_modify_hostapp_profiles`
  via the device. Allowlist: `read`/`create` get the full field list above; `update`
  is restricted to `is_active` only (you can't repoint an override to a different
  device/profile/hostApp — delete and recreate instead).

### Examples

Create an override (force on):
```ts
await sdk.pine.post({
  resource: 'device_profile_override',
  body: { device: deviceId, overrides__profile_name: 'bluetooth', on__application: hostAppId, is_active: true },
});
```

Toggle:
```ts
await sdk.pine.patch({
  resource: 'device_profile_override',
  id: overrideId,
  body: { is_active: false },
});
```

Remove (revert to the fleet-wide setting):
```ts
await sdk.pine.delete({ resource: 'device_profile_override', id: overrideId });
```

List a device's overrides for a hostApp:
```ts
await sdk.pine.get({
  resource: 'device_profile_override',
  options: {
    $select: ['id', 'overrides__profile_name', 'is_active'],
    $filter: { device: deviceId, on__application: hostAppId },
  },
});
```

## Cross-cutting: computing a device's *effective* state for a profile

Neither activation layer knows about the other, so "is profile X effectively on for
this device" has to be computed client-side:

```
effective = deviceOverride.is_active   if a device_profile_override row exists
                                        for (device, profile, hostApp)
          = applicationProfile exists  otherwise, i.e. true iff an application_profile
                                        row exists for (device's fleet, profile, hostApp)
```

## Worked example: is a device eligible / does its current release carry a profile

The robust way to check "does this device's *actual currently-running* release carry
profile X" is to navigate `device → should_be_operated_by__release → release_image →
image_profile`, filtered to the exact profile name and scoped to the fleet/hostApp —
**not** to compare `should_be_operated_by__release`'s semver against
`available_since__release`'s version as a proxy. Version comparison is fragile (hotfix
branches, version resets, a profile being removed in a later release all break it);
checking for the tag's actual presence in the release is always correct.

```ts
await sdk.pine.get({
  resource: 'device',
  options: {
    $select: ['id', 'uuid', 'device_name'],
    $filter: {
      belongs_to__application: { $any: { $alias: 'bta', $expr: { bta: { id: fleetId } } } },
      should_be_operated_by__release: {
        $any: {
          $alias: 'sbobr',
          $expr: {
            sbobr: {
              belongs_to__application: {
                $any: { $alias: 'bta', $expr: { bta: { id: hostAppId } } },
              },
              release_image: {
                $any: {
                  $alias: 'ri',
                  $expr: {
                    ri: {
                      image_profile: {
                        $any: { $alias: 'ip', $expr: { ip: { profile_name: profileName } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});
```

The same shape works as a `$count` for a cheap eligible-devices count, and works
identically whether `profileName` came from a catalog row's `catalogs__profile_name`
or a literal you already have — the important part is that it's a value *you already
know*, supplied as-is, never something the query derives or verifies on your behalf
(see the `available_since__release` gotcha above).

---
Co-authored with Claude
