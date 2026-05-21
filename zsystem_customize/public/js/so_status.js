frappe.ui.form.on("Sales Order", {

    refresh(frm) {
        update_custom_status(frm);
    },

    per_delivered(frm) {
        update_custom_status(frm);
    }
});

function update_custom_status(frm) {

    if (
        frm.doc.docstatus === 1
    ) {

        if (
            frm.doc.per_delivered < 100 &&
            frm.doc.per_delivered > 0
        ) {

            frm.page.set_indicator(
                __("Partially Deliver"),
                "orange"
            );

            frm.set_value("status", "Partially Deliver");
        }
    }
}