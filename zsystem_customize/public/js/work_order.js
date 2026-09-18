frappe.ui.form.on("Work Order", {
    onload: function(frm) {
        set_sales_order_from_bom(frm);
    },

    bom_no: function(frm) {
        set_sales_order_from_bom(frm);
    }
});


function set_sales_order_from_bom(frm) {

    if (!frm.doc.bom_no) {
        return;
    }

    frappe.db.get_value(
        "BOM",
        frm.doc.bom_no,
        "custom_sales_order_no"
    ).then(r => {

        if (r.message && r.message.custom_sales_order_no) {

            frm.set_value(
                "sales_order",
                r.message.custom_sales_order_no
            );

        }

    });
}