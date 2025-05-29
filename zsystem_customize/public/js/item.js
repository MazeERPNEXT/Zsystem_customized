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
