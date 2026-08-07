from erpnext.selling.doctype.sales_order.sales_order import SalesOrder


class CustomSalesOrder(SalesOrder):

    def get_status(self):

        # Replace "To Deliver and Bill" with "In Progress"
        if (
            self.docstatus == 1
            and self.per_delivered == 0
            and self.per_billed == 0
            and self.status != "Closed"
        ):
            return {"status": "In Progress"}

        # Partially Delivered
        if self.docstatus == 1 and 0 < self.per_delivered < 100:
            return {"status": "Partially Deliver"}
        return super().get_status()

    def set_status(self, update=False, status=None, update_modified=True):

        new_status = None

        # In Progress
        if (
            self.docstatus == 1
            and self.per_delivered == 0
            and self.per_billed == 0
            and self.status != "Closed"
        ):
            new_status = "In Progress"

        # Partially Delivered
        elif self.docstatus == 1 and 0 < self.per_delivered < 100:
            new_status = "Partially Deliver"

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

        # In Progress
        if (
            self.docstatus == 1
            and self.per_delivered == 0
            and self.per_billed == 0
            and self.status != "Closed"
        ):
            self.status = "In Progress"

            self.db_set(
                "status",
                "In Progress",
                update_modified=update_modified
            )
            return

        # Partially Delivered
        if self.docstatus == 1 and 0 < self.per_delivered < 100:
            self.status = "Partially Deliver"

            self.db_set(
                "status",
                "Partially Deliver",
                update_modified=update_modified
            )
            return

        super().update_status(status, update_modified)