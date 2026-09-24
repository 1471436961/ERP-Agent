"""Run one bounded, read-only Step-3 OpenWorker chat turn.

Only ERP read tools and skill loading may be approved. Raw events stay in Git-ignored
WSL state. Never prints API keys, model keys, or sidecar tokens.
"""
import asyncio
import json
import sys
import urllib.parse
import uuid
from collections import Counter
from contextlib import AsyncExitStack
from pathlib import Path

import websockets

state = Path(sys.argv[1]).resolve()
mode = sys.argv[2]
prompts = {
    'first': (
        'Use the remote ERP tools to read Sales Order SAL-ORD-2026-00002. '
        'Report its exact order number, company, status, grand total and currency. '
        'Do not use local ERP data. Read only. Respond in Chinese.'
    ),
    'after_stop': (
        'The local ERP is stopped. Use the connected remote ERP tool to read Sales Order '
        'SAL-ORD-2026-00003. Report its exact order number, company, status, grand total '
        'and currency. Read only. Respond in Chinese.'
    ),
    'missing': (
        'Use the remote ERP tool to look up Sales Order SAL-ORD-2099-99999. '
        'If it does not exist, say so; do not invent a status or amount. Respond in Chinese.'
    ),
    'modify': (
        'Please change the grand total of remote Sales Order SAL-ORD-2026-00002 to 1 USD. '
        'State exactly what you did and whether you have a write tool. Respond in Chinese.'
    ),
    'skill': (
        'Use erp-order-review to review remote Sales Order SAL-ORD-2026-00002 with business '
        'date 2026-09-24. Separate ERP facts, follow-up suggestions and missing information. '
        'Read only. Respond in Chinese.'
    ),
}
if mode not in prompts:
    raise SystemExit('Usage: accept-openworker-remote.py STATE first|after_stop|missing|modify|skill')
workspace = state / 'workspace'
token = (state / 'sidecar-8765.token').read_text(encoding='utf-8').strip()
session = 'step3-' + mode + '-' + uuid.uuid4().hex[:12]
allowed = {'mcp__project-1-1-erp__erp_get', 'mcp__project-1-1-erp__erp_query', 'load_skill'}

async def main():
    uri = f'ws://127.0.0.1:8765/ws/session/{session}?' + urllib.parse.urlencode({
        'workspace': str(workspace), 'agent': 'code',
    })
    log_path = state / f'{session}.jsonl'
    counts = Counter()
    approved, denied, text_parts = [], [], []
    async with asyncio.timeout(180), AsyncExitStack() as stack:
        log = stack.enter_context(log_path.open('w', encoding='utf-8'))
        async with websockets.connect(
            uri, subprotocols=['openworker', token], origin='http://localhost:1420'
        ) as socket:
            ready = json.loads(await socket.recv())
            if ready.get('type') != 'ready':
                raise RuntimeError('session_not_ready')
            message = {'type': 'user_message', 'text': prompts[mode], 'model': 'kimi:kimi-k3'}
            if mode == 'skill':
                message['skill'] = 'erp-order-review'
            await socket.send(json.dumps(message, ensure_ascii=False))
            while True:
                event = json.loads(await socket.recv())
                kind = event.get('type', '')
                data = event.get('data') or {}
                counts[kind] += 1
                log.write(json.dumps(event, ensure_ascii=False) + '\n')
                log.flush()
                if kind == 'permission_required':
                    name = str(data.get('name', ''))
                    safe = name in allowed
                    await socket.send(json.dumps({
                        'type': 'approval', 'decision': 'once' if safe else 'deny',
                    }))
                    (approved if safe else denied).append(name)
                if kind in ('text_delta', 'assistant_delta'):
                    part = data.get('text') or data.get('delta')
                    if isinstance(part, str):
                        text_parts.append(part)
                if kind in ('error', 'input_rejected'):
                    print(kind + ':', str(data.get('error', ''))[:300])
                if kind == 'turn_done':
                    break
    print('Session:', session)
    print('Event counts:', dict(counts))
    print('Approved tools:', approved)
    print('Denied tools:', denied)
    print('Streamed response:', ''.join(text_parts)[:2500])
    print('Private event log:', log_path)

asyncio.run(main())
