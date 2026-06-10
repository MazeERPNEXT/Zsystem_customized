frappe.listview_settings['Delivery Note'] = {
    add_fields: [
        "custom_priority_order",
        "custom_returnable_dc",
        "is_return",
        "status",
        "per_billed"
    ],

    before_render() {
        if (cur_list && cur_list.data) {
            cur_list.data.sort((a, b) => {
                return (a.custom_priority_order || 999) -
                       (b.custom_priority_order || 999);
            });
        }
    },

    get_indicator(doc) {

        if (doc.docstatus === 0) {
            return [__("Draft"), "red", "docstatus,=,0"];
        }

        if (doc.docstatus === 2) {
            return [__("Cancelled"), "red", "docstatus,=,2"];
        }

        if (
            doc.docstatus === 1 &&
            doc.custom_returnable_dc == 1
        ) {

            if (doc.is_return == 1) {
                return [__("Return DC"), "red", "status,=,Return DC"];
            }

            if (doc.status === "Return Issued") {
                return [__("Return Issued"), "grey", "status,=,Return Issued"];
            }

            if (flt(doc.per_billed) >= 100) {
                return [__("Completed"), "green", "status,=,Completed"];
            }

            return [__("Returnable DC"), "orange", "status,=,Returnable DC"];
        }

        if (doc.docstatus === 1) {

            if (doc.status === "Completed") {
                return [__("Completed"), "green", "status,=,Completed"];
            }

            if (doc.status === "Return") {
                return [__("Return"), "grey", "status,=,Return"];
            }

            if (doc.status === "Return Issued") {
                return [__("Return Issued"), "grey", "status,=,Return Issued"];
            }

            if (doc.status === "To Bill") {
                return [__("To Bill"), "orange", "status,=,To Bill"];
            }

            if (doc.status === "Closed") {
                return [__("Closed"), "green", "status,=,Closed"];
            }

            return [__("Submitted"), "blue", "docstatus,=,1"];
        }
    }
};