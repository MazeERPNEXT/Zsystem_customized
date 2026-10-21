import frappe
from frappe import _


def sent_email_for_panelteam(doc, method=None):

    # Debug log
    frappe.logger().info(
        f"Panel Email Triggered - {doc.name} - Workflow State: {doc.workflow_state}"
    )

    # Check workflow state
    if doc.workflow_state != "Waiting for Panel Approvel":
        return

    # Get users with Panel Team role
    users = frappe.get_all(
        "Has Role",
        filters={
            "role": "Panel User",
            "parenttype": "User"
        },
        fields=["parent"]
    )

    recipients = []

    for user in users:

        email = frappe.db.get_value(
            "User",
            user.parent,
            "email"
        )

        enabled = frappe.db.get_value(
            "User",
            user.parent,
            "enabled"
        )

        if email and enabled:
            recipients.append(email)

    recipients = list(set(recipients))

    # No recipients
    if not recipients:
        frappe.log_error(
            f"No Panel Team users found for Stock Entry {doc.name}",
            "Panel Approval Email"
        )
        return

    # Item rows
    item_rows = ""

    for item in doc.items:

        serial_no = item.serial_no or "-"
        batch_no = item.batch_no or "-"

        item_rows += f"""
            <tr>
                <td>{item.s_warehouse or "-"}</td>
                <td>{item.t_warehouse or "-"}</td>
                <td>{item.item_code or "-"}</td>
                <td style="text-align:center;">
                    {item.qty or 0}
                </td>
                <td>{serial_no}</td>
                <td>{batch_no}</td>
            </tr>
        """

    message = f"""
        <p>Dear Panel Team,</p>

        <p>
            The following Stock Entry is waiting for your
            <b>Panel Approval</b>.
        </p>

        <p>
            <b>Stock Entry:</b> {doc.name}
        </p>

        <table border="1"
               cellpadding="6"
               cellspacing="0"
               style="border-collapse:collapse;width:100%;">

            <thead>
                <tr>
                    <th>Source Warehouse</th>
                    <th>Target Warehouse</th>
                    <th>Item Code</th>
                    <th>Qty</th>
                    <th>Serial No</th>
                    <th>Batch No</th>
                </tr>
            </thead>

            <tbody>
                {item_rows}
            </tbody>

        </table>

        <br>

        <p>
            Please review the Stock Entry and take the necessary
            approval action.
        </p>

        <p>
            Thanks &amp; Regards,<br>
            <b>Z System Intelligent Controls Pvt. Ltd.</b>
        </p>
    """

    frappe.sendmail(
        recipients=recipients,
        subject=f"Panel Approval Required - Stock Entry {doc.name}",
        message=message
    )

    frappe.logger().info(
        f"Panel Approval Email Sent - {doc.name} - {recipients}"
    )

def update_material_request_serial_batch(doc, method=None):
    """Update Material Request Item serial and batch values after Stock Entry submission."""

    if doc.docstatus != 1:
        return

    for row in doc.items:
        material_request = row.get("material_request")
        mr_item_name = row.get("material_request_item")

        if not material_request or not mr_item_name:
            continue

        serial_nos = row.get("serial_no") or ""
        batch_nos = row.get("batch_no") or ""

        # ERPNext v16: Get serial and batch details from the bundle
        bundle_name = row.get("serial_and_batch_bundle")

        if bundle_name:
            bundle = frappe.get_doc(
                "Serial and Batch Bundle", bundle_name
            )

            for entry in bundle.entries:
                if entry.get("serial_no"):
                    serial_nos += (
                        ("\n" if serial_nos else "")
                        + entry.serial_no
                    )

                if entry.get("batch_no"):
                    batch_nos += (
                        ("\n" if batch_nos else "")
                        + entry.batch_no
                    )

        # Remove duplicates
        serial_nos = "\n".join(
            dict.fromkeys(
                value.strip()
                for value in serial_nos.replace(",", "\n").splitlines()
                if value.strip()
            )
        )

        batch_nos = "\n".join(
            dict.fromkeys(
                value.strip()
                for value in batch_nos.replace(",", "\n").splitlines()
                if value.strip()
            )
        )

        values = {}
        meta = frappe.get_meta("Material Request Item")

        if meta.has_field("custom_serial_no"):
            values["custom_serial_no"] = serial_nos

        if meta.has_field("custom_batch_no"):
            values["custom_batch_no"] = batch_nos

        if values:
            frappe.db.set_value(
                "Material Request Item",
                mr_item_name,
                values,
                update_modified=True
            )


def clear_material_request_serial_batch_on_cancel(doc, method=None):
    """Clear Material Request Item serial and batch values when Stock Entry is cancelled."""

    if doc.docstatus != 2:
        return

    meta = frappe.get_meta("Material Request Item")
    fields_to_clear = {}

    if meta.has_field("custom_serial_no"):
        fields_to_clear["custom_serial_no"] = ""

    if meta.has_field("custom_batch_no"):
        fields_to_clear["custom_batch_no"] = ""

    if not fields_to_clear:
        return

    for row in doc.items:
        mr_item_name = row.get("material_request_item")

        if not row.get("material_request") or not mr_item_name:
            continue

        frappe.db.set_value(
            "Material Request Item",
            mr_item_name,
            fields_to_clear,
            update_modified=True
        )




# //set serial no or batch based on work order
# def set_serial_batch_from_work_order(doc, method=None):
#     """
#     Fetch serial and batch values from Work Order required_items
#     and set them in Stock Entry items.
#     """

#     if doc.doctype != "Stock Entry":
#         return

#     for row in doc.items:
#         work_order = row.get("work_order")

#         if not work_order:
#             continue

#         # Get Work Order required_items child table
#         required_items = frappe.get_all(
#             "Work Order Item",
#             filters={"parent": work_order},
#             fields=[
#                 "item_code",
#                 "custom_serial_no",
#                 "custom_batch_no",
#             ],
#         )

#         # Match by item code
#         for required_row in required_items:
#             if required_row.item_code != row.item_code:
#                 continue

#             # Set serial number
#             if required_row.custom_serial_no:
#                 row.serial_no = required_row.custom_serial_no

#             # Set batch number
#             if required_row.custom_batch_no:
#                 row.batch_no = required_row.custom_batch_no

#             break
