import frappe
from typing import TypeVar, Generic
from erpnext.controllers.stock_controller import StockController
from erpnext.subcontracting.doctype.subcontracting_receipt.subcontracting_receipt import SubcontractingReceipt
from erpnext.stock.doctype.stock_reconciliation.stock_reconciliation import StockReconciliation
from erpnext.stock.doctype.stock_entry.stock_entry import StockEntry
from erpnext.stock.doctype.purchase_receipt.purchase_receipt import PurchaseReceipt
from erpnext.stock.doctype.delivery_note.delivery_note import DeliveryNote
from erpnext.assets.doctype.asset_capitalization.asset_capitalization import AssetCapitalization
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice
from erpnext.accounts.doctype.purchase_invoice.purchase_invoice import PurchaseInvoice
from erpnext.stock.utils import get_combine_datetime
from erpnext.stock.stock_ledger import validate_cancellation, set_as_cancel, get_or_make_bin,get_args_for_future_sle, make_entry,repost_current_voucher, update_bin_qty
# from erpnext.stock.stock_ledger import (
#     validate_cancellation,
#     set_as_cancel,
#     get_or_make_bin
# )
from frappe.utils import ( flt )
from erpnext.stock.utils import ( get_incoming_outgoing_rate_for_cancel)
from erpnext.stock.doctype.delivery_note.delivery_note import DeliveryNote
# from erpnext.buying.doctype.purchase_order.purchase_order import PurchaseOrder

T = TypeVar('T', bound=StockController)

class UpdateStockMixin(Generic[T]):
    def make_sl_entries(self, sl_entries, allow_negative_stock=False, via_landed_cost_voucher=False):
        super().make_sl_entries(
            sl_entries,
            allow_negative_stock=allow_negative_stock,
            via_landed_cost_voucher=via_landed_cost_voucher
        )

        for sl_entry in sl_entries:
            item_code = sl_entry.item_code
            bins = frappe.db.sql("""
                        SELECT sum(actual_qty) as a_qty
                        FROM `tabBin`
                        WHERE item_code = %s
                        group by item_code
                    """, (item_code,), as_dict=True)
            frappe.db.set_value("Item", item_code, "custom_stock_qty", bins[0]['a_qty']) 
            

class CustomSubcontractingReceipt(UpdateStockMixin['CustomSubcontractingReceipt'], SubcontractingReceipt):
    pass

class CustomStockReconciliation(UpdateStockMixin['CustomStockReconciliation'], StockReconciliation):
    pass

class CustomStockEntry(UpdateStockMixin['CustomStockEntry'],StockEntry):
    pass

class CustomPurchaseReceipt(UpdateStockMixin['CustomPurchaseReceipt'],PurchaseReceipt):
    pass

class CustomDeliveryNote(UpdateStockMixin['CustomDeliveryNote'],DeliveryNote):
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

class CustomAssetCapitalization(UpdateStockMixin['CustomAssetCapitalization'],AssetCapitalization):
    pass

class CustomSalesInvoice(UpdateStockMixin['CustomSalesInvoice'],SalesInvoice):
    pass

class CustomPurchaseInvoice(UpdateStockMixin['CustomPurchaseInvoice'],PurchaseInvoice):
    pass

# # with reserve stock also
# import frappe
# from typing import TypeVar, Generic

# from frappe.utils import flt

# from erpnext.controllers.stock_controller import StockController

# from erpnext.subcontracting.doctype.subcontracting_receipt.subcontracting_receipt import (
#     SubcontractingReceipt
# )
# from erpnext.stock.stock_ledger import validate_cancellation, set_as_cancel, get_or_make_bin,get_args_for_future_sle, make_entry,repost_current_voucher, update_bin_qty

# from erpnext.stock.doctype.stock_reconciliation.stock_reconciliation import (
#     StockReconciliation
# )

# from erpnext.stock.doctype.stock_entry.stock_entry import StockEntry

# from erpnext.stock.doctype.purchase_receipt.purchase_receipt import (
#     PurchaseReceipt
# )

# from erpnext.stock.doctype.delivery_note.delivery_note import DeliveryNote

# from erpnext.stock.doctype.stock_reservation_entry.stock_reservation_entry import (
#     StockReservationEntry
# )

# from erpnext.assets.doctype.asset_capitalization.asset_capitalization import (
#     AssetCapitalization
# )

# from erpnext.accounts.doctype.sales_invoice.sales_invoice import (
#     SalesInvoice
# )

# from erpnext.accounts.doctype.purchase_invoice.purchase_invoice import (
#     PurchaseInvoice
# )

# T = TypeVar('T', bound=StockController)


# # =========================================================
# # COMMON FUNCTION
# # =========================================================

# def update_available_stock(item_code):

#     if not item_code:
#         return

#     # Total Actual Stock
#     actual_stock = frappe.db.sql("""
#         SELECT IFNULL(SUM(actual_qty), 0)
#         FROM `tabBin`
#         WHERE item_code = %s
#     """, (item_code,))[0][0]

#     # Reserved Stock Qty
#     reserved_stock = frappe.db.sql("""
#         SELECT IFNULL(SUM(reserved_qty), 0)
#         FROM `tabStock Reservation Entry`
#         WHERE item_code = %s
#         AND docstatus = 1
#         AND status NOT IN ('Cancelled', 'Delivered')
#     """, (item_code,))[0][0]

#     # Available Qty
#     available_qty = flt(actual_stock) - flt(reserved_stock)

#     # Update Item Custom Field
#     frappe.db.set_value(
#         "Item",
#         item_code,
#         "custom_stock_qty",
#         available_qty
#     )


# # =========================================================
# # STOCK LEDGER MIXIN
# # =========================================================

# class UpdateStockMixin(Generic[T]):

#     def make_sl_entries(
#         self,
#         sl_entries,
#         allow_negative_stock=False,
#         via_landed_cost_voucher=False
#     ):

#         super().make_sl_entries(
#             sl_entries,
#             allow_negative_stock=allow_negative_stock,
#             via_landed_cost_voucher=via_landed_cost_voucher
#         )

#         processed_items = []

#         for sl_entry in sl_entries:

#             item_code = sl_entry.item_code

#             if not item_code:
#                 continue

#             # Avoid duplicate processing
#             if item_code in processed_items:
#                 continue

#             processed_items.append(item_code)

#             update_available_stock(item_code)


# # =========================================================
# # STOCK CONTROLLER OVERRIDES
# # =========================================================

# class CustomSubcontractingReceipt(
#     UpdateStockMixin['CustomSubcontractingReceipt'],
#     SubcontractingReceipt
# ):
#     pass


# class CustomStockReconciliation(
#     UpdateStockMixin['CustomStockReconciliation'],
#     StockReconciliation
# ):
#     pass


# class CustomStockEntry(
#     UpdateStockMixin['CustomStockEntry'],
#     StockEntry
# ):
#     pass


# class CustomPurchaseReceipt(
#     UpdateStockMixin['CustomPurchaseReceipt'],
#     PurchaseReceipt
# ):
#     pass


# class CustomAssetCapitalization(
#     UpdateStockMixin['CustomAssetCapitalization'],
#     AssetCapitalization
# ):
#     pass


# class CustomSalesInvoice(
#     UpdateStockMixin['CustomSalesInvoice'],
#     SalesInvoice
# ):
#     pass


# class CustomPurchaseInvoice(
#     UpdateStockMixin['CustomPurchaseInvoice'],
#     PurchaseInvoice
# ):
#     pass


# # =========================================================
# # DELIVERY NOTE CUSTOM STATUS
# # =========================================================

# class CustomDeliveryNote(
#     UpdateStockMixin['CustomDeliveryNote'],
#     DeliveryNote
# ):

#     def get_status(self):

#         if self.docstatus == 1 and self.custom_returnable_dc == 1:

#             if self.is_return:
#                 return "Return DC"

#             if self.has_return_against():
#                 return "Return Issued"

#             if self.per_billed >= 100:
#                 return "Completed"

#             return "Returnable DC"

#         return super().get_status()

#     def set_status(self, update=False, status=None, update_modified=True):

#         if self.docstatus == 1 and self.custom_returnable_dc == 1:

#             if self.is_return:
#                 new_status = "Return DC"

#             elif self.has_return_against():
#                 new_status = "Return Issued"

#             elif self.per_billed >= 100:
#                 new_status = "Completed"

#             else:
#                 new_status = "Returnable DC"

#             self.status = new_status

#             if update:
#                 self.db_set(
#                     "status",
#                     new_status,
#                     update_modified=update_modified
#                 )

#             return

#         super().set_status(update, status, update_modified)

#     def update_status(self, status=None, update_modified=True):

#         if self.docstatus == 1 and self.custom_returnable_dc == 1:

#             if self.is_return:
#                 status = "Return DC"

#             elif self.has_return_against():
#                 status = "Return Issued"

#             elif self.per_billed >= 100:
#                 status = "Completed"

#             else:
#                 status = "Returnable DC"

#         super().update_status(status, update_modified)

#     def has_return_against(self):

#         return frappe.db.exists(
#             "Delivery Note",
#             {
#                 "is_return": 1,
#                 "return_against": self.name,
#                 "docstatus": 1
#             }
#         )


# # =========================================================
# # STOCK RESERVATION ENTRY
# # =========================================================

# class CustomStockReservationEntry(StockReservationEntry):

#     def on_submit(self):
#         super().on_submit()
#         update_available_stock(self.item_code)

#     def on_cancel(self):
#         super().on_cancel()
#         update_available_stock(self.item_code)

#     def on_update_after_submit(self):
#         super().on_update_after_submit()
#         update_available_stock(self.item_code)