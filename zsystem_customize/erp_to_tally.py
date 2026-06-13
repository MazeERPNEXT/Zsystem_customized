import frappe
import json
from frappe.utils import getdate, nowdate
from frappe.utils import strip_html
from datetime import datetime
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
                "narration": doc.remarks or "",
                "customername": doc.customer,
                "vchtype": "GST Sales",
                "invoicemode": "Invoice Voucher View",
                "reference": "",
                "salesledger": doc.custom_income_account or "",
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

# Sales invoice status
@frappe.whitelist(allow_guest=True)
def get_sales_invoice_status():
    try:
        # -----------------------------
        # GET INPUT DATA
        # -----------------------------
        data = frappe.local.form_dict

        if frappe.request and frappe.request.data:
            try:
                data = json.loads(frappe.request.data)
            except Exception:
                pass

        # -----------------------------
        # GET VALUES
        # -----------------------------
        tallyname      = data.get("tallyname")
        tallyserialno  = data.get("tallyserialno")
        requesttype    = data.get("requesttype")

        # -----------------------------
        # VALIDATIONS
        # -----------------------------
        if requesttype != "Sales Status":
            return {
                "status": "error",
                "message": "Request Type must be Sales Status !!!"
            }

        invoices = []

        # -----------------------------
        # PROCESS STATUS REPORTS
        # -----------------------------
        for record in data.get("STATUSREPORTS", []):

            vrno          = record.get("VRNO")
            actual_status = record.get("APIRESULT_STATUS")
            msg           = record.get("APIRESULT_Msg", "")   # ✅ FIX: extract msg here

            if not vrno:
                continue

            try:
                # -----------------------------
                # CHECK SALES INVOICE EXISTS
                # -----------------------------
                if not frappe.db.exists("Sales Invoice", vrno):

                    frappe.log_error(
                        title="Sales Invoice Not Found",
                        message=f"Sales Invoice {vrno} not found"
                    )

                    invoices.append({
                        "invoice_name": vrno,
                        "status": "Error",
                        "message": "Sales Invoice not found"
                    })
                    continue

                # -----------------------------
                # GET DOCUMENT
                # -----------------------------
                doc = frappe.get_doc("Sales Invoice", vrno)

                # -----------------------------
                # SUCCESS CASE
                # -----------------------------
                if actual_status == "Success":

                    doc.db_set(
                        "custom_tally_status",
                        1,
                        update_modified=True
                    )

                    invoices.append({
                        "invoice_name": doc.name,
                        "status": "Success",
                        "message": "Tally Status Updated Successfully"
                    })

                # -----------------------------
                # ERROR CASE
                # -----------------------------
                elif actual_status == "Error":

                    frappe.log_error(
                        title=f"Tally Error - {vrno}",
                        reference_doctype = "Sales Invoice",
                        message=f"Invoice : {vrno}\nTally Response Status : {actual_status}\nTally Message : {msg}"  # ✅ FIX: msg now defined
                    )

                    invoices.append({
                        "invoice_name": doc.name,
                        "status": "Error",
                        "message": msg  # ✅ FIX: msg now defined
                    })

                # -----------------------------
                # UNKNOWN STATUS CASE
                # -----------------------------
                else:

                    frappe.log_error(
                        title=f"Unknown Tally Status - {vrno}",
                        message=f"Received Status : {actual_status}"
                    )

                    invoices.append({
                        "invoice_name": doc.name,
                        "status": "Error",
                        "message": f"Unknown status : {actual_status}"
                    })

            except Exception as e:

                frappe.log_error(
                    frappe.get_traceback(),
                    "Sales Invoice Status Update Error"
                )

                invoices.append({
                    "invoice_name": vrno,
                    "status": "Error",
                    "message": str(e)
                })

        frappe.db.commit()

        # -----------------------------
        # FINAL RESPONSE
        # -----------------------------
        return {
            "status": "success",
            "tallyname": tallyname,
            "tallyserialno": tallyserialno,
            "requesttype": requesttype,
            "saleslist": invoices
        }

    except Exception as e:

        frappe.log_error(
            frappe.get_traceback(),
            "get_sales_invoice_status Error"
        )

        return {
            "status": "error",
            "message": str(e)
        }

# purchase invoice    
@frappe.whitelist(allow_guest=True)
def sent_purchase_tally():
    try:
        data = json.loads(frappe.request.data or "{}")
        payload = data.get("message",data)

        if payload.get("tallycode") != "111222":
            return{
                "status":"error",
                "message":"Incorrect Tally code ..."
            }
        
        #finanical year
        today = getdate(nowdate())

        if today.month >=4:
            fy_start = f"{today.year}-04-01"
        else:
            fy_start = f"{today.year-1}-04-01"

        invoices = frappe.get_all("Purchase Invoice",filters={"docstatus":1,"is_return":0,"posting_date": [">=", fy_start]},fields=["name"],order_by ="posting_date desc")
        
        purchase_list = []

        for inv in invoices:
                doc = frappe.get_doc("Purchase Invoice", inv.name)

                # Customer GSTIN
                supplier_gstin = frappe.db.get_value(
                    "Customer",
                    doc.supplier,
                    "gstin"
                ) or ""
                # -----------------------------
                # BUYER ADDRESS
                # -----------------------------
                buyer_address = ""
                buyer_state = ""

                buyer_address1 = ""
                buyer_address2 = ""
                buyer_address3 = ""
                buyer_address4 = ""
                buyer_address5 = ""
                buyer_address6 = ""

                if doc.supplier_address:
                    try:
                        addr = frappe.get_doc("Address", doc.supplier_address)

                        buyer_address = re.sub(
                            r'-(Billing|Shipping)(-\d+)?$',
                            '',
                            doc.supplier_address
                        ).strip()

                        buyer_address1 = addr.address_line1 or ''
                        buyer_address2 = addr.address_line2 or ''
                        buyer_address3 = addr.city or ''
                        buyer_address4 = addr.state or ''
                        buyer_address5 = addr.pincode or ''
                        buyer_address6 = addr.country or ''

                        buyer_state = addr.state or ""

                    except Exception as e:
                        frappe.log_error(
                            frappe.get_traceback(),
                            f"Supplier Address Error: {doc.supplier_address}"
                        )
                #E-way details
                ewaybill_no = ""
                ewaybill_date = ""

                try:
                    ewb = frappe.get_all(
                        "e-Waybill Log",
                        filters={"reference_name": doc.name},
                        fields=["data"],
                        order_by="creation desc",
                        limit=1
                    )

                    if ewb:
                        raw_data = ewb[0].get("data")

                        if raw_data:
                            # Ensure proper JSON parsing
                            if isinstance(raw_data, str):
                                json_start = raw_data.find("{")
                                if json_start != -1:
                                    raw_data = raw_data[json_start:]
                                parsed = json.loads(raw_data)
                            else:
                                parsed = raw_data

                            # ✅ Extract values from JSON
                            ewaybill_no = str(parsed.get("ewbNo", ""))
                            ewaybill_date = parsed.get("ewayBillDate", "")

                            # ✅ Format date
                            if ewaybill_date:
                                try:
                                    dt = datetime.strptime(ewaybill_date, "%d/%m/%Y %I:%M:%S %p")
                                    ewaybill_date = dt.strftime("%d-%m-%Y")
                                except:
                                    pass

                except Exception:
                    frappe.log_error(frappe.get_traceback(), "eWaybill Fetch Error")

                #E-Invoice
                irn = ""
                ack_no = ""
                ack_date = ""
                sign_inv = ""
                sign_qr = ""

                try:
                    einvoice_log = frappe.get_all(
                        "e-Invoice Log",
                        filters={
                            "reference_name": doc.name,
                            "reference_doctype": "Sales Invoice"
                        },
                        fields=["name", "acknowledgement_number", "acknowledged_on", "invoice_data","signed_invoice","signed_qr_code"],
                        order_by="acknowledged_on desc",
                        limit=1
                    )

                    if einvoice_log:
                        log = einvoice_log[0]
                        irn = einvoice_json.get("Irn") or ""
                        ack_no = str(log.get("acknowledgement_number") or "")
                        sign_inv = log.get("signed_invoice") or ""
                        sign_qr = log.get("signed_qr_code") or ""

                        if log.get("acknowledged_on"):
                            try:
                                ack_date = log["acknowledged_on"].strftime("%d/%m/%Y")
                            except Exception:
                                ack_date = str(log["acknowledged_on"])[:10]

                        
                        invoice_data = log.get("invoice_data")
                        if invoice_data:
                            try:
                                einvoice_json = json.loads(invoice_data)
                                irn = einvoice_json.get("Irn") or ""
                                irn_qr_code = einvoice_json.get("SignedQRCode") or ""
                            except Exception:
                                pass

                except Exception as e:
                    frappe.log_error(str(e), "e-Invoice Log Fetch Error")
                # -----------------------------
                # DELIVERY ADDRESS
                # -----------------------------
                delivery_name = ""
                delivery_address = ""
                delivery_state = ""
                delivery_gstin = ""

                if doc.shipping_address:
                    try:
                        ship = frappe.get_doc("Address", doc.shipping_address)
                        delivery_name = re.sub(r'-(Billing|Shipping)(-\d+)?$', '', doc.shipping_address).strip()
                        delivery_address1 = ship.address_line1 or ""
                        delivery_address2 = ship.address_line2 or ""
                        delivery_address3 = ship.city or ''
                        delivery_address4 = ship.state or ''
                        delivery_address5 = ship.pincode or ''
                        delivery_address6 = ship.country or ''
                        
                        delivery_state = ship.state or ""
                        delivery_gstin = ship.gstin or ""
                    except Exception:
                        pass
                    
                    vchproductlist_pur = []
                    for item in doc.items:
                        clean_text = strip_html(item.description or "")
                        vchproductlist_pur.append ({
                            "invoicenumber": doc.name,
                            "product": item.item_code ,
                            "productdescription": clean_text,
                            "parent": "",
                            "partno": "",
                            "productgodown": item.warehouse.replace(" - Z", "") if item.warehouse else "",
                            "unit": item.uom or "",
                            "Altunit": item.stock_uom or "",
                            "productqty": item.qty,
                            "productAltqty": item.stock_qty,
                            "productrate": item.rate,
                            "producthsn": getattr(item, "gst_hsn_code", "") or "",
                            "productigstpercentage": item.igst_rate or "",
                            "productcgstpercentage": item.cgst_rate or "",
                            "productsgstpercentage": item.sgst_rate or "",
                            "taxamount": "",
                            "taxableamount":"" ,
                            "productvalue": item.amount,
                        })

                    vchledgerlist_pur = []
                    for tax in doc.taxes:
                        parent_account = frappe.get_value("Account",tax.account_head,"parent_account")
                        account_name = (tax.account_head or "").split(" - ")[0]

                        vchledgerlist_pur.append({
                            "invoicenumber": doc.name,
                            "additionalledger": account_name,
                            "parent": parent_account.replace(" - Z", ""),
                            "rateofpercentage": "",
                            "additionalledgervalue": abs(tax.tax_amount)
                        })

                        place_of_supply = ""
                        if doc.get("place_of_supply"):
                            try:
                                place_of_supply = doc.place_of_supply.split("-")[-1].strip()
                            except Exception:
                                place_of_supply = doc.place_of_supply
                        
                        purchase_list.append({
                            "invoicenumber": doc.name,
                            "invoicedate": doc.posting_date.strftime("%d-%m-%Y"),
                            "narration": doc.remarks or "",
                            "customername": doc.supplier or "",
                            "vchtype": "Purchase",
                            "invoicemode": "Invoice Voucher View",
                            "reference": "",
                            "salesledger": doc.custom_expense_head or "",
                            "vchclass": "Local Purchase",
                            "deliverynoteno": "",
                            "deliverynotedate": "",
                            "dispatchdocno": "",
                            "dipatchthrough": "",
                            "destination": "",
                            "lrrnumber": doc.lr_no or "",
                            "lrrdate": doc.lr_date.strftime("%d-%m-%Y") if doc.lr_date else "",
                            "vehiclenumber": doc.vehicle_no or "",
                            "ordernumber": doc.bill_no or "",
                            "orderdate": doc.bill_date.strftime("%d-%m-%Y")  if doc.bill_date else "",
                            "modeofpayment": "",
                            "otherreference": "",
                            "termsofdelivery": "",
                            "buyername": doc.supplier or "",
                            "buyeraddress1":"-".join([x for x in [buyer_address1, buyer_address2] if x]),
                            "buyeraddress2": buyer_address3,
                            "buyeraddress3": "-".join([x for x in [buyer_address4, buyer_address5] if x]),
                            "buyeraddress4": buyer_address6,
                            "buyeraddress5": "",
                            "country": buyer_address6,
                            "buyerstate": buyer_address4,
                            "placeofsupply": place_of_supply,
                            "buyergstinnumber": supplier_gstin,
                            "deliveryname": delivery_name,
                            "deliveryaddress1": delivery_address1,
                            "deliveryaddress2": delivery_address2,
                            "deliveryaddress3": delivery_address3,
                            "deliveryaddress4": "-".join([x for x in [delivery_address4, delivery_address5] if x]),
                            "deliveryaddress5": delivery_address6,
                            "consigneestate": delivery_state,
                            "consigneegstinnumber": delivery_gstin,
                            "subvalue": doc.total or 0,
                            "roundoffledger": "Round Off",
                            "roundoffamount": doc.rounding_adjustment or 0,
                            "invoicevalue": doc.rounded_total,
                            "irn": irn or "",
                            "ackno": ack_no,
                            "ackdate": ack_date,
                            "SignedInvoice": sign_inv,
                            "SignedQRCode": sign_qr,
                            "ewaybillno": doc.ewaybill or "",
                            "ewaybillnodate": ewaybill_date,
                            "vchproductlist_pur":vchproductlist_pur,
                            "vchledgerlist_pur":vchledgerlist_pur,
                        })
        return {

            "tallycode": "111222",
            "tallyname": payload.get("tallyname", ""),
            "tallyserialno": payload.get("tallyserialno", ""),
            "requesttype": "123456",
            "purchaselist": purchase_list,
            
        }
    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            "Purchase Invoice Tally Export"
        )

        return {
            "status": "error",
            "message": frappe.get_traceback()
        }
                