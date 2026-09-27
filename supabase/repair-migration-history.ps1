<#
.SYNOPSIS
    Reconcile Supabase migration history for Tradibu, then apply the one migration
    that is genuinely new.

.DESCRIPTION
    Why this script exists
    ----------------------
    `supabase migration list` reports 43 migrations as "pending" (blank remote
    column) starting at 20260714004000. That is a HISTORY problem, not a SCHEMA
    problem. Read-only probes against the live project proved every one of those
    migrations is already applied:

      * all 14 tables they introduce exist in production (product_variants,
        inventory_reservations, product_metrics, carts, cart_items, order_events,
        site_visits, platform_policies, collection_rules, marketplace_collections,
        marketplace_collection_products, variant_stock_movements,
        admin_order_exports, message_safety_flags);
      * orders.payment_status / payment_reference / paid_at all exist, so
        20260926000000_paystack_payment_lifecycle is applied too.

    Running `supabase db push` in that state is DANGEROUS: it would try to re-apply 42
    migrations whose objects already exist, fail on CREATE TABLE conflicts, and leave
    the schema half-mutated.

    The correct remedy is to tell Supabase the truth - mark those versions applied -
    and then push, which applies only 20260927000000 (the inventory fix).

.EXAMPLE
    powershell -File supabase\repair-migration-history.ps1          # dry run
    powershell -File supabase\repair-migration-history.ps1 -Apply   # execute
#>
[CmdletBinding()]
param(
    [switch]$Apply
)

# Continue rather than Stop: the Supabase CLI writes progress lines ("Initialising
# login role...", "Connecting to remote database...") to stderr, and Windows
# PowerShell turns any native stderr output into an error record, which would abort
# the script on the very first call. Real failures are handled explicitly with
# `throw` and $LASTEXITCODE checks below instead.
$ErrorActionPreference = 'Continue'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backupDir = Join-Path $env:TEMP 'tradibu-db-backup'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Write-Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "  $text" -ForegroundColor Yellow }

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    throw 'Supabase CLI not found. Install it, then re-run.'
}
if (-not $env:SUPABASE_DB_PASSWORD) {
    Write-Warn 'SUPABASE_DB_PASSWORD is not set; the CLI will prompt when it needs it.'
}

# The newest migration is excluded on purpose: it is the one that really is new and
# must be applied by `db push`, not marked as applied.
$newMigration = '20260927000000'
$all = Get-ChildItem (Join-Path $projectRoot 'supabase\migrations') -Filter *.sql |
    Sort-Object Name | ForEach-Object { $_.BaseName }
if ($all.Count -eq 0) { throw 'No migrations found.' }

Write-Step 'Current state (read-only)'
$list = supabase migration list 2>&1

# A row counts as "not applied" when the local version has a backticked value and the
# remote column does not. A blank remote column renders like this: `20260714004000` | ` `.
$pendingVersions = @(
    $list |
    Where-Object { $_ -match '`\d{14}`' -and $_ -notmatch '`\d{14}`\s*\|\s*`\d{14}`' } |
    ForEach-Object { ([regex]::Match($_, '`(\d{14})`')).Groups[1].Value } |
    Where-Object { $_ } |
    Sort-Object -Unique
)
$toRepair = @($pendingVersions | Where-Object { $_ -ne $newMigration })

Write-Host "  migrations in repo              : $($all.Count)"
Write-Host "  reported as not applied         : $($pendingVersions.Count)"
Write-Host "  will be marked applied (repair) : $($toRepair.Count)"
if ($toRepair.Count -gt 0) {
    Write-Host "    from $($toRepair[0])  to  $($toRepair[-1])"
}
Write-Host "  left for a real db push         : $newMigration (inventory reservation fix)"

if ($toRepair.Count -eq 0) {
    Write-Ok 'history already matches the database - nothing to repair.'
}

if (-not $Apply) {
    Write-Step 'Dry run - nothing was changed'
    Write-Host '  1. back up the live database (supabase db dump)'
    Write-Host '  2. snapshot the remote schema for the record (supabase db diff)'
    Write-Host "  3. supabase migration repair --status applied   (x$($toRepair.Count))"
    Write-Host '  4. verify the history is clean'
    Write-Host '  5. db push -> applies ONLY the inventory migration, then verify the stock fix'
    Write-Host ''
    Write-Host 'Re-run with -Apply to execute.'
    return
}

if (-not $env:SUPABASE_DB_PASSWORD) {
    Write-Warn 'Set SUPABASE_DB_PASSWORD before running -Apply so the CLI is not blocked on a prompt.'
    throw 'Database password is required to repair history.'
}
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Step '1/5  Backing up the live database'
$dump = Join-Path $backupDir "db-$stamp.sql"
supabase db dump --linked --file $dump
if (-not (Test-Path $dump)) {
    throw "Backup failed - stop here.$([Environment]::NewLine)  No repair has been made yet, so the database is untouched."
}
Write-Ok "backup written: $dump"

Write-Step '2/5  Snapshotting the remote schema (for the record)'
$diff = Join-Path $backupDir "remote-schema-$stamp.sql"
supabase db diff --linked --schema public --file $diff
if (Test-Path $diff) { Write-Ok "schema snapshot: $diff" } else { Write-Warn 'no snapshot produced' }

Write-Step "3/5  Marking $($toRepair.Count) migrations as applied"
$failed = @()
foreach ($version in $toRepair) {
    supabase migration repair --status applied $version | Out-Null
    if ($LASTEXITCODE -ne 0) { $failed += $version; Write-Warn "failed: $version" }
}
if ($failed.Count -gt 0) {
    throw "Repair failed for: $($failed -join ', '). The command is idempotent, so just re-run it."
}
Write-Ok 'all versions marked as applied'

Write-Step '4/5  Verifying the history'
$after = supabase migration list 2>&1
$stillPending = @($after | Where-Object { $_ -match '`\d{14}`' -and $_ -notmatch '`\d{14}`\s*\|\s*`\d{14}`' })
Write-Host "  still reported as not applied: $($stillPending.Count) (expected: 1)"
$stillPending | ForEach-Object { Write-Host "    $_" }

Write-Step '5/5  Applying the one new migration (dry run first)'
supabase db push --dry-run
Write-Host ''
$answer = Read-Host 'Apply the inventory migration now? Type APPLY to continue'
if ($answer -ne 'APPLY') { Write-Warn 'Stopped before applying. History is repaired; re-run when ready.'; return }
supabase db push
Write-Ok 'pushed'

Write-Step 'Verify the stock fix (Supabase SQL editor)'
@'
-- 1. reservations now exist for orders that still hold stock
select count(*) as reservations from public.inventory_reservations;

-- 2. stuck pending orders should reach zero within ~5 minutes
select count(*) as stuck_pending from public.orders
 where status = 'pending' and reservation_expires_at <= now();

-- 3. the sweeper is registered and active
select jobid, jobname, schedule, active from cron.job
 where jobname = 'expire-pending-orders';

-- 4. no cancelled order is left holding unreleased stock
select count(*) as unreleased from public.inventory_reservations
 where status = 'reserved'
   and order_id in (select id from public.orders where status = 'cancelled');
'@ | Write-Host
