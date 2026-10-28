# Admin / verifier guide

Manual for the pdJ team using the verification dashboard at `/{lang}/admin`.
It covers what each screen does and the decisions behind it; the church protocol
itself (data model, copying rules, pastor bonus) is in
[church-registration.md](church-registration.md).

> Access is restricted to the wallets listed in
> `NEXT_PUBLIC_VERIFIER_WALLET` (comma-separated). The UI hides the dashboard
> for other wallets **and** every `/api/admin/*` route checks the same list
> server-side (`authenticateAdmin`), so the client-side check is only comfort.
> Route rules: [api-security.md](api-security.md).

## Dashboard (`/{lang}/admin`)

| Widget | Shows | Actions |
|---|---|---|
| **My Calendar** | Verifier availability, blocked slots and booked interviews (CalDAV/Radicale) | Block time, open an interview, delete a slot (✕, with a confirmation toast) |
| **Pending Verifications** | Users with a proposed interview date and no conducted date | Click a row to open the user modal |
| **Recent Users** | Last 20 users by `updated_at` | Click a row to open the user modal |
| **Recent Churches** | Last churches created | Click a row to open the church modal |
| **Premium Purchases** | Purchases per course (count, USDT, SLEARN, total) | Click a course to open the list of people **enrolled** (who bought it) |

Links at the bottom go to **All Users** (`/{lang}/admin/users`) and **All
Churches** (`/{lang}/admin/churches`).

## All Users (`/{lang}/admin/users`)

Table with ID, name (and email), wallet, country, church, score and actions
(`View Profile`, `Edit`). Search looks in username, name, email and wallet with a
300 ms debounce; the page shows 50 rows at a time.

## Reputation (`/{lang}/admin/reputation`)

Records and resolves **private** reputation evidence (R-#164 §2.4,
[church-directory.md](church-directory.md)). You enter a pastor's user id, a
reason (`dishonesty`, `sexual_abuse`, `zionism`, `other`), private notes and **at
least one file**; the evidence is stored privately and starts the private-first
process. A **different** verifier must resolve it (nobody is judge in their own
cause). What is **published** follows the process: a church appears in the
directory's "not recommended" section only after strong, unanswered evidence,
never with a crime label. Region type 2 churches are never published.

## The user modal (verification)

Opened from any user row or from a user id (`/{lang}/admin/user/{id}` is the
standalone page). It is the place where a profile gets verified.

1. **Profile fields**: the public **display name** (`nusuario`, read-only — it is what
   the public profile and the leaderboard publish), the real name, email, WhatsApp,
   Telegram, country, religion, position on Israel/Gaza (shown **only for Christians**,
   like `/profile`), passport name and nationality.
2. **Church data depends on whether the church exists** (`usuario.church_id`):
   - **Church not in the `church` table yet**: the modal keeps the declared
     church name (*Place of Worship*) and the autocompleted town (*City of Place
     of Worship*), and adds a block with the **pastor name and WhatsApp** so you
     can contact the pastor. For a lead pastor or co-pastor it also shows the
     **registration number, the denomination and the registration document
     (editable by the verifier)**.
   - **Church already registered**: the modal shows only the church's canonical
     **name and location** and hides the declaration and the pastor contact.

   The church controls (items 3, 4 and 6) appear **only for Christians**
   (`usuario.religion_id = 2`, R-#281). For any other religion the modal hides
   *Assign Church*, *Church Role* and the yellow create panel; the place-of-worship
   declaration stays for everyone (it feeds the profile score).
3. **Assign Church** (`ChurchSelector`): pick the existing church of that
   community. Saving with a `church_id` copies the pastor's registration number,
   denomination and document to the church (only when the church is missing
   them), sets `church.pastor_id` and keeps the one-pastor-per-church rule
   (a second lead pastor gets a **409** with the current pastor's name).
4. **Create the church** (yellow panel): appears while no church is assigned and
   the declaration has a church name, a country and pastor data. It calls
   `POST /api/admin/churches` and assigns the new church; save the modal
   afterwards so the registration data is copied.
5. **Interviews**: proposed and conducted date/time (`datetime-local`).
6. **Church Role**: the user's `church_relationship` (`pastor`, `co_pastor`,
   `leader`, `member`). Selecting `pastor` reveals the registration block.
7. **Verified fields**: one checkbox per confirmable field. Checking one copies
   the user's own value into the `verified_*` column; that is what the profile
   score reads (rules in `lib/score-rules.ts`, the single source of truth):
   26 name, 24 country, 9 email, 9 WhatsApp/Telegram, 7 GoodDollar, 9 location,
   9 church/place of worship, 7 interview. The church is worth **9 points**
   (Christians: `church_id` + verified church role; others: verified place of
   worship). Saving recalculates the score (`recalculateProfileScore`).
8. **ID documents**: front and back photos (Sierra Leone). The registration
   document is shown in the pastor block above, and can be replaced or deleted there.
9. **Referrals** (`Referidos`, R-#163): shows the user's own **referral code** (the
   one others type to be referred by them; read-only, because it already travels in
   sent links) and **who referred them** (`#id username (name)`) or *none*. The
   field below accepts the referrer's **user id, username or referral code** (empty
   removes the referrer) to fix a wrong declaration; the same rules as the claim
   endpoint apply (no self-referral, the referrer must not be a newer account) and
   the change is recorded in `verification_log` as `update_referrer`. When that
   referrer already received rewards for this user, the modal says so: changing the
   referrer **does not move** what was already paid, only what comes next
   (`lib/referral-admin.ts`).

## All Churches (`/{lang}/admin/churches`)

Table with ID, name, pastor, country, city, denomination and whether the
registration was verified. The church modal edits name, contact data, city,
denomination, **registration number** and the **registration document**
(view/upload/delete through
`/api/admin/church/{id}/registration-photo`), toggles
`registration_verified`, lists the members and soft-deletes the church.

Confirming `registration_verified` is what unlocks the **22 SLEARN pastor bonus**
(once per church; the conditions are in
[church-registration.md](church-registration.md) §4).

## All Clusters (`/{lang}/admin/clusters`)

Verifier view of the GD clusters (https://github.com/pasosdeJesus/learn.tg/issues/220
§5). The table lists ID, name, pseudonym, code, country, initiator church, member
count and **status** (pending / active / disbanded), with a search box (name,
pseudonym or code) and two filters: status and country.

- **Edit** opens a dialog with the name, the pseudonym and the status
  (`PUT /api/admin/clusters/{id}`). Renaming is rejected with **409** when another
  cluster of the same country already uses that name.
- **Disband** applies the soft delete (`DELETE /api/admin/clusters/{id}`): the
  cluster leaves the public ranking and its history stays. A verifier can also
  disband: the auth model has no separate admin role, and `authenticateAdmin`
  only distinguishes verifiers (documented simplification in
  `gd-admin-clusters.ts`).
- Changes are recorded in `userevent` and `clustergd_history`.

**The cluster wallet is not set here.** `church.cluster_wallet` (the address the 10%
of GD purchases and guide scholarships is routed to) is configured by the **cluster
initiator** on the cluster page `/{lang}/cluster/{id}`, which recommends a multisig
wallet shared by the cluster's pastors. The verifier can still correct it in the church
modal (*Cluster wallet*) when a cluster cannot do it, as a support path.

**Changing it with funds in it asks first.** The `ClusterFundsV2` fund is indexed by
the wallet address, so moving the wallet does not move the money: the old fund stays in
the old address, disappears from the ranking and cannot be released from the cluster
page. Both surfaces therefore answer **409 `cluster_wallet_has_funds`** when the current
wallet still holds funds; the cluster page and the church modal show a confirmation and
retry with `confirmMigrate: true`. The change is recorded in `clustergd_history` with
the amounts left behind, and the `userevent` carries `funds_left`.

### Presenting the cluster to Global Disciples

When the initiator requests the presentation (see
guide 6 of the GD course), the **GD** action appears for that cluster in
the table. The dialog shows the **proposed email** (To, subject and body, with a copy
button) so you can copy, paste and edit it in your mail client; it also lets you mark the
email as **sent** and record **GD's answer** and the **email or channel to continue**; the initiator gets an in-app notification and sees the answer on
the cluster page. pdJ is not GD staff: it only asks for the nearest program director's
contact or the channel GD suggests.

The public ranking (`/{lang}/gdcluster/ranking`, Clusters tab) also shows the
status of each cluster, next to the pseudonym and the fund columns.

## Issues to resolve (`/{lang}/admin/solves`)

The dashboard widget **Issues to resolve** counts the open rows of `admin_solves`,
the queue the money routes fill when something fails **after** a transfer: the 10% of a
GD course or guide scholarship that could not be recorded in `transaction`
(`gd_cluster_ledger`) or could not be routed to the cluster fund (`gd_cluster_transfer`).
Until 2026-10-28 nothing read that table, so an unrecorded 10% was invisible.

The page lists ID, type, date, `metadata` and status, with filters by status
(pending / resolved / all) and by type. Each row shows the raw metadata needed to check
it (transaction hash, course, guide, user, amounts). **The platform does not retry by
itself**: check the transfer on the explorer, record the missing ledger row if it
corresponds, and then press **Mark resolved** with a short note. The resolution stores
`solved_at`, `solved_by` (your account) and the note, and logs `admin_solve_resolved` in
`userevent`.

Endpoints: `GET /api/admin/solves?status=&type=&limit=` and
`PUT /api/admin/solves/{id}` (`{ note }`), both verifier-only.

## Wallets and credentials

The user modal ends with **Wallets and credentials** (R-#265). It lists every wallet of the
account (an account may have several: the in-app one plus external ones) and every course
credential (SBT), with the wallet that **holds** it.

- A credential is minted to the wallet that completed the course. Losing or exposing that
  wallet does not lose the account (progress, scores and privacy switches follow the user),
  but an attacker holding the key would appear as the holder of the SBT.
- **Revoke** burns the credential of the compromised wallet (`POST
  /api/admin/credentials/revoke`); then choose another wallet **of the same account** and
  **Re-mint** (`POST /api/admin/credentials/re-mint`). Both actions are logged
  (`userevent`: `admin_credential_revoke`, `admin_credential_remint`).
- The automatic flow never re-mints a credential the learner revoked on purpose; only this
  explicit admin action does. Historical emissions may show no wallet (the column was
  added on 2026-10-16 and is not invented for old rows).

## Rules to keep in mind

- **Documents are private.** Identity and registration files are never in
  `public/`; they are served through APIs. `GET /api/user/id-photo/[userId]`
  answers only to the **owner or an admin**.
- **No PII in logs.** Console logs in routes must not print names, phones or
  emails; log booleans and reasons only.
- **Privacy switches win.** Public surfaces filter per-user visibility
  (https://github.com/pasosdeJesus/learn.tg/issues/259); a hidden item must look
  absent, never "shorter".
- **The pastor declares, the verifier confirms.** The registration number and
  denomination are edited by the pastor in their profile; the modal shows them
  **editable by the verifier** (number, denomination and the document), so a pastor who
  cannot upload it does not block the process. The pastor declares it first from the
  profile.

## Where it lives

- Dashboard and widgets: `app/[lang]/admin/page.tsx`,
  `components/admin/AdminWidgets.tsx` (`PendingWidget`, `RecentUsersWidget`,
  `RecentChurchesWidget`, `UserEditModal`, `ChurchEditModal`),
  `components/admin/CalendarWidget.tsx`, `PremiumPurchasesWidget.tsx`.
- Pages: `app/[lang]/admin/users/page.tsx`, `app/[lang]/admin/churches/page.tsx`,
  `app/[lang]/admin/user/[id]/page.tsx`.
- APIs: `app/api/admin/*` (in the `app/api` submodule). Shared selects:
  `components/shared/{ChurchSelector,TownAutocomplete,PhotoUpload,FormSelects}`.
