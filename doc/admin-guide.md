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
