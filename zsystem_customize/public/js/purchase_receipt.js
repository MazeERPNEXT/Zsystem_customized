frappe.ui.form.on("Purchase Receipt Item",{
    item_code:function(frm, cdt, cdn){
        if(cur_dialog == null){
            locals[cdt][cdn].use_serial_batch_fields = 1;
            frappe.flags.dialog_set = false;
            frappe.flags.hide_serial_batch_dialog = false;
        }
    },
    rejected_serial_no: function(frm, cdt, cdn) {
        let child = locals[cdt][cdn];

        let serials = child.rejected_serial_no || "";

        let count = serials
            .split(/\n|,/)
            .map(s => s.trim())
            .filter(s => s.length > 0).length;

        frappe.model.set_value(cdt, cdn, "rejected_qty", count);
    },
    qty: function(frm, cdt, cdn) {
        let child = locals[cdt][cdn];

        let received_qty = (child.qty || 0) + (child.rejected_qty || 0);

        frappe.model.set_value(cdt, cdn, "received_qty", received_qty);
    },
});

frappe.ui.form.on("Purchase Receipt", {
    before_submit(frm) {
        let missing_hsn = [];

        (frm.doc.items || []).forEach((row, index) => {
            if (!row.gst_hsn_code || !row.gst_hsn_code.trim()) {
                missing_hsn.push(
                    `Row ${index + 1}: ${row.item_code || "Unknown Item"}`
                );
            }
        });

        if (missing_hsn.length > 0) {
            frm.set_value("custom_is_hsn_code_verified", 0);

            frappe.msgprint({
                title: __("Missing HSN Code"),
                indicator: "red",
                message: __(
                    "Please fill in the GST HSN Code for the following items:<br><br>{0}",
                    [missing_hsn.join("<br>")]
                )
            });

            frappe.validated = false;
            return;
        }

        // All item rows have an HSN code
        frm.set_value("custom_is_hsn_code_verified", 1);
    },
    refresh(frm) {
        const rename_purchase_return = () => {
            $('.es-menu__item').each(function () {
                const label = $(this).find('.es-menu__label');

                if (label.length && label.text().trim() === 'Purchase Return') {
                    label.text('Customer Material Return');
                }
            });
        };

        // Run immediately
        rename_purchase_return();

        // Watch for dynamically rendered menu items
        if (!window.purchase_return_observer) {
            window.purchase_return_observer = new MutationObserver(() => {
                rename_purchase_return();
            });

            window.purchase_return_observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
});

