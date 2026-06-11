frappe.ui.form.on('Item Barcode', {
    barcode: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (row.barcode) {
            // Split the string by '|'
            let parts = row.barcode.split('|');

            // Find the part that starts with '1P' (case-insensitive)
            let target = parts.find(p => /^1P/i.test(p));

            if (target) {
                // Remove '1P' from start, dashes, and pipes
                let cleaned = target.replace(/^1P\s*/, '').replace(/-/g, '');

                // Add back the 'P' if needed
                cleaned = cleaned;

                // Update the field
                frappe.model.set_value(cdt, cdn, 'barcode', cleaned);
            }
        }
    }    
});

frappe.ui.form.on("Item", {
    custom_warehouse(frm) {
        if (!frm.doc.custom_warehouse) return;

        if (!frm.doc.item_defaults?.length) {
            let row = frm.add_child("item_defaults");
            row.default_warehouse = frm.doc.custom_warehouse;
        } else {
            frm.doc.item_defaults.forEach(row => {
                row.default_warehouse = frm.doc.custom_warehouse;
            });
        }

        frm.refresh_field("item_defaults");
    }
});