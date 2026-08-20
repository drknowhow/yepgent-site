<#
.SYNOPSIS
  One-step installer for Local Yep (the `yepgent` / `gent` Claude Code add-on).

.DESCRIPTION
  Bootstraps a tester/user in a single command:
    1. checks for Python 3.10+ and Claude Code (`claude`),
    2. ensures pipx, then installs Local Yep (from a wheel, the Git repo, or PyPI),
    3. configures the entitlement public key (+ optional fully-gated mode),
    4. optionally applies an activation token,
    5. points you at `gent`.

  Local Yep runs on YOUR own Claude Code (Pro/Max or API key) — it never touches
  your Claude credentials. The only hard prerequisite it cannot install for you
  is Claude Code itself.

.PARAMETER Wheel
  Path or https URL to a local-yep .whl. Implies -Source wheel.

.PARAMETER Source
  Where to install from: wheel | git | pypi. Default: wheel — using -Wheel if
  given, else the hosted alpha wheel at https://yepgent.com/dl/.

.PARAMETER GitUrl
  The Git source (private repo) used when -Source git.

.PARAMETER Pubkey
  The entitlement PUBLIC key (base64url) testers verify licenses against.
  Defaults to the alpha key. Public — safe to ship.

.PARAMETER Gated
  Enable fully-gated mode (YEPGENT_REQUIRE_ACTIVATION=1): Local Yep refuses to
  run without a valid activation token. Use for a gated alpha.

.PARAMETER Token
  An activation token to apply now. If omitted in an interactive shell you are
  prompted; otherwise you can run `yepgent license activate <token>` later.

.PARAMETER AcceptTerms
  Accept the alpha Terms (TERMS.md) non-interactively. Required for unattended /
  piped installs; interactive installs prompt you to type "I AGREE" instead.

.EXAMPLE
  # gated alpha, install from a wheel you were given, prompt for the token
  ./install.ps1 -Wheel .\local_yep-0.1.0-py3-none-any.whl -Gated
#>
[CmdletBinding()]
param(
  [string]$Wheel,
  [ValidateSet('wheel', 'git', 'pypi')][string]$Source,
  [string]$GitUrl = 'git+https://github.com/drknowhow/yepgent-local.git',
  [string]$Pubkey = 'TsiByx8LlpIdrtXhpbnJTMGQr8newB8TKRox4tkoW8Q',
  [switch]$Gated,
  [string]$Token,
  [switch]$AcceptTerms
)

# Hosted alpha wheel — used when neither -Wheel nor -Source is given, so the
# one-liner works for testers who have no access to the private repo.
# RELEASE STEP: bump this version AND upload the new wheel to yepgent.com/dl/.
$DefaultWheel = 'https://yepgent.com/dl/local_yep-0.3.1-py3-none-any.whl'

$ErrorActionPreference = 'Stop'
function Info([string]$m) { Write-Host "[install] $m" -ForegroundColor Cyan }
function Warn([string]$m) { Write-Host "[install] $m" -ForegroundColor Yellow }
function Die([string]$m)  { Write-Host "[install] $m" -ForegroundColor Red; exit 1 }

# --- Source availability (checked BEFORE we touch anything) -----------------
# Both non-wheel sources exist for the operator, not for testers, and both fail
# in ways that look like a successful install if we let them run:
#   pypi -> PyPI currently holds only a ~2 KB NAME RESERVATION (0.0.1a1), no
#           agent code and no console scripts, so `gent` would simply not exist.
#   git  -> drknowhow/yepgent-local is PRIVATE; a tester's clone 404s.
# Fail loudly here rather than after installing pipx and downloading nothing.
if ($Source -eq 'pypi') {
  Die "-Source pypi is not available yet: PyPI holds only a name reservation for 'local-yep' (no agent code, no 'gent' command). Install the hosted wheel instead - drop -Source, or pass -Wheel https://yepgent.com/dl/local_yep-0.3.1-py3-none-any.whl"
}
if ($Source -eq 'git') {
  Die "-Source git needs access to the private source repo, which alpha testers do not have. Drop -Source to install the hosted wheel from https://yepgent.com/dl/."
}

# --- 0. Terms acknowledgment ------------------------------------------------
$TermsVersion = 'alpha-1'
function Accept-Terms {
  Write-Host ''
  Write-Host '[install] Local Yep - Alpha. Please read before installing.' -ForegroundColor Cyan
  Write-Host '[install] This is pre-release software provided "AS IS", without warranty.'
  Write-Host '[install] By installing you acknowledge:'
  Write-Host '[install]   1. It runs on YOUR own Claude/Anthropic account - YOU are responsible'
  Write-Host '[install]      for complying with Anthropic''s terms and for all usage and charges.'
  Write-Host '[install]      Local Yep never proxies or resells Claude.'
  Write-Host '[install]   2. Yep is an AI agent that can act on your machine (files, tools, APIs).'
  Write-Host '[install]      AI can be wrong. You supervise it and own what it does.'
  Write-Host '[install]   3. Memory and credentials are stored locally; backups are your job.'
  Write-Host '[install]   4. Third-party tools/packs run at your own risk; output is NOT'
  Write-Host '[install]      professional advice.'
  Write-Host '[install]   5. To the maximum extent permitted by law, the authors are NOT liable'
  Write-Host '[install]      for damages arising from use.'
  Write-Host '[install] Full terms: TERMS.md'
  Write-Host ''
  $mode = ''
  if ($AcceptTerms) {
    $mode = 'flag'
    Info "Terms ($TermsVersion) accepted via -AcceptTerms."
  } elseif ([Environment]::UserInteractive) {
    $reply = Read-Host 'Type "I AGREE" to accept the Terms and continue'
    if ($reply.Trim().ToUpper() -ne 'I AGREE') { Die 'Terms not accepted - installation aborted.' }
    $mode = 'typed'
  } else {
    Die 'Non-interactive install: re-run with -AcceptTerms to accept the Terms (TERMS.md).'
  }
  try {
    $hd = Join-Path $HOME '.local-yep'
    New-Item -ItemType Directory -Force -Path $hd | Out-Null
    $ts = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    [pscustomobject]@{
      product       = 'local-yep'
      terms_version = $TermsVersion
      accepted      = $true
      accepted_at   = $ts
      method        = 'install.ps1'
      mode          = $mode
    } | ConvertTo-Json | Set-Content -Path (Join-Path $hd 'ACCEPTED_TERMS.json') -Encoding utf8
  } catch {
    Warn 'could not record acceptance marker (continuing).'
  }
}
Accept-Terms

# --- 1. Python --------------------------------------------------------------
$py = $null
foreach ($c in @('python', 'py')) {
  $cmd = Get-Command $c -ErrorAction SilentlyContinue
  if ($cmd) { $py = $cmd.Source; break }
}
if (-not $py) {
  Die "Python 3.10+ is required. Install it from https://www.python.org/downloads/ (check 'Add to PATH'), then re-run."
}
Info "python: $py"

# --- 2. pipx + install ------------------------------------------------------
if (-not (Get-Command pipx -ErrorAction SilentlyContinue)) {
  Info "installing pipx (one-time)..."
  & $py -m pip install --user --upgrade pipx
  & $py -m pipx ensurepath | Out-Null
}

if (-not $Source) { $Source = 'wheel'; if (-not $Wheel) { $Wheel = $DefaultWheel } }

switch ($Source) {
  'wheel' {
    if (-not $Wheel) { Die "-Source wheel needs -Wheel <path-or-url>." }
    $target = $Wheel
    if ($Wheel -match '^https?://') {
      $target = Join-Path $env:TEMP ([IO.Path]::GetFileName($Wheel))
      Info "downloading wheel..."
      Invoke-WebRequest -Uri $Wheel -OutFile $target
    }
    Info "installing Local Yep from wheel: $target"
    & $py -m pipx install --force $target
  }
  'git'  { Info "installing Local Yep from git: $GitUrl"; & $py -m pipx install --force $GitUrl }
  'pypi' { Info "installing Local Yep from PyPI: local-yep"; & $py -m pipx install --force 'local-yep' }
}

# Resolve the pipx bin dir so we can call yepgent/gent in THIS session (a fresh
# shell would pick them up from PATH after ensurepath).
$bin = (& $py -m pipx environment --value PIPX_BIN_DIR) 2>$null
$yepgent = if ($bin) { Join-Path $bin 'yepgent.exe' } else { 'yepgent' }
if (-not (Test-Path $yepgent)) { $yepgent = 'yepgent' }  # fall back to PATH

# --- 3. configure entitlement verification + gate ---------------------------
if ($Pubkey) {
  # Durable lane FIRST: a file in the Local Yep home is read identically from a
  # scheduled task, a service, an IDE terminal, or a shell that never inherited
  # the User environment. The env var below stays as an override.
  $lyHome = Join-Path $HOME '.local-yep'
  try {
    if (-not (Test-Path $lyHome)) { New-Item -ItemType Directory -Path $lyHome -Force | Out-Null }
    Set-Content -Path (Join-Path $lyHome 'entitlement_pubkey') -Value $Pubkey -Encoding ascii -NoNewline
    Info "entitlement public key written to $lyHome\entitlement_pubkey"
  } catch {
    Warn "could not write the entitlement public key file (continuing): $_"
  }
  [Environment]::SetEnvironmentVariable('LOCAL_YEP_TOOLSPACE_PUBKEY', $Pubkey, 'User')
  $env:LOCAL_YEP_TOOLSPACE_PUBKEY = $Pubkey
  Info "entitlement public key configured (User scope)."
}
if ($Gated) {
  [Environment]::SetEnvironmentVariable('YEPGENT_REQUIRE_ACTIVATION', '1', 'User')
  $env:YEPGENT_REQUIRE_ACTIVATION = '1'
  Info "fully-gated mode ON — an activation token is required to run."
}

# --- 4. Claude Code check ---------------------------------------------------
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Warn "Claude Code ('claude') not found on PATH. Install it from https://claude.com/claude-code"
  Warn "Local Yep runs on YOUR Claude Code; `gent` needs it present."
}

# --- 5. activation ----------------------------------------------------------
if (-not $Token -and $Gated -and [Environment]::UserInteractive) {
  $Token = Read-Host "Paste your activation token (or press Enter to skip)"
}
if ($Token) {
  Info "activating..."
  & $yepgent license activate $Token
}

Write-Host ""
Info "Done. Open a NEW terminal (so PATH refreshes), then run:  gent"
if ($Gated -and -not $Token) {
  Warn "Gated mode is on but no token applied yet — run: yepgent license activate <token>"
}
