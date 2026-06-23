frappe.ui.form.on("Purchase Receipt Item",{
    item_code:function(frm, cdt, cdn){
        if(cur_dialog == null){
            locals[cdt][cdn].use_serial_batch_fields = 1;
            frappe.flags.dialog_set = false;
            frappe.flags.hide_serial_batch_dialog = false;
        }
    },
    qty: function(frm, cdt, cdn){
        let child = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "received_qty", child.qty);
    }
    
});

frappe.ui.form.on("Purchase Receipt", {
    before_submit(frm) {
        if (frm.doc.custom_is_hsn_code_verified != 1) {
            frappe.msgprint(__("Kindly verify HSN Code in Item Table"));
            frappe.validated = false; 
        }
    }
});

