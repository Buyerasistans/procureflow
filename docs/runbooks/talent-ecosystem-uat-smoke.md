# Talent Ecosystem UAT Smoke Checklist

Use this checklist before merging or deploying the procurement talent network workstream.
Run it with a platform admin account that can access payout review and talent KYC controls.

## Scope

- Admin payout flow: `/admin/payout-requests`
- Talent admin control flow: `/admin/talent-ecosystem`
- Friendly error UX for admin-facing failures

## Preconditions

- Backend API is running and reachable from the web app.
- Frontend build is current.
- At least one payout request exists in each state needed for the transition test, or seed data is available.
- At least one talent profile exists with KYC `pending`.
- Test operator has a role allowed to review payouts and KYC.

## Route Access

- [ ] Open `/admin/payout-requests`.
- [ ] Confirm the payout table loads without a blank screen.
- [ ] Confirm the status filter is visible and labeled.
- [ ] Open `/admin/talent-ecosystem`.
- [ ] Confirm the talent profile table and payout summary load without a blank screen.
- [ ] Confirm the KYC filter is visible and labeled.

## Payout Happy Path

- [ ] Find a payout with status `Bekliyor`.
- [ ] Click `Onayla`.
- [ ] Confirm the row refreshes to `Onaylandı`.
- [ ] Click `İşleme Al`.
- [ ] Confirm the row refreshes to `İşlemde`.
- [ ] Click `Ödendi`.
- [ ] Confirm the row refreshes to `Ödendi`.

## Payout Reject Path

- [ ] Find a payout with status `Bekliyor`.
- [ ] Click `Reddet`.
- [ ] Confirm the inline rejection reason field appears.
- [ ] Submit with an optional reason.
- [ ] Confirm the row refreshes to `Reddedildi`.
- [ ] Confirm no raw backend exception text is displayed.

## Talent KYC Review

- [ ] Open `/admin/talent-ecosystem`.
- [ ] Filter KYC status to `Bekliyor`.
- [ ] Click `Onayla` on a pending profile.
- [ ] Confirm the row refreshes to `Onaylı`.
- [ ] Repeat with another pending profile and click `Reddet`.
- [ ] Confirm the row refreshes to `Reddedildi`.

## Error UX Smoke

Simulate or trigger a forbidden/not-found/invalid-transition response in a non-production environment.

- [ ] Payout errors show a friendly Turkish message.
- [ ] Talent admin errors show a friendly Turkish message.
- [ ] UI does not display raw `detail.message`, Python/JS exception text, stack traces, or request internals.
- [ ] Browser console does not show a render crash after the failed action.

## Acceptance

- [ ] All checked flows pass.
- [ ] Any failed item has an owner and rollback decision before release.
- [ ] Screenshots or short notes are attached to the release ticket.
