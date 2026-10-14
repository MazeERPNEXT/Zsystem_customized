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
    before_submit: function(frm) {
        const estimate = flt(frm.doc.custom_estimate_cost);
        const totalcost = flt(frm.doc.custom_total_cost);

        console.log("Estimate Cost:", estimate);
        console.log("Total Cost:", totalcost);

        if (totalcost > estimate) {
            frappe.throw(
                __("Your Total Cost ({0}) is greater than the Estimate Cost ({1}).", [
                    totalcost,
                    estimate
                ])
            );
        }
    },
    after_save: async function(frm) {
        for (let row of frm.doc.items || []) {
            if (row.item_code) {
                let r = await frappe.db.get_value(
                    "Item",
                    row.item_code,
                    "custom_stock_qty"
                );

                if (r && r.message) {
                    row.custom_item_stock_qty = r.message.custom_stock_qty || 0;
                }
            }
        }

        frm.refresh_field("items");
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
        //Add btn and clear the bom value in so
        if (frm.doc.docstatus == 1 && frm.doc.custom_sales_order_no) {

            frm.add_custom_button(
                __("Clear BOM from Sales Order"),
                function() {

                    frappe.confirm(
                        __("Clear BOM {0} from the Sales Order Item?", [
                            frm.doc.name
                        ]),
                        function() {

                            frappe.call({
                                method: "zsystem_customize.bom.clear_bom_from_sales_order",
                                args: {
                                    bom: frm.doc.name
                                },
                                freeze: true,
                                freeze_message: __("Clearing BOM from Sales Order..."),

                                callback: function(r) {

                                    if (r.message) {

                                        frappe.msgprint(
                                            __("BOM reference cleared from {0} Sales Order Item(s).", [
                                                r.message.cleared_items
                                            ])
                                        );

                                        frm.reload_doc();
                                    }
                                }
                            });

                        }
                    );
                },
                __("Actions")
            );
        }
        const grid = frm.fields_dict.items.grid;

        if (grid.__delete_po_confirmation) {
            return;
        }

        grid.__delete_po_confirmation = true;

        const $wrapper = $(grid.wrapper);

        $wrapper.on(
            "click.bom_po_delete",
            ".es-button__label",
            function (e) {
                if ($(this).text().trim() !== "Delete row") {
                    return;
                }

                const selected_rows = grid.get_selected_children();

                if (!selected_rows || !selected_rows.length) {
                    return;
                }

                const linked_rows = selected_rows.filter(
                    row => row.custom_purchase_order_no
                );

                if (!linked_rows.length) {
                    return;
                }

                // Stop the normal Delete row action
                e.preventDefault();
                e.stopImmediatePropagation();

                const po_numbers = [
                    ...new Set(
                        linked_rows.map(
                            row => row.custom_purchase_order_no
                        )
                    )
                ];

                frappe.confirm(
                    __(
                        "Are you sure you want to delete the selected row(s)? " +
                        "They are linked to Purchase Order(s): {0}",
                        [po_numbers.join(", ")]
                    ),
                    function () {
                        // YES: remove only the selected rows
                        linked_rows.forEach(row => {
                            grid.grid_rows_by_docname[row.name]?.remove();
                        });

                        frm.dirty();
                    },
                    function () {
                        // NO: keep all rows unchanged
                    }
                );
            }
        );
    },

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
    if (frm.is_new()) {
        frappe.msgprint(__("Please save the BOM first."));
        return;
    }

    if (!selected_rows || !selected_rows.length) {
        frappe.msgprint(__("Please select at least one BOM item."));
        return;
    }

    const selected_items = selected_rows.map(row => row.name);

    frappe.call({
        method: "zsystem_customize.bom.get_purchase_order_data_from_bom",
        args: {
            bom: frm.doc.name,
            selected_items: JSON.stringify(selected_items)
        },
        freeze: true,
        freeze_message: __("Fetching selected BOM items..."),

        callback: function(r) {
            if (!r.message) return;

            const data = r.message;

            frappe.model.with_doctype("Purchase Order", function() {
                const po = frappe.model.get_new_doc("Purchase Order");

                po.company = data.company;
                po.custom_sales_order_no = data.custom_sales_order_no;

                data.items.forEach(function(item) {
                    const po_item = frappe.model.add_child(
                        po,
                        "Purchase Order Item",
                        "items"
                    );

                    po_item.custom_bom_item_row = item.bom_item_row;
                    po_item.item_code = item.item_code;
                    po_item.item_name = item.item_name;
                    po_item.description = item.description;
                    po_item.qty = item.qty;
                    po_item.uom = item.uom;
                    po_item.stock_uom = item.stock_uom;
                    po_item.conversion_factor = item.conversion_factor;
                    po_item.rate = item.rate;
                    po_item.warehouse = item.warehouse;
                    po_item.sales_order = item.sales_order;
                    po_item.schedule_date = item.schedule_date;
                    po_item.custom_bom_no = frm.doc.name;
                });

                // Open the new Purchase Order without saving it.
                frappe.set_route("Form", "Purchase Order", po.name);
            });
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

                    mr_item.custom_bom_item_row = item.bom_item_row;
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