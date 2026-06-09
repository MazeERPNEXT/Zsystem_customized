import frappe
import json
from frappe.utils import getdate, nowdate

@frappe.whitelist(allow_guest=True)
def sent_salesinvoice_tally():
    try:
        data = json.loads(frappe.request.data)

        if data.get("tallycode") != "111222":
            return {
                "status": "error",
                "message": "Incorrect Tally code..."
            }

        # Financial Year Start (1-Apr)
        today = getdate(nowdate())

        if today.month >= 4:
            fy_start = f"{today.year}-04-01"
        else:
            fy_start = f"{today.year - 1}-04-01"

        invoices = frappe.get_all(
            "Sales Invoice",
            filters={
                "docstatus": 1,
                "is_return": 0,
                "posting_date": [">=", fy_start]
            },
            fields=["name"],
            order_by="posting_date desc"
        )

        sales_list = []

        for inv in invoices:
            doc = frappe.get_doc("Sales Invoice", inv.name)

            # Customer GSTIN
            customer_gstin = frappe.db.get_value(
                "Customer",
                doc.customer,
                "gstin"
            ) or ""

            # Customer Address
            address = {}
            if doc.customer_address:
                addr = frappe.get_doc("Address", doc.customer_address)

                address = {
                    "buyeraddress1": addr.address_line1 or "",
                    "buyeraddress2": addr.address_line2 or "",
                    "buyeraddress3": "",
                    "buyeraddress4": "",
                    "buyeraddress5": "",
                    "buyerstate": addr.state or ""
                }

            # Product List
            product_list = []

            for item in doc.items:
                product_list.append({
                    "invoicenumber": doc.name,
                    "product": item.item_code,
                    "productdescription": item.description,
                    "parent": "Primary",
                    "partno": "",
                    "productgodown": item.warehouse,
                    "unit": item.uom,
                    "Altunit": item.stock_uom,
                    "productqty": item.qty,
                    "productAltqty": item.stock_qty,
                    "productrate": item.rate,
                    "producthsn": item.gst_hsn_code or "",
                    "productvalue": item.amount
                })

            # Ledger List
            ledger_list = []

            for tax in doc.taxes:
                ledger_list.append({
                    "invoicenumber": doc.name,
                    "additionalledger": tax.account_head.replace(" - Z", ""),
                    "parent": "Duties & Taxes",
                    "rateofpercentage": tax.rate,
                    "additionalledgervalue": abs(tax.tax_amount)
                })

            # Freight Charge
            freight_amount = 0

            for tax in doc.taxes:
                if "freight" in (tax.description or "").lower():
                    freight_amount += tax.tax_amount

            if freight_amount:
                ledger_list.insert(0, {
                    "invoicenumber": doc.name,
                    "additionalledger": "Freights",
                    "parent": "Indirect Incomes",
                    "rateofpercentage": "",
                    "additionalledgervalue": freight_amount
                })

            sales_list.append({
                "invoicenumber": doc.name,
                "invoicedate": doc.posting_date.strftime("%d-%m-%Y"),
                "narration": doc.remarks or "",
                "customername": doc.customer,
                "vchtype": "GST Sales",
                "invoicemode": "Invoice Voucher View",
                "salesledger": (
                    doc.items[0].income_account.replace(" - Z", "")
                    if doc.items else ""
                ),
                "buyername": doc.customer,
                "buyerGSTIN": customer_gstin,
                "Placeofsupply": doc.place_of_supply[3:] if doc.place_of_supply else "",
                "subvalue": doc.net_total,
                "roundoffamount": doc.rounding_adjustment,
                "invoicevalue": doc.rounded_total or doc.grand_total,
                "ackno": doc.get("ack_no") or "",
                "ackdate": str(doc.get("ack_date")) if doc.get("ack_date") else "",
                "irn": doc.get("irn") or "",
                "ewaybillno": doc.get("ewaybill") or "",
                "vehiclenumber": doc.vehicle_no or "",
                **address,
                "vchproductlist": product_list,
                "vchledgerlist": ledger_list,
            })

        return {
            "tallycode": "111222",
            "requesttype": "Sales",
            "saleslist": sales_list
        }

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            "Sales Invoice Tally Export"
        )

        return {
            "status": "error",
            "message": frappe.get_traceback()
        }