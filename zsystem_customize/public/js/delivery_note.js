frappe.ui.form.on("Delivery Note Item",{
    item_code:function(frm, cdt, cdn){
        locals[cdt][cdn].use_serial_batch_fields = 1;
        frappe.flags.dialog_set = false;
        frappe.flags.hide_serial_batch_dialog = false;
        setTimeout(function() {
            frappe.model.set_value(cdt, cdn, 'rate', 0);
            // frappe.model.set_value(cdt, cdn, 'price_list_rate', 0);
            // frappe.model.set_value(cdt, cdn, 'base_price_list_rate', 0);
        },1000);
    }
})
frappe.ui.form.on("Delivery Note", {

    refresh(frm) {
        frm.fields_dict.custom_modified_by.$wrapper
            .find('.control-value')
            .css('color', 'black');

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

        // Return Issued
        else if (
            frm.doc.docstatus === 1 &&
            frm.doc.custom_returnable_dc == 1 &&
            frm.doc.status === "Return Issued"
        ) {

            frm.page.set_indicator(
                __("Return Issued"),
                "grey"
            );

        }

        // Completed
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
    after_save: function(frm) {
        frappe.db.get_value(
            "User",
            frm.doc.modified_by,
            "full_name"
        ).then(r => {
            if (r.message) {
                frm.set_value("custom_modified_by", r.message.full_name);
                frm.save();
            }
        });
    },
    on_submit(frm) {

        // Return DC document
        if (
            frm.doc.custom_returnable_dc == 1 &&
            frm.doc.is_return == 1
        ) {

            // Set current document as Return DC
            frappe.db.set_value(
                "Delivery Note",
                frm.doc.name,
                "status",
                "Return DC"
            );

            // Update original DN as Return Issued
            if (frm.doc.return_against) {

                frappe.db.set_value(
                    "Delivery Note",
                    frm.doc.return_against,
                    "status",
                    "Return Issued"
                );
            }

            frm.reload_doc();
        }

        // Normal Returnable DC
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
    },
    async customer(frm){
        if(frm.doc.customer){
            let r = await frappe.db.get_value("Customer",frm.doc.customer,"custom_sales_person");
            frm.set_value("custom_sales_person",r.message.custom_sales_person || '')
        }
    }
});