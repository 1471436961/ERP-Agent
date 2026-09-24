"""Connect the configured read-only Step-3 MCP server without invoking a model."""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

state = Path(sys.argv[1])
token = (state / 'sidecar-8765.token').read_text(encoding='utf-8').strip()
name = 'project-1-1-erp'
base = 'http://127.0.0.1:8765/v1/mcp'
headers = {'X-OpenWorker-Token': token}
request = urllib.request.Request(
    base + '/' + urllib.parse.quote(name) + '/connect',
    data=b'{}',
    headers={**headers, 'Content-Type': 'application/json'},
    method='POST',
)
with urllib.request.urlopen(request, timeout=10) as response:
    result = json.load(response)
if not result.get('ok'):
    raise SystemExit('MCP connect request rejected')
for _ in range(25):
    with urllib.request.urlopen(urllib.request.Request(base, headers=headers), timeout=10) as response:
        payload = json.load(response)
    match = next(item for item in payload['servers'] if item['name'] == name)
    status = match['status']
    if status == 'connected':
        assert match['config']['include_tools'] == ['erp.query', 'erp.get']
        print('Remote MCP connected; Agent allowlist: erp.query, erp.get')
        break
    if status == 'error':
        raise SystemExit('Remote MCP connection error; inspect local OpenWorker logs')
    time.sleep(1)
else:
    raise SystemExit('Remote MCP connection did not reach connected state')
