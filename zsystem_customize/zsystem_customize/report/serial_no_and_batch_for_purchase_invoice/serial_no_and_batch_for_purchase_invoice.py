import frappe

def execute(filters=None):
    columns = [
        {"label": "Serial No", "fieldname": "serial_no", "fieldtype": "Link", "options": "Serial No", "width": 200},
        {"label": "Batch No", "fieldname": "batch_no", "fieldtype": "Link", "options": "Batch", "width": 250},
        {"label": "Supplier Invoice No", "fieldname": "bill_no", "fieldtype": "Data", "width": 250},
        {"label": "Supplier Invoice Date", "fieldname": "bill_date", "fieldtype": "Date", "width": 200},
        {"label": "Purchase Invoice No", "fieldname": "purchase_invoice_no", "fieldtype": "Link", "options": "Purchase Invoice", "width": 300},
    ]

    data = []
    seen = set()  # To avoid duplicates

    if filters and filters.get("serial_no"):
        serial_doc = frappe.get_doc("Serial No", filters.get("serial_no"))
        purchase_document_no = serial_doc.purchase_document_no

        if purchase_document_no:
            pur_receipt_exists = frappe.db.exists("Purchase Receipt", purchase_document_no)

            if pur_receipt_exists:
                purchase_invoices = frappe.get_all(
                    "Purchase Invoice Item",
                    filters={"purchase_receipt": purchase_document_no},
                    fields=["parent"]
                )

                for item in purchase_invoices:
                    if (serial_doc.name, item.parent) in seen:
                        continue  # Skip duplicates
                    seen.add((serial_doc.name, item.parent))

                    invoice_data = frappe.get_doc("Purchase Invoice", item.parent)

                    data.append({
                        "serial_no": serial_doc.name,
                        "batch_no": serial_doc.batch_no,
                        "purchase_invoice_no": invoice_data.name,
                        "bill_no": invoice_data.bill_no,
                        "bill_date": invoice_data.bill_date
                    })

    elif filters and filters.get("batch_no"):
        batch_doc = frappe.get_doc("Batch", filters.get("batch_no"))

        receipt_items = frappe.get_all(
            "Purchase Receipt Item",
            filters={"batch_no": filters.get("batch_no")},
            fields=["parent"]
        )

        for receipt in receipt_items:
            purchase_invoices = frappe.get_all(
                "Purchase Invoice Item",
                filters={"purchase_receipt": receipt.parent},
                fields=["parent"]
            )

            for item in purchase_invoices:
                if (batch_doc.name, item.parent) in seen:
                    continue  # Skip duplicates
                seen.add((batch_doc.name, item.parent))

                invoice_data = frappe.get_doc("Purchase Invoice", item.parent)

                data.append({
                    "serial_no": "",
                    "batch_no": batch_doc.name,
                    "purchase_invoice_no": invoice_data.name,
                    "bill_no": invoice_data.bill_no,
                    "bill_date": invoice_data.bill_date
                })

    return columns, data
