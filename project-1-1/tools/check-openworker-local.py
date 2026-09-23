"""Print sanitized status of the isolated local OpenWorker MCP setup."""

import json
import sys
import urllib.request
import urllib.parse
from pathlib import Path


state = Path(sys.argv[1])
token = (state / "sidecar-8765.token").read_text(encoding="utf-8").strip()
request = urllib.request.Request(
    "http://127.0.0.1:8765/v1/mcp",
    headers={"X-OpenWorker-Token": token},
)
with urllib.request.urlopen(request, timeout=10) as response:
    payload = json.load(response)

servers = payload if isinstance(payload, list) else payload.get("servers", [])
for server in servers:
    if server.get("name") == "project-1-1-erp":
        print("MCP server present")
        print("Enabled:", server.get("enabled"))
        print("Status:", server.get("status"))
        print("Included tools:", server.get("config", {}).get("include_tools"))
        print("Tool count:", server.get("tool_count"))
        break
else:
    raise SystemExit("Project MCP server absent")

skill_request = urllib.request.Request(
    "http://127.0.0.1:8765/v1/skills?workspace=" + urllib.parse.quote(str(state / "workspace")),
    headers={"X-OpenWorker-Token": token},
)
with urllib.request.urlopen(skill_request, timeout=10) as response:
    skill_payload = json.load(response)
skills = skill_payload if isinstance(skill_payload, list) else skill_payload.get("skills", [])
matches = [skill for skill in skills if skill.get("name") == "erp-order-review"]
if not matches:
    raise SystemExit("Order review Skill absent")
print("Order review Skill present; enabled:", matches[0].get("enabled"))
