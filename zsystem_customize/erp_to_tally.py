import frappe
import json
from frappe.utils import getdate, nowdate
from frappe.utils import strip_html
import re

@frappe.whitelist(allow_guest=True)
def sent_salesinvoice_tally():
    try:
        data = json.loads(frappe.request.data or "{}")

        payload = data.get("message", data)

        if payload.get("tallycode") != "111222":
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

           # -----------------------------
            # BUYER ADDRESS
            # -----------------------------
            buyer_address = ""
            buyer_state = ""

            if doc.customer_address:
                try:
                    addr = frappe.get_doc("Address", doc.customer_address)
                    buyer_address = re.sub(r'-(Billing|Shipping)(-\d+)?$', '', doc.customer_address).strip()
                    buyer_address1 = addr.address_line1 or ''
                    buyer_address2 = addr.address_line2 or ''
                    buyer_address3 = addr.city or ''
                    buyer_address4 = addr.state or ''
                    buyer_address5 = addr.pincode or ''
                    buyer_address6 = addr.country or ''

                    buyer_state = addr.state or ""
                except Exception:
                    pass

            # -----------------------------
            # DELIVERY ADDRESS
            # -----------------------------
            delivery_name = ""
            delivery_address = ""
            delivery_state = ""
            delivery_gstin = ""

            if doc.shipping_address_name:
                try:
                    ship = frappe.get_doc("Address", doc.shipping_address_name)
                    delivery_name = re.sub(r'-(Billing|Shipping)(-\d+)?$', '', doc.shipping_address_name).strip()
                    delivery_address1 = ship.address_line1 or ''
                    delivery_address2 = ship.address_line2 or ''
                    delivery_address3 = ship.city or ''
                    delivery_address4 = ship.state or ''
                    delivery_address5 = ship.pincode or ''
                    delivery_address6 = ship.country or ''
                    
                    delivery_state = ship.state or ""
                    delivery_gstin = ship.gstin or ""
                except Exception:
                    pass

            # Product List
            product_list = []

            for item in doc.items:
                clean_text = strip_html(item.description or "")
                product_list.append({
                    "invoicenumber": doc.name,
                    "product": item.item_code,
                    "productdescription": clean_text,
                    "parent": "Primary",
                    "partno": "",
                    "productgodown": item.warehouse.replace(" - Z", ""),
                    "unit": item.uom or "",
                    "Altunit": item.stock_uom or "",
                    "productqty": item.qty,
                    "productAltqty": item.stock_qty,
                    "productrate": item.rate,
                    "producthsn": getattr(item, "gst_hsn_code", "") or "",
                    "productigstpercentage":item.igst_rate or "",
                    "productcgstpercentage": item.cgst_rate or "",
                    "productsgstpercentage": item.sgst_rate or "",
                    "taxamount": "",
                    "taxableamount": item.amount,
                    "productvalue": item.amount
                })

            # Ledger List
            ledger_list = []

            for tax in doc.taxes:
                parent_account = frappe.get_value("Account",tax.account_head,"parent_account")
                account_name = (tax.account_head or "").split(" - ")[0]

                ledger_list.append({
                    "invoicenumber": doc.name,
                    "additionalledger": account_name,
                    "parent": parent_account.replace(" - Z", ""),
                    "rateofpercentage": tax.rate or "",
                    "additionalledgervalue": abs(tax.tax_amount)
                })

            # Place of Supply
            place_of_supply = ""
            if doc.get("place_of_supply"):
                try:
                    place_of_supply = doc.place_of_supply.split("-")[-1].strip()
                except Exception:
                    place_of_supply = doc.place_of_supply

            sales_list.append({
                "invoicenumber": doc.name,
                "invoicedate": doc.posting_date.strftime("%d-%m-%Y"),
                "narration": doc.remarks or "No Remarks",
                "customername": doc.customer,
                "vchtype": "GST Sales",
                "invoicemode": "Invoice Voucher View",
                "reference": "",
                "salesledger": (
                    doc.items[0].income_account.split(" - ")[0]
                    if doc.items and doc.items[0].income_account
                    else ""
                ),
                "vchclass": "Local Sales",
                "ordernumber": "",
                "orderdate": "",

                # Buyer Details
                "buyername": doc.customer,
                "buyeraddress1": "-".join([x for x in [buyer_address1, buyer_address2] if x]),
                "buyeraddress2": buyer_address3,
                "buyeraddress3": "-".join([x for x in [buyer_address4, buyer_address5] if x]),
                "buyeraddress4": buyer_address6,
                "buyeraddress5": "",
                "buyerstate": buyer_state,
                "buyerGSTIN": customer_gstin,
                # Place of Supply
                "Placeofsupply": place_of_supply,
                # Delivery Details
                "deliveryname": doc.customer,
                "deliveryaddress1": delivery_address1,
                "deliveryaddress2": delivery_address2,
                "deliveryaddress3": delivery_address3,
                "deliveryaddress4": "-".join([x for x in [delivery_address4, delivery_address5] if x]),
                "deliveryaddress5": delivery_address6,
                "deliverystate": delivery_state,
                "deliveryGSTIN": delivery_gstin,
                # Values
                "subvalue": doc.total,
                "roundoffledger": "Round Off",
                "roundoffamount": doc.rounding_adjustment or 0,
                "invoicevalue": doc.rounded_total,

                # E-Invoice
                "irn": doc.get("irn") or "",
                "ackno": doc.get("ack_no") or "",
                "ackdate": (
                    str(doc.get("ack_date"))
                    if doc.get("ack_date")
                    else ""
                ),
                # Locations
                "Billto": doc.place_of_supply[3:] or "",
                "shipto": delivery_state,
                "dispatchFrom": "",
                "dispatchto": "",

                # E-Way Bill
                "ewaybillno": doc.get("ewaybill") or "",
                "ewaybillnodate": "",

                # Vehicle
                "vehiclenumber": doc.get("vehicle_no") or "",
                "modeo": "1 - Road",
                "vehicletype": "R - Regular",

                # Child Tables
                "vchproductlist": product_list,
                "vchledgerlist": ledger_list
            })

        return {
            
            "tallycode": "111222",
            "tallyname": payload.get("tallyname", ""),
            "tallyserialno": payload.get("tallyserialno", ""),
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