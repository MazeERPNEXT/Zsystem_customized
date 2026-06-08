frappe.ui.form.on('Customer', {
    customer_name(frm) {
        if (frm.doc.customer_name) {
            frm.set_value(
                'customer_name',
                frm.doc.customer_name.toUpperCase()
            );
        }
    }
});