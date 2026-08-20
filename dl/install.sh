#!/usr/bin/env bash
# One-step installer for Local Yep (the `yepgent` / `gent` Claude Code add-on).
#
# Bootstraps a tester/user in a single command:
#   1. checks for Python 3.10+ and Claude Code (`claude`),
#   2. ensures pipx, then installs Local Yep (from a wheel, the Git repo, or PyPI),
#   3. configures the entitlement public key (+ optional fully-gated mode),
#   4. optionally applies an activation token,
#   5. points you at `gent`.
#
# Local Yep runs on YOUR own Claude Code (Pro/Max or API key) — it never touches
# your Claude credentials. The one prerequisite it cannot install for you is
# Claude Code itself.
#
# Usage:
#   ./install.sh [--wheel <path|url>] [--source wheel|git|pypi] [--git-url <url>]
#                [--pubkey <b64>] [--gated] [--token <token>] [--accept-terms]
#
# With no --wheel and no --source it installs the hosted alpha wheel from
# https://yepgent.com/dl/ (see DEFAULT_WHEEL below).
#
# Example (gated alpha from a wheel, prompt for the token):
#   ./install.sh --wheel ./local_yep-0.1.0-py3-none-any.whl --gated
set -euo pipefail

WHEEL=""; SOURCE=""; TOKEN=""; GATED=0; ACCEPT_TERMS=0
GIT_URL="git+https://github.com/drknowhow/yepgent-local.git"
PUBKEY="TsiByx8LlpIdrtXhpbnJTMGQr8newB8TKRox4tkoW8Q"
# Hosted alpha wheel — used when neither --wheel nor --source is given, so the
# one-liner works for testers who have no access to the private repo.
# RELEASE STEP: bump this version AND upload the new wheel to yepgent.com/dl/.
DEFAULT_WHEEL="https://yepgent.com/dl/local_yep-0.3.1-py3-none-any.whl"

while [ $# -gt 0 ]; do
  case "$1" in
    --wheel)   WHEEL="$2"; shift 2 ;;
    --source)  SOURCE="$2"; shift 2 ;;
    --git-url) GIT_URL="$2"; shift 2 ;;
    --pubkey)  PUBKEY="$2"; shift 2 ;;
    --token)   TOKEN="$2"; shift 2 ;;
    --gated)   GATED=1; shift ;;
    --accept-terms) ACCEPT_TERMS=1; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "[install] unknown option: $1" >&2; exit 2 ;;
  esac
done

info() { printf '[install] %s\n' "$*"; }
warn() { printf '[install] %s\n' "$*" >&2; }
die()  { printf '[install] %s\n' "$*" >&2; exit 1; }

# --- Source availability (checked BEFORE we touch anything) -----------------
# Both non-wheel sources exist for the operator, not for testers, and both fail
# in ways that look like a successful install if we let them run:
#   pypi -> PyPI currently holds only a ~2 KB NAME RESERVATION (0.0.1a1), no
#           agent code and no console scripts, so `gent` would simply not exist.
#   git  -> drknowhow/yepgent-local is PRIVATE; a tester's clone 404s.
# Fail loudly here rather than after installing pipx and downloading nothing.
case "$SOURCE" in
  pypi)
    die "--source pypi is not available yet: PyPI holds only a name reservation for 'local-yep' (no agent code, no 'gent' command). Install the hosted wheel instead — just drop --source, or pass --wheel https://yepgent.com/dl/local_yep-0.3.1-py3-none-any.whl" ;;
  git)
    die "--source git needs access to the private source repo, which alpha testers do not have. Drop --source to install the hosted wheel from https://yepgent.com/dl/." ;;
esac

# --- 0. Terms acknowledgment ------------------------------------------------
TERMS_VERSION="alpha-1"
accept_terms() {
  cat <<'EOF'
[install]
[install] Local Yep - Alpha. Please read before installing.
[install] This is pre-release software provided "AS IS", without warranty. By
[install] installing you acknowledge:
[install]   1. It runs on YOUR own Claude/Anthropic account - YOU are responsible
[install]      for complying with Anthropic's terms and for all usage and charges.
[install]      Local Yep never proxies or resells Claude.
[install]   2. Yep is an AI agent that can act on your machine (files, tools, APIs).
[install]      AI can be wrong. You supervise it and own what it does.
[install]   3. Memory and credentials are stored locally; backups are your job.
[install]   4. Third-party tools/packs run at your own risk; output is NOT
[install]      professional advice.
[install]   5. To the maximum extent permitted by law, the authors are NOT liable
[install]      for damages arising from use.
[install] Full terms: TERMS.md
[install]
EOF
  local mode=""
  if [ "$ACCEPT_TERMS" -eq 1 ]; then
    mode="flag"
    info "Terms ($TERMS_VERSION) accepted via --accept-terms."
  elif [ -t 0 ]; then
    printf '[install] Type "I AGREE" to accept the Terms and continue: '
    local reply; read -r reply || true
    case "$reply" in
      "I AGREE"|"I agree"|"i agree") mode="typed" ;;
      *) die "Terms not accepted - installation aborted." ;;
    esac
  else
    die "Non-interactive install: re-run with --accept-terms to accept the Terms (TERMS.md)."
  fi
  # Record acceptance (auditable, one-time, versioned).
  local hd="${HOME}/.local-yep"
  mkdir -p "$hd" 2>/dev/null || true
  local ts; ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)"
  printf '{\n  "product": "local-yep",\n  "terms_version": "%s",\n  "accepted": true,\n  "accepted_at": "%s",\n  "method": "install.sh",\n  "mode": "%s"\n}\n' \
    "$TERMS_VERSION" "$ts" "$mode" > "$hd/ACCEPTED_TERMS.json" 2>/dev/null \
    || warn "could not record acceptance marker (continuing)."
}
accept_terms

# --- 1. Python --------------------------------------------------------------
PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$(command -v "$c")"; break; fi
done
[ -n "$PY" ] || die "Python 3.10+ is required. Install it (https://www.python.org/downloads/), then re-run."
info "python: $PY"

# --- 2. pipx + install ------------------------------------------------------
if ! command -v pipx >/dev/null 2>&1; then
  info "installing pipx (one-time)..."
  "$PY" -m pip install --user --upgrade pipx
  "$PY" -m pipx ensurepath >/dev/null 2>&1 || true
fi

if [ -z "$SOURCE" ]; then
  SOURCE="wheel"
  [ -n "$WHEEL" ] || WHEEL="$DEFAULT_WHEEL"
fi

case "$SOURCE" in
  wheel)
    [ -n "$WHEEL" ] || die "--source wheel needs --wheel <path|url>."
    TARGET="$WHEEL"
    case "$WHEEL" in
      http://*|https://*)
        TARGET="$(mktemp -d)/$(basename "$WHEEL")"
        info "downloading wheel..."
        if command -v curl >/dev/null 2>&1; then curl -fsSL "$WHEEL" -o "$TARGET"
        else "$PY" -c "import urllib.request,sys;urllib.request.urlretrieve(sys.argv[1],sys.argv[2])" "$WHEEL" "$TARGET"; fi ;;
    esac
    info "installing Local Yep from wheel: $TARGET"
    "$PY" -m pipx install --force "$TARGET" ;;
  git)  info "installing Local Yep from git: $GIT_URL"; "$PY" -m pipx install --force "$GIT_URL" ;;
  pypi) info "installing Local Yep from PyPI: local-yep"; "$PY" -m pipx install --force "local-yep" ;;
  *) die "unknown --source: $SOURCE" ;;
esac

# pipx bin dir so we can call yepgent in THIS session.
BIN="$("$PY" -m pipx environment --value PIPX_BIN_DIR 2>/dev/null || true)"
YEPGENT="yepgent"
[ -n "$BIN" ] && [ -x "$BIN/yepgent" ] && YEPGENT="$BIN/yepgent"

# --- 3. configure entitlement verification + gate ---------------------------
profile="${HOME}/.profile"
[ -n "${ZSH_VERSION:-}" ] && profile="${HOME}/.zshrc"
[ -n "${BASH_VERSION:-}" ] && [ -f "${HOME}/.bashrc" ] && profile="${HOME}/.bashrc"
persist() { # NAME VALUE — export now + append to the profile (idempotent)
  export "$1=$2"
  grep -q "export $1=" "$profile" 2>/dev/null || printf 'export %s=%s\n' "$1" "$2" >> "$profile"
}
if [ -n "$PUBKEY" ]; then
  # Durable lane FIRST. A profile `export` is fragile: this script picks
  # ~/.bashrc, ~/.zshrc or ~/.profile from the shell that happens to run it,
  # and an interactive bash never sources ~/.profile — so the key could land
  # somewhere the agent never reads, leaving a valid token unverifiable
  # (`yepgent license status` -> state: no_pubkey). A file in the Local Yep
  # home is read the same way from any shell, cron, or systemd.
  ly_home="${HOME}/.local-yep"
  if mkdir -p "$ly_home" 2>/dev/null && printf '%s' "$PUBKEY" > "$ly_home/entitlement_pubkey" 2>/dev/null; then
    info "entitlement public key written to $ly_home/entitlement_pubkey"
  else
    warn "could not write $ly_home/entitlement_pubkey (continuing)."
  fi
  persist LOCAL_YEP_TOOLSPACE_PUBKEY "$PUBKEY"
  info "entitlement public key also exported ($profile)."
fi
if [ "$GATED" -eq 1 ]; then persist YEPGENT_REQUIRE_ACTIVATION 1; info "fully-gated mode ON — an activation token is required to run."; fi

# --- 4. Claude Code check ---------------------------------------------------
if ! command -v claude >/dev/null 2>&1; then
  warn "Claude Code ('claude') not found on PATH. Install it from https://claude.com/claude-code"
  warn "Local Yep runs on YOUR Claude Code; 'gent' needs it present."
fi

# --- 5. activation ----------------------------------------------------------
if [ -z "$TOKEN" ] && [ "$GATED" -eq 1 ] && [ -t 0 ]; then
  printf '[install] Paste your activation token (or press Enter to skip): '
  read -r TOKEN
fi
if [ -n "$TOKEN" ]; then
  info "activating..."
  "$YEPGENT" license activate "$TOKEN"
fi

echo
info "Done. Open a NEW terminal (so PATH refreshes), then run:  gent"
if [ "$GATED" -eq 1 ] && [ -z "$TOKEN" ]; then
  warn "Gated mode is on but no token applied — run: yepgent license activate <token>"
fi
