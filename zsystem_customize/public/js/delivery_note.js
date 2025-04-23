frappe.ui.form.on("Delivery Note Item",{
    item_code:function(frm, cdt, cdn){
        locals[cdt][cdn].use_serial_batch_fields = 0;
        frappe.flags.dialog_set = false;
        frappe.flags.hide_serial_batch_dialog = false;
    }
})
