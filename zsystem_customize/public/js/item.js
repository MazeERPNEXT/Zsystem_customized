frappe.ui.form.on('Item Barcode', {
    barcode: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (row.barcode) {
            // Remove '1p' and '$' from the value
            let cleaned = row.barcode.replace(/1P/g, '').replace(/\$/g, '').replace(/-/g,'');

            // Update the field
            frappe.model.set_value(cdt, cdn, 'barcode', cleaned);
        }
    }
});
