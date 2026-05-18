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
from erpnext.stock.stock_ledger import validate_cancellation, set_as_cancel, get_or_make_bin, \
                                            get_args_for_future_sle, validate_serial_no, make_entry, \
                                                repost_current_voucher, update_bin_qty
from frappe.utils import ( flt )
from erpnext.stock.utils import ( get_incoming_outgoing_rate_for_cancel)
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
    pass

class CustomAssetCapitalization(UpdateStockMixin['CustomAssetCapitalization'],AssetCapitalization):
    pass

class CustomSalesInvoice(UpdateStockMixin['CustomSalesInvoice'],SalesInvoice):
    pass

class CustomPurchaseInvoice(UpdateStockMixin['CustomPurchaseInvoice'],PurchaseInvoice):
    pass