#!/usr/bin/env bash
# Run inside Ubuntu-24.04 as root after remote state setup.
set -euo pipefail
root=/home/erpdev/erp-agent
state="$root/project-1-1/.runtime/remote"
server="$root/openworker/.venv/bin/openworker-server"
[[ $(id -u) == 0 ]] || { echo 'Run as root in Ubuntu-24.04'; exit 1; }
[[ -x "$server" && -f "$state/mcp.json" ]] || { echo 'OpenWorker or local state missing'; exit 1; }
systemctl stop erp-openworker-gui erp-openworker-server 2>/dev/null || true
systemctl reset-failed erp-openworker-server erp-openworker-gui 2>/dev/null || true
systemd-run --unit=erp-openworker-server --uid=erpdev \
  --property="WorkingDirectory=$root/openworker" \
  --setenv="COWORKER_STATE_DIR=$state" \
  "$server" --cwd "$state/workspace" --host 127.0.0.1 --port 8765 --model kimi:kimi-k3
ready=0
for i in {1..30}; do
  if [[ -s "$state/sidecar-8765.token" ]] && curl -s --max-time 2 -o /dev/null http://127.0.0.1:8765/; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'OpenWorker backend did not become ready'; exit 1; }
systemd-run --unit=erp-openworker-gui --uid=erpdev \
  --property="WorkingDirectory=$root/openworker/surfaces/gui" \
  --setenv="COWORKER_STATE_DIR=$state" \
  /usr/local/bin/npm run dev -- --host 127.0.0.1
echo 'OpenWorker Step-3: http://localhost:1420'
echo 'Configure the model key in the new isolated UI state before the chat test.'
