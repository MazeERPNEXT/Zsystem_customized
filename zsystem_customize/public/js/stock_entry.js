frappe.ui.form.on("Stock Entry", {
    onload: function(frm) {
        set_sales_order_value(frm);
    },

    work_order: function(frm) {
        set_sales_order_value(frm);
        set_serial_batch_from_work_order(frm);
    },
    refresh: function(frm) {
        if (frm.doc.work_order) {
            set_serial_batch_from_work_order(frm);
        }
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
//based on work order serial no to stock entry serial no
function set_serial_batch_from_work_order(frm) {
    if (!frm.doc.work_order) return;

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Work Order",
            name: frm.doc.work_order
        },
        callback: function(r) {
            if (!r.message) return;

            let required_items = r.message.required_items || [];

            (frm.doc.items || []).forEach(function(row) {
                let required = required_items.find(function(item) {
                    return item.item_code === row.item_code;
                });

                if (required) {
                    if (required.custom_serial_no) {
                        frappe.model.set_value(
                            row.doctype,
                            row.name,
                            "serial_no",
                            required.custom_serial_no
                        );
                    }

                    if (required.custom_batch_no) {
                        frappe.model.set_value(
                            row.doctype,
                            row.name,
                            "batch_no",
                            required.custom_batch_no
                        );
                    }
                }
            });
        }
    });
}