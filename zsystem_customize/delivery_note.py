import frappe
from erpnext.stock.doctype.delivery_note.delivery_note import DeliveryNote

class CustomDeliveryNotes(DeliveryNote):

    def get_status(self):

        if self.docstatus == 1 and self.custom_returnable_dc == 1:

            # Most specific first: Return DC
            if self.is_return:
                return "Return DC"

            # Check if return created against this DN
            if self.has_return_against():
                return "Return Issued"

            # Completed after Sales Invoice is linked
            if self.per_billed >= 100:
                return "Completed"

            # Default returnable state
            return "Returnable DC"

        return super().get_status()

    def set_status(self, update=False, status=None, update_modified=True):

        if self.docstatus == 1 and self.custom_returnable_dc == 1:

            # Most specific first: Return DC
            if self.is_return:
                new_status = "Return DC"

            # Check return created
            elif self.has_return_against():
                new_status = "Return Issued"

            # Completed after Sales Invoice is linked
            elif self.per_billed >= 100:
                new_status = "Completed"

            # Default returnable state
            else:
                new_status = "Returnable DC"

            self.status = new_status

            if update:
                self.db_set("status", new_status, update_modified=update_modified)

            return

        super().set_status(update, status, update_modified)

    def update_status(self, status=None, update_modified=True):

        if self.docstatus == 1 and self.custom_returnable_dc == 1:

            if self.is_return:
                status = "Return DC"

            elif self.has_return_against():
                status = "Return Issued"

            elif self.per_billed >= 100:
                status = "Completed"

            else:
                status = "Returnable DC"

        super().update_status(status, update_modified)

    def has_return_against(self):

        return frappe.db.exists(
            "Delivery Note",
            {
                "is_return": 1,
                "return_against": self.name,
                "docstatus": 1
            }
        )