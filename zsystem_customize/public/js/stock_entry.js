frappe.ui.form.on("Stock Entry", {
    onload: function(frm) {
        set_sales_order_value(frm);
    },

    work_order: function(frm) {
        set_sales_order_value(frm);
    }
});

function set_sales_order_value(frm) {

    if (!frm.doc.work_order) {
        // frm.set_value("custom_sales_order_no", "");
        return;
    }

    frappe.db.get_value(
        "Work Order",
        frm.doc.work_order,
        "sales_order"
    ).then(r => {

        if (r.message && r.message.sales_order) {

            frm.set_value(
                "custom_sales_order_no",
                r.message.sales_order
            );

        } else {

            frm.set_value("custom_sales_order_no", "");
        }
    });
}