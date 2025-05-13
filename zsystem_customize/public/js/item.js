frappe.ui.form.on('Item Barcode', {
    barcode: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
    
        if (row.barcode) {
            // Remove '1P' (case-insensitive) from the start, '$' at the end, and all dashes
            let cleaned = row.barcode.replace(/^1P/i, '').replace(/\$$/, '').replace(/-/g, '');
    
            // Update the barcode field with the cleaned value
            frappe.model.set_value(cdt, cdn, 'barcode', cleaned);
        }
    }    
});
