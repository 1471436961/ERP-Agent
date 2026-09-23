"""Create one unsubmitted local invoice draft for Step-2 read-only verification."""

import frappe
from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice


ORDER = "SAL-ORD-2026-00001"


def create():
    frappe.set_user("Administrator")
    order = frappe.get_doc("Sales Order", ORDER)
    if order.docstatus != 1 or order.company != "ZHOU":
        raise RuntimeError("expected_submitted_test_order_missing")
    existing = frappe.db.get_value("Sales Invoice Item", {"sales_order": ORDER}, "parent")
    if existing:
        raise RuntimeError(f"invoice_for_test_order_already_exists: {existing}")
    invoice = make_sales_invoice(ORDER)
    if invoice.docstatus != 0 or invoice.company != order.company:
        raise RuntimeError("unexpected_invoice_mapping")
    invoice.insert(ignore_permissions=True)
    if invoice.docstatus != 0:
        raise RuntimeError("test_invoice_was_not_a_draft")
    frappe.db.commit()
    print(f"Local unsubmitted invoice draft created: {invoice.name}")


create()
