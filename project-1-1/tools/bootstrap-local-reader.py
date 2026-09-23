"""Run once in the local ERPNext bench console, as Administrator.

This is intentionally scoped to the disposable Step-1/2 ERP instance.
It never prints credentials; copy the generated private JSON out of the
container before removing it.
"""

import json
import os

import frappe
from frappe.core.doctype.user.user import generate_keys
from frappe.utils.password import update_password


USER = "erp-reader@example.com"
ROLE = "ERP Agent Reader"
COMPANY = "ZHOU"
PRIVATE_PATH = "/tmp/project11-reader-credentials.json"
READABLE = ("Company", "Item", "Sales Order", "Sales Invoice")


def bootstrap():
    frappe.set_user("Administrator")
    if not frappe.db.exists("Company", COMPANY):
        raise RuntimeError("expected_test_company_missing")
    if frappe.db.exists("User", USER) or frappe.db.exists("Role", ROLE):
        raise RuntimeError("reader_or_role_already_exists; inspect before retrying")
    if os.path.exists(PRIVATE_PATH):
        raise RuntimeError("private_credential_file_already_exists")

    try:
        frappe.get_doc({
            "doctype": "Role", "role_name": ROLE, "desk_access": 1,
        }).insert(ignore_permissions=True)
        for doctype in READABLE:
            frappe.permissions.add_permission(doctype, ROLE, ptype="read")

        user = frappe.get_doc({
            "doctype": "User",
            "email": USER,
            "first_name": "ERP",
            "last_name": "Reader",
            "enabled": 1,
            "user_type": "System User",
            "send_welcome_email": 0,
        }).insert(ignore_permissions=True)
        user.add_roles(ROLE)
        frappe.get_doc({
            "doctype": "User Permission",
            "user": USER,
            "allow": "Company",
            "for_value": COMPANY,
            "apply_to_all_doctypes": 1,
        }).insert(ignore_permissions=True)

        password = frappe.generate_hash(length=32)
        update_password(USER, password)
        result = generate_keys(USER)
        api_key = frappe.db.get_value("User", USER, "api_key")
        if not api_key or not result.get("api_secret"):
            raise RuntimeError("api_credentials_not_generated")

        payload = {
            "ERP_URL": "http://localhost:8080",
            "ERP_USER": USER,
            "ERP_API_KEY": api_key,
            "ERP_API_SECRET": result["api_secret"],
            "COMPANY": COMPANY,
            "CURRENCY": frappe.db.get_value("Company", COMPANY, "default_currency"),
            "LOCAL_LOGIN_PASSWORD": password,
        }
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        fd = os.open(PRIVATE_PATH, flags, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(payload, output)
        frappe.db.commit()
    except Exception:
        frappe.db.rollback()
        raise
    print("Local ERP reader created; credentials saved to private container file.")


bootstrap()
