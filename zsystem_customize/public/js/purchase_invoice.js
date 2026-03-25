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