frappe.ui.form.on("BOM", {
    custom_sales_order_no: function(frm) {

        if (!frm.doc.custom_sales_order_no) {
            frm.set_value("item", "");
            return;
        }

        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Sales Order",
                name: frm.doc.custom_sales_order_no
            },
            callback: function(r) {

                if (r.message && r.message.items && r.message.items.length) {

                    // Get first Sales Order item
                    let first_item = r.message.items[0];

                    // Set item_code in BOM Item field
                    frm.set_value("item", first_item.item_code);

                } else {
                    frm.set_value("item", "");
                    frappe.msgprint("No items found in this Sales Order.");
                }
            }
        });
    },

    refresh: function(frm) {

        // Remove existing Purchase Order button
        frm.remove_custom_button(
            __("Purchase Order"),
            __("Create")
        );
        frm.remove_custom_button(
            __("Material Request"),
            __("Create")
        );

        // No items
        if (!frm.doc.items || frm.doc.items.length === 0) {
            return;
        }

        // Add Purchase Order button
        if(frm.doc.docstatus == 0){
            frm.add_custom_button(
                __("Purchase Order"),
                function() {

                    let selected_rows =
                        frm.fields_dict.items.grid.get_selected_children();

                    // No row selected
                    if (!selected_rows || selected_rows.length === 0) {

                        frappe.msgprint(
                            __("Please select at least one item row.")
                        );

                        return;
                    }

                    // Create Purchase Order
                    create_purchase_order(
                        frm,
                        selected_rows
                    );
                },
                __("Create")
            );

        }
        //Add material request button
        if(frm.doc.docstatus == 0){
            frm.add_custom_button(
                __("Material Request"),
                function() {

                    let selected_rows =
                        frm.fields_dict.items.grid.get_selected_children();

                    // No row selected
                    if (!selected_rows || selected_rows.length === 0) {

                        frappe.msgprint(
                            __("Please select at least one item row.")
                        );

                        return;
                    }

                    // Create Purchase Order
                    create_material_request(
                        frm,
                        selected_rows
                    );
                },
                __("Create")
            );

        }

        // Hide button initially
        setTimeout(function() {
            hide_purchase_order_button(frm);
            hide_material_request_button(frm);
        }, 100);

        // Remove old event
        frm.fields_dict.items.grid.wrapper.off(
            "click.purchase_order_selection",
            "click.material_request_selection"
        );

        // Detect row selection
        frm.fields_dict.items.grid.wrapper.on(
            "click.purchase_order_selection",
            ".grid-row-check",
            function() {

                setTimeout(function() {

                    let selected_rows =
                        frm.fields_dict.items.grid.get_selected_children();

                    let btn = frm.page.wrapper
                        .find(".dropdown-menu li")
                        .filter(function() {

                            return $(this)
                                .text()
                                .trim() === __("Purchase Order");

                        });

                    if (selected_rows.length > 0) {
                        btn.show();
                    } else {
                        btn.hide();
                    }

                }, 100);
            }
        );
        frm.fields_dict.items.grid.wrapper.on(
            "click.material_request_selection",
            ".grid-row-check",
            function() {

                setTimeout(function() {

                    let selected_rows =
                        frm.fields_dict.items.grid.get_selected_children();

                    let btn = frm.page.wrapper
                        .find(".dropdown-menu li")
                        .filter(function() {

                            return $(this)
                                .text()
                                .trim() === __("Material Request");

                        });

                    if (selected_rows.length > 0) {
                        btn.show();
                    } else {
                        btn.hide();
                    }

                }, 100);
            }
        );
    }
});

/* Hide Purchase Order button*/
function hide_purchase_order_button(frm) {

    let btn = frm.page.wrapper
        .find(".dropdown-menu li")
        .filter(function() {

            return $(this)
                .text()
                .trim() === __("Purchase Order");

        });

    btn.hide();
}
/* Hide material request button*/
function hide_material_request_button(frm) {

    let btn = frm.page.wrapper
        .find(".dropdown-menu li")
        .filter(function() {

            return $(this)
                .text()
                .trim() === __("Material Request");

        });

    btn.hide();
}

/* Create Purchase Order from selected BOM rows */
function create_purchase_order(frm, selected_rows) {

    // BOM must be saved
    if (frm.is_new()) {

        frappe.msgprint(
            __("Please save the BOM first.")
        );

        return;
    }

    // Get selected BOM row names
    let selected_items = selected_rows.map(function(row) {
        return row.name;
    });

    console.log("Selected BOM Items:", selected_items);

    frappe.call({

        method:
            "zsystem_customize.bom.get_purchase_order_data_from_bom",

        args: {
            bom: frm.doc.name,
            selected_items: JSON.stringify(selected_items)
        },

        freeze: true,

        freeze_message:
            __("Fetching selected BOM items..."),

        callback: function(r) {

            if (!r.message) {
                return;
            }

            let data = r.message;

            /*
             * Create a NEW Purchase Order
             * Nothing is saved automatically.
             */
            frappe.model.with_doctype(
                "Purchase Order",
                function() {

                    let po = frappe.model.get_new_doc(
                        "Purchase Order"
                    );

                    /*
                     * Set only the fields coming
                     * from BOM.
                     */
                    po.company = data.company;
                    po.custom_sales_order_no = data.custom_sales_order_no;

                    /*
                     * Add selected BOM items
                     */
                    data.items.forEach(function(item) {

                        let po_item =
                            frappe.model.add_child(
                                po,
                                "Purchase Order Item",
                                "items"
                            );

                        po_item.item_code =
                            item.item_code;

                        po_item.item_name =
                            item.item_name;

                        po_item.description =
                            item.description;

                        po_item.qty =
                            item.qty;

                        po_item.uom =
                            item.uom;

                        po_item.stock_uom =
                            item.stock_uom;

                        po_item.conversion_factor =
                            item.conversion_factor;

                        po_item.rate =
                            item.rate;

                        po_item.warehouse =
                            item.warehouse;

                        po_item.schedule_date =
                            item.schedule_date;

                        po_item.bom =
                            item.bom;
                    });

                    /*
                     * Open new Purchase Order
                     * without saving.
                     */
                    frappe.set_route(
                        "Form",
                        "Purchase Order",
                        po.name
                    );
                }
            );
        },

        error: function(r) {

            console.error(
                "Failed to fetch BOM items:",
                r
            );

        }
    });
}
//Create material request
function create_material_request(frm, selected_rows) {

    // BOM must be saved
    if (frm.is_new()) {

        frappe.msgprint(
            __("Please save the BOM first.")
        );

        return;
    }

    // Get selected BOM row names
    let selected_items = selected_rows.map(function(row) {
        return row.name;
    });

    console.log("Selected BOM Items:", selected_items);

    frappe.call({

        method:
            "zsystem_customize.bom.get_material_request_data_from_bom",

        args: {
            bom: frm.doc.name,
            selected_items: JSON.stringify(selected_items)
        },

        freeze: true,

        freeze_message:
            __("Fetching selected BOM items..."),

        callback: function(r) {

            if (!r.message) {
                return;
            }

            let data = r.message;

            /*
             * Create a NEW Purchase Order
             * Nothing is saved automatically.
             */
            frappe.model.with_doctype(
                "Material Request",
                function() {

                    let mr = frappe.model.get_new_doc(
                        "Material Request"
                    );

                    /*
                     * Set only the fields coming
                     * from BOM.
                     */
                    mr.company = data.company;
                    mr.custom_sales_order_no = data.custom_sales_order_no;
                    mr.custom_bom_no = data.custom_bom_no;
                    mr.material_request_type = "Material Transfer";
                    mr.set_warehouse = "Factory Store - Z";

                    /*
                     * Add selected BOM items
                     */
                    data.items.forEach(function(item) {

                    let mr_item =
                        frappe.model.add_child(
                            mr,
                            "Material Request Item",
                            "items"
                        );

                    mr_item.item_code =
                        item.item_code;

                    mr_item.item_name =
                        item.item_name;

                    mr_item.description =
                        item.description;

                    mr_item.qty =
                        item.qty;

                    mr_item.uom =
                        item.uom;

                    mr_item.stock_uom =
                        item.stock_uom;

                    mr_item.conversion_factor =
                        item.conversion_factor;

                    mr_item.rate =
                        item.rate;

                    // Warehouse from Item Master custom_warehouse
                    mr_item.from_warehouse =
                        item.from_warehouse;

                    mr_item.schedule_date =
                        item.schedule_date;

                    mr_item.bom =
                        item.bom;
                });

                    /*
                     * Open new Purchase Order
                     * without saving.
                     */
                    frappe.set_route(
                        "Form",
                        "Material Request",
                        mr.name
                    );
                }
            );
        },

        error: function(r) {

            console.error(
                "Failed to fetch BOM items:",
                r
            );

        }
    });
}