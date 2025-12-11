import frappe

def validate_so_stock(doc, method):
    """
    Validate that Sales Order item qty is not greater than actual_qty
    available in the Bin for the given warehouse.
    """
    error_rows = []

    for item in doc.items:

        # Warehouse required
        if not item.warehouse:
            frappe.throw(
                f"Please select a Warehouse for item <b>{item.item_code}</b>"
            )

        # Fetch Bin stock
        actual_qty = frappe.db.get_value(
            "Bin",
            {"item_code": item.item_code, "warehouse": item.warehouse},
            "actual_qty"
        ) or 0

        actual_qty = float(actual_qty)
        ordered_qty = float(item.qty or 0)

        # If insufficient, store details instead of throwing immediately
        if ordered_qty > actual_qty:
            error_rows.append(
                f"""
                <tr>
                    <td>{item.item_code}</td>
                    <td>{item.warehouse}</td>
                    <td>{ordered_qty}</td>
                    <td>{actual_qty}</td>
                </tr>
                """
            )

    # After loop → if any errors, throw one combined message
    if error_rows:
        message = f"""
            <h3> Insufficient Stock for the following Items !</h3>
            <table class="table table-bordered" style="width: 100%; margin-top:10px;font-size:13px">
                <thead>
                    <tr>
                        <th>Item Code</th>
                        <th>Warehouse</th>
                        <th>Required Qty</th>
                        <th>Available Qty</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(error_rows)}
                </tbody>
            </table>
            <br>
            <b>Cannot submit this Sales Order.</b>
        """
        frappe.throw(message)
