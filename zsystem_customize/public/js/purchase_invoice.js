frappe.ui.form.on("Purchase Invoice",{
    custom_expense_head(frm) {
        if (!frm.doc.custom_expense_head) return;

        frm.doc.items.forEach(row => {
            frappe.model.set_value(
                row.doctype,
                row.name,
                "expense_account",
                frm.doc.custom_expense_head
            );
        });
    }
});
frappe.ui.form.on("Purchase Invoice Item",{
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
})