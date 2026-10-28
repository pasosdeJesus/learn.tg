# Presenting a cluster to Global Disciples (GD)

How a finished cluster asks pdJ to present it to **Global Disciples**, how pdJ answers
and how the cluster continues directly with GD. Feature of the GD course
(https://github.com/pasosdeJesus/learn.tg/issues/161, decision of 2026-10-27).

> **pdJ is not part of GD's staff.** It has contacts in GD. It does not assign program
> directors, does not connect the cluster with a director by itself and does not prepare
> the local budget. Its job here is to ask GD for the contact of the nearest program
> director (in the country or abroad) or for the channel GD suggests, and to pass the
> cluster the answer.

## 1. Eligibility

The platform computes it in `packages/gdcluster/src/lib/gd-presentation.ts`:

| Condition | Rule |
|---|---|
| Cluster | `status = 'active'` and **3 or more** member churches |
| Pastors | every principal pastor (`church_relationship = 'pastor'`) of the member churches |
| Course | finished the GD course: the 6 guides with `guide_usuario.points > 0` |
| Profile | `usuario.profilescore > 90` (`MIN_PROFILE_SCORE`) |
| Invited a pastor | at least one referred user with role `pastor`/`co_pastor` (`referralrelationship`) |
| Invited a member | at least one referred user with role `member`/`leader` whose `church_id` is the pastor's own church |

A church without a principal pastor blocks the request. The thresholds live in that
file so the business rule has one place.

## 2. The request

- `GET /api/cluster/[id]/gd-presentation?walletAddress=…` — conditions and status.
  Only for pastors of the cluster's churches (or the initiator); a non-member gets 403.
  The **answer from GD and the contact email are returned only to the initiator**;
  members see the request and sent dates.
- `POST /api/cluster/[id]/gd-presentation` — `{ walletAddress }`, **initiator only**.
  `400` with `missing` / `pastors[].missing` when a condition is not met; idempotent
  when the request already exists.
- On success it writes `clustergd.gd_requested_at` / `gd_requested_by`, the history
  event `gd_presentation_requested` and the `userevent`.

Surfaces: the cluster page `/{lang}/cluster/{id}` (full detail) and the "Your cluster"
card of the GD course page (compact control for the initiator, component
`components/GdPresentationControl.tsx`).

## 3. pdJ's step (admin)

In `/{lang}/admin/clusters`, the **GD** action appears for a cluster that requested the
presentation. The dialog:

1. **The email proposal** is shown on screen (To, subject and body) with the cluster
   name, code, country, initiator church, cluster wallet and member churches, asking for
   the nearest program director's contact or the channel to continue. pdJ **copies,
   pastes and edits it in their mail client**; the block also has a copy button. The
   address comes from `NEXT_PUBLIC_GD_CONTACT_EMAIL` (it can be edited after pasting).
   The app does not open a mail client and does not send anything.
2. **Email sent to GD** (checkbox) writes `gd_sent_at` / `gd_sent_by` and the history
   event `gd_presentation_sent`.
3. **Answer from GD** writes `gd_response` / `gd_response_at` / `gd_response_by` and the
   history event `gd_presentation_response`; it **notifies the initiator**.
4. **Email or channel GD indicates** is stored in `gd_contact_email` and shown to the
   initiator, who continues the conversation directly with GD.

The app does **not** send email by itself and does not even open a mail client: it only
shows the proposal so pdJ can copy, paste and modify it. That was the operator's decision
(2026-10-27).

## 4. Data

`clustergd` gained (migration `20261027200000_cluster_gd_presentation`):
`gd_requested_at`, `gd_requested_by`, `gd_sent_at`, `gd_sent_by`, `gd_response`,
`gd_response_at`, `gd_response_by`, `gd_contact_email`.

## 5. Tests

- `packages/gdcluster/src/routes/__tests__/gd-presentation.test.ts` — auth, initiator
  permission, 400 with reasons, idempotence, and the visibility of the answer.
- `apps/web/components/__tests__/GdPresentationControl.test.tsx` — the course-page
  control: hidden without a session or for a member, missing conditions with the link to
  the cluster page, the confirmation checkbox, the POST, and the recorded answer/contact.
- E2E `cluster-formation.spec.mjs` checks that the endpoint requires a session and that
  a verifier who is not a member gets 403. The full happy path needs three pastor
  fixtures with the course, the score and the invitations.
- `packages/gdcluster/src/routes/__tests__/gd-admin-clusters.test.ts` — the verifier side:
  the detail answers `initiator_church` (not the old `leader_church`), GD data is refused
  before the request exists, and recording the answer notifies the initiator in their
  language.

### 5.1 Checking the eligibility rules against a real database

The threshold logic is unit-tested with a mocked Kysely, so the two raw SQL queries
(`cor1440_gen_actividadpf` totals and `guide_usuario` progress) are worth one real run
before deploying. On a local database (`learntg_des`, `PGHOST` in `apps/.env`):

1. Create an active cluster with three churches that have a `pastor` user and add them
   to `church_clustergd`.
2. Call `getPresentationReadiness(db, <id>)` from a scratch script that imports
   `packages/gdcluster/dist/lib/gd-presentation.js` (a Vitest test cannot: its setup mocks
   `kysely`). With no progress the answer is `ready: false` and every pastor lists
   `course`/`invite_pastor`/`invite_member`; `guides_total` must be **6**, which proves
   the totals query rendered.
3. Insert the six `guide_usuario` rows of course 10 (`amountpaid`, `profilescore` and
   `points` are NOT NULL) plus two `referralrelationship` rows (a `pastor`/`co_pastor` and
   a `member`/`leader` of **the same church**): that pastor becomes `missing: []` while
   `ready` stays false until the other pastors qualify.
4. Delete the fixtures (`referralrelationship`, `guide_usuario`, `church_clustergd`,
   `clustergd`) and confirm the counts are back; `points > 0` feeds the learning score, so
   leftover rows would change it.

Validated this way on 2026-10-27: three pastors, `guides_total: 6`, profile 93, one pastor
fully eligible, cluster still `ready: false` because of its peers.
