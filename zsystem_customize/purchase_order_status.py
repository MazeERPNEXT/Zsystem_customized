from erpnext.buying.doctype.purchase_order.purchase_order import PurchaseOrder


class CustomPurchaseOrder(PurchaseOrder):

    def get_status(self):

        # Replace "To Deliver and Bill" with "FollowUp"
        if (
            self.docstatus == 1
            and self.per_received == 0
            and self.per_billed == 0
            and self.status != "Closed"
        ):
            return {"status": "Followup"}

        # Partially Receive
        if self.docstatus == 1 and 0 < self.per_received < 100:
            return {"status": "Partially Receive"}
         # Receive
        if self.docstatus == 1 and self.per_received == 100:
            return {"status": "Receive"}
        return super().get_status()


    def set_status(self, update=False, status=None, update_modified=True):

        new_status = None

        # In Progress
        if (
            self.docstatus == 1
            and self.per_received == 0
            and self.per_billed == 0
            and self.status != "Closed"
        ):
            new_status = "Followup"

        # Partially Receiveed
        elif self.docstatus == 1 and 0 < self.per_received < 100:
            new_status = "Partially Receive"
        elif self.docstatus == 1 and self.per_received == 100:
            new_status = "Receive"

        if new_status:
            self.status = new_status

            if update:
                self.db_set(
                    "status",
                    new_status,
                    update_modified=update_modified
                )

            return

        super().set_status(update, status, update_modified)

    def update_status(self, status=None, update_modified=True):

        # Followup
        if (
            self.docstatus == 1
            and self.per_received == 0
            and self.per_billed == 0
            and self.status != "Closed"
        ):
            self.status = "Followup"

            self.db_set(
                "status",
                "Followup",
                update_modified=update_modified
            )
            return

        # Partially Receiveed
        if self.docstatus == 1 and self.per_received == 100:
            self.status = "Partially Receive"

            self.db_set(
                "status",
                "Partially Receive",
                update_modified=update_modified
            )
            return
        #  Receive
        if self.docstatus == 1 and self.per_received == 100:
            self.status = "Receive"

            self.db_set(
                "status",
                "Receive",
                update_modified=update_modified
            )
            return

        super().update_status(status, update_modified)