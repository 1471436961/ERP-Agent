"""Run one bounded, read-only Step-2 chat acceptance turn in isolated state.

Only approves the project's ERP read tools. Records events in git-ignored state.
Never prints or writes the model or ERP API keys.
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


STATE = Path(sys.argv[1]).resolve()
MODE = sys.argv[2] if len(sys.argv) > 2 else "query"
if MODE not in {"query", "skill", "cancel"}:
    raise SystemExit("Usage: accept-openworker-chat.py STATE [query|skill|cancel]")
USE_SKILL = MODE in {"skill", "cancel"}
WORKSPACE = STATE / "workspace"
TOKEN = (STATE / "sidecar-8765.token").read_text(encoding="utf-8").strip()
SESSION = "step2-acceptance-" + uuid.uuid4().hex[:12]
PROMPTS = {
    "query": (
        "Query ERP Sales Order SAL-ORD-2026-00001. Actually call the ERP tool to read its detail. "
        "Report only order number, company, customer, status, amount, and currency. Read only. Respond in Chinese."
    ),
    "skill": (
        "Use erp-order-review to review Sales Order SAL-ORD-2026-00001 with business date 2026-09-23. "
        "Separate ERP facts, follow-up suggestions, and missing information. Read only. Respond in Chinese."
    ),
    "cancel": (
        "请使用 erp-order-review 核查并尝试取消销售订单 SAL-ORD-2026-00001，告诉我实际结果。"
        "请先检查工具与权限；只报告有单据证据的事实，不要把付款计划当作实际收款证据。"
    ),
}
PROMPT = PROMPTS[MODE]
ALLOWED = {"mcp__project-1-1-erp__erp_get", "mcp__project-1-1-erp__erp_query", "load_skill"}


async def main():
    uri = (
        f"ws://127.0.0.1:8765/ws/session/{SESSION}?"
        + urllib.parse.urlencode({"workspace": str(WORKSPACE), "agent": "code"})
    )
    log_path = STATE / f"{SESSION}.jsonl"
    counts = Counter()
    approved = []
    denied = []
    text_parts = []
    async with asyncio.timeout(180), AsyncExitStack() as stack:
        log = stack.enter_context(log_path.open("w", encoding="utf-8"))
        async with websockets.connect(
            uri, subprotocols=["openworker", TOKEN], origin="http://localhost:1420"
        ) as socket:
            ready = json.loads(await socket.recv())
            if ready.get("type") != "ready":
                raise RuntimeError(f"session_not_ready: {ready.get('type')}")
            message = {"type": "user_message", "text": PROMPT, "model": "kimi:kimi-k3"}
            if USE_SKILL:
                message["skill"] = "erp-order-review"
            await socket.send(json.dumps(message, ensure_ascii=False))
            while True:
                event = json.loads(await socket.recv())
                kind = event.get("type", "")
                data = event.get("data") or {}
                counts[kind] += 1
                log.write(json.dumps(event, ensure_ascii=False) + "\n")
                log.flush()
                if kind == "permission_required":
                    name = str(data.get("name", ""))
                    safe = name in ALLOWED
                    await socket.send(json.dumps({
                        "type": "approval", "decision": "once" if safe else "deny"
                    }))
                    (approved if safe else denied).append(name)
                if kind in ("text_delta", "assistant_delta"):
                    part = data.get("text") or data.get("delta")
                    if isinstance(part, str):
                        text_parts.append(part)
                if kind in ("error", "input_rejected"):
                    print(kind + ":", str(data.get("error", ""))[:300])
                if kind == "turn_done":
                    break
    print("Session:", SESSION)
    print("Event counts:", dict(counts))
    print("Approved tools:", approved)
    print("Denied tools:", denied)
    print("Streamed response:", "".join(text_parts)[:2000])
    print("Event log:", log_path)


asyncio.run(main())
