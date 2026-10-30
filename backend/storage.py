import os
import time

import requests
from fastapi import HTTPException

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "newmusiq"
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def _attempt(fn):
    resp = fn(init_storage())
    if resp.status_code == 404 and "objects" in resp.url:
        resp = fn(init_storage(force=True))
    resp.raise_for_status()
    return resp


def _with_retry(fn):
    for attempt in range(3):
        try:
            return _attempt(fn)
        except requests.HTTPError as e:
            code = e.response.status_code if e.response is not None else 0
            if code == 404:
                raise HTTPException(404, "File not found")
            if code < 500 or attempt == 2:
                raise HTTPException(502, "File storage is busy right now. Please try again.")
        except requests.RequestException:
            if attempt == 2:
                raise HTTPException(502, "File storage is busy right now. Please try again.")
        time.sleep(0.6 * (attempt + 1))


def put_object(path: str, data: bytes, content_type: str) -> dict:
    return _with_retry(lambda key: requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )).json()


def get_object(path: str) -> tuple[bytes, str]:
    resp = _with_retry(lambda key: requests.get(
        f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60,
    ))
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
