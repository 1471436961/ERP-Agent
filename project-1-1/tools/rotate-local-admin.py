"""One-time Step-1 rotation of the local ERPNext demo Administrator password.

Run inside the disposable bench console with `%run /tmp/project11-rotate-admin.py`.
The generated password is written to a private container file and never printed.
"""

import json
import os
import secrets

import frappe
from frappe.utils.password import check_password, update_password


PRIVATE_PATH = "/tmp/project11-admin-credentials.json"


def rotate():
    frappe.set_user("Administrator")
    if os.path.exists(PRIVATE_PATH):
        raise RuntimeError("private_credential_file_already_exists")
    check_password("Administrator", "admin")
    password = secrets.token_urlsafe(32)
    update_password("Administrator", password, logout_all_sessions=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    fd = os.open(PRIVATE_PATH, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as output:
        json.dump({"ERP_ADMIN_USER": "Administrator", "ERP_ADMIN_PASSWORD": password}, output)
    frappe.db.commit()
    print("Local Administrator password rotated; private credential file created.")


rotate()
