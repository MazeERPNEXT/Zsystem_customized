from erpnext.selling.doctype.sales_order.sales_order import SalesOrder


class CustomSalesOrder(SalesOrder):

    def get_status(self):

        # Submitted SO
        if self.docstatus == 1:

            # Partially Delivered
            if 0 < self.per_delivered < 100:
                return "Partially Deliver"

        return super().get_status()

    def set_status(self, update=False, status=None, update_modified=True):

        new_status = None

        # Submitted SO
        if self.docstatus == 1:

            # Partially Delivered
            if 0 < self.per_delivered < 100:
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

        if self.docstatus == 1:

            # Partially Delivered
            if 0 < self.per_delivered < 100:
                self.status = "Partially Deliver"

                self.db_set(
                    "status",
                    "Partially Deliver",
                    update_modified=update_modified
                )

                return

        super().update_status(status, update_modified)