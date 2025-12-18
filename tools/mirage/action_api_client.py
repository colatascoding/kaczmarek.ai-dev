#!/usr/bin/env python3
"""
Simple client for the Mirage Action Web API (ActionWebBridge).

First kaczmarek.ai-dev solution:
  - Check Action API health.
  - List registered actions.
  - Run "test all actions" with a given permission context.

Usage (from the kaczmarek.ai-dev repo root):

  # Health check (default base URL http://localhost:4001)
  python tools/mirage/action_api_client.py health

  # List all actions (IDs and categories)
  python tools/mirage/action_api_client.py list-actions

  # Test all actions as admin in a given world/room
  python tools/mirage/action_api_client.py test-all \\
      --user admin --world example-world --room example-room

The base URL can be overridden via:
  - CLI:  --base-url http://localhost:4001
  - Env:  MIRAGE_ACTION_API_URL
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


DEFAULT_BASE_URL = "http://localhost:4001"


def resolve_base_url(cli_base_url: str | None) -> str:
    """Resolve the base URL from CLI arg, env var, or default."""
    if cli_base_url:
        return cli_base_url.rstrip("/")
    env = os.getenv("MIRAGE_ACTION_API_URL")
    if env:
        return env.rstrip("/")
    return DEFAULT_BASE_URL


def http_get(base_url: str, path: str) -> dict:
    url = f"{base_url}{path}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode("utf-8")
            if not data:
                return {}
            return json.loads(data)
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"HTTP error {e.code} for GET {url}: {e.reason}\n")
        raise
    except urllib.error.URLError as e:
        sys.stderr.write(f"Failed to reach {url}: {e.reason}\n")
        raise


def http_post(base_url: str, path: str, payload: dict) -> dict:
    url = f"{base_url}{path}"
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode("utf-8")
            if not data:
                return {}
            return json.loads(data)
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"HTTP error {e.code} for POST {url}: {e.reason}\n")
        raise
    except urllib.error.URLError as e:
        sys.stderr.write(f"Failed to reach {url}: {e.reason}\n")
        raise


def cmd_health(base_url: str) -> int:
    print(f"[kaczmarek.ai-dev] Checking Action API health at {base_url} ...")
    try:
        data = http_get(base_url, "/api/health")
    except Exception:
        return 1

    print(json.dumps(data, indent=2, sort_keys=True))
    return 0


def cmd_list_actions(base_url: str) -> int:
    print(f"[kaczmarek.ai-dev] Listing actions from {base_url} ...")
    try:
        data = http_get(base_url, "/api/actions")
    except Exception:
        return 1

    if not isinstance(data, list):
        print(json.dumps(data, indent=2, sort_keys=True))
        return 0

    print(f"Total actions: {len(data)}")
    for action in data:
        action_id = action.get("id") or action.get("actionId") or "<unknown>"
        category = action.get("category") or "<none>"
        description = action.get("description") or ""
        print(f"- {action_id} [{category}] {description}")

    return 0


def cmd_test_all(base_url: str, user: str, world: str | None, room: str | None) -> int:
    print(f"[kaczmarek.ai-dev] Running test-all against {base_url} ...")
    context = {
        "userId": user,
        "worldId": world or "",
        "roomId": room or "",
    }
    payload = {"context": context}

    try:
        data = http_post(base_url, "/api/actions/test-all", payload)
    except Exception:
        return 1

    # We don't know the exact schema; just pretty-print for now.
    print(json.dumps(data, indent=2, sort_keys=True))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="kaczmarek.ai-dev client for Mirage Action Web API"
    )
    parser.add_argument(
        "--base-url",
        help=(
            "Base URL for Action Web API "
            "(default: env MIRAGE_ACTION_API_URL or http://localhost:4001)"
        ),
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # health
    subparsers.add_parser("health", help="Check Action API health (/api/health)")

    # list-actions
    subparsers.add_parser("list-actions", help="List all actions (/api/actions)")

    # test-all
    p_test_all = subparsers.add_parser(
        "test-all",
        help="Run test-all for all actions with a given permission context",
    )
    p_test_all.add_argument(
        "--user",
        default="admin",
        help="User ID to use in PermissionContext (default: admin)",
    )
    p_test_all.add_argument(
        "--world",
        default="",
        help="World ID to use in PermissionContext (optional)",
    )
    p_test_all.add_argument(
        "--room",
        default="",
        help="Room ID to use in PermissionContext (optional)",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    base_url = resolve_base_url(args.base_url)

    if args.command == "health":
        return cmd_health(base_url)
    if args.command == "list-actions":
        return cmd_list_actions(base_url)
    if args.command == "test-all":
        return cmd_test_all(base_url, args.user, args.world, args.room)

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())


