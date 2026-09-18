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