"""
Step 5 – Photogrammetry via NodeODM (OpenDroneMap)
Checks for a running NodeODM instance at ODM_URL (default localhost:3000),
creates a task, uploads images, polls until done, and downloads outputs.

If NodeODM is not reachable the pipeline step returns a clear status —
no fake data is generated.

Install NodeODM locally:
  docker run -p 3000:3000 opendronemap/nodeodm
"""
import os
import time
import json
import uuid
import requests
from typing import Optional

ODM_URL = os.getenv("ODM_URL", "http://localhost:3000")
ODM_TIMEOUT = int(os.getenv("ODM_TIMEOUT", "3600"))   # 1h max

ODM_OPTIONS = [
    {"name": "orthophoto-resolution", "value": 5},   # cm/px
    {"name": "dem-resolution",        "value": 5},   # cm/px
    {"name": "dsm",                   "value": True},
    {"name": "dtm",                   "value": True},
    {"name": "pc-quality",            "value": "medium"},
    {"name": "feature-quality",       "value": "medium"},
]


def is_available() -> bool:
    """Return True if NodeODM is reachable."""
    try:
        r = requests.get(f"{ODM_URL}/info", timeout=4)
        return r.status_code == 200
    except Exception:
        return False


def get_info() -> dict:
    """Return NodeODM version + capabilities."""
    try:
        return requests.get(f"{ODM_URL}/info", timeout=4).json()
    except Exception:
        return {}


def create_task(image_paths: list[str],
                gcp_path: Optional[str] = None,
                options: Optional[list] = None,
                name: str = "") -> dict:
    """
    Create and start an ODM task.
    Returns {"task_id": ..., "status": "queued"} or {"error": ...}
    """
    if not is_available():
        return {"error": "NodeODM not running",
                "hint":  "docker run -p 3000:3000 opendronemap/nodeodm"}

    opts = options or ODM_OPTIONS
    init_url = f"{ODM_URL}/task/new/init"
    try:
        init_r = requests.post(init_url,
                               data={"options": json.dumps(opts), "name": name},
                               timeout=10)
        init_r.raise_for_status()
        task_id = init_r.json()["uuid"]
    except Exception as e:
        return {"error": f"Failed to create task: {e}"}

    upload_url = f"{ODM_URL}/task/new/upload/{task_id}"
    for img_path in image_paths:
        try:
            with open(img_path, "rb") as f:
                requests.post(upload_url,
                              files={"images": (os.path.basename(img_path), f, "image/jpeg")},
                              timeout=60)
        except Exception as e:
            return {"error": f"Upload failed for {os.path.basename(img_path)}: {e}"}

    if gcp_path and os.path.exists(gcp_path):
        with open(gcp_path, "rb") as f:
            requests.post(upload_url,
                          files={"images": ("gcp_list.txt", f, "text/plain")},
                          timeout=30)

    # Commit (start processing)
    commit_url = f"{ODM_URL}/task/new/commit/{task_id}"
    try:
        requests.post(commit_url, timeout=10)
    except Exception as e:
        return {"error": f"Commit failed: {e}"}

    return {"task_id": task_id, "status": "queued", "odm_url": ODM_URL}


def poll_task(task_id: str) -> dict:
    """Get current status of an ODM task."""
    try:
        r = requests.get(f"{ODM_URL}/task/{task_id}/info", timeout=10)
        r.raise_for_status()
        info = r.json()
        status_code = info.get("status", {}).get("code", 0)
        # ODM codes: 10=queued, 20=running, 30=failed, 40=complete, 50=cancelled
        STATUS_MAP = {10: "queued", 20: "running", 30: "failed", 40: "complete", 50: "cancelled"}
        return {
            "task_id":  task_id,
            "status":   STATUS_MAP.get(status_code, "unknown"),
            "progress": info.get("progress", 0),
            "processing_time": info.get("processingTime", 0),
            "output":   info.get("output", [])[-5:],   # last 5 log lines
        }
    except Exception as e:
        return {"task_id": task_id, "status": "error", "error": str(e)}


def wait_for_completion(task_id: str,
                        poll_interval: int = 15,
                        on_progress=None) -> dict:
    """Block until task completes or fails. Calls on_progress(dict) each poll."""
    start = time.time()
    while time.time() - start < ODM_TIMEOUT:
        status = poll_task(task_id)
        if on_progress:
            on_progress(status)
        if status["status"] in ("complete", "failed", "cancelled", "error"):
            return status
        time.sleep(poll_interval)
    return {"task_id": task_id, "status": "timeout"}


def download_outputs(task_id: str, output_dir: str) -> dict:
    """
    Download key ODM outputs into output_dir.
    Returns dict of {output_name: local_path}.
    """
    os.makedirs(output_dir, exist_ok=True)
    assets = {
        "dsm":         "odm_dem/dsm.tif",
        "dtm":         "odm_dem/dtm.tif",
        "orthophoto":  "odm_orthophoto/odm_orthophoto.tif",
        "point_cloud": "odm_pointcloud/cloud.laz",
    }
    downloaded = {}
    for name, asset_path in assets.items():
        url = f"{ODM_URL}/task/{task_id}/download/{asset_path}"
        local = os.path.join(output_dir, os.path.basename(asset_path))
        try:
            r = requests.get(url, stream=True, timeout=300)
            if r.status_code == 200:
                with open(local, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                downloaded[name] = local
        except Exception:
            pass
    return downloaded
