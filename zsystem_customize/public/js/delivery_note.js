frappe.ui.form.on("Delivery Note Item",{
    item_code:function(frm, cdt, cdn){
        locals[cdt][cdn].use_serial_batch_fields = 1;
        frappe.flags.dialog_set = false;
        frappe.flags.hide_serial_batch_dialog = false;
    }
})
frappe.ui.form.on("Delivery Note", {

    refresh(frm) {

        // Return DC
        if (
            frm.doc.docstatus === 1 &&
            frm.doc.custom_returnable_dc == 1 &&
            frm.doc.is_return == 1
        ) {

            frm.page.set_indicator(
                __("Return DC"),
                "orange"
            );

        }

        // Completed after billing
        else if (
            frm.doc.docstatus === 1 &&
            frm.doc.custom_returnable_dc == 1 &&
            flt(frm.doc.per_billed) >= 100
        ) {

            frm.page.set_indicator(
                __("Completed"),
                "green"
            );

        }

        // Returnable DC
        else if (
            frm.doc.docstatus === 1 &&
            frm.doc.custom_returnable_dc == 1
        ) {

            frm.page.set_indicator(
                __("Returnable DC"),
                "orange"
            );

        }
    },

    on_submit(frm) {

        // Return DC
        if (
            frm.doc.custom_returnable_dc == 1 &&
            frm.doc.is_return == 1
        ) {

            frappe.db.set_value(
                "Delivery Note",
                frm.doc.name,
                "status",
                "Return DC"
            ).then(() => {
                frm.reload_doc();
            });

        }

        // Returnable DC
        else if (frm.doc.custom_returnable_dc == 1) {

            frappe.db.set_value(
                "Delivery Note",
                frm.doc.name,
                "status",
                "Returnable DC"
            ).then(() => {
                frm.reload_doc();
            });
        }
    }
});
