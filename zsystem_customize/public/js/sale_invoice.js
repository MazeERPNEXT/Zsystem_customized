frappe.ui.form.on("Sales Invoice",{
    custom_income_account(frm) {
        if (!frm.doc.custom_income_account) return;

        frm.doc.items.forEach(row => {
            frappe.model.set_value(
                row.doctype,
                row.name,
                "income_account",
                frm.doc.custom_income_account
            );
        });
    }
});