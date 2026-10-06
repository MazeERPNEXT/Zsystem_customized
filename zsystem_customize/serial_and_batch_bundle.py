import frappe

from erpnext.stock.doctype.serial_and_batch_bundle import serial_and_batch_bundle


_original_validate_returned_serial_batch_no = (
    serial_and_batch_bundle.SerialandBatchBundle.validate_returned_serial_batch_no
)


def validate_returned_serial_batch_no(
    self,
    return_against,
    row,
    original_inv_details,
):

    if self.voucher_type == "Delivery Note" and self.voucher_no:

        custom_returnable_dc = frappe.db.get_value(
            "Delivery Note",
            self.voucher_no,
            "custom_returnable_dc",
        )

        if custom_returnable_dc:
            return

    return _original_validate_returned_serial_batch_no(
        self,
        return_against,
        row,
        original_inv_details,
    )


serial_and_batch_bundle.SerialandBatchBundle.validate_returned_serial_batch_no = (
    validate_returned_serial_batch_no
)