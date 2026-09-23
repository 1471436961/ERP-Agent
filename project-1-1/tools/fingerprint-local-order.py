"""Print a stable fingerprint and non-sensitive fields of the local test order."""
import hashlib
import json
import sys
import urllib.parse
import urllib.request

config = json.load(open(sys.argv[1], encoding="utf-8"))
name = "SAL-ORD-2026-00001"
path = "/api/resource/Sales%20Order/" + urllib.parse.quote(name, safe="")
request = urllib.request.Request(
    config["ERP_URL"].rstrip("/") + path,
    headers={"Authorization": "token " + config["ERP_API_KEY"] + ":" + config["ERP_API_SECRET"]},
)
with urllib.request.urlopen(request, timeout=15) as response:
    data = json.load(response)["data"]
fingerprint = hashlib.sha256(
    json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
).hexdigest()
print(json.dumps({
    "name": data["name"],
    "status": data.get("status"),
    "docstatus": data.get("docstatus"),
    "grand_total": data.get("grand_total"),
    "modified": data.get("modified"),
    "sha256": fingerprint,
}, ensure_ascii=False))
